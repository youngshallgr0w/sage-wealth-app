/* ══════════════════════════════════════════════
   SAGE WEALTH — history.js
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

// ── INITIAL DEPOSIT (dynamic, based on the account's real creation date) ──
function getInitialDepositTx(profile) {
  const raw = profile && profile.createdAt;
  const created = raw instanceof Date ? raw : (raw && raw.toDate ? raw.toDate() : new Date());
  const pad = n => String(n).padStart(2, '0');
  return {
    id:     'initial-deposit',
    type:   'deposit',
    name:   'Initial Deposit',
    meta:   'Account funded · Bitcoin (BTC)',
    amount: '+' + formatCurrency(STARTING_BALANCE),
    sign:   'positive',
    status: 'success',
    date:   `${created.getFullYear()}-${pad(created.getMonth() + 1)}-${pad(created.getDate())}`,
    time:   `${pad(created.getHours())}:${pad(created.getMinutes())}:${pad(created.getSeconds())}`,
  };
}

// ── READ DEPOSITS/WITHDRAWALS FROM FIRESTORE ────
async function getUserTx() {
  const notifs = await window.sw.getNotifications();
  return notifs.map((n, i) => {
    if (n.type === 'withdraw') {
      const msg = n.message || '';
      const net = msg.includes('USDT') ? 'USDT · TRC20 Network'
                : msg.includes('BTC')  ? 'BTC · Bitcoin Network'
                : 'Sent to wallet';
      return {
        id:     'wd-' + (n.id || i),
        type:   'withdraw',
        name:   'Withdrawal',
        meta:   'Sent to wallet · ' + net,
        amount: '-' + formatCurrency(n.amount || 0),
        sign:   'negative',
        status: n.status || 'pending',
        date:   n.time ? n.time.split(' ')[0] : new Date().toISOString().split('T')[0],
        time:   n.time ? (n.time.split(' ')[1] || '00:00:00') : '00:00:00',
      };
    }
    return {
      id:     'dp-' + (n.id || i),
      type:   'deposit',
      name:   'Deposit',
      meta:   'Bitcoin (BTC)',
      amount: '+' + formatCurrency(n.amount || 0),
      sign:   'positive',
      status: n.status || 'success',
      date:   n.time ? n.time.split(' ')[0] : new Date().toISOString().split('T')[0],
      time:   n.time ? (n.time.split(' ')[1] || '00:00:00') : '00:00:00',
    };
  });
}

// ── MERGE + SORT ALL TRANSACTIONS ──────────────
async function getAllTx() {
  const userTx = await getUserTx();
  const all = [...userTx, getInitialDepositTx(window.sw.getCurrentProfile())];

  // Sort: newest first by date+time
  all.sort((a, b) => {
    const da = new Date(a.date + 'T' + (a.time || '00:00:00'));
    const db = new Date(b.date + 'T' + (b.time || '00:00:00'));
    return db - da;
  });

  return all;
}

// ── FILTER ─────────────────────────────────────
let currentFilter = 'all';

function filterTx(txList, filter) {
  if (filter === 'all')      return txList;
  if (filter === 'deposit')  return txList.filter(t => t.type === 'deposit');
  if (filter === 'withdraw') return txList.filter(t => t.type === 'withdraw');
  if (filter === 'gain')     return txList.filter(t => t.type === 'gain' || t.type === 'return');
  return txList;
}

// ── ICON MAP ───────────────────────────────────
function iconClass(type) {
  if (type === 'deposit')  return 'tx-icon--deposit';
  if (type === 'withdraw') return 'tx-icon--withdraw';
  if (type === 'gain')     return 'tx-icon--gain';
  if (type === 'return')   return 'tx-icon--return';
  return 'tx-icon--gain';
}

function iconFA(type) {
  if (type === 'deposit')  return 'fa-arrow-down';
  if (type === 'withdraw') return 'fa-arrow-up';
  if (type === 'gain')     return 'fa-chart-line';
  if (type === 'return')   return 'fa-coins';
  return 'fa-chart-line';
}

function amountClass(sign) {
  if (sign === 'positive') return 'tx-amount--positive';
  if (sign === 'negative') return 'tx-amount--negative';
  if (sign === 'gold')     return 'tx-amount--gold';
  return '';
}

function statusClass(status) {
  if (status === 'success')    return 'tx-status--success';
  if (status === 'processing') return 'tx-status--processing';
  if (status === 'pending')    return 'tx-status--pending';
  if (status === 'failed')     return 'tx-status--failed';
  return 'tx-status--success';
}

function statusLabel(status) {
  if (status === 'success')    return 'Success';
  if (status === 'processing') return 'Processing';
  if (status === 'pending')    return 'Pending';
  if (status === 'failed')     return 'Failed';
  return 'Success';
}

// ── FORMAT DATE FOR GROUP HEADER ───────────────
function formatGroupDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today     = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);

  if (dateStr === today.toISOString().split('T')[0]) return 'TODAY';
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'YESTERDAY';

  return d.toLocaleDateString('en-US', {
    month: 'long',
    day:   'numeric',
    year:  'numeric',
  }).toUpperCase();
}

// ── FORMAT TIME ────────────────────────────────
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const disp = hour % 12 || 12;
  return disp + ':' + m + ' ' + ampm;
}

// ── RENDER ─────────────────────────────────────
async function render() {
  const list    = document.getElementById('txList');
  const empty   = document.getElementById('txEmpty');
  if (!list) return;

  const all      = await getAllTx();
  const filtered = filterTx(all, currentFilter);

  if (filtered.length === 0) {
    list.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');

  // Group by date
  const groups = {};
  filtered.forEach(tx => {
    if (!groups[tx.date]) groups[tx.date] = [];
    groups[tx.date].push(tx);
  });

  // Sort dates descending
  const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

  let html = '';
  sortedDates.forEach((date, di) => {
    html += `<div class="tx-date-group">${formatGroupDate(date)}</div>`;
    groups[date].forEach((tx, ti) => {
      html += `
        <div class="tx-item" style="animation-delay:${(di * 0.05 + ti * 0.04).toFixed(2)}s">
          <div class="tx-icon ${iconClass(tx.type)}">
            <i class="fa-solid ${iconFA(tx.type)}"></i>
          </div>
          <div class="tx-info">
            <span class="tx-name">${tx.name}</span>
            <span class="tx-meta">${tx.meta} · ${formatTime(tx.time)}</span>
          </div>
          <div class="tx-right">
            <span class="tx-amount ${amountClass(tx.sign)}">${tx.amount}</span>
            <span class="tx-status ${statusClass(tx.status)}">${statusLabel(tx.status)}</span>
          </div>
        </div>
      `;
    });
  });

  list.innerHTML = html;
}

// ── BALANCE DISPLAY ─────────────────────────────
function renderBalance() {
  const el = document.getElementById('histBalance');
  if (el) el.textContent = formatCurrency(getBalance());
}

// ── FILTER TABS ────────────────────────────────
function initFilters() {
  document.querySelectorAll('.ftab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });
}

// ── BOOT ──────────────────────────────────────
document.addEventListener('sw:ready', () => {
  renderBalance();
  initFilters();
  render();
});