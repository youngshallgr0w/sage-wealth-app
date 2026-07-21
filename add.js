/* ══════════════════════════════════════════════
   SAGE WEALTH — add.js  (Statistics Page)
   ══════════════════════════════════════════════ */

'use strict';

// ── BALANCE ────────────────────────────────────
const STARTING_BALANCE = 40000.00;

function getBalance() {
  return window.sw.getCachedBalance();
}

function formatCurrency(n) {
  return '$' + parseFloat(n).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

// ── TOTAL DEPOSITS / WITHDRAWN (real, from notifications) ──
async function renderTotals() {
  const notifs = await window.sw.getNotifications();

  const totalDeposits = STARTING_BALANCE + notifs
    .filter(n => n.type === 'deposit')
    .reduce((sum, n) => sum + (parseFloat(n.amount) || 0), 0);

  const totalWithdrawn = notifs
    .filter(n => n.type === 'withdraw')
    .reduce((sum, n) => sum + (parseFloat(n.amount) || 0), 0);

  const depEl = document.getElementById('totalDepositsVal');
  const wdEl  = document.getElementById('totalWithdrawnVal');
  if (depEl) depEl.textContent = formatCurrency(totalDeposits);
  if (wdEl)  wdEl.textContent  = formatCurrency(totalWithdrawn);
}

// ── TRANSACTION TIMELINE (real, from notifications) ──
async function renderTimeline() {
  const list = document.getElementById('timelineList');
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
      meta: 'Account funded · Bitcoin (BTC)',
      amount: STARTING_BALANCE,
      positive: true,
      dot: 'green',
      bar: 'green',
    },
    ...notifs.map(n => ({
      date: n.time ? new Date(n.time.replace(' ', 'T')) : new Date(),
      name: n.type === 'withdraw' ? 'Withdrawal' : 'Deposit',
      meta: n.type === 'withdraw' ? 'Sent to wallet' : 'Bitcoin (BTC)',
      amount: parseFloat(n.amount) || 0,
      positive: n.type !== 'withdraw',
      dot: n.type === 'withdraw' ? 'red' : 'green',
      bar: n.type === 'withdraw' ? 'red' : 'green',
    })),
  ];

  entries.sort((a, b) => b.date - a.date);

  const maxAmt = Math.max(...entries.map(e => e.amount), 1);

  list.innerHTML = entries.map((e, i) => {
    const day = String(e.date.getDate()).padStart(2, '0');
    const mon = e.date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const time = e.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const pct = Math.max(2, Math.round((e.amount / maxAmt) * 100));
    return `
      <div class="tl-row${i === entries.length - 1 ? ' tl-last' : ''}">
        <div class="tl-date-col">
          <span class="tl-day">${day}</span>
          <span class="tl-mon">${mon}</span>
        </div>
        <div class="tl-line-col">
          <div class="tl-dot tl-dot-${e.dot}"></div>
        </div>
        <div class="tl-content-col">
          <div class="tl-row-inner">
            <div>
              <p class="tl-name">${e.name}</p>
              <p class="tl-meta">${e.meta} · ${time}</p>
            </div>
            <span class="tl-amt ${e.positive ? 'tl-pos' : 'tl-neg'}">${e.positive ? '+' : '-'}${formatCurrency(e.amount)}</span>
          </div>
          <div class="tl-bar-wrap">
            <div class="tl-bar tl-bar-${e.bar}" style="width:${pct}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── LINE CHART DATA ────────────────────────────
const LINE_DATA = {
  '1M': {
    deposits:    [0, 0, 0, 0, 250000, 250000],
    withdrawals: [0, 0, 0, 0, 0,      0     ],
    labels:      ['Mar 1','Mar 5','Mar 10','Mar 13','Mar 16','Mar 20'],
  },
  '3M': {
    deposits:    [0, 0, 250000],
    withdrawals: [0, 0, 0     ],
    labels:      ['Jan','Feb','Mar'],
  },
  '6M': {
    deposits:    [0, 0, 0, 0, 0, 250000],
    withdrawals: [0, 0, 0, 0, 0, 0     ],
    labels:      ['Oct','Nov','Dec','Jan','Feb','Mar'],
  },
  '1Y': {
    deposits:    [0, 0, 250000, 250000, 250000, 250000, 250000, 250000, 250000, 250000, 250000, 250000],
    withdrawals: [0, 0, 0,      0,      0,      0,      0,      0,      0,      0,      0,      0     ],
    labels:      ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  },
};

// ── BAR CHART DATA ─────────────────────────────
const BAR_DATA = {
  weekly: {
    labels:      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    deposits:    [0, 0, 0, 250000, 0, 0, 0],
    withdrawals: [0, 0, 0, 0,      0, 0, 0],
  },
  monthly: {
    labels:      ['Mar 1–7','Mar 8–14','Mar 15–21','Mar 22–28'],
    deposits:    [0, 0, 250000, 0],
    withdrawals: [0, 0, 0,      0],
  },
};

let lineChart = null;
let barChart  = null;
let donutChart = null;
let currentPeriod = '1M';
let currentBarPeriod = 'weekly';

// ── BUILD LINE CHART ───────────────────────────
function buildLineChart(period) {
  const ctx  = document.getElementById('lineChart');
  if (!ctx) return;
  const d    = LINE_DATA[period];
  const c    = ctx.getContext('2d');

  const gradDep = c.createLinearGradient(0, 0, 0, 130);
  gradDep.addColorStop(0, 'rgba(192,57,43,0.4)');
  gradDep.addColorStop(1, 'rgba(192,57,43,0.0)');

  const gradWd = c.createLinearGradient(0, 0, 0, 130);
  gradWd.addColorStop(0, 'rgba(231,76,60,0.15)');
  gradWd.addColorStop(1, 'rgba(231,76,60,0.0)');

  const config = {
    type: 'line',
    data: {
      labels: d.labels,
      datasets: [
        {
          label: 'Deposits',
          data: d.deposits,
          borderColor: '#c0392b',
          backgroundColor: gradDep,
          borderWidth: 2.5,
          pointRadius: (ctx) => ctx.dataIndex === d.deposits.length - 1 ? 5 : 0,
          pointBackgroundColor: '#c0392b',
          pointBorderColor: '#171717',
          pointBorderWidth: 2,
          tension: 0.45,
          fill: true,
        },
        {
          label: 'Withdrawals',
          data: d.withdrawals,
          borderColor: '#e74c3c',
          backgroundColor: gradWd,
          borderWidth: 1.5,
          pointRadius: (ctx) => ctx.dataIndex === d.withdrawals.findIndex(v => v > 0) ? 4 : 0,
          pointBackgroundColor: '#e74c3c',
          pointBorderColor: '#171717',
          pointBorderWidth: 2,
          tension: 0.45,
          fill: true,
          borderDash: [4, 3],
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeInOutCubic' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ' $' + ctx.raw.toLocaleString() },
          backgroundColor: '#1f1f1f',
          borderColor: 'rgba(192,57,43,0.4)',
          borderWidth: 1,
          titleColor: '#f0f0f0',
          bodyColor: '#7a7a7a',
          padding: 10,
          cornerRadius: 8,
        }
      },
      scales: {
        x: { display: false },
        y: { display: false, min: -200 }
      }
    }
  };

  if (lineChart) {
    lineChart.data.labels = d.labels;
    lineChart.data.datasets[0].data = d.deposits;
    lineChart.data.datasets[1].data = d.withdrawals;
    lineChart.update('active');
  } else {
    lineChart = new Chart(ctx, config);
  }
}

// ── BUILD BAR CHART ────────────────────────────
function buildBarChart(period) {
  const ctx = document.getElementById('barChart');
  if (!ctx) return;
  const d   = BAR_DATA[period];

  const config = {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [
        {
          label: 'Deposits',
          data: d.deposits,
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 160);
            g.addColorStop(0, '#c0392b');
            g.addColorStop(1, '#7b0d1e');
            return g;
          },
          borderRadius: { topLeft: 6, topRight: 6 },
          borderSkipped: false,
          maxBarThickness: 32,
        },
        {
          label: 'Withdrawals',
          data: d.withdrawals,
          backgroundColor: 'rgba(192,57,43,0.28)',
          borderRadius: { topLeft: 6, topRight: 6 },
          borderSkipped: false,
          maxBarThickness: 32,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 900,
        easing: 'easeOutQuart',
        delay: (ctx) => ctx.dataIndex * 60,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ' $' + ctx.raw.toLocaleString() },
          backgroundColor: '#1f1f1f',
          borderColor: 'rgba(192,57,43,0.4)',
          borderWidth: 1,
          titleColor: '#f0f0f0',
          bodyColor: '#7a7a7a',
          padding: 10,
          cornerRadius: 8,
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#444', font: { size: 10, family: 'DM Sans' } },
          border: { display: false }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
          ticks: {
            color: '#444',
            font: { size: 10 },
            callback: v => v === 0 ? '0' : '$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v),
            maxTicksLimit: 5,
          },
          border: { display: false }
        }
      }
    }
  };

  if (barChart) {
    barChart.data.labels = d.labels;
    barChart.data.datasets[0].data = d.deposits;
    barChart.data.datasets[1].data = d.withdrawals;
    barChart.update('active');
  } else {
    barChart = new Chart(ctx, config);
  }
}

// ── BUILD DONUT ────────────────────────────────
function buildDonut() {
  const ctx = document.getElementById('donutChart');
  if (!ctx) return;

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [2.82, 0.44, 0.53, 0.65],
        backgroundColor: ['#c0392b', '#e74c3c', '#9b1020', '#7b0d1e'],
        borderColor: '#171717',
        borderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '68%',
      animation: {
        animateRotate: true,
        duration: 1000,
        easing: 'easeInOutQuart',
      },
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

// ── PERIOD TABS ────────────────────────────────
function initPeriodTabs() {
  document.querySelectorAll('.pc-period').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pc-period').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.p;
      buildLineChart(currentPeriod);
    });
  });
}

function initBarTabs() {
  document.querySelectorAll('.cc-sel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cc-sel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBarPeriod = btn.dataset.period;
      buildBarChart(currentBarPeriod);
    });
  });
}

// ── UPDATE BALANCE DISPLAY ─────────────────────
function updateBalance() {
  const bal = getBalance();
  const el  = document.getElementById('pcAmount');
  if (el) {
    // Animate count up
    const target = bal;
    const start  = 0;
    const dur    = 1200;
    const startT = performance.now();

    function step(now) {
      const prog = Math.min((now - startT) / dur, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      const val  = start + (target - start) * ease;
      el.textContent = '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (prog < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }
}

// ── BOOT ──────────────────────────────────────
document.addEventListener('sw:ready', () => {
  updateBalance();
  renderTotals();
  renderTimeline();
  buildLineChart('1M');
  buildBarChart('weekly');
  buildDonut();
  initPeriodTabs();
  initBarTabs();

  // Stagger card entrance animations
  document.querySelectorAll('.chart-card, .portfolio-card').forEach((card, i) => {
    card.style.animationDelay = (0.1 + i * 0.08) + 's';
  });
});