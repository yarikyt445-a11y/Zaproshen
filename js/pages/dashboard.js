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

    // Task 5: Moderators cannot access the overview tab — redirect them to users or reports
    const isModeOnly = ZAP.auth.isModerator() && !ZAP.auth.isAdmin();
    if (isModeOnly && dashTab === 'overview') {
      dashTab = 'users';
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
    const isModeOnly = ZAP.auth.isModerator() && !ZAP.auth.isAdmin();

    return `
    <aside class="sidebar" id="dash-sidebar">
      <div class="sidebar-logo">Запрошення ✦</div>

      <div class="sidebar-section">Меню</div>
      ${!isModeOnly ? `
      <button class="sidebar-item ${dashTab === 'overview' ? 'active' : ''}"
        onclick="ZAP.pages.dashboard.setTab('overview')">
        <span class="sidebar-item-icon">📊</span> Огляд
      </button>
      ` : ''}
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
    const onlineUsers = users.filter(u => u.lastSeen && (Date.now() - u.lastSeen < 2 * 60 * 1000));
    const onlineCount = onlineUsers.length;

    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <h1 class="page-title" style="margin-bottom:0">Дашборд</h1>
      <button class="hamburger" onclick="ZAP.pages.dashboard.toggleSidebar()">☰</button>
    </div>

    <!-- Stats cards -->
    <div class="stats-grid">
      ${statCard('👤', 'users', 'Користувачі', stats?.totalUsers || 0)}
      ${statCard('🟢', 'online', 'Онлайн зараз', onlineCount)}
      ${statCard('📨', 'invites', 'Запрошення', stats?.totalInvites || 0)}
      ${statCard('✅', 'accepted', 'Прийняті', stats?.acceptedInvites || 0)}
      ${statCard('📈', 'active', 'Активні (7д)', stats?.activeUsers || 0)}
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

    <!-- Advanced Stats Grid -->
    <div class="grid2" style="margin-bottom: 28px;">
      <!-- System Roles & Bans -->
      <div class="table-card">
        <div class="table-header">
          <h3>Аудиторія та безпека</h3>
        </div>
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <div style="display:flex;justify-content:space-between;font-size:.9rem">
            <span style="color:var(--muted)">👑 Засновники</span>
            <span style="font-weight:600;color:var(--ink)">${stats?.roleCounts?.founder || 0}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.9rem">
            <span style="color:var(--muted)">🛠 Тех-адміністратори</span>
            <span style="font-weight:600;color:var(--ink)">${stats?.roleCounts?.techAdmin || 0}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.9rem">
            <span style="color:var(--muted)">🛡 Модератори</span>
            <span style="font-weight:600;color:var(--ink)">${stats?.roleCounts?.moderator || 0}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.9rem">
            <span style="color:var(--muted)">👥 Звичайні користувачі</span>
            <span style="font-weight:600;color:var(--ink)">${stats?.roleCounts?.user || 0}</span>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:10px;display:flex;justify-content:space-between;font-size:.9rem">
            <span style="color:var(--red);font-weight:500">🚫 Заблоковані користувачі</span>
            <span style="font-weight:600;color:var(--red)">${stats?.bannedCount || 0}</span>
          </div>
        </div>
      </div>

      <!-- Invite Statuses & Social Connections -->
      <div class="table-card">
        <div class="table-header">
          <h3>Статуси зустрічей та взаємодія</h3>
        </div>
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
          <div style="display:flex;justify-content:space-between;font-size:.9rem">
            <span style="color:var(--muted)">✅ Прийняті запрошення</span>
            <span style="font-weight:600;color:var(--green)">${stats?.acceptedInvites || 0}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.9rem">
            <span style="color:var(--muted)">❌ Відхилені запрошення</span>
            <span style="font-weight:600;color:var(--red)">${stats?.declinedInvites || 0}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.9rem">
            <span style="color:var(--muted)">📅 Перенесені події</span>
            <span style="font-weight:600;color:var(--gold)">${stats?.rescheduleInvites || 0}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:.9rem">
            <span style="color:var(--muted)">⏳ В очікуванні відповіді</span>
            <span style="font-weight:600;color:var(--ink)">
              ${(stats?.totalInvites || 0) - (stats?.acceptedInvites || 0) - (stats?.declinedInvites || 0) - (stats?.rescheduleInvites || 0)}
            </span>
          </div>
          <div style="border-top:1px solid var(--border);padding-top:10px;display:flex;justify-content:space-between;font-size:.9rem">
            <span style="color:var(--ink);font-weight:500">🤝 Всього зв'язків дружби</span>
            <span style="font-weight:600;color:var(--ink)">${stats?.totalFriendsConnections || 0}</span>
          </div>
        </div>
      </div>

      <!-- Moderation Reports Breakdown -->
      <div class="table-card" style="grid-column: span 2;">
        <div class="table-header">
          <h3>Статистика модерації скарг</h3>
        </div>
        <div style="padding: 20px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; text-align: center;">
          <div>
            <div style="font-size:1.6rem;font-weight:700;color:var(--muted)">${stats?.reportsCount?.total || 0}</div>
            <div style="font-size:.8rem;color:var(--muted)">Всього скарг</div>
          </div>
          <div>
            <div style="font-size:1.6rem;font-weight:700;color:var(--red)">${stats?.reportsCount?.pending || 0}</div>
            <div style="font-size:.8rem;color:var(--red)">Очікують розгляду</div>
          </div>
          <div>
            <div style="font-size:1.6rem;font-weight:700;color:var(--green)">${stats?.reportsCount?.resolved || 0}</div>
            <div style="font-size:.8rem;color:var(--green)">Вирішено (Схвалено)</div>
          </div>
          <div>
            <div style="font-size:1.6rem;font-weight:700;color:var(--gold)">${stats?.reportsCount?.dismissed || 0}</div>
            <div style="font-size:.8rem;color:var(--gold)">Відхилено</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Online users and their actions -->
    <div class="table-card" style="margin-bottom: 28px;">
      <div class="table-header">
        <h3>У мережі зараз (${onlineCount})</h3>
      </div>
      ${onlineCount === 0 ? `
        <div style="text-align:center;padding:24px 0;color:var(--muted);font-style:italic;font-size:0.95rem">
          🟢 Наразі немає користувачів у мережі
        </div>
      ` : `
        <div class="table-scroll-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Користувач</th><th>Логін</th><th>Роль</th><th>Поточна дія</th>
          </tr></thead>
          <tbody>
            ${onlineUsers.map(u => `
              <tr>
                <td style="display:flex;align-items:center;gap:8px">
                  ${ZAP.utils.avatarHTML(u, 'sm')}
                  <span style="font-weight:500">${ZAP.utils.esc(u.name)}</span>
                </td>
                <td style="color:var(--muted)">@${ZAP.utils.esc(u.login)}</td>
                <td>${ZAP.utils.roleBadge(u.role)}</td>
                <td style="font-weight:500;color:var(--gold)">
                  <span class="fb-dot ok" style="margin-right:6px"></span>
                  ${ZAP.utils.esc(u.currentAction || 'Переглядає сайт')}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        </div>
      `}
    </div>

    <!-- Extra Stats Section -->
    <div class="grid2" style="margin-bottom: 28px;">
      <!-- Invites Breakdown -->
      <div class="table-card">
        <div class="table-header">
          <h3>Формати запрошень</h3>
        </div>
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.9rem;margin-bottom:6px">
              <span>👤 Персональні запрошення</span>
              <span style="font-weight:600">${stats?.personalInvitesCount || 0}</span>
            </div>
            <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
              <div style="background:var(--ink);height:100%;width:${stats?.totalInvites ? ((stats.personalInvitesCount || 0) / stats.totalInvites) * 100 : 0}%"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:.9rem;margin-bottom:6px">
              <span>👥 Групові події</span>
              <span style="font-weight:600">${stats?.groupInvitesCount || 0}</span>
            </div>
            <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
              <div style="background:var(--gold);height:100%;width:${stats?.totalInvites ? ((stats.groupInvitesCount || 0) / stats.totalInvites) * 100 : 0}%"></div>
            </div>
          </div>
          <div style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 4px;">
            <div style="display:flex;justify-content:space-between;font-size:.9rem;color:var(--muted)">
              <span>Середня активність:</span>
              <span style="font-weight:500;color:var(--ink)">
                ${stats?.totalUsers ? (stats.totalInvites / stats.totalUsers).toFixed(1) : 0} запр./користувача
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Popular Types -->
      <div class="table-card">
        <div class="table-header">
          <h3>Найпопулярніші події</h3>
        </div>
        <div style="padding: 16px 20px; display: flex; flex-direction: column; gap: 10px;">
          ${Object.entries(stats?.typeCounts || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([type, count]) => {
              const t = ZAP.utils.TYPE_MAP[type] || ZAP.utils.TYPE_MAP.other || { e: '📅', l: 'Інше' };
              const percent = stats?.totalInvites ? (count / stats.totalInvites) * 100 : 0;
              return `
              <div>
                <div style="display:flex;justify-content:space-between;font-size:.9rem;margin-bottom:4px">
                  <span>${t.e} ${t.l}</span>
                  <span style="color:var(--muted)">${count} (${percent.toFixed(0)}%)</span>
                </div>
                <div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden">
                  <div style="background:var(--green);height:100%;width:${percent}%"></div>
                </div>
              </div>`;
            }).join('') || `<div style="text-align:center;padding:24px 0;color:var(--muted);font-style:italic">Немає створених подій</div>`}
        </div>
      </div>
    </div>

    <!-- Recent users -->
    <div class="table-card">
      <div class="table-header">
        <h3>Останні реєстрації</h3>
      </div>
      <div class="table-scroll-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Користувач</th><th>Логін</th><th>Роль</th><th>ID користувача</th><th>Зареєстрований</th><th>Остання активність</th><th>Статус</th>
        </tr></thead>
        <tbody>
          ${users.slice(0, 5).map(u => {
            const statusBadge = u.banned
              ? `<span class="badge badge-declined">🚫 Бан</span>`
              : '<span class="badge badge-accepted">✓ Активний</span>';

            return `
            <tr>
              <td style="display:flex;align-items:center;gap:8px">
                ${ZAP.utils.avatarHTML(u, 'sm')}
                <span style="font-weight:500">${ZAP.utils.esc(u.name)}</span>
              </td>
              <td style="color:var(--muted)">@${ZAP.utils.esc(u.login)}</td>
              <td>${ZAP.utils.roleBadge(u.role)}</td>
              <td style="font-family:monospace;font-size:.82rem;color:var(--muted)">${ZAP.utils.esc(u.uniqueId || '—')}</td>
              <td style="font-size:.82rem;color:var(--muted)">${ZAP.utils.timeAgo(u.createdAt)}</td>
              <td style="font-size:.82rem;color:var(--muted)">${u.lastSeen ? ZAP.utils.timeAgo(u.lastSeen) : 'Ніколи'}</td>
              <td>${statusBadge}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>
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
    const myProfile = ZAP.auth.getProfile();
    const myRank = getRank(myProfile?.role);
    const isModeOnly = ZAP.auth.isModerator() && !ZAP.auth.isAdmin();

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

      <div class="table-scroll-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Користувач</th><th>Логін</th><th>Роль</th><th>Статус</th><th>Дії</th>
        </tr></thead>
        <tbody>
          ${paged.map(u => {
            const targetRank = getRank(u.role);
            const canBan = myRank > targetRank; // Task 6: can only ban lower ranks

            // Task 1: Build ban status text
            let banStatusText = '';
            if (u.banned) {
              if (u.bannedUntil) {
                const msLeft = u.bannedUntil - Date.now();
                if (msLeft > 0) {
                  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
                  const hoursLeft = Math.ceil(msLeft / (60 * 60 * 1000));
                  banStatusText = daysLeft > 1 ? `🚫 Бан · ${daysLeft} дн.` : `🚫 Бан · ${hoursLeft} год.`;
                } else {
                  banStatusText = '🚫 Бан (закінчується)';
                }
              } else {
                banStatusText = '🚫 Назавжди';
              }
            }

            return `
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
                  ? `<span class="badge badge-declined" title="${u.bannedUntil ? new Date(u.bannedUntil).toLocaleString('uk-UA') : 'Перманентно'}">${banStatusText}</span>`
                  : '<span class="badge badge-accepted">✓ Активний</span>'}
              </td>
              <td>
                ${u.banned
                  ? (canBan ? `<button class="btn btn-sm btn-gold" onclick="ZAP.pages.dashboard.toggleBan('${u.uid}',false)">Розбанити</button>` : '<span style="color:var(--muted);font-size:.8rem">—</span>')
                  : (canBan ? `<button class="btn btn-sm btn-outline" style="color:var(--red);border-color:var(--red)"
                      onclick="ZAP.pages.dashboard.toggleBan('${u.uid}',true)">Бан</button>` : '<span style="color:var(--muted);font-size:.8rem">—</span>')}
              </td>
            </tr>`; }).join('')}
        </tbody>
      </table>
      </div>

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
    let invitePreview = '';
    
    // Helper to find profile in loaded users array
    const getUserProfile = (uid) => users.find(u => u.uid === uid) || null;

    if (r.targetContent) {
      const tc = r.targetContent;
      const dateText = tc.date || 'Не вказано';
      const timeText = tc.time ? `, ${tc.time}` : '';
      const placeText = tc.place ? ` · 📍 ${ZAP.utils.esc(tc.place)}` : '';

      const creatorUid = tc.creatorUid || '';
      const recipientUid = tc.recipientUid || (r.reporterUid && r.targetType === 'invite' ? r.reporterUid : '');

      const creatorProfile = getUserProfile(creatorUid);
      const recipientProfile = getUserProfile(recipientUid);

      const creatorIdText = creatorProfile 
        ? ` (<strong>${ZAP.utils.esc(creatorProfile.uniqueId)}</strong>, @${ZAP.utils.esc(creatorProfile.login)})`
        : (creatorUid ? ` (ID: ${ZAP.utils.esc(creatorUid)})` : '');
      const creator = tc.creatorName ? ` від <strong>${ZAP.utils.esc(tc.creatorName)}</strong>${creatorIdText}` : '';

      const toIdText = recipientProfile
        ? ` (<strong>${ZAP.utils.esc(recipientProfile.uniqueId)}</strong>, @${ZAP.utils.esc(recipientProfile.login)})`
        : (recipientUid ? ` (ID: ${ZAP.utils.esc(recipientUid)})` : '');
      const toText = tc.to ? ` для <strong>${ZAP.utils.esc(tc.to)}</strong>${toIdText}` : ' (Групове)';

      invitePreview = `
        <div class="complaint-invite-preview">
          <div class="cip-header">
            <span>📋 Вміст запрошення${toText}${creator}</span>
          </div>
          <div class="cip-content">
            ${tc.msg ? `<p class="cip-msg">« ${ZAP.utils.esc(tc.msg)} »</p>` : '<p class="cip-msg" style="font-style:italic;color:var(--muted)">Без тексту повідомлення</p>'}
            <div class="cip-details" style="font-size:.78rem;color:var(--muted);margin-top:5px">
              📅 ${ZAP.utils.esc(dateText)}${timeText}${placeText}
            </div>
          </div>
        </div>
      `;
    }

    const reporterProfile = getUserProfile(r.reporterUid);
    const reporterIdText = reporterProfile 
      ? ` (<strong>${ZAP.utils.esc(reporterProfile.uniqueId)}</strong>, @${ZAP.utils.esc(reporterProfile.login)})`
      : (r.reporterUid ? ` (ID: ${ZAP.utils.esc(r.reporterUid)})` : '');

    return `
    <div class="complaint-card ${isResolved ? 'resolved' : ''}">
      <div class="complaint-icon">⚠️</div>
      <div class="complaint-body">
        <div class="complaint-reason">${ZAP.utils.esc(r.reason)}</div>
        <div class="complaint-meta">
          Від: ${ZAP.utils.esc(r.reporterName || 'Анонім')}${reporterIdText} ·
          Тип: ${r.targetType === 'invite' ? '📨 Запрошення' : '👥 Групове'} ·
          ${ZAP.utils.timeAgo(r.createdAt)}
          ${r.comment ? `<br>💬 ${ZAP.utils.esc(r.comment)}` : ''}
        </div>
        ${invitePreview}
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

    const filtered = userSearch
      ? users.filter(u =>
          (u.login || '').toLowerCase().includes(userSearch.toLowerCase()) ||
          (u.name || '').toLowerCase().includes(userSearch.toLowerCase()))
      : users;

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const paged = filtered.slice(userPage * PAGE_SIZE, (userPage + 1) * PAGE_SIZE);
    const myProfile = ZAP.auth.getProfile();
    const myRank = getRank(myProfile?.role);

    // 1. Update total count header
    const headerTitle = document.querySelector('.table-header h3');
    if (headerTitle) {
      headerTitle.textContent = `Всього: ${filtered.length}`;
    }

    // 2. Update table rows
    const tbody = document.querySelector('.data-table tbody');
    if (tbody) {
      tbody.innerHTML = paged.map(u => {
        const targetRank = getRank(u.role);
        const canBan = myRank > targetRank;

        let banStatusText = '';
        if (u.banned) {
          if (u.bannedUntil) {
            const msLeft = u.bannedUntil - Date.now();
            if (msLeft > 0) {
              const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
              const hoursLeft = Math.ceil(msLeft / (60 * 60 * 1000));
              banStatusText = daysLeft > 1 ? `🚫 Бан · ${daysLeft} дн.` : `🚫 Бан · ${hoursLeft} год.`;
            } else {
              banStatusText = '🚫 Бан (закінчується)';
            }
          } else {
            banStatusText = '🚫 Назавжди';
          }
        }

        return `
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
              ? `<span class="badge badge-declined" title="${u.bannedUntil ? new Date(u.bannedUntil).toLocaleString('uk-UA') : 'Перманентно'}">${banStatusText}</span>`
              : '<span class="badge badge-accepted">✓ Активний</span>'}
          </td>
          <td>
            ${u.banned
              ? (canBan ? `<button class="btn btn-sm btn-gold" onclick="ZAP.pages.dashboard.toggleBan('${u.uid}',false)">Розбанити</button>` : '<span style="color:var(--muted);font-size:.8rem">—</span>')
              : (canBan ? `<button class="btn btn-sm btn-outline" style="color:var(--red);border-color:var(--red)"
                  onclick="ZAP.pages.dashboard.toggleBan('${u.uid}',true)">Бан</button>` : '<span style="color:var(--muted);font-size:.8rem">—</span>')}
          </td>
        </tr>`;
      }).join('');
    }

    // 3. Update pagination
    let paginationDiv = document.querySelector('.pagination');
    if (totalPages > 1) {
      const paginationHTML = Array.from({length: totalPages}, (_, i) => `
        <button class="page-btn ${i === userPage ? 'active' : ''}"
          onclick="ZAP.pages.dashboard.setUserPage(${i})">${i + 1}</button>
      `).join('');
      
      if (paginationDiv) {
        paginationDiv.innerHTML = paginationHTML;
      } else {
        const tableCard = document.querySelector('.table-card');
        if (tableCard) {
          paginationDiv = document.createElement('div');
          paginationDiv.className = 'pagination';
          paginationDiv.innerHTML = paginationHTML;
          tableCard.appendChild(paginationDiv);
        }
      }
    } else {
      if (paginationDiv) {
        paginationDiv.remove();
      }
    }
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

  // ── Role hierarchy helper ──
  const ROLE_RANK = { user: 0, moderator: 1, 'tech-admin': 2, founder: 3 };
  function getRank(role) { return ROLE_RANK[role] ?? 0; }

  async function toggleBan(uid, ban) {
    // ── Task 6: Hierarchy check ──
    const myProfile = ZAP.auth.getProfile();
    const myRank = getRank(myProfile?.role);
    const targetUser = users.find(u => u.uid === uid);
    if (targetUser) {
      const targetRank = getRank(targetUser.role);
      if (ban && targetRank >= myRank) {
        ZAP.utils.toast('Ви не можете заблокувати користувача з рівною або вищою роллю', 'error');
        return;
      }
    }

    let until = null;
    
    if (ban) {
      const days = await ZAP.utils.prompt('На скільки днів забанити?', 'Залиште порожнім для перманентного бану');
      if (days === null) return; // cancelled
      if (days.trim() !== '' && !isNaN(Number(days))) {
        until = Date.now() + (Number(days) * 24 * 60 * 60 * 1000);
      }
    } else {
      if (!await ZAP.utils.confirm('Ви впевнені, що хочете розбанити цього користувача?')) return;
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
    if (!await ZAP.utils.confirm('Видалити це запрошення та вирішити скаргу?')) return;
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
