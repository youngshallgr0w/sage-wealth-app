/* ══════════════════════════════════════════════
   SAGE WEALTH — dashboard.js
   ══════════════════════════════════════════════ */

'use strict';

// ── BALANCE ────────────────────────────────────
const STARTING_BALANCE = 40000.00;

function getBalance() {
  return window.sw.getCachedBalance();
}

function formatCurrency(n) {
  return '$' + parseFloat(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── CHART DATA ──────────────────────────────────
const CHART_DATA = {
  '1M': {
    labels: ['Feb 1','Feb 10','Feb 15','Feb 20','Feb 27','Mar'],
    data:   [0, 0, 0, 0, 31000, 31000],
  },
  '3M': {
    labels: ['Jan','Feb','Mar'],
    data:   [0, 31000, 31000],
  },
  '6M': {
    labels: ['Sep','Oct','Nov','Dec','Jan','Feb'],
    data:   [0, 0, 0, 0, 0, 31000],
  },
  '1Y': {
    labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    data:   [0, 31000, 31000, 31000, 31000, 31000, 31000, 31000, 31000, 31000, 31000, 31000],
  },
};

let chart = null;
let currentPeriod = '1M';

function buildChart(period) {
  const ctx  = document.getElementById('investChart');
  if (!ctx) return;

  const d = CHART_DATA[period];

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 130);
  gradient.addColorStop(0, 'rgba(192,57,43,0.35)');
  gradient.addColorStop(1, 'rgba(192,57,43,0.00)');

  const config = {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [{
        data: d.data,
        borderColor: '#c0392b',
        backgroundColor: gradient,
        borderWidth: 2.5,
        pointBackgroundColor: '#c0392b',
        pointBorderColor: '#111',
        pointBorderWidth: 2,
        pointRadius: (ctx) => ctx.dataIndex === d.data.length - 1 ? 6 : 0,
        pointHoverRadius: 6,
        tension: 0.45,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeInOutCubic' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' $' + ctx.raw.toFixed(2),
          },
          backgroundColor: '#1a1a1a',
          borderColor: 'rgba(192,57,43,0.4)',
          borderWidth: 1,
          titleColor: '#f0f0f0',
          bodyColor: '#8a8a8a',
          padding: 10,
          cornerRadius: 8,
        }
      },
      scales: {
        x: {
          display: false,
        },
        y: {
          display: false,
          min: -2,
        }
      }
    }
  };

  if (chart) {
    chart.data.labels             = d.labels;
    chart.data.datasets[0].data   = d.data;
    chart.update('active');
  } else {
    chart = new Chart(ctx, config);
  }
}

function initChartTabs() {
  document.querySelectorAll('.ctab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ctab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      buildChart(currentPeriod);
    });
  });
}

// ── NOTIFICATION PANEL POPULATION ──────────────
async function populateNotifPanel() {
  const body = document.getElementById('notifPanelBody');
  if (!body) return;

  const notifs = await window.sw.getNotifications();

  if (notifs.length === 0) {
    body.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">No notifications yet</p>';
    return;
  }

  body.innerHTML = notifs.slice().reverse().map(n => {
    const isWithdraw = n.type === 'withdraw';
    return `
      <div class="notif-item notif-unread">
        <div class="notif-dot"></div>
        <div class="notif-icon-wrap ${isWithdraw ? 'ni-red' : 'ni-green'}">
          <i class="fa-solid ${isWithdraw ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
        </div>
        <div class="notif-content">
          <p class="notif-title">${isWithdraw ? 'Withdrawal Pending' : 'Deposit Confirmed'}</p>
          <p class="notif-msg">${n.message || (isWithdraw
            ? `Your withdrawal of <strong>${formatCurrency(n.amount || 0)}</strong> has been submitted and is pending processing.`
            : `Your deposit of <strong>${formatCurrency(n.amount || 0)}</strong> has been credited to your account.`)}</p>
          <p class="notif-time">${n.time || ''}</p>
        </div>
      </div>
    `;
  }).join('');
}

async function renderNotifBadge() {
  const notifs = await window.sw.getNotifications();
  const badge = document.querySelector('#notifBtn .db-badge');
  if (badge) badge.textContent = notifs.length;
}

// ── MAIL PANEL (real welcome/deposit message + evergreen tips) ──
function getMailItems() {
  const profile = window.sw.getCurrentProfile();
  const created = profile && profile.createdAt
    ? (profile.createdAt instanceof Date ? profile.createdAt : new Date(profile.createdAt))
    : new Date();

  const shortDate = created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fullDate  = created.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr   = created.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const firstName = profile && profile.name ? profile.name.split(' ')[0] : 'there';

  return [
    {
      icon: 'fa-solid fa-circle-check',
      bg: 'linear-gradient(135deg,#27ae60,#1e8449)',
      from: 'Sage Wealth Team',
      date: shortDate,
      subject: 'Welcome to Sage Wealth!',
      preview: `Hi ${firstName}, your account was created on ${fullDate} at ${timeStr}. Your initial deposit of ${formatCurrency(STARTING_BALANCE)} has been credited — your investment journey starts now.`,
      unread: true,
    },
    {
      icon: 'fa-solid fa-shield-halved',
      bg: 'linear-gradient(135deg,#2980b9,#1a5276)',
      from: 'Security Center',
      date: shortDate,
      subject: 'Keep Your Account Secure',
      preview: 'Set a strong withdrawal PIN and never share your login details with anyone. Your security is our top priority.',
      unread: true,
    },
    {
      icon: 'fa-solid fa-chart-line',
      bg: 'linear-gradient(135deg,#F0B90B,#e67e22)',
      from: 'Investment Insights',
      date: shortDate,
      subject: 'Getting Started with BTC Investing',
      preview: 'Track your portfolio growth anytime from the Dashboard tab. Small, consistent deposits can compound significantly over time.',
      unread: false,
    },
    {
      icon: 'fa-solid fa-coins',
      bg: 'linear-gradient(135deg,#8e44ad,#6c3483)',
      from: 'Sage Wealth Tips',
      date: shortDate,
      subject: 'Earn More With BTC Staking',
      preview: 'Did you know you can earn passive rewards through BTC staking? Visit the Statistics tab to learn more about maximizing your returns.',
      unread: false,
    },
  ];
}

function renderMailPanel() {
  const body = document.getElementById('mailPanelBody');
  if (!body) return;

  const mails = getMailItems();

  body.innerHTML = mails.map(m => `
    <div class="mail-item${m.unread ? ' mail-unread' : ''}">
      <div class="mail-avatar" style="background:${m.bg}"><i class="${m.icon}"></i></div>
      <div class="mail-content">
        <div class="mail-meta"><span class="mail-from">${m.from}</span><span class="mail-date">${m.date}</span></div>
        <p class="mail-subject">${m.subject}</p>
        <p class="mail-preview">${m.preview}</p>
      </div>
    </div>
  `).join('');
}

function renderMailBadge() {
  const badge = document.getElementById('mailBadge');
  if (!badge) return;
  const unreadCount = getMailItems().filter(m => m.unread).length;
  badge.textContent = unreadCount;
}

// ── PANELS ─────────────────────────────────────
function openPanel(id) {
  const panel = document.getElementById(id);
  if (panel) {
    panel.classList.remove('hidden');
    if (id === 'notifPanel') populateNotifPanel();
    if (id === 'mailPanel') renderMailPanel();
  }
}

function closePanel(id) {
  const panel = document.getElementById(id);
  if (!panel) return;
  const drawer = panel.querySelector('.side-panel');
  if (drawer) {
    drawer.style.transition = 'transform 0.28s cubic-bezier(0.4,0,1,1)';
    drawer.style.transform  = 'translateX(100%)';
  }
  panel.style.transition = 'opacity 0.3s ease';
  panel.style.opacity    = '0';
  setTimeout(() => {
    panel.classList.add('hidden');
    if (drawer) { drawer.style.transform = ''; drawer.style.transition = ''; }
    panel.style.opacity    = '';
    panel.style.transition = '';
  }, 300);
}

function initPanels() {
  // Open
  document.getElementById('notifBtn').addEventListener('click', () => openPanel('notifPanel'));
  document.getElementById('mailBtn').addEventListener('click',  () => openPanel('mailPanel'));

  // Close buttons
  document.getElementById('closeNotif').addEventListener('click', () => closePanel('notifPanel'));
  document.getElementById('closeMail').addEventListener('click',  () => closePanel('mailPanel'));

  // Close on overlay click
  document.getElementById('notifPanel').addEventListener('click', e => {
    if (e.target === document.getElementById('notifPanel')) closePanel('notifPanel');
  });
  document.getElementById('mailPanel').addEventListener('click', e => {
    if (e.target === document.getElementById('mailPanel')) closePanel('mailPanel');
  });
}

// ── BALANCE DISPLAY ─────────────────────────────
function renderBalance() {
  const bal = getBalance();
  const fmt = formatCurrency(bal);

  const dashBal   = document.getElementById('dashBalance');
  const chartSumm = document.getElementById('chartSummaryVal');

  if (dashBal)   dashBal.textContent   = fmt;
  if (chartSumm) chartSumm.textContent = fmt;
}

// ── RECENT ACTIVITY (real, from notifications) ──
async function renderRecentActivity() {
  const list = document.getElementById('recentList');
  if (!list) return;

  const profile = window.sw.getCurrentProfile();
  const notifs  = await window.sw.getNotifications();

  const created = profile && profile.createdAt
    ? (profile.createdAt instanceof Date ? profile.createdAt : new Date(profile.createdAt))
    : new Date();

  const entries = [
    {
      date: created,
      name: 'Initial Deposit',
      amount: STARTING_BALANCE,
      positive: true,
      icon: 'ri-green',
      iconClass: 'fa-arrow-down',
    },
    ...notifs.map(n => ({
      date: n.time ? new Date(n.time.replace(' ', 'T')) : new Date(),
      name: n.type === 'withdraw' ? 'Withdrawal' : 'Deposit',
      amount: parseFloat(n.amount) || 0,
      positive: n.type !== 'withdraw',
      icon: n.type === 'withdraw' ? '' : 'ri-green',
      iconClass: n.type === 'withdraw' ? 'fa-arrow-up' : 'fa-arrow-down',
    })),
  ];

  entries.sort((a, b) => b.date - a.date);

  list.innerHTML = entries.slice(0, 5).map(e => {
    const dateStr = e.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const iconStyle = e.icon ? '' : ' style="background:rgba(192,57,43,0.12);color:#e74c3c;border:1px solid rgba(192,57,43,0.2)"';
    return `
      <div class="recent-item">
        <div class="ri-icon ${e.icon}"${iconStyle}><i class="fa-solid ${e.iconClass}"></i></div>
        <div class="ri-info">
          <span class="ri-name">${e.name}</span>
          <span class="ri-date">${dateStr}</span>
        </div>
        <span class="ri-amount ${e.positive ? 'ri-pos' : 'ri-neg'}">${e.positive ? '+' : '-'}${formatCurrency(e.amount)}</span>
      </div>
    `;
  }).join('');
}

// ── BOOT ──────────────────────────────────────
document.addEventListener('sw:ready', (e) => {
  const { profile } = e.detail;

  const avatarImg = document.getElementById('dbAvatarImg');
  const bankIdEl  = document.querySelector('.db-bank-id');
  const greetEl   = document.getElementById('greetName');
  const phoneEl   = document.getElementById('dbPhone');
  if (avatarImg) avatarImg.src = profile.photoURL;
  if (bankIdEl)  bankIdEl.textContent = profile.name;
  if (greetEl)   greetEl.textContent  = profile.name;
  if (phoneEl)   phoneEl.textContent  = profile.phone || '';

  renderBalance();
  buildChart('1M');
  initChartTabs();
  initPanels();
  renderNotifBadge();
  renderRecentActivity();
  renderMailBadge();
});