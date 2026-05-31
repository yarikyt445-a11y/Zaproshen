/* ═══════════════════════════════════════════════════════
   Utils — Common helpers
   ═══════════════════════════════════════════════════════ */

(function () {
  // ── HTML escape ──
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Generate short ID ──
  function genId() {
    return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
  }

  // ── Generate unique user ID (ZAP-XXXXXX) ──
  function genUserId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return 'ZAP-' + id;
  }

  // ── Copy to clipboard ──
  function copyText(text, btn) {
    const flash = () => {
      if (!btn) return;
      btn.classList.add('copy-ok');
      const t = btn.textContent;
      btn.textContent = '✓ Скопійовано!';
      setTimeout(() => { btn.classList.remove('copy-ok'); btn.textContent = t; }, 2400);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(flash).catch(() => { legacyCopy(text); flash(); });
    } else {
      legacyCopy(text); flash();
    }
  }

  function legacyCopy(text) {
    const el = Object.assign(document.createElement('textarea'), { value: text });
    el.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(el); el.focus(); el.select();
    try { document.execCommand('copy'); } catch { }
    document.body.removeChild(el);
  }

  // ── Badge HTML ──
  function badge(status) {
    const MAP = {
      pending: ['badge-pending', '⏳', 'Очікує'],
      accepted: ['badge-accepted', '✓', 'Прийнято'],
      declined: ['badge-declined', '✕', 'Відхилено'],
      reschedule: ['badge-reschedule', '↕', 'Перенесення'],
    };
    const [cls, icon, label] = MAP[status] || MAP.pending;
    return `<span class="badge ${cls}">${icon} ${label}</span>`;
  }

  // ── Role badge ──
  function roleBadge(role) {
    const MAP = {
      founder: ['badge-role badge-founder', '👑', 'Засновник'],
      'tech-admin': ['badge-role badge-tech-admin', '⚙️', 'Тех-адмін'],
      moderator: ['badge-role badge-moderator', '🛡️', 'Модератор'],
      user: ['badge-role badge-user', '', 'Користувач'],
    };
    const [cls, icon, label] = MAP[role] || MAP.user;
    return `<span class="badge ${cls}">${icon ? icon + ' ' : ''}${label}</span>`;
  }

  // ── Divider line ──
  function divLine() {
    return '<div class="div-line"><i>✦</i></div>';
  }

  // ── Confetti ──
  function boom() {
    const colors = ['#c9922a', '#2d7a4f', '#e05c5c', '#5a8fd4', '#e8b84b', '#6db87a'];
    for (let i = 0; i < 60; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText = `
        left:${Math.random() * 100}vw;top:-10px;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        width:${6 + Math.random() * 8}px;height:${6 + Math.random() * 8}px;
        border-radius:${Math.random() > .5 ? '50%' : '2px'};
        animation-duration:${1.5 + Math.random() * 2}s;
        animation-delay:${Math.random() * .6}s;
      `;
      document.body.appendChild(el);
      el.addEventListener('animationend', () => el.remove());
    }
  }

  // ── Toast notifications ──
  function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    el.innerHTML = `<span>${icons[type] || '✦'}</span><span>${esc(message)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // ── Date formatting ──
  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return dateStr; }
  }

  function timeAgo(timestamp) {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'щойно';
    if (mins < 60) return `${mins} хв тому`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} год тому`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days} дн тому`;
    return formatDate(new Date(timestamp).toISOString().split('T')[0]);
  }

  // ── Avatar HTML ──
  function avatarHTML(user, size = '') {
    const cls = size ? `avatar avatar-${size}` : 'avatar';
    const src = user?.avatar || user?.avatarBase64 || null;
    if (src) {
      return `<div class="${cls}"><img src="${esc(src)}" alt="${esc(user.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/></div>`;
    }
    const initials = (user?.name || '?').charAt(0).toUpperCase();
    return `<div class="${cls}">${initials}</div>`;
  }

  // ── Spinner HTML ──
  function spinner() {
    return '<div class="page-loader"><div class="spinner"></div></div>';
  }

  // ── Invite types ──
  const TYPES = [
    { v: 'date', l: 'Побачення', e: '🌹' },
    { v: 'walk', l: 'Прогулянка', e: '🍃' },
    { v: 'birthday', l: 'День народження', e: '🎂' },
    { v: 'party', l: 'Свято / Вечірка', e: '🥂' },
    { v: 'cinema', l: 'Кіно', e: '🎬' },
    { v: 'coffee', l: 'Кава', e: '☕' },
    { v: 'travel', l: 'Подорож', e: '✈️' },
    { v: 'other', l: 'Інше', e: '✨' },
  ];
  const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.v, t]));

  // ── Invite link ──
  function inviteLink(invId) {
    return location.href.split('#')[0] + '#i/' + invId;
  }

  // ── Expose ──
  ZAP.utils = {
    esc, genId, genUserId, copyText, badge, roleBadge, divLine,
    boom, toast, formatDate, timeAgo, avatarHTML, spinner,
    TYPES, TYPE_MAP, inviteLink,
  };
})();
