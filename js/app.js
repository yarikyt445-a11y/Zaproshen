/* ═══════════════════════════════════════════════════════
   App — Main orchestrator
   ═══════════════════════════════════════════════════════ */

(function () {
  let authReady = false;
  let unreadCount = 0;
  let lastPage = '';
  let lastParamsStr = '';

  // ── Main render ──
  async function render() {
    const app = document.getElementById('app');
    if (!app) return;

    const route = ZAP.router.parsePath();
    const user = ZAP.auth.getUser();
    const profile = ZAP.auth.getProfile();

    const isPageChange = (route.page !== lastPage || JSON.stringify(route.params) !== lastParamsStr);

    // Dynamic page title
    const pageTitles = {
      'home': '',
      'create': 'Створити запрошення',
      'profile': 'Профіль',
      'friends': 'Друзі',
      'notifications': 'Сповіщення',
      'dashboard': 'Дашборд',
      'user-profile': 'Профіль користувача',
      'invite': 'Перегляд запрошення',
      'group-invite': 'Групове запрошення',
      'login': 'Вхід',
      'register': 'Реєстрація',
    };
    const titleSuffix = pageTitles[route.page] || '';
    document.title = titleSuffix ? `Запрошення ✦ — ${titleSuffix}` : 'Запрошення ✦ — Безкоштовний додаток для запрошень';

    // Set real-time user action
    if (user && profile && ZAP.dbRef) {
      const pageActions = {
        'home': 'Переглядає свої запрошення',
        'create': 'Створює нове запрошення',
        'profile': 'Редагує налаштування профілю',
        'friends': 'Переглядає список друзів',
        'notifications': 'Переглядає сповіщення',
        'dashboard': 'Керує адмін-дашбордом',
        'user-profile': 'Переглядає профіль користувача',
        'invite': 'Переглядає запрошення',
        'group-invite': 'Переглядає групове запрошення',
      };
      const act = pageActions[route.page] || 'Активний на сайті';
      ZAP.dbRef.ref('users/' + user.uid + '/currentAction').set(act).catch(() => { });
    }

    // ── Invite pages — accessible without auth ──
    if (route.page === 'invite') {
      if (isPageChange) {
        app.innerHTML = ZAP.utils.spinner();
        await ZAP.pages.invite.loadPersonal(route.params.inviteId, route.params.b64);
      }
      app.innerHTML = ZAP.pages.invite.render();
      requestAnimationFrame(() => {
        document.querySelector('.invite-envelope')?.scrollIntoView({ block: 'center' });
      });
      lastPage = route.page;
      lastParamsStr = JSON.stringify(route.params);
      return;
    }

    if (route.page === 'group-invite') {
      if (isPageChange) {
        app.innerHTML = ZAP.utils.spinner();
        await ZAP.pages.invite.loadGroup(route.params.inviteId);
      }
      app.innerHTML = ZAP.pages.invite.render();
      requestAnimationFrame(() => {
        document.querySelector('.invite-envelope')?.scrollIntoView({ block: 'center' });
      });
      lastPage = route.page;
      lastParamsStr = JSON.stringify(route.params);
      return;
    }

    // ── Not yet initialized ──
    if (!authReady) {
      app.innerHTML = `<div class="page-loader"><div class="spinner"></div></div>`;
      return;
    }

    // Update page tracking AFTER authReady check
    lastPage = route.page;
    lastParamsStr = JSON.stringify(route.params);

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
        // Determine ban status text (Task 1)
        let banStatusTitle = 'Назавжди заблокований';
        let banStatusBody = 'Ваш акаунт було <strong>перманентно</strong> заблоковано модератором.';

        if (profile.bannedUntil) {
          const msLeft = profile.bannedUntil - Date.now();
          const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
          const hoursLeft = Math.ceil(msLeft / (60 * 60 * 1000));
          const minsLeft = Math.ceil(msLeft / (60 * 1000));

          banStatusTitle = `Заблокований на ${daysLeft > 1 ? daysLeft + ' ' + (daysLeft <= 4 ? 'дні' : 'днів') : hoursLeft > 1 ? hoursLeft + ' год' : minsLeft + ' хв'}`;

          const untilDate = new Date(profile.bannedUntil);
          const untilStr = untilDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          banStatusBody = `До розблокування залишилось: <strong>${daysLeft > 1 ? daysLeft + ' дн.' : hoursLeft > 1 ? hoursLeft + ' год.' : minsLeft + ' хв.'}</strong><br><span style="color:var(--muted);font-size:.85rem">Розблокування: ${untilStr}</span>`;
        }

        app.innerHTML = `
          <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">
            <div style="text-align:center;max-width:400px">
              <div style="font-size:3rem;margin-bottom:16px"><i class="ph ph-prohibit" style="font-size:3rem"></i></div>
              <h2 style="font-family:var(--font-heading);font-style:italic;margin-bottom:8px">${banStatusTitle}</h2>
              <p style="color:var(--muted);margin-bottom:20px;line-height:1.6">${banStatusBody}</p>
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
      if (isPageChange) {
        app.innerHTML = ZAP.utils.spinner();
        await ZAP.pages.dashboard.load();
      }
      app.innerHTML = ZAP.pages.dashboard.render();
      ZAP.pages.dashboard.drawCharts();
      return;
    }

    // ── User profile ──
    if (route.page === 'user-profile') {
      if (isPageChange) {
        app.innerHTML = renderTopbar(route.page) + '<div class="wrap">' + ZAP.utils.spinner() + '</div>';
        await ZAP.pages.userProfile.load(route.params.uid);
      }
      app.innerHTML = renderTopbar(route.page) + '<div class="wrap">' + ZAP.pages.userProfile.render() + '</div>' + renderFooter(route.page) + (user ? renderBottomNav(route.page) : '');
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
        if (isPageChange) {
          app.innerHTML = renderTopbar(route.page) + '<div class="wrap">' + ZAP.utils.spinner() + '</div>';
          await ZAP.pages.home.load();
        }
        pageContent = ZAP.pages.home.render();
        break;

      case 'create':
        if (isPageChange) {
          app.innerHTML = renderTopbar(route.page) + '<div class="wrap">' + ZAP.utils.spinner() + '</div>';
          await ZAP.pages.create.load();
        }
        pageContent = ZAP.pages.create.render();
        break;

      case 'profile':
        if (isPageChange) {
          app.innerHTML = renderTopbar(route.page) + '<div class="wrap">' + ZAP.utils.spinner() + '</div>';
          await ZAP.pages.profile.load();
        }
        pageContent = ZAP.pages.profile.render();
        break;

      case 'friends':
        if (isPageChange) {
          app.innerHTML = renderTopbar(route.page) + '<div class="wrap">' + ZAP.utils.spinner() + '</div>';
          await ZAP.pages.friends.load();
        }
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
      ${renderFooter(route.page)}
      ${user ? renderBottomNav(route.page) : ''}
    `;

    // Dynamic admin UI injection (not visible to regular users)
    if (user && (ZAP.auth.isAdmin() || ZAP.auth.isModerator())) {
      if (window.ZAP_ADMIN) {
        window.ZAP_ADMIN.addControls(route.page);
      } else {
        const s = document.createElement('script');
        s.src = '/js/admin.js';
        s.onload = function () { window.ZAP_ADMIN.addControls(route.page); };
        document.body.appendChild(s);
      }
    }
  }

  // ── Topbar ──
  function renderTopbar(page) {
    const profile = ZAP.auth.getProfile();
    const { esc, avatarHTML, roleBadge, icon } = ZAP.utils;

    return `
    <header class="topbar">
      <button class="logo" onclick="ZAP.router.go('home')">Запрошення ✦</button>
      <div class="topbar-right">
        <button class="nb ${page === 'home' ? 'on' : ''}" onclick="ZAP.router.go('home')">${icon('house',18)} Мої</button>
        <button class="nb ${page === 'create' ? 'on' : ''}" onclick="ZAP.router.go('create')">+ Нове</button>
        <div class="pill-wrap">
          <button class="nb ${page === 'friends' ? 'on' : ''}" onclick="ZAP.router.go('friends')" aria-label="Друзі">${icon('users',18)}</button>
        </div>
        <div class="pill-wrap">
          <button class="nb ${page === 'notifications' ? 'on' : ''}" onclick="ZAP.router.go('notifications')" aria-label="Сповіщення">${icon('bell',18)}</button>
          ${unreadCount > 0 ? `<span class="notif-badge">${unreadCount}</span>` : ''}
        </div>
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
    const { icon } = ZAP.utils;
    return `
    <nav class="bottom-nav">
      <button class="bn-item ${page === 'home' ? 'on' : ''}" onclick="ZAP.router.go('home')">
        <div style="font-size:1.25rem">${icon('house',22)}</div>
        <span>Мої</span>
      </button>
      <button class="bn-item ${page === 'friends' ? 'on' : ''}" onclick="ZAP.router.go('friends')">
        <div style="font-size:1.25rem">${icon('users',22)}</div>
        <span>Друзі</span>
      </button>
      <button class="bn-item ${page === 'create' ? 'on' : ''}" onclick="ZAP.router.go('create')">
        <div class="bn-fab">+</div>
      </button>
      <button class="bn-item ${page === 'notifications' ? 'on' : ''}" onclick="ZAP.router.go('notifications')" style="position:relative">
        <div style="font-size:1.25rem">${icon('bell',22)}</div>
        ${unreadCount > 0 ? `<span class="notif-badge" style="position:absolute;top:0;right:2px;font-size:.6rem;padding:1px 4px">${unreadCount}</span>` : ''}
        <span>Сповіщ.</span>
      </button>
      <button class="bn-item ${page === 'profile' ? 'on' : ''}" onclick="ZAP.router.go('profile')">
        <div style="font-size:1.25rem">${icon('user',22)}</div>
        <span>Профіль</span>
      </button>
    </nav>`;
  }

  // ── Footer (SEO + links) ──
  function renderFooter(page) {
    if (page !== 'profile') return '';
    return `
    <footer class="seo-footer">
      <div class="seo-footer-links">
        <a href="/about">Про додаток</a>
        <span>·</span>
        <a href="/privacy">Конфіденційність</a>
        <span>·</span>
        <a href="/terms">Умови</a>
      </div>
      <p class="seo-footer-copy">✦ Запрошення — безкоштовний додаток для створення запрошень</p>
    </footer>`;
  }

  // ── In-App Notification Popup ──
  function showNotifPopup(notif) {
    // Remove existing popup if any
    document.querySelectorAll('.notif-popup').forEach(el => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 300);
    });

    const { icon } = ZAP.utils;
    const iconMap = {
      'friend-request': icon('user-plus',24),
      'friend-accepted': icon('check-circle',24),
      'invite': icon('paper-plane-tilt',24),
      'group-invite': icon('users',24),
      'invite-response': icon('chat-circle-dots',24),
      'invite-reschedule': icon('calendar-blank',24),
    };
    const iconHtml = iconMap[notif.type] || icon('bell',24);

    // Clean old broken titles that may contain raw HTML tags
    const cleanTitle = (notif.title || 'Сповіщення').replace(/<[^>]*>/g, '');
    const cleanBody = (notif.body || '').replace(/<[^>]*>/g, '');

    const popup = document.createElement('div');
    popup.className = 'notif-popup';
    popup.innerHTML = `
      <div class="notif-popup-icon">${iconHtml}</div>
      <div class="notif-popup-body">
        <div class="notif-popup-title">${ZAP.utils.esc(cleanTitle)}</div>
        <div class="notif-popup-text">${ZAP.utils.esc(cleanBody)}</div>
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
        <div class="empty-icon"><i class="ph ph-bell-ringing" style="font-size:3rem"></i></div>
        <p style="font-style:italic;font-size:1.05rem">Немає сповіщень</p>
      </div>`;
    }

    const { icon: phIcon } = ZAP.utils;
    const iconMap = {
      'friend-request': phIcon('user-plus',20),
      'friend-accepted': phIcon('check-circle',20),
      'invite': phIcon('paper-plane-tilt',20),
      'group-invite': phIcon('users',20),
      'invite-response': phIcon('chat-circle-dots',20),
      'invite-reschedule': phIcon('calendar-blank',20),
    };

    // Track processed friend requests to prevent duplicate actions
    const processedReqs = new Set();
    // Check which friend requests are already processed (user is already a friend)
    const friends = await ZAP.db.getFriends(user.uid);
    const friendUids = new Set(friends.map(f => f.uid));

    return `
    <h1 class="page-title">Сповіщення</h1>
    <p class="page-subtitle">Ваші останні сповіщення</p>
    ${notifs.map((n, i) => {
      const notifIcon = iconMap[n.type] || phIcon('info',20);
      let actionBtn = '';
      const isProcessed = (n.type === 'friend-request' && n.fromUid && friendUids.has(n.fromUid)) || processedReqs.has(n.fromUid);

      if (n.type === 'friend-request' && n.fromUid) {
        if (isProcessed) {
          actionBtn = `<span class="status-text">Запит прийнято</span>`;
        } else {
          actionBtn = `
            <button class="btn btn-gold btn-sm" 
              onclick="ZAP.pages.friends.acceptReq('${n.fromUid}');processedReqs.add('${n.fromUid}');this.closest('.notif-item').remove()">Прийняти</button>
            <button class="btn btn-outline btn-sm" 
              onclick="ZAP.pages.friends.declineReq('${n.fromUid}');processedReqs.add('${n.fromUid}');this.closest('.notif-item').remove()">Відхилити</button>
          `;
        }
      } else if ((n.type === 'invite' || n.type === 'group-invite') && n.inviteId) {
        const routePage = n.type === 'group-invite' ? 'group-invite' : 'invite';
        actionBtn = n.read
          ? `<span class="status-text" style="color:var(--muted)">Переглянуто</span>`
          : `<button class="btn btn-gold btn-sm" onclick="ZAP.router.go('${routePage}',{id:'${n.inviteId}'})">Переглянути</button>`;
      } else if (n.type === 'friend-accepted' && n.fromUid) {
        actionBtn = `<button class="btn btn-outline btn-sm" onclick="ZAP.router.go('user-profile',{uid:'${n.fromUid}'})">Профіль</button>`;
      }

      return `
      <div class="notif-item ${n.read ? '' : 'unread'} ${isProcessed ? 'processed' : ''}" style="animation-delay:${i * 40}ms">
        <div class="notif-icon">${notifIcon}</div>
        <div class="notif-body">
          <div class="notif-text"><strong>${ZAP.utils.esc(n.title || '')}</strong></div>
          <div class="notif-text">${ZAP.utils.esc(n.body || '')}</div>
          <div class="notif-time">${ZAP.utils.timeAgo(n.createdAt)}</div>
          ${actionBtn ? `<div class="notif-actions">${actionBtn}</div>` : ''}
        </div>
        <button class="notif-delete-btn" title="Видалити" onclick="ZAP.app.deleteNotification('${n.id}', this)">×</button>
      </div>`;
    }).join('')}`;
  }

  // ── Update unread count periodically ──
  async function updateUnreadCount() {
    const user = ZAP.auth.getUser();
    if (!user) { unreadCount = 0; return; }
    unreadCount = await ZAP.notifications.getUnreadCount(user.uid);
    const badge = document.querySelector('.notif-badge');
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
      } else {
        badge.remove();
      }
    } else if (unreadCount > 0) {
      const el = document.createElement('span');
      el.className = 'notif-badge';
      el.textContent = unreadCount;
      const container = document.querySelector('.pill-wrap .nb[aria-label="Сповіщення"]')?.parentElement;
      if (container) container.appendChild(el);
    }
  }

  // ── Task 4: Delete a notification inline without full re-render ──
  async function deleteNotification(notifId, btn) {
    const user = ZAP.auth.getUser();
    if (!user || !notifId) return;
    // Animate out
    const item = btn.closest('.notif-item');
    if (item) {
      item.style.transition = 'opacity 0.2s, transform 0.2s';
      item.style.opacity = '0';
      item.style.transform = 'translateX(20px)';
      setTimeout(() => item.remove(), 220);
    }
    await ZAP.notifications.deleteNotification(user.uid, notifId);
    await updateUnreadCount();
    // Re-render topbar/bottomnav badge without full page reload
    const badge = document.querySelector('.notif-badge');
    if (badge) badge.textContent = unreadCount > 0 ? unreadCount : '';
    if (unreadCount === 0 && badge) badge.remove();
  }

  // ── Init ──
  ZAP.render = render;
  ZAP.app = { deleteNotification, updateUnreadCount };

  // Initialize delegated truncation handler once
  ZAP.utils.initTruncHandler();

  ZAP.auth.onAuthReady(async (user) => {
    authReady = true;
    if (user) {
      await updateUnreadCount();
      // Initialize FCM for push notifications
      ZAP.notifications.initFCM(user.uid);
      // Periodic unread count update
      setInterval(updateUnreadCount, 30000);
      
      // Presence heartbeat: update lastSeen every 45s
      setInterval(() => {
        const u = ZAP.auth.getUser();
        if (u && ZAP.dbRef) {
          ZAP.dbRef.ref('users/' + u.uid + '/lastSeen').set(Date.now()).catch(() => {});
        }
      }, 45000);

      // Start real-time notification listener with popup
      ZAP.notifications.listenNotifications(user.uid, (notif) => {
        showNotifPopup(notif);
      });
      // Request push permission
      ZAP.notifications.requestPushPermission();

      // ── Task 3: Real-time ban status listener ──
      // Watch banned/bannedUntil fields — if admin bans while user is online,
      // they immediately lose access without needing a page reload.
      if (ZAP.dbRef) {
        ZAP.dbRef.ref('users/' + user.uid + '/banned').on('value', snap => {
          const profile = ZAP.auth.getProfile();
          if (!profile) return;
          const newBanned = snap.val();
          if (newBanned === true && !profile.banned) {
            // User just got banned — re-fetch full profile to get bannedUntil, then re-render
            ZAP.dbRef.ref('users/' + user.uid).once('value', fullSnap => {
              if (fullSnap.exists()) {
                const updated = fullSnap.val();
                profile.banned = updated.banned;
                profile.bannedUntil = updated.bannedUntil || null;
              } else {
                profile.banned = true;
              }
              ZAP.render();
            });
          } else if (newBanned === false && profile.banned) {
            // User got unbanned — restore access
            profile.banned = false;
            profile.bannedUntil = null;
            ZAP.render();
          }
        });
      }
    }
    render();
  });
})();
