/* ═══════════════════════════════════════════════════════
   Page — Login / Register
   ═══════════════════════════════════════════════════════ */

(function () {
  let activeTab = 'login'; // 'login' | 'register'
  let loading = false;

  function render() {
    const { esc } = ZAP.utils;
    return `
    <div class="auth-bg">
      <div class="auth-card">

        <div class="auth-header">
          <span class="auth-header-icon">✦</span>
          <div class="auth-header-title">Запрошення</div>
          <div class="auth-header-sub">Створюйте та надсилайте запрошення на зустрічі</div>
        </div>

        <div class="auth-body">
          <div class="auth-tabs">
            <button class="auth-tab ${activeTab === 'login' ? 'active' : ''}"
              onclick="ZAP.pages.login.setTab('login')">Вхід</button>
            <button class="auth-tab ${activeTab === 'register' ? 'active' : ''}"
              onclick="ZAP.pages.login.setTab('register')">Реєстрація</button>
          </div>

          ${activeTab === 'login' ? renderLoginForm() : renderRegisterForm()}
        </div>

      </div>
    </div>`;
  }

  function renderLoginForm() {
    return `
    <div class="auth-form" id="login-form">
      <div>
        <label class="lbl">Логін</label>
        <input id="login-login" type="text" placeholder="Ваш логін" autocomplete="username"
          onkeydown="if(event.key==='Enter')ZAP.pages.login.doLogin()"/>
      </div>
      <div>
        <label class="lbl">Пароль</label>
        <input id="login-pass" type="password" placeholder="Ваш пароль" autocomplete="current-password"
          onkeydown="if(event.key==='Enter')ZAP.pages.login.doLogin()"/>
      </div>
      <div class="form-error" id="login-error"></div>
      <button class="btn btn-dark btn-full" id="login-btn"
        onclick="ZAP.pages.login.doLogin()" ${loading ? 'disabled' : ''}>
        ${loading ? '⏳ Зачекайте...' : 'Увійти →'}
      </button>
      <div class="auth-footer">
        Ще немає акаунту?
        <button onclick="ZAP.pages.login.setTab('register')">Зареєструватися</button>
      </div>
    </div>`;
  }

  function renderRegisterForm() {
    return `
    <div class="auth-form" id="register-form">
      <div>
        <label class="lbl">Ім'я</label>
        <input id="reg-name" type="text" placeholder="Як вас звати?" autocomplete="name"/>
      </div>
      <div>
        <label class="lbl">Логін</label>
        <input id="reg-login" type="text" placeholder="Латиниця, цифри, _ (мін. 3)" autocomplete="username"/>
      </div>
      <div>
        <label class="lbl">Пароль</label>
        <input id="reg-pass" type="password" placeholder="Мінімум 6 символів" autocomplete="new-password"/>
      </div>
      <div>
        <label class="lbl">Пароль ще раз</label>
        <input id="reg-pass2" type="password" placeholder="Повторіть пароль" autocomplete="new-password"
          onkeydown="if(event.key==='Enter')ZAP.pages.login.doRegister()"/>
      </div>
      <div class="form-error" id="reg-error"></div>
      <button class="btn btn-dark btn-full" id="reg-btn"
        onclick="ZAP.pages.login.doRegister()" ${loading ? 'disabled' : ''}>
        ${loading ? '⏳ Зачекайте...' : 'Створити акаунт →'}
      </button>
      <div class="auth-footer">
        Вже маєте акаунт?
        <button onclick="ZAP.pages.login.setTab('login')">Увійти</button>
      </div>
    </div>`;
  }

  function setTab(tab) {
    activeTab = tab;
    loading = false;
    ZAP.render();
  }

  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.classList.add('show'); }
  }

  async function doLogin() {
    const loginVal = document.getElementById('login-login')?.value?.trim();
    const passVal = document.getElementById('login-pass')?.value;

    if (!loginVal || !passVal) {
      showError('login-error', 'Заповніть всі поля');
      return;
    }

    loading = true;
    ZAP.render();

    try {
      await ZAP.auth.login(loginVal, passVal);
      ZAP.utils.toast('Ласкаво просимо! ✦', 'success');
      ZAP.router.go('home');
    } catch (e) {
      loading = false;
      ZAP.render();
      // Wait for DOM update then show error
      setTimeout(() => {
        let msg = 'Помилка входу';
        if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
          msg = 'Невірний логін або пароль';
        } else if (e.code === 'auth/too-many-requests') {
          msg = 'Забагато спроб. Спробуйте пізніше';
        } else if (e.message) {
          msg = e.message;
        }
        showError('login-error', msg);
      }, 50);
    }
  }

  async function doRegister() {
    const name = document.getElementById('reg-name')?.value?.trim();
    const login = document.getElementById('reg-login')?.value?.trim();
    const pass = document.getElementById('reg-pass')?.value;
    const pass2 = document.getElementById('reg-pass2')?.value;

    if (!name || !login || !pass || !pass2) {
      showError('reg-error', 'Заповніть всі поля');
      return;
    }
    if (pass !== pass2) {
      showError('reg-error', 'Паролі не співпадають');
      return;
    }

    loading = true;
    ZAP.render();

    try {
      const profile = await ZAP.auth.register(name, login, pass);
      ZAP.utils.toast(`Ласкаво просимо, ${profile.name}! ✦`, 'success');
      ZAP.router.go('home');
    } catch (e) {
      loading = false;
      ZAP.render();
      setTimeout(() => {
        let msg = e.message || 'Помилка реєстрації';
        if (e.code === 'auth/email-already-in-use') {
          msg = 'Цей логін вже зайнятий';
        }
        showError('reg-error', msg);
      }, 50);
    }
  }

  ZAP.pages = ZAP.pages || {};
  ZAP.pages.login = { render, setTab, doLogin, doRegister };
})();
