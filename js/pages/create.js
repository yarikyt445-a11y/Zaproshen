/* ═══════════════════════════════════════════════════════
   Page — Create Invitation (Personal + Group)
   ═══════════════════════════════════════════════════════ */

(function () {
  let mode = 'personal'; // 'personal' | 'group'
  let isPublic = true;
  let requireAuth = false;
  let selectedFriends = [];
  let friends = [];
  let done = false;
  let createdInv = null;
  let formState = {};

  async function load() {
    const user = ZAP.auth.getUser();
    if (user) {
      friends = await ZAP.db.getFriends(user.uid);
    }
  }

  function render() {
    const { esc, TYPES } = ZAP.utils;
    const today = new Date().toISOString().split('T')[0];
    const profile = ZAP.auth.getProfile();

    if (done && createdInv) return renderDone();

    return `
    <h1 class="page-title">Нове запрошення</h1>
    <p class="page-subtitle">Заповніть деталі — посилання буде готове миттєво</p>

    <!-- Mode switcher -->
    <div class="tabs" style="margin-bottom:28px">
      <button class="tab ${mode === 'personal' ? 'active' : ''}"
        onclick="ZAP.pages.create.setMode('personal')">👤 Персональне</button>
      <button class="tab ${mode === 'group' ? 'active' : ''}"
        onclick="ZAP.pages.create.setMode('group')">👥 Групове</button>
    </div>

    <div id="cform" style="display:flex;flex-direction:column;gap:24px">

      ${mode === 'group' ? `
        <div>
          <label class="lbl">Назва зустрічі</label>
          <input id="f-title" placeholder="Наприклад: Вечірка на день народження" value="${ZAP.utils.esc(formState.title || '')}" oninput="ZAP.pages.create.chk()"/>
        </div>
      ` : `
        <div>
          <label class="lbl">Кому</label>
          <input id="f-to" placeholder="Ім'я отримувача" value="${ZAP.utils.esc(formState.to || '')}" oninput="ZAP.pages.create.chk()"/>
        </div>
      `}

      <div>
        <label class="lbl">Ваше повідомлення</label>
        <textarea id="f-msg" placeholder="Напишіть своїми словами — що хочете, куди запрошуєте…"
          style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;background:#fff;font-size:1rem" oninput="ZAP.pages.create.chk()">${ZAP.utils.esc(formState.msg || '')}</textarea>
      </div>

      <div>
        <label class="lbl">Тип події</label>
        <select id="f-type" onchange="ZAP.pages.create.chk()">
          ${TYPES.map(o => `<option value="${o.v}" ${formState.type === o.v ? 'selected' : ''}>${o.e} ${o.l}</option>`).join('')}
        </select>
      </div>

      <div class="grid2">
        <div><label class="lbl">Дата</label><input type="date" id="f-date" min="${today}" value="${formState.date || ''}" oninput="ZAP.pages.create.chk()"/></div>
        <div><label class="lbl">Час</label><input type="time" id="f-time" value="${formState.time || ''}" oninput="ZAP.pages.create.chk()"/></div>
      </div>

      <div>
        <label class="lbl">Місце</label>
        <input id="f-place" placeholder="Адреса, назва кафе, парк…" value="${ZAP.utils.esc(formState.place || '')}" oninput="ZAP.pages.create.chk()"/>
      </div>

      ${mode === 'group' ? renderGroupOptions() : renderPersonalOptions()}

      <!-- Auth required toggle -->
      <div style="background:var(--warm);border-radius:12px;padding:16px;border:1px solid var(--border)">
        <div class="toggle-wrap">
          <button class="toggle ${requireAuth ? 'on' : ''}"
            onclick="ZAP.pages.create.toggleRequireAuth()"></button>
          <span class="toggle-label">
            ${requireAuth
              ? '🔒 Тільки для зареєстрованих — отримувач повинен увійти в акаунт'
              : '🌐 Для всіх — будь-хто може переглянути запрошення'}
          </span>
        </div>
      </div>

      <button id="sbtn" class="btn btn-dark btn-full" disabled onclick="ZAP.pages.create.submit()">
        Створити запрошення →
      </button>
    </div>`;
  }

  function renderPersonalOptions() {
    if (friends.length === 0) return '';
    return `
    <div style="background:var(--warm);border-radius:12px;padding:16px;border:1px solid var(--border)">
      <p style="font-size:.78rem;color:var(--muted);margin-bottom:10px;font-weight:500;text-transform:uppercase;letter-spacing:.08em">
        Або надішліть напряму другу
      </p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${friends.map(f => `
          <button class="pill ${selectedFriends.includes(f.uid) ? 'on' : ''}"
            onclick="ZAP.pages.create.toggleFriend('${f.uid}','personal')">
            ${ZAP.utils.esc(f.name)}
          </button>
        `).join('')}
      </div>
    </div>`;
  }

  function renderGroupOptions() {
    return `
    <!-- Public / Private toggle -->
    <div style="background:var(--warm);border-radius:12px;padding:16px;border:1px solid var(--border)">
      <div class="toggle-wrap" style="margin-bottom:14px">
        <button class="toggle ${isPublic ? 'on' : ''}"
          onclick="ZAP.pages.create.togglePublic()"></button>
        <span class="toggle-label">
          ${isPublic ? '🌍 Публічне — будь-хто може приєднатися за посиланням' : '🔒 Приватне — тільки для обраних друзів'}
        </span>
      </div>

      ${!isPublic ? `
        <p style="font-size:.78rem;color:var(--muted);margin-bottom:10px;font-weight:500;text-transform:uppercase;letter-spacing:.08em">
          Виберіть друзів для запрошення
        </p>
        ${friends.length === 0 ? `
          <p style="font-size:.88rem;color:var(--muted);font-style:italic">
            У вас ще немає друзів. <button class="btn-ghost" onclick="ZAP.router.go('friends')">Додати →</button>
          </p>
        ` : `
          <div style="display:flex;flex-direction:column;gap:4px">
            ${friends.map(f => `
              <div class="check-item ${selectedFriends.includes(f.uid) ? 'checked' : ''}"
                onclick="ZAP.pages.create.toggleFriend('${f.uid}','group')">
                <div class="check-box">${selectedFriends.includes(f.uid) ? '✓' : ''}</div>
                ${ZAP.utils.avatarHTML(f, 'sm')}
                <span style="font-size:.9rem">${ZAP.utils.esc(f.name)}</span>
              </div>
            `).join('')}
          </div>
        `}
      ` : ''}
    </div>`;
  }

  function renderDone() {
    const link = createdInv.isGroup
      ? location.href.split('#')[0] + '#g/' + createdInv.id
      : ZAP.utils.inviteLink(createdInv.id);

    return `
    <div style="animation:fadeUp .5s ease">
      <div style="text-align:center;padding:10px 0 24px">
        <div style="font-size:2.8rem;margin-bottom:12px">🎉</div>
        <h2 style="font-family:var(--font-heading);font-weight:400;font-style:italic;font-size:1.9rem;margin-bottom:8px">Готово!</h2>
        <p style="color:var(--muted);margin-bottom:22px">
          ${createdInv.sentToFriends
            ? 'Запрошення надіслано друзям! Вони отримають сповіщення.'
            : 'Скопіюйте та надішліть це посилання:'}
        </p>
      </div>
      ${!createdInv.sentToFriends ? `
        <div class="link-box" style="margin-bottom:14px">
          <div class="link-text" id="done-link-text">${ZAP.utils.esc(link)}</div>
          <button id="done-copy-btn"
            onclick="ZAP.utils.copyText('${link.replace(/'/g,"\\'")}', this)"
            style="background:var(--ink);color:var(--paper);border:none;border-radius:10px;padding:11px;font-size:.9rem;width:100%">
            🔗 Скопіювати посилання
          </button>
        </div>
      ` : ''}
      <p style="font-size:.82rem;color:var(--muted);text-align:center;margin-bottom:20px;font-style:italic">
        Коли людина відповість — статус оновиться автоматично 🔄
      </p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button onclick="ZAP.pages.create.reset()" class="btn-ghost">Ще одне</button>
        <span style="color:var(--border)">·</span>
        <button onclick="ZAP.router.go('home')" class="btn-ghost">← До списку</button>
      </div>
    </div>`;
  }

  function saveFormState() {
    formState.title = document.getElementById('f-title')?.value || '';
    formState.to = document.getElementById('f-to')?.value || '';
    formState.msg = document.getElementById('f-msg')?.value || '';
    formState.type = document.getElementById('f-type')?.value || '';
    formState.date = document.getElementById('f-date')?.value || '';
    formState.time = document.getElementById('f-time')?.value || '';
    formState.place = document.getElementById('f-place')?.value || '';
  }

  function setMode(m) {
    saveFormState();
    mode = m;
    selectedFriends = [];
    ZAP.render();
  }

  function togglePublic() {
    saveFormState();
    isPublic = !isPublic;
    if (isPublic) selectedFriends = [];
    ZAP.render();
  }

  function toggleFriend(uid, ctx) {
    saveFormState();
    if (ctx === 'personal') {
      // For personal, only one friend
      selectedFriends = selectedFriends.includes(uid) ? [] : [uid];
    } else {
      // For group, multiple
      if (selectedFriends.includes(uid)) {
        selectedFriends = selectedFriends.filter(f => f !== uid);
      } else {
        selectedFriends.push(uid);
      }
    }
    ZAP.render();
  }

  function chk() {
    const btn = document.getElementById('sbtn');
    if (!btn) return;
    if (mode === 'personal') {
      btn.disabled = !(
        document.getElementById('f-to')?.value.trim() &&
        document.getElementById('f-date')?.value &&
        document.getElementById('f-time')?.value
      );
    } else {
      btn.disabled = !(
        document.getElementById('f-date')?.value &&
        document.getElementById('f-time')?.value
      );
    }
  }

  async function submit() {
    const profile = ZAP.auth.getProfile();
    const user = ZAP.auth.getUser();
    if (!profile || !user) return;

    const type = document.getElementById('f-type').value;
    const date = document.getElementById('f-date').value;
    const time = document.getElementById('f-time').value;
    const place = document.getElementById('f-place')?.value.trim() || '';
    const msg = document.getElementById('f-msg')?.value.trim() || '';

    if (mode === 'personal') {
      const to = document.getElementById('f-to').value.trim();
      const inv = {
        id: ZAP.utils.genId(),
        to, type, date, time, place, msg,
        from: profile.name,
        creatorUid: user.uid,
        requireAuth,
        status: 'pending',
        created: Date.now(),
      };

      // If sending to friends directly
      if (selectedFriends.length > 0) {
        for (const fUid of selectedFriends) {
          const toName = friends.find(f => f.uid === fUid)?.name || to;
          const friendInv = { ...inv, id: ZAP.utils.genId(), to: toName || 'Друг' };
          await ZAP.db.sendInviteToFriend(friendInv, fUid);
        }
        inv.sentToFriends = true;
        createdInv = inv;
      } else {
        await ZAP.db.createInvite(inv);
        createdInv = inv;
      }

      createdInv = inv;
    } else {
      // Group invite
      const title = document.getElementById('f-title')?.value.trim() || '';
      const inv = {
        id: ZAP.utils.genId(),
        title, type, date, time, place, msg,
        creatorUid: user.uid,
        creatorName: profile.name,
        isPublic,
        requireAuth,
        isGroup: true,
        members: {},
        invited: {},
        status: 'pending',
        created: Date.now(),
      };

      await ZAP.db.createGroupInvite(inv);

      // Send to selected friends if private
      if (!isPublic && selectedFriends.length > 0) {
        await ZAP.db.sendGroupInviteToFriends(inv.id, selectedFriends, inv);
        inv.sentToFriends = true;
      }

      createdInv = inv;
    }

    done = true;
    ZAP.render();
  }

  function reset() {
    done = false;
    createdInv = null;
    selectedFriends = [];
    requireAuth = false;
    formState = {};
    ZAP.render();
  }

  function toggleRequireAuth() {
    saveFormState();
    requireAuth = !requireAuth;
    ZAP.render();
  }

  ZAP.pages = ZAP.pages || {};
  ZAP.pages.create = {
    render, load, setMode, togglePublic, toggleFriend, chk, submit, reset,
    toggleRequireAuth, saveFormState,
  };
})();
