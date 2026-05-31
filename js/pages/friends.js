/* ═══════════════════════════════════════════════════════
   Page — Friends & Friend Requests
   ═══════════════════════════════════════════════════════ */

(function () {
  let friends = [];
  let requests = [];
  let searchResult = null;
  let searchLoading = false;
  let tab = 'friends'; // 'friends' | 'requests' | 'invites'
  let friendInvites = []; // invites from friends
  let loaded = false;

  async function load() {
    const user = ZAP.auth.getUser();
    if (!user) return;
    friends = await ZAP.db.getFriends(user.uid);
    requests = await ZAP.db.getFriendRequests(user.uid);

    // Load friend invites from notifications
    const notifs = await ZAP.notifications.getNotifications(user.uid);
    friendInvites = notifs.filter(n =>
      (n.type === 'invite' || n.type === 'group-invite')
    );

    loaded = true;
  }

  function render() {
    const { esc, avatarHTML } = ZAP.utils;

    return `
    <h1 class="page-title">Друзі</h1>
    <p class="page-subtitle">Додавайте друзів та надсилайте запрошення напряму</p>

    <!-- Search by ID -->
    <div class="friend-search">
      <input id="friend-search-input" placeholder="Введіть ID (наприклад ZAP-A7F3K2)"
        onkeydown="if(event.key==='Enter')ZAP.pages.friends.search()"/>
      <button class="btn btn-dark" onclick="ZAP.pages.friends.search()" ${searchLoading ? 'disabled' : ''}>
        ${searchLoading ? '⏳' : '🔍 Знайти'}
      </button>
    </div>

    ${searchResult !== null ? renderSearchResult() : ''}

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab ${tab === 'friends' ? 'active' : ''}"
        onclick="ZAP.pages.friends.setTab('friends')">
        👥 Друзі ${friends.length > 0 ? `(${friends.length})` : ''}
      </button>
      <button class="tab ${tab === 'requests' ? 'active' : ''}"
        onclick="ZAP.pages.friends.setTab('requests')">
        👋 Запити ${requests.length > 0 ? `(${requests.length})` : ''}
      </button>
      <button class="tab ${tab === 'invites' ? 'active' : ''}"
        onclick="ZAP.pages.friends.setTab('invites')">
        📨 Запрошення ${friendInvites.length > 0 ? `(${friendInvites.length})` : ''}
      </button>
    </div>

    ${!loaded ? ZAP.utils.spinner() : renderTab()}`;
  }

  function renderTab() {
    if (tab === 'requests') return renderRequests();
    if (tab === 'invites') return renderFriendInvites();
    return renderFriendsList();
  }

  function renderFriendsList() {
    if (friends.length === 0) {
      return `
      <div class="empty">
        <div class="empty-icon">👥</div>
        <p style="font-style:italic;font-size:1.05rem;margin-bottom:8px">Ще немає друзів</p>
        <p style="font-size:.88rem;color:var(--muted)">Знайдіть друзів за їх унікальним ID</p>
      </div>`;
    }

    return friends.map((f, i) => {
      const { esc, avatarHTML } = ZAP.utils;
      return `
      <div class="friend-card" style="animation-delay:${i * 40}ms">
        ${avatarHTML(f)}
        <div class="friend-info">
          <div class="friend-name">${esc(f.name)}</div>
        </div>
        <div class="friend-actions">
          <button class="btn-icon" title="Профіль"
            onclick="ZAP.router.go('user-profile', {uid:'${f.uid}'})">👤</button>
          <button class="btn-icon" title="Запросити"
            onclick="ZAP.router.go('create')">✉</button>
          <button class="btn-icon" title="Видалити з друзів" style="color:var(--red)"
            onclick="ZAP.pages.friends.removeFriend('${f.uid}','${esc(f.name)}')">✕</button>
        </div>
      </div>`;
    }).join('');
  }

  function renderRequests() {
    if (requests.length === 0) {
      return `
      <div class="empty">
        <div class="empty-icon">👋</div>
        <p style="font-style:italic;font-size:1.05rem">Немає запитів на дружбу</p>
      </div>`;
    }

    return requests.map((req, i) => `
      <div class="friend-card" style="animation-delay:${i * 40}ms">
        <div class="avatar">${(req.fromName || '?').charAt(0).toUpperCase()}</div>
        <div class="friend-info">
          <div class="friend-name">${ZAP.utils.esc(req.fromName)}</div>
          <div style="font-size:.78rem;color:var(--muted)">${ZAP.utils.timeAgo(req.sentAt)}</div>
        </div>
        <div class="friend-actions">
          <button class="btn btn-gold btn-sm"
            onclick="ZAP.pages.friends.acceptReq('${req.fromUid}')">✓ Прийняти</button>
          <button class="btn btn-outline btn-sm"
            onclick="ZAP.pages.friends.declineReq('${req.fromUid}')">✕</button>
        </div>
      </div>
    `).join('');
  }

  function renderFriendInvites() {
    if (friendInvites.length === 0) {
      return `
      <div class="empty">
        <div class="empty-icon">📨</div>
        <p style="font-style:italic;font-size:1.05rem;margin-bottom:8px">Немає запрошень від друзів</p>
        <p style="font-size:.88rem;color:var(--muted)">Коли друзі надішлють вам запрошення, вони з'являться тут</p>
      </div>`;
    }

    return friendInvites.map((n, i) => `
      <div class="notif-item unread" style="animation-delay:${i * 40}ms">
        <div class="notif-icon">${n.type === 'group-invite' ? '👥' : '📨'}</div>
        <div class="notif-body">
          <div class="notif-text">${ZAP.utils.esc(n.body)}</div>
          <div class="notif-time">${ZAP.utils.timeAgo(n.createdAt)}</div>
          <div class="notif-actions">
            ${n.inviteId ? `
              <button class="btn btn-gold btn-sm"
                onclick="ZAP.router.go('${n.type === 'group-invite' ? 'group-invite' : 'invite'}', {id:'${n.inviteId}'})">
                Переглянути
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderSearchResult() {
    if (searchResult === 'not-found') {
      return `
      <div style="background:var(--red-bg);border-radius:10px;padding:14px 18px;margin-bottom:20px;animation:fadeUp .3s ease">
        <p style="font-size:.9rem;color:var(--red)">❌ Користувача з таким ID не знайдено</p>
      </div>`;
    }

    if (searchResult === 'self') {
      return `
      <div style="background:var(--warm);border-radius:10px;padding:14px 18px;margin-bottom:20px;animation:fadeUp .3s ease">
        <p style="font-size:.9rem;color:var(--muted)">😅 Це ваш власний ID</p>
      </div>`;
    }

    if (searchResult && typeof searchResult === 'object') {
      const { esc, avatarHTML, roleBadge } = ZAP.utils;
      return `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:20px;animation:fadeUp .3s ease">
        <div style="display:flex;align-items:center;gap:14px">
          ${avatarHTML(searchResult)}
          <div style="flex:1">
            <div style="font-weight:600">${esc(searchResult.name)}</div>
            <div style="font-size:.78rem;color:var(--muted)">${esc(searchResult.uniqueId)}</div>
          </div>
          <button class="btn btn-dark btn-sm"
            onclick="ZAP.router.go('user-profile', {uid:'${searchResult.uid}'})">
            Профіль →
          </button>
        </div>
      </div>`;
    }

    return '';
  }

  function setTab(t) {
    tab = t;
    ZAP.render();
  }

  async function search() {
    const input = document.getElementById('friend-search-input');
    const query = input?.value.trim();
    if (!query) return;

    searchLoading = true;
    searchResult = null;
    ZAP.render();

    try {
      const user = await ZAP.db.getUserById(query.toUpperCase());
      if (!user) {
        searchResult = 'not-found';
      } else if (user.uid === ZAP.auth.getUser()?.uid) {
        searchResult = 'self';
      } else {
        searchResult = user;
      }
    } catch {
      searchResult = 'not-found';
    }

    searchLoading = false;
    ZAP.render();
  }

  async function acceptReq(fromUid) {
    const me = ZAP.auth.getUser();
    if (!me) return;
    try {
      await ZAP.db.acceptFriendRequest(me.uid, fromUid);
      requests = requests.filter(r => r.fromUid !== fromUid);
      friends = await ZAP.db.getFriends(me.uid);
      await ZAP.notifications.deleteNotificationsByPayload(me.uid, 'friend-request', 'fromUid', fromUid);
      ZAP.utils.toast('Друга додано ✓', 'success');
      ZAP.render();
    } catch (e) {
      ZAP.utils.toast(e.message || 'Помилка', 'error');
    }
  }

  async function declineReq(fromUid) {
    const me = ZAP.auth.getUser();
    if (!me) return;
    await ZAP.db.declineFriendRequest(me.uid, fromUid);
    requests = requests.filter(r => r.fromUid !== fromUid);
    await ZAP.notifications.deleteNotificationsByPayload(me.uid, 'friend-request', 'fromUid', fromUid);
    ZAP.render();
  }

  async function removeFriend(friendUid, friendName) {
    if (!confirm(`Видалити ${friendName} з друзів?`)) return;
    const me = ZAP.auth.getUser();
    if (!me) return;
    await ZAP.db.removeFriend(me.uid, friendUid);
    friends = friends.filter(f => f.uid !== friendUid);
    ZAP.utils.toast('Видалено з друзів', 'info');
    ZAP.render();
  }

  ZAP.pages = ZAP.pages || {};
  ZAP.pages.friends = {
    render, load, setTab, search, acceptReq, declineReq, removeFriend,
  };
})();
