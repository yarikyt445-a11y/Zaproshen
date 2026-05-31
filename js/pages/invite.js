/* ═══════════════════════════════════════════════════════
   Page — Invite View (for recipient)
   Handles both personal (#i/) and group (#g/) invites
   ═══════════════════════════════════════════════════════ */

(function () {
  let invData = null;
  let groupData = null;
  let loading = true;
  let answered = false;
  let answerStatus = null;
  let showRescheduleForm = false;
  let isGroup = false;
  let guestName = '';

  async function loadPersonal(inviteId, b64) {
    loading = true;
    isGroup = false;
    invData = null;
    answered = false;
    answerStatus = null;
    showRescheduleForm = false;

    if (inviteId) {
      // Short ID — load from Firebase
      invData = await ZAP.db.getInvite(inviteId);
    } else if (b64) {
      // Legacy Base64
      try { invData = JSON.parse(decodeURIComponent(escape(atob(b64)))); } catch {}
    }

    // Check if already answered
    if (invData) {
      try {
        const statusSnap = await ZAP.dbRef.ref('statuses/' + invData.id).get();
        if (statusSnap.exists()) {
          const st = statusSnap.val();
          if (st === 'accepted' || st === 'declined' || st === 'reschedule') {
            answered = true;
            answerStatus = st;
          }
        }
      } catch {}
    }

    loading = false;
  }

  async function loadGroup(inviteId) {
    loading = true;
    isGroup = true;
    groupData = null;
    guestName = '';

    groupData = await ZAP.db.getGroupInvite(inviteId);

    // Check if current user already joined
    const user = ZAP.auth.getUser();
    if (user && groupData?.members) {
      const memberEntry = Object.values(groupData.members).find(m => m.uid === user.uid);
      if (memberEntry) {
        answered = true;
        answerStatus = memberEntry.status;
      }
    }

    loading = false;
  }

  function render() {
    if (loading) return `<div class="page-loader"><div class="spinner"></div></div>`;

    if (isGroup) return renderGroupInvite();
    return renderPersonalInvite();
  }

  // ───────────────────────────────────────────────
  // Personal invite
  // ───────────────────────────────────────────────
  function renderPersonalInvite() {
    const { esc, TYPE_MAP } = ZAP.utils;

    if (!invData) {
      return `<div style="text-align:center;padding:80px 20px">
        <div style="font-size:2rem;margin-bottom:12px">🍂</div>
        <p style="color:var(--muted);font-size:1.1rem">Запрошення не знайдено</p>
      </div>`;
    }

    // Check if auth is required
    if (invData.requireAuth && !ZAP.auth.getUser()) {
      return `
      <div class="invite-bg">
        <div class="invite-envelope" style="max-width:420px">
          <div class="envelope-top">
            <span class="envelope-emoji">🔒</span>
            <div class="envelope-type">Запрошення</div>
            <div class="envelope-to">${ZAP.utils.esc(invData.to)}</div>
          </div>
          <div class="envelope-body" style="text-align:center">
            <p style="color:var(--muted);margin-bottom:20px;font-size:1rem">
              Щоб переглянути це запрошення, потрібно увійти в акаунт або зареєструватися.
            </p>
            <button class="btn btn-dark" style="width:auto;padding:12px 32px"
              onclick="ZAP.router.go('login')">Увійти / Зареєструватися</button>
          </div>
        </div>
      </div>`;
    }

    const t = TYPE_MAP[invData.type] || TYPE_MAP.other;

    return `
    <div class="invite-bg">
      <div class="invite-envelope">
        <div class="envelope-top">
          <span class="envelope-emoji">${t.e}</span>
          <div class="envelope-type">${t.l}</div>
          <div class="envelope-to">${esc(invData.to)}</div>
        </div>

        <div class="envelope-body">
          ${invData.msg ? `
            <div class="msg-block">
              <p class="msg-text">${esc(invData.msg)}</p>
            </div>` : ''}

          <div style="background:rgba(0,0,0,.02);border-radius:12px;padding:6px 12px;margin-bottom:0">
            <div class="detail-row">
              <span class="detail-icon">📅</span>
              <span class="detail-label">Дата</span>
              <span class="detail-value">${esc(invData.date)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-icon">🕐</span>
              <span class="detail-label">Час</span>
              <span class="detail-value">${esc(invData.time)}</span>
            </div>
            ${invData.place ? `
            <div class="detail-row">
              <span class="detail-icon">📍</span>
              <span class="detail-label">Місце</span>
              <span class="detail-value">${esc(invData.place)}</span>
            </div>` : ''}
          </div>

          ${answered ? renderResult(answerStatus) : renderButtons(invData.id)}

          ${!answered ? `
            <div style="text-align:center;margin-top:18px">
              <button onclick="ZAP.pages.invite.showReport('${invData.id}')"
                style="background:none;border:none;color:var(--muted);font-size:.78rem;cursor:pointer;text-decoration:underline">
                ⚠ Поскаржитися
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    </div>`;
  }

  function renderButtons(invId) {
    return `
    <div class="answer-wrap" id="answer-btns-${invId}">
      <button class="btn-yes" onclick="ZAP.pages.invite.answer('${invId}','accepted')">
        Так, я приду! ✓
      </button>
      <button class="btn-reschedule" onclick="ZAP.pages.invite.toggleReschedule('${invId}')">
        📅 Перенести зустріч
      </button>
      <div id="reschedule-block-${invId}" style="display:${showRescheduleForm ? 'block' : 'none'}">
        <div class="reschedule-form">
          <p style="font-size:.85rem;font-weight:500;margin-bottom:12px">Запропонуйте інший час:</p>
          <div class="grid2" style="margin-bottom:12px">
            <div><label class="lbl">Нова дата</label><input type="date" id="rdate-${invId}" min="${new Date().toISOString().split('T')[0]}"/></div>
            <div><label class="lbl">Новий час</label><input type="time" id="rtime-${invId}"/></div>
          </div>
          <button class="btn btn-gold btn-full" onclick="ZAP.pages.invite.sendReschedule('${invId}')">
            Надіслати пропозицію →
          </button>
        </div>
      </div>
      <button class="btn-no" onclick="ZAP.pages.invite.answer('${invId}','declined')">
        Ні, не зможу
      </button>
    </div>`;
  }

  function renderResult(status) {
    const results = {
      accepted: `
        <span class="result-icon">🎊</span>
        <div class="result-title" style="color:var(--green)">Ура! Так! 🌟</div>
        <div class="result-sub">Ви погодились! Відправник дізнається автоматично ✓</div>`,
      declined: `
        <span class="result-icon">💔</span>
        <div class="result-title" style="color:var(--red)">Відмовлено</div>
        <div class="result-sub">Ви відмовились. Відправник дізнається автоматично.</div>`,
      reschedule: `
        <span class="result-icon">📅</span>
        <div class="result-title" style="color:var(--gold)">Пропозицію надіслано!</div>
        <div class="result-sub">Відправник отримає ваш варіант часу і зв'яжеться з вами.</div>`,
    };
    return `<div class="result-screen" style="margin-top:24px;animation:pop .5s cubic-bezier(.34,1.56,.64,1) both">
      ${results[status] || results.declined}
    </div>`;
  }

  // ───────────────────────────────────────────────
  // Group invite
  // ───────────────────────────────────────────────
  function renderGroupInvite() {
    const { esc, TYPE_MAP, avatarHTML } = ZAP.utils;

    if (!groupData) {
      return `<div style="text-align:center;padding:80px 20px">
        <div style="font-size:2rem;margin-bottom:12px">🍂</div>
        <p style="color:var(--muted);font-size:1.1rem">Групове запрошення не знайдено</p>
      </div>`;
    }

    // Check if private and user not invited
    const user = ZAP.auth.getUser();
    if (!groupData.isPublic && user) {
      const invited = groupData.invited || {};
      if (!invited[user.uid] && groupData.creatorUid !== user.uid) {
        return `<div style="text-align:center;padding:80px 20px">
          <div style="font-size:2rem;margin-bottom:12px">🔒</div>
          <p style="color:var(--muted);font-size:1.1rem">Це приватне запрошення. Ви не в списку запрошених.</p>
        </div>`;
      }
    }

    const t = TYPE_MAP[groupData.type] || TYPE_MAP.other;
    const members = groupData.members ? Object.values(groupData.members) : [];

    return `
    <div class="invite-bg">
      <div class="invite-envelope" style="max-width:520px">
        <div class="envelope-top">
          <span class="envelope-emoji">${t.e}</span>
          <div class="envelope-type">Групове запрошення</div>
          <div class="envelope-to">${esc(groupData.title || t.l)}</div>
        </div>

        <div class="envelope-body">
          ${groupData.msg ? `
            <div class="msg-block">
              <p class="msg-text">${esc(groupData.msg)}</p>
            </div>` : ''}

          <div style="background:rgba(0,0,0,.02);border-radius:12px;padding:6px 12px;margin-bottom:16px">
            <div class="detail-row">
              <span class="detail-icon">📅</span>
              <span class="detail-label">Дата</span>
              <span class="detail-value">${esc(groupData.date)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-icon">🕐</span>
              <span class="detail-label">Час</span>
              <span class="detail-value">${esc(groupData.time)}</span>
            </div>
            ${groupData.place ? `
            <div class="detail-row">
              <span class="detail-icon">📍</span>
              <span class="detail-label">Місце</span>
              <span class="detail-value">${esc(groupData.place)}</span>
            </div>` : ''}
            <div class="detail-row">
              <span class="detail-icon">👤</span>
              <span class="detail-label">Від</span>
              <span class="detail-value">${esc(groupData.creatorName || 'Невідомий')}</span>
            </div>
          </div>

          <!-- Participants -->
          ${members.length > 0 ? `
            <div style="margin-bottom:16px">
              <p style="font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:500;margin-bottom:8px">
                Учасники (${members.length})
              </p>
              <div class="participant-list">
                ${members.map(m => `
                  <div class="participant-item">
                    <span class="participant-name">${esc(m.name)}</span>
                    <span class="participant-status">${ZAP.utils.badge(m.status || 'accepted')}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${answered ? renderResult(answerStatus) : renderGroupJoin()}
        </div>
      </div>
    </div>`;
  }

  function renderGroupJoin() {
    const user = ZAP.auth.getUser();

    if (!user && groupData.isPublic) {
      // Check if auth required
      if (groupData.requireAuth) {
        return `
        <div style="text-align:center;padding:16px 0">
          <div style="font-size:1.5rem;margin-bottom:10px">🔒</div>
          <p style="color:var(--muted);margin-bottom:12px">Для відповіді потрібно увійти в акаунт</p>
          <button class="btn btn-dark" style="width:auto;padding:10px 28px"
            onclick="ZAP.router.go('login')">Увійти</button>
        </div>`;
      }
      // Public group, no auth — enter name
      return `
      <div class="answer-wrap">
        <div style="margin-bottom:12px">
          <label class="lbl">Ваше ім'я</label>
          <input id="guest-name" placeholder="Як вас звати?" value="${ZAP.utils.esc(guestName)}"
            oninput="ZAP.pages.invite.setGuestName(this.value)"/>
        </div>
        <button class="btn-yes" onclick="ZAP.pages.invite.joinGroup()">
          Так, я приду! ✓
        </button>
        <button class="btn-no" onclick="ZAP.pages.invite.declineGroup()">
          Ні, не зможу
        </button>
      </div>`;
    }

    if (user) {
      return `
      <div class="answer-wrap">
        <button class="btn-yes" onclick="ZAP.pages.invite.joinGroup()">
          Так, я приду! ✓
        </button>
        <button class="btn-no" onclick="ZAP.pages.invite.declineGroup()">
          Ні, не зможу
        </button>
      </div>`;
    }

    // Private group, no auth
    return `
    <div style="text-align:center;padding:16px 0">
      <p style="color:var(--muted);margin-bottom:12px">Увійдіть, щоб відповісти на запрошення</p>
      <button class="btn btn-dark" style="width:auto;padding:10px 28px"
        onclick="ZAP.router.go('login')">Увійти</button>
    </div>`;
  }

  // ───────────────────────────────────────────────
  // Actions
  // ───────────────────────────────────────────────

  async function answer(invId, status) {
    // Write to Firebase
    if (ZAP.dbRef) {
      await ZAP.dbRef.ref('statuses/' + invId).set(status);
    }
    
    // Clean up notification
    const user = ZAP.auth.getUser();
    if (user) await ZAP.notifications.deleteNotificationsByPayload(user.uid, 'invite', 'inviteId', invId);

    // Notify creator
    if (invData?.creatorUid) {
      const responderName = ZAP.auth.getProfile()?.name || invData.to || 'Хтось';
      const titles = {
        accepted: '✓ Запрошення прийнято!',
        declined: '✕ Запрошення відхилено',
      };
      await ZAP.notifications.addNotification(invData.creatorUid, {
        type: 'invite-response',
        title: titles[status] || 'Відповідь на запрошення',
        body: `${responderName} ${status === 'accepted' ? 'погодився прийти!' : 'не зможе прийти'}`,
        inviteId: invId,
      });
    }

    if (status === 'accepted') ZAP.utils.boom();

    answered = true;
    answerStatus = status;
    ZAP.render();
  }

  function toggleReschedule(invId) {
    showRescheduleForm = !showRescheduleForm;
    const block = document.getElementById('reschedule-block-' + invId);
    if (block) block.style.display = showRescheduleForm ? 'block' : 'none';
  }

  async function sendReschedule(invId) {
    const date = document.getElementById('rdate-' + invId)?.value || '';
    const time = document.getElementById('rtime-' + invId)?.value || '';
    if (!date && !time) { alert('Виберіть дату або час!'); return; }

    await ZAP.db.saveReschedule(invId, { date, time });

    // Clean up notification
    const user = ZAP.auth.getUser();
    if (user) await ZAP.notifications.deleteNotificationsByPayload(user.uid, 'invite', 'inviteId', invId);

    // Notify creator
    if (invData?.creatorUid) {
      const responderName = ZAP.auth.getProfile()?.name || invData.to || 'Хтось';
      await ZAP.notifications.addNotification(invData.creatorUid, {
        type: 'invite-reschedule',
        title: '📅 Запит на перенесення',
        body: `${responderName} хоче перенести зустріч`,
        inviteId: invId,
      });
    }

    answered = true;
    answerStatus = 'reschedule';
    ZAP.render();
  }

  async function joinGroup() {
    if (!groupData) return;
    const user = ZAP.auth.getUser();
    const profile = ZAP.auth.getProfile();

    const participant = {
      name: user ? profile?.name || 'Невідомий' : guestName || 'Гість',
      uid: user?.uid || null,
      status: 'accepted',
    };

    if (!user && !guestName.trim()) {
      ZAP.utils.toast('Введіть ваше ім\'я', 'error');
      return;
    }

    await ZAP.db.joinGroupInvite(groupData.id, participant);

    // Clean up notification
    if (user) await ZAP.notifications.deleteNotificationsByPayload(user.uid, 'group-invite', 'inviteId', groupData.id);

    ZAP.utils.boom();
    answered = true;
    answerStatus = 'accepted';
    ZAP.render();
  }

  async function declineGroup() {
    if (!groupData) return;
    const user = ZAP.auth.getUser();
    const profile = ZAP.auth.getProfile();

    const participant = {
      name: user ? profile?.name || 'Невідомий' : guestName || 'Гість',
      uid: user?.uid || null,
      status: 'declined',
    };

    await ZAP.db.joinGroupInvite(groupData.id, participant);

    // Clean up notification
    if (user) await ZAP.notifications.deleteNotificationsByPayload(user.uid, 'group-invite', 'inviteId', groupData.id);

    answered = true;
    answerStatus = 'declined';
    ZAP.render();
  }

  function setGuestName(name) {
    guestName = name;
  }

  // ── Report ──
  function showReport(invId) {
    const reasons = [
      'Спам або шахрайство',
      'Образливий вміст',
      'Небажане запрошення',
      'Інше',
    ];

    const modal = document.createElement('div');
    modal.className = 'overlay';
    modal.onclick = e => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()">
        <h3 class="modal-title">⚠ Поскаржитися</h3>
        <p style="color:var(--muted);font-size:.9rem;margin-bottom:16px">Оберіть причину скарги:</p>
        <div class="report-reasons" id="report-reasons">
          ${reasons.map((r, i) => `
            <div class="report-reason" onclick="this.parentElement.querySelectorAll('.report-reason').forEach(e=>e.classList.remove('selected'));this.classList.add('selected');this.dataset.reason='${ZAP.utils.esc(r)}'">
              <div class="report-reason-radio"></div>
              <span>${ZAP.utils.esc(r)}</span>
            </div>
          `).join('')}
        </div>
        <div style="margin-top:12px">
          <label class="lbl">Додатковий коментар (необов'язково)</label>
          <textarea id="report-comment" placeholder="Опишіть проблему..." style="min-height:60px"></textarea>
        </div>
        <div style="display:flex;gap:10px;margin-top:18px">
          <button class="btn btn-red btn-full" onclick="ZAP.pages.invite.submitReport('${invId}')">
            Надіслати скаргу
          </button>
          <button class="btn btn-outline btn-full" onclick="this.closest('.overlay').remove()">
            Скасувати
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  async function submitReport(invId) {
    const selected = document.querySelector('.report-reason.selected');
    if (!selected) {
      ZAP.utils.toast('Оберіть причину скарги', 'error');
      return;
    }

    const reason = selected.dataset.reason || selected.textContent.trim();
    const comment = document.getElementById('report-comment')?.value?.trim() || '';
    const user = ZAP.auth.getUser();

    await ZAP.db.createReport({
      targetType: isGroup ? 'group-invite' : 'invite',
      targetId: invId,
      reason,
      comment,
      reporterUid: user?.uid || null,
      reporterName: ZAP.auth.getProfile()?.name || 'Анонім',
    });

    document.querySelector('.overlay')?.remove();
    ZAP.utils.toast('Скаргу надіслано. Дякуємо!', 'success');
  }

  ZAP.pages = ZAP.pages || {};
  ZAP.pages.invite = {
    render, loadPersonal, loadGroup,
    answer, toggleReschedule, sendReschedule,
    joinGroup, declineGroup, setGuestName,
    showReport, submitReport,
  };
})();
