/* ═══════════════════════════════════════════════════════
   Router — Hash-based SPA router
   ═══════════════════════════════════════════════════════ */

(function () {
  function parseHash() {
    const h = location.hash.slice(1);
    if (!h || h === '/') return { page: 'home', params: {} };

    // Invite: #i/{id}
    if (h.startsWith('i/')) {
      const val = h.slice(2);
      const isShortId = val.length <= 14 && !/[=+/]/.test(val);
      return {
        page: 'invite',
        params: { inviteId: isShortId ? val : null, b64: isShortId ? null : val }
      };
    }

    // Group invite: #g/{id}
    if (h.startsWith('g/')) {
      return { page: 'group-invite', params: { inviteId: h.slice(2) } };
    }

    // User profile: #user/{uid}
    if (h.startsWith('user/')) {
      return { page: 'user-profile', params: { uid: h.slice(5) } };
    }

    // Simple pages
    const simple = ['create', 'login', 'register', 'profile', 'friends', 'dashboard', 'notifications'];
    if (simple.includes(h)) return { page: h, params: {} };

    return { page: 'home', params: {} };
  }

  function go(page, params) {
    if (page === 'invite' && params?.id) {
      location.hash = 'i/' + params.id;
    } else if (page === 'group-invite' && params?.id) {
      location.hash = 'g/' + params.id;
    } else if (page === 'user-profile' && params?.uid) {
      location.hash = 'user/' + params.uid;
    } else if (page === 'home') {
      location.hash = '';
    } else {
      location.hash = page;
    }
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

  window.addEventListener('hashchange', () => {
    if (ZAP.render) ZAP.render();
  });

  ZAP.router = { parseHash, go, isAuthRequired, isAdminRequired };
})();
