/* ═══════════════════════════════════════════════════════
   Auth — Registration, Login, Session
   ═══════════════════════════════════════════════════════ */

(function () {
  // Special logins → auto-assign roles
  const SPECIAL_ROLES = {
    'dinospike': 'founder',
    'yarikyt445': 'founder',
    'dimitrio': 'founder',
  };

  // ── State ──
  let currentUser = null;   // Firebase Auth user
  let currentProfile = null; // Our user profile from DB

  function getUser() { return currentUser; }
  function getProfile() { return currentProfile; }

  function isAdmin() {
    const role = currentProfile?.role;
    const special = currentProfile ? SPECIAL_ROLES[currentProfile.login] : null;
    return role === 'founder' || role === 'tech-admin' || special === 'founder' || special === 'tech-admin';
  }

  function isModerator() {
    const special = currentProfile ? SPECIAL_ROLES[currentProfile.login] : null;
    return isAdmin() || currentProfile?.role === 'moderator' || special === 'moderator';
  }

  // ── Register ──
  async function register(name, login, password) {
    if (!ZAP.authInstance || !ZAP.dbRef) throw new Error('Firebase не ініціалізовано');

    login = login.trim().toLowerCase();
    name = name.trim();

    if (!name || name.length < 2) throw new Error('Ім\'я має бути не менше 2 символів');
    if (!login || login.length < 3) throw new Error('Логін має бути не менше 3 символів');
    if (!/^[a-z0-9_]+$/.test(login)) throw new Error('Логін: тільки латиниця, цифри, _');
    if (!password || password.length < 6) throw new Error('Пароль має бути не менше 6 символів');

    // Check login uniqueness
    const existing = await ZAP.dbRef.ref('logins/' + login).get();
    if (existing.exists()) throw new Error('Цей логін вже зайнятий');

    // Create Firebase Auth user (login@zap.app as fake email)
    const email = login + '@zap.app';
    const cred = await ZAP.authInstance.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    // Generate unique public ID
    let uniqueId = ZAP.utils.genUserId();
    let idCheck = await ZAP.dbRef.ref('ids/' + uniqueId).get();
    while (idCheck.exists()) {
      uniqueId = ZAP.utils.genUserId();
      idCheck = await ZAP.dbRef.ref('ids/' + uniqueId).get();
    }

    // Determine role
    const role = SPECIAL_ROLES[login] || 'user';

    // Save profile
    const profile = {
      uid,
      name,
      login,
      uniqueId,
      role,
      avatar: null,
      createdAt: Date.now(),
      lastSeen: Date.now(),
    };

    await ZAP.dbRef.ref('users/' + uid).set(profile);
    await ZAP.dbRef.ref('logins/' + login).set(uid);
    await ZAP.dbRef.ref('ids/' + uniqueId).set(uid);

    currentProfile = profile;
    return profile;
  }

  // ── Login ──
  async function login(login, password) {
    if (!ZAP.authInstance) throw new Error('Firebase не ініціалізовано');

    login = login.trim().toLowerCase();
    const email = login + '@zap.app';

    await ZAP.authInstance.signInWithEmailAndPassword(email, password);
    // Profile will be loaded by onAuthStateChanged
  }

  // ── Logout ──
  async function logout() {
    if (!ZAP.authInstance) return;
    ZAP.notifications.stopListeningNotifications();
    await ZAP.authInstance.signOut();
    currentUser = null;
    currentProfile = null;
  }

  // ── Load profile ──
  async function loadProfile(uid) {
    if (!ZAP.dbRef) return null;
    try {
      const snap = await ZAP.dbRef.ref('users/' + uid).get();
      return snap.exists() ? snap.val() : null;
    } catch (e) {
      console.warn('loadProfile:', e);
      return null;
    }
  }

  // ── Update profile ──
  async function updateProfile(uid, updates) {
    if (!ZAP.dbRef) return;
    await ZAP.dbRef.ref('users/' + uid).update(updates);
    if (uid === currentUser?.uid) {
      currentProfile = { ...currentProfile, ...updates };
    }
  }

  // ── Change login ──
  async function changeLogin(newLogin) {
    if (!currentUser || !currentProfile) throw new Error('Не авторизовано');
    newLogin = newLogin.trim().toLowerCase();

    if (!/^[a-z0-9_]+$/.test(newLogin)) throw new Error('Логін: тільки латиниця, цифри, _');
    if (newLogin.length < 3) throw new Error('Логін має бути не менше 3 символів');

    // Check uniqueness
    const existing = await ZAP.dbRef.ref('logins/' + newLogin).get();
    if (existing.exists()) throw new Error('Цей логін вже зайнятий');

    const oldLogin = currentProfile.login;

    // Update email in Firebase Auth
    const newEmail = newLogin + '@zap.app';
    // Try modern method first, fall back to deprecated for compat
    if (currentUser.verifyBeforeUpdateEmail) {
      try { await currentUser.verifyBeforeUpdateEmail(newEmail); } catch {
        await currentUser.updateEmail(newEmail);
      }
    } else {
      await currentUser.updateEmail(newEmail);
    }

    // Update DB
    await ZAP.dbRef.ref('logins/' + oldLogin).remove();
    await ZAP.dbRef.ref('logins/' + newLogin).set(currentUser.uid);
    await updateProfile(currentUser.uid, { login: newLogin });
  }

  // ── Change password ──
  async function changePassword(oldPassword, newPassword) {
    if (!currentUser || !currentProfile) throw new Error('Не авторизовано');
    if (newPassword.length < 6) throw new Error('Пароль має бути не менше 6 символів');

    // Reauthenticate
    const email = currentProfile.login + '@zap.app';
    const cred = firebase.auth.EmailAuthProvider.credential(email, oldPassword);
    await currentUser.reauthenticateWithCredential(cred);

    await currentUser.updatePassword(newPassword);
  }

  // ── Upload avatar ──
  async function uploadAvatar(file) {
    if (!ZAP.dbRef || !currentUser) throw new Error('Недоступно');

    // Validate file
    if (!file.type.startsWith('image/')) throw new Error('Тільки зображення');
    if (file.size > 5 * 1024 * 1024) throw new Error('Максимум 5 МБ');

    // Resize on client and convert to Base64
    const base64Url = await resizeImageToBase64(file, 256);

    // Save URL (Base64 string) in profile inside Realtime DB
    await updateProfile(currentUser.uid, { avatar: base64Url });

    // Оновити аватар у всіх друзів
    try {
      const friendsSnap = await ZAP.dbRef.ref('friends/' + currentUser.uid).get();
      if (friendsSnap.exists()) {
        const updates = {};
        friendsSnap.forEach(child => {
          updates['friends/' + child.key + '/' + currentUser.uid + '/avatar'] = base64Url;
        });
        if (Object.keys(updates).length > 0) await ZAP.dbRef.ref().update(updates);
      }
    } catch (e) { console.warn('avatar sync:', e); }

    return base64Url;
  }

  // ── Resize image on client to Base64 ──
  function resizeImageToBase64(file, maxSize) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const reader = new FileReader();

      reader.onload = e => {
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
          else { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85)); // Returns Base64 string
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Delete account ──
  async function deleteAccount(password) {
    if (!currentUser || !currentProfile) throw new Error('Не авторизовано');

    // Reauthenticate
    const email = currentProfile.login + '@zap.app';
    const cred = firebase.auth.EmailAuthProvider.credential(email, password);
    await currentUser.reauthenticateWithCredential(cred);

    const uid = currentUser.uid;
    const login_val = currentProfile.login;
    const uniqueId = currentProfile.uniqueId;

    // Remove data from DB
    await ZAP.dbRef.ref('users/' + uid).remove();
    await ZAP.dbRef.ref('logins/' + login_val).remove();
    await ZAP.dbRef.ref('ids/' + uniqueId).remove();
    await ZAP.dbRef.ref('notifications/' + uid).remove();
    await ZAP.dbRef.ref('friends/' + uid).remove();
    await ZAP.dbRef.ref('friend-requests/' + uid).remove();

    // Delete auth account
    await currentUser.delete();
    currentUser = null;
    currentProfile = null;
  }

  // ── Auth state listener ──
  function onAuthReady(callback) {
    if (!ZAP.authInstance) {
      callback(null);
      return;
    }
    ZAP.authInstance.onAuthStateChanged(async user => {
      currentUser = user;
      if (user) {
        currentProfile = await loadProfile(user.uid);
        // Update lastSeen
        if (currentProfile) {
          ZAP.dbRef.ref('users/' + user.uid + '/lastSeen').set(Date.now()).catch(() => { });
        }
        // Start listening for notifications
        ZAP.notifications.listenNotifications(user.uid, () => {
          if (ZAP.render) ZAP.render();
        });
        ZAP.notifications.requestPushPermission();
      } else {
        currentProfile = null;
        ZAP.notifications.stopListeningNotifications();
      }
      callback(user);
    });
  }

  ZAP.auth = {
    getUser, getProfile, isAdmin, isModerator,
    register, login, logout,
    loadProfile, updateProfile,
    changeLogin, changePassword,
    uploadAvatar, deleteAccount,
    onAuthReady,
  };
})();
