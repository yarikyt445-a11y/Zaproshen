/* ═══════════════════════════════════════════════════════
   Page — Profile & Settings
   ═══════════════════════════════════════════════════════ */

(function () {
  let editing = null; // 'name' | 'login' | 'password' | null
  let saving = false;

  function render() {
    const profile = ZAP.auth.getProfile();
    if (!profile) return ZAP.utils.spinner();

    const { esc, avatarHTML, roleBadge } = ZAP.utils;

    return `
    <h1 class="page-title">Профіль</h1>
    <p class="page-subtitle">Налаштування вашого акаунту</p>

    <!-- Profile header -->
    <div class="profile-header">
      <div class="profile-avatar-wrap">
        ${avatarHTML(profile, 'xl')}
        <label class="profile-avatar-edit" title="Змінити аватар">
          📷
          <input type="file" accept="image/*" style="display:none"
            onchange="ZAP.pages.profile.uploadAvatar(this.files[0])"/>
        </label>
      </div>
      <div class="profile-info">
        <h2>${esc(profile.name)}</h2>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:4px">
          ${roleBadge(profile.role)}
          <span class="profile-id">${esc(profile.uniqueId)}</span>
        </div>
        <div style="font-size:.82rem;color:var(--muted);margin-top:6px">@${esc(profile.login)}</div>
      </div>
    </div>

    <!-- Personal info section -->
    <div class="profile-section">
      <div class="profile-section-title">Особисті дані</div>

      <!-- Name -->
      <div class="profile-field">
        <div>
          <div class="profile-field-label">Ім'я</div>
          <div class="profile-field-value">${esc(profile.name)}</div>
        </div>
        <button class="btn-outline btn-sm" onclick="ZAP.pages.profile.startEdit('name')">Змінити</button>
      </div>

      <!-- Login -->
      <div class="profile-field">
        <div>
          <div class="profile-field-label">Логін</div>
          <div class="profile-field-value">@${esc(profile.login)}</div>
        </div>
        <button class="btn-outline btn-sm" onclick="ZAP.pages.profile.startEdit('login')">Змінити</button>
      </div>

      <!-- Unique ID -->
      <div class="profile-field">
        <div>
          <div class="profile-field-label">Унікальний ID</div>
          <div class="profile-field-value" style="font-family:monospace">${esc(profile.uniqueId)}</div>
        </div>
        <button class="btn-outline btn-sm"
          onclick="ZAP.utils.copyText('${esc(profile.uniqueId)}', this)">Копіювати</button>
      </div>
    </div>

    <!-- Security section -->
    <div class="profile-section">
      <div class="profile-section-title">Безпека</div>

      <div class="profile-field">
        <div>
          <div class="profile-field-label">Пароль</div>
          <div class="profile-field-value">••••••••</div>
        </div>
        <button class="btn-outline btn-sm" onclick="ZAP.pages.profile.startEdit('password')">Змінити</button>
      </div>
    </div>

    <!-- Stats section -->
    <div class="profile-section">
      <div class="profile-section-title">Статистика</div>
      <div class="profile-field">
        <div class="profile-field-label">Дата реєстрації</div>
        <div class="profile-field-value">${ZAP.utils.formatDate(new Date(profile.createdAt).toISOString().split('T')[0])}</div>
      </div>
    </div>

    <!-- Danger zone -->
    <div class="profile-section" style="border-color:rgba(192,57,43,.2)">
      <div class="profile-section-title" style="color:var(--red)">Небезпечна зона</div>
      <p style="font-size:.88rem;color:var(--muted);margin-bottom:14px">
        Видалення акаунту є незворотнім. Усі ваші дані будуть стерті.
      </p>
      <button class="btn btn-red btn-sm" onclick="ZAP.pages.profile.confirmDelete()">
        🗑 Видалити акаунт
      </button>
    </div>

    <!-- Logout -->
    <div style="text-align:center;margin-top:16px">
      <button class="btn-ghost" onclick="ZAP.pages.profile.doLogout()" style="color:var(--red)">
        Вийти з акаунту
      </button>
    </div>

    ${editing ? renderEditModal() : ''}`;
  }

  function renderEditModal() {
    const profile = ZAP.auth.getProfile();
    let title, body;

    if (editing === 'name') {
      title = 'Змінити ім\'я';
      body = `
        <div class="form-group">
          <label class="lbl">Нове ім'я</label>
          <input id="edit-name" value="${ZAP.utils.esc(profile.name)}" placeholder="Ваше ім'я"/>
        </div>
        <div class="form-error" id="edit-error"></div>
        <button class="btn btn-dark btn-full" onclick="ZAP.pages.profile.saveName()" ${saving ? 'disabled' : ''}>
          ${saving ? '⏳...' : 'Зберегти'}
        </button>`;
    } else if (editing === 'login') {
      title = 'Змінити логін';
      body = `
        <div class="form-group">
          <label class="lbl">Новий логін</label>
          <input id="edit-login" value="${ZAP.utils.esc(profile.login)}" placeholder="Логін (латиниця, цифри, _)"/>
        </div>
        <p style="font-size:.8rem;color:var(--muted);margin-bottom:12px">
          ⚠ Після зміни логіну потрібно буде входити з новим логіном
        </p>
        <div class="form-error" id="edit-error"></div>
        <button class="btn btn-dark btn-full" onclick="ZAP.pages.profile.saveLogin()" ${saving ? 'disabled' : ''}>
          ${saving ? '⏳...' : 'Зберегти'}
        </button>`;
    } else if (editing === 'password') {
      title = 'Змінити пароль';
      body = `
        <div class="form-group">
          <label class="lbl">Поточний пароль</label>
          <input id="edit-old-pass" type="password" placeholder="Ваш поточний пароль"/>
        </div>
        <div class="form-group">
          <label class="lbl">Новий пароль</label>
          <input id="edit-new-pass" type="password" placeholder="Мінімум 6 символів"/>
        </div>
        <div class="form-group">
          <label class="lbl">Підтвердити новий пароль</label>
          <input id="edit-new-pass2" type="password" placeholder="Повторіть новий пароль"/>
        </div>
        <div class="form-error" id="edit-error"></div>
        <button class="btn btn-dark btn-full" onclick="ZAP.pages.profile.savePassword()" ${saving ? 'disabled' : ''}>
          ${saving ? '⏳...' : 'Зберегти'}
        </button>`;
    }

    return `
    <div class="overlay" onclick="ZAP.pages.profile.cancelEdit()">
      <div class="modal" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
          <h3 class="modal-title" style="margin-bottom:0">${title}</h3>
          <button onclick="ZAP.pages.profile.cancelEdit()"
            style="background:none;border:none;font-size:1.3rem;color:var(--muted)">×</button>
        </div>
        ${body}
      </div>
    </div>`;
  }

  function startEdit(field) { editing = field; saving = false; ZAP.render(); }
  function cancelEdit() { editing = null; saving = false; ZAP.render(); }

  function showEditError(msg) {
    const el = document.getElementById('edit-error');
    if (el) { el.textContent = msg; el.classList.add('show'); }
  }

  async function saveName() {
    const name = document.getElementById('edit-name')?.value.trim();
    if (!name || name.length < 2) { showEditError('Ім\'я має бути не менше 2 символів'); return; }

    saving = true; ZAP.render();
    try {
      await ZAP.auth.updateProfile(ZAP.auth.getUser().uid, { name });
      // Update in friends lists
      const friends = await ZAP.db.getFriends(ZAP.auth.getUser().uid);
      for (const f of friends) {
        await ZAP.dbRef.ref('friends/' + f.uid + '/' + ZAP.auth.getUser().uid + '/name').set(name);
      }
      editing = null; saving = false;
      ZAP.utils.toast('Ім\'я змінено ✓', 'success');
      ZAP.render();
    } catch (e) {
      saving = false; ZAP.render();
      setTimeout(() => showEditError(e.message || 'Помилка'), 50);
    }
  }

  async function saveLogin() {
    const newLogin = document.getElementById('edit-login')?.value.trim();
    if (!newLogin) { showEditError('Введіть логін'); return; }

    saving = true; ZAP.render();
    try {
      await ZAP.auth.changeLogin(newLogin);
      editing = null; saving = false;
      ZAP.utils.toast('Логін змінено ✓', 'success');
      ZAP.render();
    } catch (e) {
      saving = false; ZAP.render();
      setTimeout(() => showEditError(e.message || 'Помилка'), 50);
    }
  }

  async function savePassword() {
    const oldPass = document.getElementById('edit-old-pass')?.value;
    const newPass = document.getElementById('edit-new-pass')?.value;
    const newPass2 = document.getElementById('edit-new-pass2')?.value;

    if (!oldPass || !newPass) { showEditError('Заповніть всі поля'); return; }
    if (newPass !== newPass2) { showEditError('Паролі не співпадають'); return; }

    saving = true; ZAP.render();
    try {
      await ZAP.auth.changePassword(oldPass, newPass);
      editing = null; saving = false;
      ZAP.utils.toast('Пароль змінено ✓', 'success');
      ZAP.render();
    } catch (e) {
      saving = false; ZAP.render();
      let msg = e.message || 'Помилка';
      if (e.code === 'auth/wrong-password') msg = 'Невірний поточний пароль';
      setTimeout(() => showEditError(msg), 50);
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    try {
      ZAP.utils.toast('Завантаження аватару...', 'info');
      await ZAP.auth.uploadAvatar(file);
      ZAP.utils.toast('Аватар оновлено ✓', 'success');
      ZAP.render();
    } catch (e) {
      ZAP.utils.toast(e.message || 'Помилка завантаження', 'error');
    }
  }

  function confirmDelete() {
    const modal = document.createElement('div');
    modal.className = 'overlay';
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()">
        <h3 class="modal-title" style="color:var(--red)">🗑 Видалити акаунт?</h3>
        <p style="color:var(--muted);font-size:.9rem;margin-bottom:16px">
          Ця дія незворотня. Всі ваші дані, запрошення та друзі будуть видалені.
        </p>
        <div class="form-group">
          <label class="lbl">Введіть пароль для підтвердження</label>
          <input id="delete-pass" type="password" placeholder="Ваш пароль"/>
        </div>
        <div class="form-error" id="delete-error"></div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-red btn-full" onclick="ZAP.pages.profile.doDelete()">Так, видалити</button>
          <button class="btn btn-outline btn-full" onclick="this.closest('.overlay').remove()">Скасувати</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  async function doDelete() {
    const pass = document.getElementById('delete-pass')?.value;
    if (!pass) {
      const el = document.getElementById('delete-error');
      if (el) { el.textContent = 'Введіть пароль'; el.classList.add('show'); }
      return;
    }
    try {
      await ZAP.auth.deleteAccount(pass);
      ZAP.utils.toast('Акаунт видалено', 'info');
      ZAP.router.go('login');
    } catch (e) {
      const el = document.getElementById('delete-error');
      let msg = e.message || 'Помилка';
      if (e.code === 'auth/wrong-password') msg = 'Невірний пароль';
      if (el) { el.textContent = msg; el.classList.add('show'); }
    }
  }

  async function doLogout() {
    await ZAP.auth.logout();
    ZAP.utils.toast('Ви вийшли з акаунту', 'info');
    ZAP.router.go('login');
  }

  ZAP.pages = ZAP.pages || {};
  ZAP.pages.profile = {
    render, startEdit, cancelEdit,
    saveName, saveLogin, savePassword,
    uploadAvatar, confirmDelete, doDelete, doLogout,
  };
})();
