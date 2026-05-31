/* ═══════════════════════════════════════════════════════
   Notifications — Push + In-App
   ═══════════════════════════════════════════════════════ */

(function () {
  // ── Push permissions ──
  function requestPushPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function sendPush(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: 'https://files.catbox.moe/0m8wur.png',
          badge: 'https://files.catbox.moe/0m8wur.png',
        });
      } catch (e) { console.warn('Push:', e); }
    }
  }

  // ── In-app notifications (stored in Firebase) ──
  async function addNotification(toUid, data) {
    if (!ZAP.dbRef || !toUid) return;
    try {
      const ref = ZAP.dbRef.ref('notifications/' + toUid).push();
      await ref.set({
        id: ref.key,
        ...data,
        read: false,
        createdAt: Date.now(),
      });
    } catch (e) { console.warn('addNotification:', e); }
  }

  async function getNotifications(uid) {
    if (!ZAP.dbRef || !uid) return [];
    try {
      const snap = await ZAP.dbRef.ref('notifications/' + uid)
        .orderByChild('createdAt').limitToLast(50).get();
      if (!snap.exists()) return [];
      const list = [];
      snap.forEach(c => { list.push(c.val()); });
      return list.reverse();
    } catch (e) { console.warn('getNotifications:', e); return []; }
  }

  async function markNotifRead(uid, notifId) {
    if (!ZAP.dbRef) return;
    try {
      await ZAP.dbRef.ref('notifications/' + uid + '/' + notifId + '/read').set(true);
    } catch (e) { console.warn('markNotifRead:', e); }
  }

  async function markAllNotifsRead(uid) {
    if (!ZAP.dbRef || !uid) return;
    try {
      const snap = await ZAP.dbRef.ref('notifications/' + uid).get();
      if (!snap.exists()) return;
      const updates = {};
      snap.forEach(c => {
        const type = c.val().type;
        if (type !== 'invite' && type !== 'group-invite' && type !== 'friend-request') {
          updates[c.key + '/read'] = true;
        }
      });
      if (Object.keys(updates).length > 0) {
        await ZAP.dbRef.ref('notifications/' + uid).update(updates);
      }
    } catch (e) { console.warn('markAllNotifsRead:', e); }
  }

  async function deleteNotification(uid, notifId) {
    if (!ZAP.dbRef || !uid || !notifId) return;
    try {
      await ZAP.dbRef.ref('notifications/' + uid + '/' + notifId).remove();
    } catch (e) { console.warn('deleteNotification:', e); }
  }

  async function deleteNotificationsByPayload(uid, type, payloadKey, payloadVal) {
    if (!ZAP.dbRef || !uid) return;
    try {
      const snap = await ZAP.dbRef.ref('notifications/' + uid).orderByChild('type').equalTo(type).get();
      if (!snap.exists()) return;
      const updates = {};
      snap.forEach(c => {
        if (c.val()[payloadKey] === payloadVal) {
          updates[c.key] = null;
        }
      });
      await ZAP.dbRef.ref('notifications/' + uid).update(updates);
    } catch (e) { console.warn('deleteNotificationsByPayload:', e); }
  }

  function getUnreadCount(uid) {
    return new Promise(resolve => {
      if (!ZAP.dbRef || !uid) return resolve(0);
      ZAP.dbRef.ref('notifications/' + uid).orderByChild('read').equalTo(false)
        .once('value', snap => resolve(snap.numChildren()))
        .catch(() => resolve(0));
    });
  }

  // ── Listen for new notifications in real-time ──
  let _notifListener = null;
  function listenNotifications(uid, callback) {
    if (!ZAP.dbRef || !uid) return;
    stopListeningNotifications();
    _notifListener = ZAP.dbRef.ref('notifications/' + uid)
      .orderByChild('createdAt').limitToLast(1);
    _notifListener.on('child_added', snap => {
      const n = snap.val();
      if (n && !n.read && Date.now() - n.createdAt < 10000) {
        // New notification just arrived
        sendPush(n.title || 'Сповіщення', n.body || '');
        if (callback) callback(n);
      }
    });
  }

  function stopListeningNotifications() {
    if (_notifListener) {
      _notifListener.off();
      _notifListener = null;
    }
  }

  ZAP.notifications = {
    requestPushPermission, sendPush,
    addNotification, getNotifications, deleteNotification, deleteNotificationsByPayload,
    markNotifRead, markAllNotifsRead, getUnreadCount,
    listenNotifications, stopListeningNotifications,
  };
})();
