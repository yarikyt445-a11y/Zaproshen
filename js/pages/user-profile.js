/* ═══════════════════════════════════════════════════════
   Page — View Other User's Profile
   ═══════════════════════════════════════════════════════ */

(function () {
  let userData = null;
  let friendStatus = 'none'; // 'none' | 'friend' | 'pending-sent' | 'pending-received'
  let loading = true;

  async function load(uid) {
    loading = true;
    userData = null;
    friendStatus = 'none';

    userData = await ZAP.db.getUserByUid(uid);

    // Check friend status
    const me = ZAP.auth.getUser();
    if (me && userData) {
      const friendSnap = await ZAP.dbRef.ref('friends/' + me.uid + '/' + uid).get();
      if (friendSnap.exists()) {
        friendStatus = 'friend';
      } else {
        // Check pending requests
        try {
          const sentSnap = await ZAP.dbRef.ref('friend-requests/' + uid + '/' + me.uid).get();
          if (sentSnap.exists()) {
            friendStatus = 'pending-sent';
          } else {
            const recvSnap = await ZAP.dbRef.ref('friend-requests/' + me.uid + '/' + uid).get();
            if (recvSnap.exists()) {
              friendStatus = 'pending-received';
            }
          }
        } catch (e) {
          console.warn('Friend request check:', e.message);
        }
      }
    }

    loading = false;
  }

  function render() {
    if (loading) return ZAP.utils.spinner();

    if (!userData) {
      return `
      <div class="wrap">
        <div class="empty">
          <div class="empty-icon">🍂</div>
          <p style="font-style:italic;font-size:1.05rem">Користувача не знайдено</p>
        </div>
      </div>`;
    }

    const { esc, avatarHTML, roleBadge } = ZAP.utils;
    const me = ZAP.auth.getUser();
    const isMe = me && me.uid === userData.uid;

    return `
    <div class="wrap">
      <button class="btn-outline" style="margin-bottom:20px" onclick="history.back()">← Назад</button>

      <div class="user-profile-card">
        ${avatarHTML(userData, 'xl')}
        <div class="user-profile-name">${esc(userData.name)}</div>
        <div style="margin-bottom:4px">${roleBadge(userData.role)}</div>
        <div class="profile-id" style="margin-bottom:16px">${esc(userData.uniqueId)}</div>

        ${!isMe && me ? `
          <div class="user-profile-actions">
            ${renderFriendButton()}
            <button class="btn btn-gold btn-sm"
              onclick="ZAP.router.go('create')">
              ✉ Запросити
            </button>
          </div>
        ` : ''}

        ${isMe ? `
          <div style="margin-top:12px">
            <button class="btn btn-outline btn-sm" onclick="ZAP.router.go('profile')">
              ⚙ Налаштування
            </button>
          </div>
        ` : ''}
      </div>
    </div>`;
  }

  function renderFriendButton() {
    switch (friendStatus) {
      case 'friend':
        return `<button class="btn btn-outline btn-sm" style="color:var(--green);border-color:var(--green)" disabled>
          ✓ У друзях
        </button>`;
      case 'pending-sent':
        return `<button class="btn btn-outline btn-sm" disabled>
          ⏳ Запит надіслано
        </button>`;
      case 'pending-received':
        return `<button class="btn btn-gold btn-sm"
          onclick="ZAP.pages.userProfile.acceptRequest()">
          ✓ Прийняти запит
        </button>`;
      default:
        return `<button class="btn btn-dark btn-sm"
          onclick="ZAP.pages.userProfile.addFriend()">
          👋 Додати в друзі
        </button>`;
    }
  }

  async function addFriend() {
    const me = ZAP.auth.getUser();
    const myProfile = ZAP.auth.getProfile();
    if (!me || !userData) return;

    try {
      const result = await ZAP.db.sendFriendRequest(me.uid, userData.uid, myProfile.name);
      if (result === 'auto-accepted') {
        friendStatus = 'friend';
        ZAP.utils.toast(`${userData.name} тепер ваш друг! ✓`, 'success');
      } else {
        friendStatus = 'pending-sent';
        ZAP.utils.toast('Запит надіслано ✓', 'success');
      }
      ZAP.render();
    } catch (e) {
      ZAP.utils.toast(e.message || 'Помилка', 'error');
    }
  }

  async function acceptRequest() {
    const me = ZAP.auth.getUser();
    if (!me || !userData) return;

    try {
      await ZAP.db.acceptFriendRequest(me.uid, userData.uid);
      friendStatus = 'friend';
      ZAP.utils.toast(`${userData.name} тепер ваш друг! ✓`, 'success');
      ZAP.render();
    } catch (e) {
      ZAP.utils.toast(e.message || 'Помилка', 'error');
    }
  }

  ZAP.pages = ZAP.pages || {};
  ZAP.pages.userProfile = { render, load, addFriend, acceptRequest };
})();
