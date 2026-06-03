/* ═══════════════════════════════════════════════════════
   Router — History-based SPA router
   ═══════════════════════════════════════════════════════ */

(function () {
  function parsePath() {
    const p = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (!p) return { page: 'home', params: {} };

    // Invite: /i/{id}
    if (p.startsWith('i/')) {
      const val = p.slice(2);
      const isShortId = val.length <= 14 && !/[=+/]/.test(val);
      return {
        page: 'invite',
        params: { inviteId: isShortId ? val : null, b64: isShortId ? null : val }
      };
    }

    // Group invite: /g/{id}
    if (p.startsWith('g/')) {
      return { page: 'group-invite', params: { inviteId: p.slice(2) } };
    }

    // User profile: /user/{uid}
    if (p.startsWith('user/')) {
      return { page: 'user-profile', params: { uid: p.slice(5) } };
    }

    // Simple pages
    const simple = ['create', 'login', 'register', 'profile', 'friends', 'dashboard', 'notifications'];
    if (simple.includes(p)) return { page: p, params: {} };

    return { page: 'home', params: {} };
  }

  function go(page, params) {
    let path = '/';
    if (page === 'invite' && params?.id) {
      path = '/i/' + params.id;
    } else if (page === 'group-invite' && params?.id) {
      path = '/g/' + params.id;
    } else if (page === 'user-profile' && params?.uid) {
      path = '/user/' + params.uid;
    } else if (page !== 'home') {
      path = '/' + page;
    }

    if (window.location.pathname === path) return;
    history.pushState({}, '', path);
    if (ZAP.render) ZAP.render();
  }

  // Pages that require authentication
  const AUTH_REQUIRED = ['home', 'create', 'profile', 'friends', 'dashboard', 'notifications'];
  // Pages that require admin/founder role
  const ADMIN_REQUIRED = ['dashboard'];

  function isAuthRequired(page) {
    return AUTH_REQUIRED.includes(page);
  }

  function isAdminRequired(page) {
    return ADMIN_REQUIRED.includes(page);
  }

  window.addEventListener('popstate', () => {
    if (ZAP.render) ZAP.render();
  });

  // Keep parseHash as alias for backward compatibility
  ZAP.router = { parseHash: parsePath, parsePath, go, isAuthRequired, isAdminRequired };
})();
