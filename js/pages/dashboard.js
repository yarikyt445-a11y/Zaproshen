/* ═══════════════════════════════════════════════════════
   Page — Admin Dashboard
   ═══════════════════════════════════════════════════════ */

(function () {
  let stats = null;
  let users = [];
  let reports = [];
  let loading = true;
  let dashTab = 'overview'; // 'overview' | 'users' | 'reports'
  let userSearch = '';
  let userPage = 0;
  const PAGE_SIZE = 15;

  async function load() {
    loading = true;
    try {
      const data = await ZAP.db.getStats();
      stats = data;
      users = data.users || [];
      reports = await ZAP.db.getReports();
    } catch (e) {
      console.warn('Dashboard load:', e);
    }
    loading = false;
  }

  function render() {
    if (!ZAP.auth.isAdmin() && !ZAP.auth.isModerator()) {
      return `<div class="wrap"><div class="empty">
        <div class="empty-icon">🔒</div>
        <p style="font-style:italic;font-size:1.05rem">Доступ заборонено</p>
      </div></div>`;
    }

    return `
    <div class="app-with-sidebar">
      ${renderSidebar()}
      <div class="sidebar-content">
        <div class="wrap">
          ${loading ? ZAP.utils.spinner() : renderDashContent()}
        </div>
      </div>
    </div>`;
  }

  function renderSidebar() {
    const profile = ZAP.auth.getProfile();
    const pendingReports = reports.filter(r => r.status === 'pending').length;

    return `
    <aside class="sidebar" id="dash-sidebar">
      <div class="sidebar-logo">Запрошення ✦</div>

      <div class="sidebar-section">Меню</div>
      <button class="sidebar-item ${dashTab === 'overview' ? 'active' : ''}"
        onclick="ZAP.pages.dashboard.setTab('overview')">
        <span class="sidebar-item-icon">📊</span> Огляд
      </button>
      <button class="sidebar-item ${dashTab === 'users' ? 'active' : ''}"
        onclick="ZAP.pages.dashboard.setTab('users')">
        <span class="sidebar-item-icon">👥</span> Користувачі
      </button>
      <button class="sidebar-item ${dashTab === 'reports' ? 'active' : ''}"
        onclick="ZAP.pages.dashboard.setTab('reports')">
        <span class="sidebar-item-icon">⚠️</span> Скарги
        ${pendingReports > 0 ? `<span class="notif-badge" style="position:static;margin-left:auto">${pendingReports}</span>` : ''}
      </button>

      <div class="sidebar-section">Навігація</div>
      <button class="sidebar-item" onclick="ZAP.router.go('home')">
        <span class="sidebar-item-icon">🏠</span> Головна
      </button>
      <button class="sidebar-item" onclick="ZAP.router.go('profile')">
        <span class="sidebar-item-icon">⚙️</span> Профіль
      </button>

      <div style="margin-top:auto;padding:16px;border-top:1px solid rgba(255,255,255,.08)">
        <div style="display:flex;align-items:center;gap:10px">
          ${ZAP.utils.avatarHTML(profile, 'sm')}
          <div>
            <div style="color:#fff;font-size:.85rem;font-weight:500">${ZAP.utils.esc(profile?.name)}</div>
            <div style="font-size:.7rem;color:rgba(255,255,255,.4)">${ZAP.utils.roleBadge(profile?.role)}</div>
          </div>
        </div>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="ZAP.pages.dashboard.toggleSidebar()"></div>`;
  }

  function renderDashContent() {
    if (dashTab === 'users') return renderUsers();
    if (dashTab === 'reports') return renderReports();
    return renderOverview();
  }

  // ═══════════════════════════════════════════════════════
  // Overview
  // ═══════════════════════════════════════════════════════
  function renderOverview() {
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <h1 class="page-title" style="margin-bottom:0">Дашборд</h1>
      <button class="hamburger" onclick="ZAP.pages.dashboard.toggleSidebar()">☰</button>
    </div>

    <!-- Stats cards -->
    <div class="stats-grid">
      ${statCard('👤', 'users', 'Користувачі', stats?.totalUsers || 0)}
      ${statCard('📨', 'invites', 'Запрошення', stats?.totalInvites || 0)}
      ${statCard('✅', 'accepted', 'Прийняті', stats?.acceptedInvites || 0)}
      ${statCard('🟢', 'active', 'Активні (7д)', stats?.activeUsers || 0)}
    </div>

    <!-- Charts -->
    <div class="chart-grid">
      <div class="chart-card">
        <div class="chart-card-title">
          <h3>Активність</h3>
        </div>
        <canvas id="chart-activity" class="chart-canvas"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-card-title">
          <h3>Ролі</h3>
        </div>
        <canvas id="chart-roles" class="chart-canvas"></canvas>
      </div>
    </div>

    <!-- Recent users -->
    <div class="table-card">
      <div class="table-header">
        <h3>Останні реєстрації</h3>
      </div>
      <table class="data-table">
        <thead><tr>
          <th>Користувач</th><th>Логін</th><th>Роль</th><th>Дата</th>
        </tr></thead>
        <tbody>
          ${users.slice(0, 5).map(u => `
            <tr>
              <td style="display:flex;align-items:center;gap:8px">
                ${ZAP.utils.avatarHTML(u, 'sm')}
                ${ZAP.utils.esc(u.name)}
              </td>
              <td style="color:var(--muted)">@${ZAP.utils.esc(u.login)}</td>
              <td>${ZAP.utils.roleBadge(u.role)}</td>
              <td style="font-size:.82rem;color:var(--muted)">${ZAP.utils.timeAgo(u.createdAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  }

  function statCard(icon, cls, label, value) {
    return `
    <div class="stat-card">
      <div class="stat-icon ${cls}">${icon}</div>
      <div class="stat-value">${value.toLocaleString()}</div>
      <div class="stat-label">${label}</div>
    </div>`;
  }

  // ═══════════════════════════════════════════════════════
  // Users management
  // ═══════════════════════════════════════════════════════
  function renderUsers() {
    const filtered = userSearch
      ? users.filter(u =>
          u.login.toLowerCase().includes(userSearch.toLowerCase()) ||
          u.name.toLowerCase().includes(userSearch.toLowerCase()))
      : users;

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paged = filtered.slice(userPage * PAGE_SIZE, (userPage + 1) * PAGE_SIZE);

    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <h1 class="page-title" style="margin-bottom:0">Користувачі</h1>
      <button class="hamburger" onclick="ZAP.pages.dashboard.toggleSidebar()">☰</button>
    </div>

    <div class="table-card">
      <div class="table-header">
        <h3>Всього: ${filtered.length}</h3>
        <input class="table-search" placeholder="🔍 Пошук по логіну або імені..."
          value="${ZAP.utils.esc(userSearch)}"
          oninput="ZAP.pages.dashboard.searchUsers(this.value)"/>
      </div>

      <table class="data-table">
        <thead><tr>
          <th>Користувач</th><th>Логін</th><th>Роль</th><th>Статус</th><th>Дії</th>
        </tr></thead>
        <tbody>
          ${paged.map(u => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:8px;cursor:pointer"
                  onclick="ZAP.router.go('user-profile',{uid:'${u.uid}'})">
                  ${ZAP.utils.avatarHTML(u, 'sm')}
                  <div>
                    <div style="font-weight:500">${ZAP.utils.esc(u.name)}</div>
                    <div style="font-size:.72rem;color:var(--muted)">${ZAP.utils.esc(u.uniqueId)}</div>
                  </div>
                </div>
              </td>
              <td style="color:var(--muted);font-size:.88rem">@${ZAP.utils.esc(u.login)}</td>
              <td>
                <select class="role-select" onchange="ZAP.pages.dashboard.changeRole('${u.uid}',this.value)"
                  ${!ZAP.auth.isAdmin() ? 'disabled' : ''}>
                  ${['user','moderator','tech-admin','founder'].map(r =>
                    `<option value="${r}" ${u.role === r ? 'selected' : ''}>${
                      {user:'Користувач',moderator:'Модератор','tech-admin':'Тех-адмін',founder:'Засновник'}[r]
                    }</option>`
                  ).join('')}
                </select>
              </td>
              <td>
                ${u.banned
                  ? '<span class="badge badge-declined">🚫 Бан</span>'
                  : '<span class="badge badge-accepted">✓ Активний</span>'}
              </td>
              <td>
                ${u.banned
                  ? `<button class="btn btn-sm btn-gold" onclick="ZAP.pages.dashboard.toggleBan('${u.uid}',false)">Розбанити</button>`
                  : `<button class="btn btn-sm btn-outline" style="color:var(--red);border-color:var(--red)"
                      onclick="ZAP.pages.dashboard.toggleBan('${u.uid}',true)">Бан</button>`}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${totalPages > 1 ? `
        <div class="pagination">
          ${Array.from({length: totalPages}, (_, i) => `
            <button class="page-btn ${i === userPage ? 'active' : ''}"
              onclick="ZAP.pages.dashboard.setUserPage(${i})">${i + 1}</button>
          `).join('')}
        </div>
      ` : ''}
    </div>`;
  }

  // ═══════════════════════════════════════════════════════
  // Reports / Complaints
  // ═══════════════════════════════════════════════════════
  function renderReports() {
    const pending = reports.filter(r => r.status === 'pending');
    const resolved = reports.filter(r => r.status !== 'pending');

    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <h1 class="page-title" style="margin-bottom:0">Скарги</h1>
      <button class="hamburger" onclick="ZAP.pages.dashboard.toggleSidebar()">☰</button>
    </div>

    ${pending.length > 0 ? `
      <div class="dash-section">
        <div class="dash-section-title">Очікують розгляду (${pending.length})</div>
        ${pending.map(r => renderReportCard(r)).join('')}
      </div>
    ` : `
      <div style="background:var(--green-bg);border-radius:12px;padding:18px;margin-bottom:24px;text-align:center">
        <p style="color:var(--green);font-size:.95rem">✓ Немає нових скарг</p>
      </div>
    `}

    ${resolved.length > 0 ? `
      <div class="dash-section">
        <div class="dash-section-title">Розглянуті (${resolved.length})</div>
        ${resolved.slice(0, 20).map(r => renderReportCard(r, true)).join('')}
      </div>
    ` : ''}`;
  }

  function renderReportCard(r, isResolved) {
    return `
    <div class="complaint-card ${isResolved ? 'resolved' : ''}">
      <div class="complaint-icon">⚠️</div>
      <div class="complaint-body">
        <div class="complaint-reason">${ZAP.utils.esc(r.reason)}</div>
        <div class="complaint-meta">
          Від: ${ZAP.utils.esc(r.reporterName || 'Анонім')} ·
          Тип: ${r.targetType === 'invite' ? '📨 Запрошення' : '👥 Групове'} ·
          ${ZAP.utils.timeAgo(r.createdAt)}
          ${r.comment ? `<br>💬 ${ZAP.utils.esc(r.comment)}` : ''}
        </div>
        ${!isResolved ? `
          <div class="complaint-actions">
            <button class="btn btn-sm btn-red"
              onclick="ZAP.pages.dashboard.resolveReport('${r.id}','resolved')">
              ✓ Вирішено
            </button>
            <button class="btn btn-sm btn-outline"
              onclick="ZAP.pages.dashboard.resolveReport('${r.id}','dismissed')">
              Відхилити
            </button>
            ${r.targetId ? `
              <button class="btn btn-sm btn-outline"
                onclick="ZAP.pages.dashboard.deleteReportedInvite('${r.targetId}','${r.targetType}','${r.id}')">
                🗑 Видалити запрошення
              </button>
            ` : ''}
          </div>
        ` : `
          <div style="margin-top:6px;font-size:.78rem;color:var(--muted)">
            ${r.status === 'resolved' ? '✓ Вирішено' : '✕ Відхилено'}
            ${r.resolvedAt ? ' · ' + ZAP.utils.timeAgo(r.resolvedAt) : ''}
          </div>
        `}
      </div>
    </div>`;
  }

  // ═══════════════════════════════════════════════════════
  // Chart rendering (Canvas)
  // ═══════════════════════════════════════════════════════
  function drawCharts() {
    setTimeout(() => {
      drawActivityChart();
      drawRolesChart();
    }, 100);
  }

  function drawActivityChart() {
    const canvas = document.getElementById('chart-activity');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.parentElement.clientWidth - 40;
    const H = 200;
    canvas.width = W * 2; canvas.height = H * 2;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(2, 2);

    // Group users by registration day (last 14 days)
    const days = [];
    const labels = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days.push(key);
      labels.push(d.getDate() + '/' + (d.getMonth() + 1));
    }

    const counts = days.map(day => {
      return users.filter(u => {
        const ud = new Date(u.createdAt).toISOString().split('T')[0];
        return ud === day;
      }).length;
    });

    const max = Math.max(...counts, 1);
    const padL = 30, padR = 10, padT = 20, padB = 30;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    // Grid
    ctx.strokeStyle = 'rgba(180,140,60,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillStyle = '#9a8e82'; ctx.font = '10px DM Sans';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(max - (max / 4) * i), padL - 6, y + 4);
    }

    // Labels
    ctx.fillStyle = '#9a8e82'; ctx.font = '9px DM Sans'; ctx.textAlign = 'center';
    const step = chartW / (days.length - 1);
    labels.forEach((l, i) => {
      if (i % 2 === 0) ctx.fillText(l, padL + i * step, H - 8);
    });

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#c9922a'; ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    counts.forEach((c, i) => {
      const x = padL + i * step;
      const y = padT + chartH - (c / max) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Area fill
    ctx.lineTo(padL + (counts.length - 1) * step, padT + chartH);
    ctx.lineTo(padL, padT + chartH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, 'rgba(201,146,42,0.15)');
    grad.addColorStop(1, 'rgba(201,146,42,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Dots
    counts.forEach((c, i) => {
      const x = padL + i * step;
      const y = padT + chartH - (c / max) * chartH;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#c9922a'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    });
  }

  function drawRolesChart() {
    const canvas = document.getElementById('chart-roles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.parentElement.clientWidth - 40;
    const H = 200;
    canvas.width = W * 2; canvas.height = H * 2;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.scale(2, 2);

    const roles = {
      user: { label: 'Користувачі', color: '#9a8e82', count: 0 },
      moderator: { label: 'Модератори', color: '#c9922a', count: 0 },
      'tech-admin': { label: 'Тех-адміни', color: '#3b82f6', count: 0 },
      founder: { label: 'Засновники', color: '#7c3aed', count: 0 },
    };
    users.forEach(u => { if (roles[u.role]) roles[u.role].count++; });

    const entries = Object.values(roles).filter(r => r.count > 0);
    const total = entries.reduce((s, r) => s + r.count, 0) || 1;

    // Draw donut chart
    const cx = W / 2, cy = H / 2 - 10;
    const outerR = Math.min(cx, cy) - 20;
    const innerR = outerR * 0.55;

    let angle = -Math.PI / 2;
    entries.forEach(r => {
      const sliceAngle = (r.count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, outerR, angle, angle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = r.color;
      ctx.fill();
      angle += sliceAngle;
    });

    // Inner circle (donut hole)
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Center text
    ctx.fillStyle = '#18120a'; ctx.font = 'bold 20px DM Sans'; ctx.textAlign = 'center';
    ctx.fillText(total, cx, cy + 4);
    ctx.fillStyle = '#9a8e82'; ctx.font = '10px DM Sans';
    ctx.fillText('всього', cx, cy + 18);

    // Legend
    let ly = H - 14;
    ctx.textAlign = 'left';
    const legendX = 10;
    entries.forEach((r, i) => {
      const x = legendX + i * (W / entries.length);
      ctx.fillStyle = r.color;
      ctx.fillRect(x, ly, 10, 10);
      ctx.fillStyle = '#9a8e82'; ctx.font = '9px DM Sans';
      ctx.fillText(`${r.label} (${r.count})`, x + 14, ly + 9);
    });
  }

  // ═══════════════════════════════════════════════════════
  // Actions
  // ═══════════════════════════════════════════════════════

  function setTab(t) {
    dashTab = t;
    ZAP.render();
    if (t === 'overview') drawCharts();
  }

  function toggleSidebar() {
    document.getElementById('dash-sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-overlay')?.classList.toggle('open');
  }

  function searchUsers(q) {
    userSearch = q;
    userPage = 0;
    ZAP.render();
  }

  function setUserPage(p) {
    userPage = p;
    ZAP.render();
  }

  async function changeRole(uid, newRole) {
    try {
      await ZAP.db.updateUserRole(uid, newRole);
      const u = users.find(u => u.uid === uid);
      if (u) u.role = newRole;
      ZAP.utils.toast('Роль змінено ✓', 'success');
    } catch (e) {
      ZAP.utils.toast('Помилка: ' + e.message, 'error');
    }
  }

  async function toggleBan(uid, ban) {
    const action = ban ? 'забанити' : 'розбанити';
    let until = null;
    
    if (ban) {
      const days = prompt('На скільки днів забанити? (Залиште порожнім для перманентного бану)');
      if (days === null) return; // cancelled
      if (days.trim() !== '' && !isNaN(Number(days))) {
        until = Date.now() + (Number(days) * 24 * 60 * 60 * 1000);
      }
    } else {
      if (!confirm(`Ви впевнені, що хочете розбанити цього користувача?`)) return;
    }

    try {
      await ZAP.db.banUser(uid, ban, until);
      const u = users.find(u => u.uid === uid);
      if (u) {
        u.banned = ban;
        u.bannedUntil = until;
      }
      ZAP.utils.toast(ban ? 'Користувача забанено' : 'Користувача розбанено', ban ? 'error' : 'success');
      ZAP.render();
    } catch (e) {
      ZAP.utils.toast('Помилка: ' + e.message, 'error');
    }
  }

  async function resolveReport(reportId, action) {
    try {
      await ZAP.db.resolveReport(reportId, action, ZAP.auth.getUser()?.uid);
      const r = reports.find(r => r.id === reportId);
      if (r) r.status = action;
      ZAP.utils.toast(action === 'resolved' ? 'Скаргу вирішено ✓' : 'Скаргу відхилено', 'success');
      ZAP.render();
    } catch (e) {
      ZAP.utils.toast('Помилка: ' + e.message, 'error');
    }
  }

  async function deleteReportedInvite(targetId, targetType, reportId) {
    if (!confirm('Видалити це запрошення та вирішити скаргу?')) return;
    try {
      if (targetType === 'group-invite') {
        await ZAP.dbRef.ref('group-invites/' + targetId).remove();
      } else {
        await ZAP.dbRef.ref('invites/' + targetId).remove();
        await ZAP.dbRef.ref('statuses/' + targetId).remove();
      }
      await ZAP.db.resolveReport(reportId, 'resolved', ZAP.auth.getUser()?.uid);
      const r = reports.find(r => r.id === reportId);
      if (r) r.status = 'resolved';
      ZAP.utils.toast('Запрошення видалено, скаргу вирішено ✓', 'success');
      ZAP.render();
    } catch (e) {
      ZAP.utils.toast('Помилка: ' + e.message, 'error');
    }
  }

  ZAP.pages = ZAP.pages || {};
  ZAP.pages.dashboard = {
    render, load, setTab, toggleSidebar, drawCharts,
    searchUsers, setUserPage,
    changeRole, toggleBan,
    resolveReport, deleteReportedInvite,
  };
})();
