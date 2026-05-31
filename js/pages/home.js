/* ═══════════════════════════════════════════════════════
   Page — Home (My Invitations)
   ═══════════════════════════════════════════════════════ */

(function () {
  let filter = 'all';
  let invites = [];
  let modalInv = null;
  let loaded = false;

  async function load() {
    const user = ZAP.auth.getUser();
    if (!user) return;
    invites = await ZAP.db.getUserInvites(user.uid);

    // Sync statuses from Firebase
    const statusSnap = await ZAP.dbRef.ref('statuses').get();
    if (statusSnap.exists()) {
      const statuses = statusSnap.val();
      invites.forEach(inv => {
        if (statuses[inv.id] && statuses[inv.id] !== inv.status) {
          inv.status = statuses[inv.id];
          // Update in DB
          ZAP.db.updateInviteStatus(inv.id, statuses[inv.id], ZAP.auth.getUser().uid);
        }
      });
    }
    loaded = true;
  }

  function render() {
    const { esc, badge, TYPE_MAP, inviteLink, copyText } = ZAP.utils;
    const f = filter;
    const shown = f === 'all' ? invites : invites.filter(i => i.status === f);

    return `
    <h1 class="page-title">Мої запрошення</h1>
    <p class="page-subtitle">Статуси оновлюються автоматично ✦</p>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px" id="filter-bar">
      ${[['all','Всі'],['pending','Очікують'],['accepted','Прийняті'],['declined','Відхилені'],['reschedule','Перенесення']]
        .map(([v, l]) => `
          <div class="pill-wrap">
            <button class="pill ${f === v ? 'on' : ''}"
              onclick="ZAP.pages.home.setFilter('${v}')">${l}</button>
          </div>`).join('')}
    </div>

    ${!loaded ? ZAP.utils.spinner() :
      shown.length === 0 ? `
        <div class="empty">
          <div class="empty-icon">✦</div>
          <p style="font-style:italic;font-size:1.05rem;margin-bottom:18px">
            ${f === 'all' ? 'Ще немає запрошень' : 'Немає запрошень з таким статусом'}
          </p>
          <button class="btn btn-dark" style="width:auto;padding:10px 28px"
            onclick="ZAP.router.go('create')">Створити перше</button>
        </div>
      ` : shown.map((inv, i) => {
        const t = TYPE_MAP[inv.type] || TYPE_MAP.other;
        return `
        <div class="inv-card status-${inv.status}" style="animation-delay:${i * 40}ms"
          onclick="ZAP.pages.home.openModal('${inv.id}')">
          <div style="font-size:1.8rem;flex-shrink:0">${t.e}</div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
              <span style="font-weight:600;font-size:1rem">${esc(inv.to || inv.title || 'Групове')}</span>
              ${badge(inv.status)}
              ${inv.isGroup ? '<span class="badge badge-pending">👥 Група</span>' : ''}
            </div>
            <div style="color:var(--muted);font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${t.l} · ${esc(inv.date)} ${esc(inv.time || '')}
            </div>
          </div>
          <div onclick="event.stopPropagation()" style="flex-shrink:0">
            <button id="copy-${inv.id}"
              onclick="ZAP.utils.copyText('${inviteLink(inv.id).replace(/'/g,"\\'")}', this)"
              style="background:var(--warm);border:none;border-radius:8px;padding:7px 13px;font-size:.8rem;color:var(--muted)">
              🔗 Копіювати
            </button>
          </div>
        </div>`;
      }).join('')
    }`;
  }

  function renderModal(inv) {
    const { esc, badge, TYPE_MAP, inviteLink, divLine } = ZAP.utils;
    const t = TYPE_MAP[inv.type] || TYPE_MAP.other;
    const link = inv.isGroup
      ? location.href.split('#')[0] + '#g/' + inv.id
      : inviteLink(inv.id);

    return `
    <div class="overlay" onclick="ZAP.pages.home.closeModal()">
      <div class="modal" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:1.7rem">${t.e}</span>
            <div>
              <div style="font-weight:600;font-size:1.05rem">${esc(inv.to || inv.title || 'Групове')}</div>
              <div style="color:var(--muted);font-size:.82rem">${t.l}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            ${badge(inv.status)}
            <button onclick="ZAP.pages.home.closeModal()"
              style="background:none;border:none;font-size:1.3rem;color:var(--muted);line-height:1">×</button>
          </div>
        </div>

        ${divLine()}

        <div style="margin-bottom:14px">
          <div class="detail-row">
            <span class="detail-icon">📅</span>
            <span class="detail-label">Дата</span>
            <span class="detail-value">${esc(inv.date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-icon">🕐</span>
            <span class="detail-label">Час</span>
            <span class="detail-value">${esc(inv.time || '')}</span>
          </div>
          ${inv.status === 'reschedule' ? `
            <div id="modal-resc-${inv.id}"
              style="margin-top:8px;padding:10px 13px;background:rgba(201,146,42,.08);border-radius:8px;border-left:3px solid var(--gold)">
              <p style="font-size:.75rem;color:var(--muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:.08em;font-weight:500">Пропозиція отримувача</p>
              <p style="font-size:.95rem;color:var(--ink)" id="reschedule-info-${inv.id}">⏳ Завантаження...</p>
            </div>` : ''}
        </div>

        <div class="link-box">
          <p style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:500;margin-bottom:8px">Посилання</p>
          <div class="link-text">${esc(link)}</div>
          <div style="display:flex;gap:8px">
            <button id="mcopy"
              onclick="ZAP.utils.copyText('${link.replace(/'/g,"\\'")}', this)"
              style="flex:1;background:var(--ink);color:var(--paper);border:none;border-radius:9px;padding:9px;font-size:.85rem">
              🔗 Скопіювати
            </button>
            <button onclick="ZAP.router.go('${inv.isGroup ? 'group-invite' : 'invite'}', {id:'${inv.id}'})"
              style="flex:1;background:none;border:1px solid var(--border);border-radius:9px;padding:9px;font-size:.85rem;color:var(--muted)">
              👁 Переглянути
            </button>
          </div>
        </div>

        <button onclick="ZAP.pages.home.deleteInv('${inv.id}')"
          style="display:block;margin:14px auto 0;background:none;border:none;color:var(--red);font-size:.85rem;text-decoration:underline;cursor:pointer">
          Видалити
        </button>
      </div>
    </div>`;
  }

  async function openModal(id) {
    const inv = invites.find(i => i.id === id);
    if (!inv) return;
    
    // Remove existing if any
    const existing = document.getElementById('home-modal-container');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'home-modal-container';
    container.innerHTML = renderModal(inv);
    document.body.appendChild(container);

    // Load reschedule info if needed
    if (inv.status === 'reschedule') {
      const resc = await ZAP.db.getReschedule(id);
      const el = document.getElementById('reschedule-info-' + id);
      if (el && resc) {
        el.textContent = [resc.date, resc.time].filter(Boolean).join(' о ') || 'Без конкретної дати';
      } else if (el) {
        el.textContent = 'Деталі не вказані';
      }
    }
  }

  function closeModal() {
    const existing = document.getElementById('home-modal-container');
    if (existing) existing.remove();
  }

  function setFilter(f) {
    filter = f;
    ZAP.render();
  }

  async function deleteInv(id) {
    if (!confirm('Видалити запрошення?')) return;
    await ZAP.db.deleteInvite(id, ZAP.auth.getUser()?.uid);
    invites = invites.filter(i => i.id !== id);
    modalInv = null;
    ZAP.utils.toast('Запрошення видалено', 'info');
    ZAP.render();
  }

  // Start real-time listener for status updates
  function startListening() {
    const user = ZAP.auth.getUser();
    if (!user) return;
    ZAP.db.listenStatuses(user.uid, statuses => {
      let changed = false;
      invites.forEach(inv => {
        if (statuses[inv.id] && statuses[inv.id] !== inv.status) {
          const oldStatus = inv.status;
          inv.status = statuses[inv.id];
          changed = true;

          // Toast notification
          if (inv.status === 'accepted') {
            ZAP.utils.toast(`${inv.to || 'Хтось'} прийняв запрошення! ✓`, 'success');
          } else if (inv.status === 'declined') {
            ZAP.utils.toast(`${inv.to || 'Хтось'} відхилив запрошення`, 'error');
          } else if (inv.status === 'reschedule') {
            ZAP.utils.toast(`${inv.to || 'Хтось'} хоче перенести зустріч`, 'info');
          }
        }
      });
      if (changed) {
        const route = ZAP.router.parseHash();
        if (route.page === 'home') ZAP.render();
      }
    });
  }

  ZAP.pages = ZAP.pages || {};
  ZAP.pages.home = {
    render, load, setFilter, openModal, closeModal, deleteInv, startListening,
  };
})();
