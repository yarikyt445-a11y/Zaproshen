/* ═══════════════════════════════════════════════════════
   App — Main orchestrator
   ═══════════════════════════════════════════════════════ */

(function () {
  let authReady = false;
  let unreadCount = 0;

  // ── Main render ──
  async function render() {
    const app = document.getElementById('app');
    if (!app) return;

    const route = ZAP.router.parseHash();
    const user = ZAP.auth.getUser();
    const profile = ZAP.auth.getProfile();

    // ── Invite pages — accessible without auth ──
    if (route.page === 'invite') {
      app.innerHTML = ZAP.utils.spinner();
      await ZAP.pages.invite.loadPersonal(route.params.inviteId, route.params.b64);
      app.innerHTML = ZAP.pages.invite.render();
      return;
    }

    if (route.page === 'group-invite') {
      app.innerHTML = ZAP.utils.spinner();
      await ZAP.pages.invite.loadGroup(route.params.inviteId);
      app.innerHTML = ZAP.pages.invite.render();
      return;
    }

    // ── Not yet initialized ──
    if (!authReady) {
      app.innerHTML = `<div class="page-loader"><div class="spinner"></div></div>`;
      return;
    }

    // ── Auth required pages ──
    if (!user && ZAP.router.isAuthRequired(route.page)) {
      app.innerHTML = ZAP.pages.login.render();
      return;
    }

    // ── Login/Register page ──
    if (route.page === 'login' || route.page === 'register') {
      if (user) {
        ZAP.router.go('home');
        return;
      }
      app.innerHTML = ZAP.pages.login.render();
      return;
    }

    // ── Check banned status ──
    if (profile?.banned) {
      if (profile.bannedUntil && Date.now() > profile.bannedUntil) {
        // Auto-unban
        ZAP.db.banUser(user.uid, false);
        profile.banned = false;
        profile.bannedUntil = null;
      } else {
        const untilText = profile.bannedUntil ? `до ${new Date(profile.bannedUntil).toLocaleDateString()}` : 'назавжди';
        app.innerHTML = `
          <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">
            <div style="text-align:center;max-width:400px">
              <div style="font-size:3rem;margin-bottom:16px">🚫</div>
              <h2 style="font-family:var(--font-heading);font-style:italic;margin-bottom:8px">Акаунт заблоковано</h2>
              <p style="color:var(--muted);margin-bottom:20px">Ваш акаунт було заблоковано модератором <strong>${untilText}</strong>.</p>
              <button class="btn btn-outline" onclick="ZAP.pages.profile.doLogout()">Вийти</button>
            </div>
          </div>`;
        return;
      }
    }

    // ── Admin required ──
    if (ZAP.router.isAdminRequired(route.page) && !ZAP.auth.isAdmin() && !ZAP.auth.isModerator()) {
      ZAP.router.go('home');
      return;
    }

    // ── Dashboard (has its own layout) ──
    if (route.page === 'dashboard') {
      app.innerHTML = ZAP.utils.spinner();
      await ZAP.pages.dashboard.load();
      app.innerHTML = ZAP.pages.dashboard.render();
      ZAP.pages.dashboard.drawCharts();
      return;
    }

    // ── User profile ──
    if (route.page === 'user-profile') {
      app.innerHTML = renderTopbar(route.page) + '<div class="wrap">' + ZAP.utils.spinner() + '</div>';
      await ZAP.pages.userProfile.load(route.params.uid);
      app.innerHTML = renderTopbar(route.page) + ZAP.pages.userProfile.render() + (user ? renderBottomNav(route.page) : '');
      return;
    }

    // ── Pages with data loading ──
    let pageContent = '';

    switch (route.page) {
      case 'home':
        if (!ZAP.pages.home._listening) {
          ZAP.pages.home.startListening();
          ZAP.pages.home._listening = true;
        }
        app.innerHTML = renderTopbar(route.page) + '<div class="wrap">' + ZAP.utils.spinner() + '</div>';
        await ZAP.pages.home.load();
        pageContent = ZAP.pages.home.render();
        break;

      case 'create':
        app.innerHTML = renderTopbar(route.page) + '<div class="wrap">' + ZAP.utils.spinner() + '</div>';
        await ZAP.pages.create.load();
        pageContent = ZAP.pages.create.render();
        break;

      case 'profile':
        pageContent = ZAP.pages.profile.render();
        break;

      case 'friends':
        app.innerHTML = renderTopbar(route.page) + '<div class="wrap">' + ZAP.utils.spinner() + '</div>';
        await ZAP.pages.friends.load();
        pageContent = ZAP.pages.friends.render();
        break;

      case 'notifications':
        pageContent = await renderNotifications();
        break;

      default:
        pageContent = ZAP.pages.home.render();
    }

    app.innerHTML = `
      ${renderTopbar(route.page)}
      <div class="wrap">${pageContent}</div>
      ${user ? renderBottomNav(route.page) : ''}
    `;
  }

  // ── Topbar ──
  function renderTopbar(page) {
    const profile = ZAP.auth.getProfile();
    const { esc, avatarHTML, roleBadge } = ZAP.utils;
    const isAdminUser = ZAP.auth.isAdmin() || ZAP.auth.isModerator();

    const fbStatus = ZAP.dbRef
      ? `<span title="Firebase підключено" style="font-size:.7rem;color:var(--muted);display:flex;align-items:center"><span class="fb-dot ok"></span>синх.</span>`
      : `<span title="Firebase не підключено" style="font-size:.7rem;color:var(--red)">⚠ Firebase</span>`;

    return `
    <header class="topbar">
      <button class="logo" onclick="ZAP.router.go('home')">Запрошення ✦</button>
      <div class="topbar-right">
        ${fbStatus}
        <button class="nb ${page === 'home' ? 'on' : ''}" onclick="ZAP.router.go('home')">🏠 Мої</button>
        <button class="nb ${page === 'create' ? 'on' : ''}" onclick="ZAP.router.go('create')">+ Нове</button>
        <div class="pill-wrap">
          <button class="nb ${page === 'friends' ? 'on' : ''}" onclick="ZAP.router.go('friends')">👥</button>
        </div>
        <div class="pill-wrap">
          <button class="nb ${page === 'notifications' ? 'on' : ''}" onclick="ZAP.router.go('notifications')">🔔</button>
          ${unreadCount > 0 ? `<span class="notif-badge">${unreadCount}</span>` : ''}
        </div>
        ${isAdminUser ? `
          <button class="nb ${page === 'dashboard' ? 'on' : ''}" onclick="ZAP.router.go('dashboard')">📊</button>
        ` : ''}
        ${profile ? `
          <div class="topbar-user" onclick="ZAP.router.go('profile')">
            ${avatarHTML(profile, 'sm')}
            <span class="topbar-username">${esc(profile.name)}</span>
          </div>
        ` : `
          <button class="btn btn-outline btn-sm" onclick="ZAP.router.go('login')" style="padding:6px 12px">Увійти</button>
        `}
      </div>
    </header>`;
  }

  // ── Bottom Navigation (Mobile) ──
  function renderBottomNav(page) {
    const isAdminUser = ZAP.auth.isAdmin() || ZAP.auth.isModerator();
    return `
    <nav class="bottom-nav">
      <button class="bn-item ${page === 'home' ? 'on' : ''}" onclick="ZAP.router.go('home')">
        <div style="font-size:1.25rem">🏠</div>
        <span>Мої</span>
      </button>
      <button class="bn-item ${page === 'friends' ? 'on' : ''}" onclick="ZAP.router.go('friends')">
        <div style="font-size:1.25rem">👥</div>
        <span>Друзі</span>
      </button>
      <button class="bn-item ${page === 'create' ? 'on' : ''}" onclick="ZAP.router.go('create')">
        <div class="bn-fab">+</div>
      </button>
      <button class="bn-item ${page === 'notifications' ? 'on' : ''}" onclick="ZAP.router.go('notifications')" style="position:relative">
        <div style="font-size:1.25rem">🔔</div>
        ${unreadCount > 0 ? `<span class="notif-badge" style="position:absolute;top:0;right:2px;font-size:.6rem;padding:1px 4px">${unreadCount}</span>` : ''}
        <span>Сповіщ.</span>
      </button>
      <button class="bn-item ${page === 'profile' || page === 'dashboard' ? 'on' : ''}" onclick="ZAP.router.go('${isAdminUser ? 'dashboard' : 'profile'}')">
        <div style="font-size:1.25rem">${isAdminUser ? '📊' : '👤'}</div>
        <span>${isAdminUser ? 'Панель' : 'Профіль'}</span>
      </button>
    </nav>`;
  }

  // ── In-App Notification Popup ──
  function showNotifPopup(notif) {
    // Remove existing popup if any
    document.querySelectorAll('.notif-popup').forEach(el => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 300);
    });

    const iconMap = {
      'friend-request': '👋',
      'friend-accepted': '✅',
      'invite': '📨',
      'group-invite': '👥',
      'invite-response': '💬',
      'invite-reschedule': '📅',
    };
    const icon = iconMap[notif.type] || '🔔';

    const popup = document.createElement('div');
    popup.className = 'notif-popup';
    popup.innerHTML = `
      <div class="notif-popup-icon">${icon}</div>
      <div class="notif-popup-body">
        <div class="notif-popup-title">${ZAP.utils.esc(notif.title || 'Сповіщення')}</div>
        <div class="notif-popup-text">${ZAP.utils.esc(notif.body || '')}</div>
      </div>
      <button class="notif-popup-close" onclick="event.stopPropagation();this.closest('.notif-popup').classList.add('removing');setTimeout(()=>this.closest('.notif-popup')?.remove(),300)">×</button>
    `;
    popup.onclick = () => {
      popup.classList.add('removing');
      setTimeout(() => popup.remove(), 300);
      // Navigate based on type
      if (notif.type === 'friend-request' || notif.type === 'friend-accepted') {
        ZAP.router.go('friends');
      } else if (notif.type === 'invite' && notif.inviteId) {
        ZAP.router.go('invite', { id: notif.inviteId });
      } else if (notif.type === 'group-invite' && notif.inviteId) {
        ZAP.router.go('group-invite', { id: notif.inviteId });
      } else {
        ZAP.router.go('notifications');
      }
    };
    document.body.appendChild(popup);

    // Auto-remove after 5s
    setTimeout(() => {
      if (popup.parentElement) {
        popup.classList.add('removing');
        setTimeout(() => popup.remove(), 300);
      }
    }, 5000);

    // Update badge count
    updateUnreadCount();
  }

  // ── Notifications page ──
  async function renderNotifications() {
    const user = ZAP.auth.getUser();
    if (!user) return '';

    const notifs = await ZAP.notifications.getNotifications(user.uid);

    // Mark all as read
    await ZAP.notifications.markAllNotifsRead(user.uid);
    unreadCount = 0;

    if (notifs.length === 0) {
      return `
      <h1 class="page-title">Сповіщення</h1>
      <div class="empty">
        <div class="empty-icon">🔔</div>
        <p style="font-style:italic;font-size:1.05rem">Немає сповіщень</p>
      </div>`;
    }

    const iconMap = {
      'friend-request': '👋',
      'friend-accepted': '✓',
      'invite': '📨',
      'group-invite': '👥',
      'invite-response': '💬',
      'invite-reschedule': '📅',
    };

    return `
    <h1 class="page-title">Сповіщення</h1>
    <p class="page-subtitle">Ваші останні сповіщення</p>
    ${notifs.map((n, i) => {
      const icon = iconMap[n.type] || '✦';
      let actionBtn = '';

      if (n.type === 'friend-request' && n.fromUid) {
        actionBtn = `
          <button class="btn btn-gold btn-sm" onclick="ZAP.pages.friends.acceptReq('${n.fromUid}');this.closest('.notif-item').remove()">Прийняти</button>
          <button class="btn btn-outline btn-sm" onclick="ZAP.pages.friends.declineReq('${n.fromUid}');this.closest('.notif-item').remove()">Відхилити</button>
        `;
      } else if ((n.type === 'invite' || n.type === 'group-invite') && n.inviteId) {
        const routePage = n.type === 'group-invite' ? 'group-invite' : 'invite';
        actionBtn = `<button class="btn btn-gold btn-sm" onclick="ZAP.router.go('${routePage}',{id:'${n.inviteId}'})">Переглянути</button>`;
      } else if (n.type === 'friend-accepted' && n.fromUid) {
        actionBtn = `<button class="btn btn-outline btn-sm" onclick="ZAP.router.go('user-profile',{uid:'${n.fromUid}'})">Профіль</button>`;
      }

      return `
      <div class="notif-item ${n.read ? '' : 'unread'}" style="animation-delay:${i * 40}ms">
        <div class="notif-icon">${icon}</div>
        <div class="notif-body">
          <div class="notif-text"><strong>${ZAP.utils.esc(n.title || '')}</strong></div>
          <div class="notif-text">${ZAP.utils.esc(n.body || '')}</div>
          <div class="notif-time">${ZAP.utils.timeAgo(n.createdAt)}</div>
          ${actionBtn ? `<div class="notif-actions">${actionBtn}</div>` : ''}
        </div>
      </div>`;
    }).join('')}`;
  }

  // ── Update unread count periodically ──
  async function updateUnreadCount() {
    const user = ZAP.auth.getUser();
    if (!user) { unreadCount = 0; return; }
    unreadCount = await ZAP.notifications.getUnreadCount(user.uid);
  }

  // ── Init ──
  ZAP.render = render;

  ZAP.auth.onAuthReady(async (user) => {
    authReady = true;
    if (user) {
      await updateUnreadCount();
      // Periodic unread count update
      setInterval(updateUnreadCount, 30000);
      // Start real-time notification listener with popup
      ZAP.notifications.listenNotifications(user.uid, (notif) => {
        showNotifPopup(notif);
      });
      // Request push permission
      ZAP.notifications.requestPushPermission();
    }
    render();
  });
})();
