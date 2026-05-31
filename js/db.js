/* ═══════════════════════════════════════════════════════
   DB — CRUD operations for all entities
   ═══════════════════════════════════════════════════════ */

(function () {
  const db = () => ZAP.dbRef;

  // ═══════════════════════════════════════════════════════
  // Users
  // ═══════════════════════════════════════════════════════

  async function getUserByUid(uid) {
    if (!db()) return null;
    const snap = await db().ref('users/' + uid).get();
    return snap.exists() ? snap.val() : null;
  }

  async function getUserByLogin(login) {
    if (!db()) return null;
    const uidSnap = await db().ref('logins/' + login.toLowerCase()).get();
    if (!uidSnap.exists()) return null;
    return getUserByUid(uidSnap.val());
  }

  async function getUserById(uniqueId) {
    if (!db()) return null;
    const uidSnap = await db().ref('ids/' + uniqueId).get();
    if (!uidSnap.exists()) return null;
    return getUserByUid(uidSnap.val());
  }

  async function getAllUsers(limit = 100) {
    if (!db()) return [];
    const snap = await db().ref('users').orderByChild('createdAt').limitToLast(limit).get();
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(c => list.push(c.val()));
    return list.reverse();
  }

  async function updateUserRole(uid, newRole) {
    if (!db()) return;
    await db().ref('users/' + uid + '/role').set(newRole);
  }

  async function banUser(uid, banned) {
    if (!db()) return;
    await db().ref('users/' + uid + '/banned').set(banned);
    if (banned) {
      await db().ref('users/' + uid + '/bannedAt').set(Date.now());
    } else {
      await db().ref('users/' + uid + '/bannedAt').remove();
    }
  }

  // ═══════════════════════════════════════════════════════
  // Invitations (personal)
  // ═══════════════════════════════════════════════════════

  async function createInvite(inv) {
    if (!db()) return;
    await db().ref('invites/' + inv.id).set(inv);
    await db().ref('statuses/' + inv.id).set('pending');
    // Save to user's invite list
    if (inv.creatorUid) {
      await db().ref('user-invites/' + inv.creatorUid + '/' + inv.id).set({
        id: inv.id, to: inv.to, type: inv.type,
        date: inv.date, time: inv.time, status: 'pending',
        created: inv.created,
      });
    }
  }

  async function getInvite(invId) {
    if (!db()) return null;
    const snap = await db().ref('invites/' + invId).get();
    return snap.exists() ? snap.val() : null;
  }

  async function getUserInvites(uid) {
    if (!db()) return [];
    const snap = await db().ref('user-invites/' + uid).get();
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(c => list.push(c.val()));
    return list.sort((a, b) => (b.created || 0) - (a.created || 0));
  }

  async function updateInviteStatus(invId, status, uid) {
    if (!db()) return;
    await db().ref('statuses/' + invId).set(status);
    // Update in user's invite list
    if (uid) {
      await db().ref('user-invites/' + uid + '/' + invId + '/status').set(status);
    }
  }

  async function deleteInvite(invId, uid) {
    if (!db()) return;
    await db().ref('invites/' + invId).remove();
    await db().ref('statuses/' + invId).remove();
    await db().ref('reschedule/' + invId).remove();
    if (uid) {
      await db().ref('user-invites/' + uid + '/' + invId).remove();
    }
  }

  // ── Reschedule ──
  async function saveReschedule(invId, data) {
    if (!db()) return;
    await db().ref('reschedule/' + invId).set({ ...data, ts: Date.now() });
    await db().ref('statuses/' + invId).set('reschedule');
  }

  async function getReschedule(invId) {
    if (!db()) return null;
    const snap = await db().ref('reschedule/' + invId).get();
    return snap.exists() ? snap.val() : null;
  }

  // ═══════════════════════════════════════════════════════
  // Group Invitations
  // ═══════════════════════════════════════════════════════

  async function createGroupInvite(inv) {
    if (!db()) return;
    await db().ref('group-invites/' + inv.id).set(inv);
    // Save to creator's list
    if (inv.creatorUid) {
      await db().ref('user-invites/' + inv.creatorUid + '/' + inv.id).set({
        id: inv.id, type: inv.type, date: inv.date, time: inv.time,
        status: 'pending', created: inv.created, isGroup: true,
        title: inv.title || '',
      });
    }
  }

  async function getGroupInvite(invId) {
    if (!db()) return null;
    const snap = await db().ref('group-invites/' + invId).get();
    return snap.exists() ? snap.val() : null;
  }

  async function joinGroupInvite(invId, participant) {
    if (!db()) return;
    const key = participant.uid || participant.name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
    await db().ref('group-invites/' + invId + '/members/' + key).set({
      name: participant.name,
      uid: participant.uid || null,
      status: participant.status || 'accepted',
      joinedAt: Date.now(),
    });
  }

  async function updateGroupMemberStatus(invId, memberKey, status) {
    if (!db()) return;
    await db().ref('group-invites/' + invId + '/members/' + memberKey + '/status').set(status);
  }

  // Send group invite to friends via notifications
  async function sendGroupInviteToFriends(invId, friendUids, invData) {
    for (const fuid of friendUids) {
      await db().ref('group-invites/' + invId + '/invited/' + fuid).set({
        status: 'pending', sentAt: Date.now(),
      });
      // Send notification
      await ZAP.notifications.addNotification(fuid, {
        type: 'group-invite',
        title: '📨 Групове запрошення',
        body: `${invData.creatorName} запрошує вас: ${invData.title || ZAP.utils.TYPE_MAP[invData.type]?.l || 'Зустріч'}`,
        inviteId: invId,
        fromUid: invData.creatorUid,
        fromName: invData.creatorName,
      });
    }
  }

  // ═══════════════════════════════════════════════════════
  // Friends
  // ═══════════════════════════════════════════════════════

  async function sendFriendRequest(fromUid, toUid, fromName) {
    if (!db()) return;
    // Check if already friends
    const existing = await db().ref('friends/' + fromUid + '/' + toUid).get();
    if (existing.exists()) throw new Error('Вже у друзях');

    // Check if request already sent
    const req = await db().ref('friend-requests/' + toUid + '/' + fromUid).get();
    if (req.exists()) throw new Error('Запит вже надіслано');

    await db().ref('friend-requests/' + toUid + '/' + fromUid).set({
      fromUid, fromName, sentAt: Date.now(),
    });

    // Check if they already sent request to us (auto-accept)
    const reverse = await db().ref('friend-requests/' + fromUid + '/' + toUid).get();
    if (reverse.exists()) {
      await acceptFriendRequest(fromUid, toUid);
      return 'auto-accepted';
    }

    // Notification
    await ZAP.notifications.addNotification(toUid, {
      type: 'friend-request',
      title: '👋 Запит на дружбу',
      body: `${fromName} хоче додати вас у друзі`,
      fromUid, fromName,
    });

    return 'sent';
  }

  async function acceptFriendRequest(myUid, fromUid) {
    if (!db()) return;
    const myProfile = await getUserByUid(myUid);
    const theirProfile = await getUserByUid(fromUid);

    // Add both ways
    await db().ref('friends/' + myUid + '/' + fromUid).set({
      uid: fromUid, name: theirProfile?.name || '', addedAt: Date.now(),
    });
    await db().ref('friends/' + fromUid + '/' + myUid).set({
      uid: myUid, name: myProfile?.name || '', addedAt: Date.now(),
    });

    // Remove requests both ways
    await db().ref('friend-requests/' + myUid + '/' + fromUid).remove();
    await db().ref('friend-requests/' + fromUid + '/' + myUid).remove();

    // Notification
    await ZAP.notifications.addNotification(fromUid, {
      type: 'friend-accepted',
      title: '✓ Запит прийнято',
      body: `${myProfile?.name || 'Хтось'} прийняв вашу пропозицію дружби`,
      fromUid: myUid, fromName: myProfile?.name || '',
    });
  }

  async function declineFriendRequest(myUid, fromUid) {
    if (!db()) return;
    await db().ref('friend-requests/' + myUid + '/' + fromUid).remove();
  }

  async function removeFriend(myUid, friendUid) {
    if (!db()) return;
    await db().ref('friends/' + myUid + '/' + friendUid).remove();
    await db().ref('friends/' + friendUid + '/' + myUid).remove();
  }

  async function getFriends(uid) {
    if (!db()) return [];
    const snap = await db().ref('friends/' + uid).get();
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(c => list.push(c.val()));
    
    // Fetch avatars for friends
    for (const f of list) {
      const pf = await getUserByUid(f.uid);
      if (pf && pf.avatarBase64) f.avatarBase64 = pf.avatarBase64;
      if (pf && pf.name) f.name = pf.name; // always get latest name too
    }
    return list;
  }

  async function getFriendRequests(uid) {
    if (!db()) return [];
    const snap = await db().ref('friend-requests/' + uid).get();
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(c => list.push(c.val()));
    return list;
  }

  // ═══════════════════════════════════════════════════════
  // Reports / Complaints
  // ═══════════════════════════════════════════════════════

  async function createReport(report) {
    if (!db()) return;
    const ref = db().ref('reports').push();
    await ref.set({
      id: ref.key,
      ...report,
      status: 'pending', // pending, resolved, dismissed
      createdAt: Date.now(),
    });
  }

  async function getReports() {
    if (!db()) return [];
    const snap = await db().ref('reports').orderByChild('createdAt').get();
    if (!snap.exists()) return [];
    const list = [];
    snap.forEach(c => list.push(c.val()));
    return list.reverse();
  }

  async function resolveReport(reportId, action, moderatorUid) {
    if (!db()) return;
    await db().ref('reports/' + reportId).update({
      status: action, // 'resolved' or 'dismissed'
      resolvedBy: moderatorUid,
      resolvedAt: Date.now(),
    });
  }

  // ═══════════════════════════════════════════════════════
  // Stats (for dashboard)
  // ═══════════════════════════════════════════════════════

  async function getStats() {
    if (!db()) return {};
    
    let usersSnap = null, invitesSnap = null, groupSnap = null, reportsSnap = null;
    let statusesSnap = null;
    
    try { usersSnap = await db().ref('users').get(); } catch (e) { console.warn('users stats:', e); }
    try { invitesSnap = await db().ref('invites').get(); } catch (e) { console.warn('invites stats:', e); }
    try { groupSnap = await db().ref('group-invites').get(); } catch (e) { console.warn('groups stats:', e); }
    try { reportsSnap = await db().ref('reports').orderByChild('status').equalTo('pending').get(); } catch (e) { console.warn('reports stats:', e); }
    try { statusesSnap = await db().ref('statuses').get(); } catch (e) { console.warn('statuses stats:', e); }

    const users = [];
    if (usersSnap && usersSnap.exists()) usersSnap.forEach(c => users.push(c.val()));

    let totalInvites = 0, accepted = 0;
    if (invitesSnap && invitesSnap.exists()) invitesSnap.forEach(() => totalInvites++);
    if (groupSnap && groupSnap.exists()) groupSnap.forEach(() => totalInvites++);

    // Count active users (last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const activeUsers = users.filter(u => u.lastSeen > weekAgo).length;

    // Accepted invites
    if (statusesSnap && statusesSnap.exists()) {
      statusesSnap.forEach(c => { if (c.val() === 'accepted') accepted++; });
    }

    return {
      totalUsers: users.length,
      totalInvites,
      acceptedInvites: accepted,
      activeUsers,
      pendingReports: (reportsSnap && reportsSnap.exists()) ? reportsSnap.numChildren() : 0,
      users,
    };
  }

  // ═══════════════════════════════════════════════════════
  // Real-time listeners
  // ═══════════════════════════════════════════════════════

  function listenStatuses(uid, callback) {
    if (!db()) return;
    db().ref('statuses').on('value', snap => {
      callback(snap.val() || {});
    });
  }

  function listenUserInvites(uid, callback) {
    if (!db()) return;
    db().ref('user-invites/' + uid).on('value', snap => {
      const list = [];
      if (snap.exists()) snap.forEach(c => list.push(c.val()));
      callback(list.sort((a, b) => (b.created || 0) - (a.created || 0)));
    });
  }

  function stopListening(path) {
    if (!db()) return;
    db().ref(path).off();
  }

  // ═══════════════════════════════════════════════════════
  // Invite via friend (direct, no link needed)
  // ═══════════════════════════════════════════════════════

  async function sendInviteToFriend(inv, friendUid) {
    if (!db()) return;
    // Save invite
    await createInvite(inv);
    // Send notification
    await ZAP.notifications.addNotification(friendUid, {
      type: 'invite',
      title: '📨 Нове запрошення',
      body: `${inv.from || 'Хтось'} запрошує вас: ${ZAP.utils.TYPE_MAP[inv.type]?.l || 'Зустріч'}`,
      inviteId: inv.id,
      fromUid: inv.creatorUid,
      fromName: inv.from || '',
    });
  }

  ZAP.db = {
    // Users
    getUserByUid, getUserByLogin, getUserById, getAllUsers, updateUserRole, banUser,
    // Invites
    createInvite, getInvite, getUserInvites, updateInviteStatus, deleteInvite,
    saveReschedule, getReschedule,
    // Group invites
    createGroupInvite, getGroupInvite, joinGroupInvite,
    updateGroupMemberStatus, sendGroupInviteToFriends,
    // Friends
    sendFriendRequest, acceptFriendRequest, declineFriendRequest,
    removeFriend, getFriends, getFriendRequests,
    // Reports
    createReport, getReports, resolveReport,
    // Stats
    getStats,
    // Real-time
    listenStatuses, listenUserInvites, stopListening,
    // Direct invite
    sendInviteToFriend,
  };
})();
