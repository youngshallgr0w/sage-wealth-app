/* ══════════════════════════════════════════════
   SAGE WEALTH INVESTMENT — app.js
   ══════════════════════════════════════════════ */

'use strict';

function getBalance() {
  return window.sw.getCachedBalance();
}

async function setBalance(val) {
  return window.sw.setBalance(val);
}

async function getNotifications() {
  return window.sw.getNotifications();
}

async function pushNotification(notif) {
  return window.sw.pushNotification(notif);
}

function formatNotifTime(timeStr) {
  if (!timeStr) return '';
  const [, timePart] = timeStr.split(' ');
  if (!timePart) return timeStr;
  const [h, m] = timePart.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const disp = hour % 12 || 12;
  return disp + ':' + m + ' ' + ampm;
}

let balance = 0;
let balanceHidden = false;

const USER_POOL = [
  { name: 'Jessica Monroe', city: 'New York', country: 'USA', flag: 'us' },
  { name: 'Ethan Brooks', city: 'Los Angeles', country: 'USA', flag: 'us' },
  { name: 'Amber Collins', city: 'Chicago', country: 'USA', flag: 'us' },
  { name: 'Marcus Webb', city: 'Houston', country: 'USA', flag: 'us' },
  { name: 'Olivia Banks', city: 'San Francisco', country: 'USA', flag: 'us' },
  { name: 'Oliver Hartley', city: 'London', country: 'UK', flag: 'gb' },
  { name: 'Charlotte Evans', city: 'Manchester', country: 'UK', flag: 'gb' },
  { name: 'James Thornton', city: 'Birmingham', country: 'UK', flag: 'gb' },
  { name: 'Wei Zhang', city: 'Shanghai', country: 'China', flag: 'cn' },
  { name: 'Li Mei', city: 'Beijing', country: 'China', flag: 'cn' },
  { name: 'Chen Jian', city: 'Shenzhen', country: 'China', flag: 'cn' },
  { name: 'Klaus Müller', city: 'Berlin', country: 'Germany', flag: 'de' },
  { name: 'Anna Schneider', city: 'Munich', country: 'Germany', flag: 'de' },
  { name: 'Liam Tremblay', city: 'Toronto', country: 'Canada', flag: 'ca' },
  { name: 'Sophie Carter', city: 'Sydney', country: 'Australia', flag: 'au' },
  { name: 'Noah Williams', city: 'Melbourne', country: 'Australia', flag: 'au' },
  { name: 'Kenji Tanaka', city: 'Tokyo', country: 'Japan', flag: 'jp' },
  { name: 'Yuki Sato', city: 'Osaka', country: 'Japan', flag: 'jp' },
  { name: 'Pierre Dubois', city: 'Paris', country: 'France', flag: 'fr' },
  { name: 'Hans Keller', city: 'Zurich', country: 'Switzerland', flag: 'ch' },
  { name: 'Lucas van Berg', city: 'Amsterdam', country: 'Netherlands', flag: 'nl' },
  { name: 'Carlos Reyes', city: 'Madrid', country: 'Spain', flag: 'es' },
  { name: 'Emma Johansson', city: 'Stockholm', country: 'Sweden', flag: 'se' },
];

const AMOUNTS = [
  120, 250, 400, 580, 750, 870, 1050, 1200, 1500, 1800,
  2100, 2500, 3200, 4100, 5000, 6200, 320, 18, 340, 780
];

const loader = document.getElementById('loader');
const app = document.getElementById('app');
const balanceAmount = document.getElementById('balanceAmount');
const toggleBalance = document.getElementById('toggleBalance');
const eyeIcon = document.getElementById('eyeIcon');
const depositBtn = document.getElementById('depositBtn');
const withdrawBtn = document.getElementById('withdrawBtn');
const depositModal = document.getElementById('depositModal');
const withdrawModal = document.getElementById('withdrawModal');
const closeDeposit = document.getElementById('closeDeposit');
const closeWithdraw = document.getElementById('closeWithdraw');
const confirmDeposit = document.getElementById('confirmDeposit');
const confirmWithdraw = document.getElementById('confirmWithdraw');
const depositAmountEl = document.getElementById('depositAmount');
const withdrawAmountEl = document.getElementById('withdrawAmount');
const toast = document.getElementById('toast');
const toastMsg = document.getElementById('toastMsg');
const todayGroup = document.getElementById('todayGroup');
const tickerInner = document.getElementById('tickerInner');

const notifBtn = document.querySelector('.notif-btn');
const badge = document.querySelector('.notif-btn .badge');

// ════════════════════════════════════════════
//  LOADER → APP
// ════════════════════════════════════════════

document.addEventListener('sw:ready', async (e) => {
  const { profile } = e.detail;

  balance = profile.balance || 0;
  if (balanceAmount) balanceAmount.textContent = formatCurrency(balance);

  const avatarImg = document.getElementById('topbarAvatar');
  const usernameEl = document.querySelector('.username');
  if (avatarImg) avatarImg.src = profile.photoURL;
  if (usernameEl) usernameEl.textContent = profile.name;

  // Keep the withdrawal PIN in sync between this device and Supabase.
  // This device's localStorage is authoritative if it already has a PIN
  // (never overwrite a real chosen PIN with a stale/default DB value) —
  // push it up instead. Only adopt the DB's value on a fresh device that
  // has never set one locally.
  const localPin = localStorage.getItem('sw_user_pin');
  if (localPin) {
    if (profile.pin !== localPin && window.sw && typeof window.sw.updateProfilePin === 'function') {
      window.sw.updateProfilePin(localPin).catch(() => {});
    }
  } else if (profile.pin) {
    localStorage.setItem('sw_user_pin', profile.pin);
  }

  setTimeout(() => {
    loader.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
    loader.style.opacity = '0';
    loader.style.transform = 'scale(1.04)';
    setTimeout(() => {
      loader.style.display = 'none';
      app.classList.remove('hidden');
      buildTicker();
      startLiveFeed();
      animateItems();
      renderNotifBadge();
      renderCardWithdrawal();
      if (typeof window.maybeShowPinSetup === 'function') window.maybeShowPinSetup();
    }, 560);
  }, 2800);
});

// ════════════════════════════════════════════
//  CARD WITHDRAWAL STATUS
// ════════════════════════════════════════════
async function renderCardWithdrawal() {
  const cardFooter = document.querySelector('.card-footer-row');
  if (!cardFooter) return;

  const firstCell = cardFooter.querySelector('.card-detail');
  if (!firstCell) return;

  const labelEl = firstCell.querySelector('.card-detail-label');
  const valueEl = firstCell.querySelector('.card-detail-value');
  if (!labelEl || !valueEl) return;

  const notifs = await getNotifications();
  const withdraws = notifs.filter(n => n.type === 'withdraw');

  if (withdraws.length === 0) {
    labelEl.textContent = 'RECENT';
    valueEl.textContent = 'No transactions';
    valueEl.className = 'card-detail-value';
    return;
  }

  const last = withdraws[withdraws.length - 1];
  const amt = parseFloat(last.amount || 0);

  labelEl.textContent = 'WITHDRAWAL';
  valueEl.textContent = '-$' + amt.toFixed(2);
  valueEl.className = 'card-detail-value card-withdraw-pending';

  if (!firstCell.querySelector('.card-pending-pill')) {
    const pill = document.createElement('span');
    pill.className = 'card-pending-pill';
    pill.textContent = 'PENDING';
    firstCell.appendChild(pill);
  }
}

// ════════════════════════════════════════════
//  NOTIFICATION BADGE
// ════════════════════════════════════════════
async function renderNotifBadge() {
  const notifs = await getNotifications();
  if (!badge) return;
  badge.style.display = notifs.length > 0 ? 'block' : 'none';
}

if (notifBtn) {
  notifBtn.addEventListener('click', () => toggleNotifPanel());
}

let notifPanelEl = null;

async function toggleNotifPanel() {
  if (notifPanelEl) {
    notifPanelEl.remove();
    notifPanelEl = null;
    return;
  }

  const notifs = await getNotifications();
  const panel = document.createElement('div');
  panel.id = 'notifPanel';
  panel.innerHTML = `
    <div class="notif-panel-header">
      <span class="notif-panel-title">Notifications</span>
      <button class="notif-panel-close" id="closeNotifPanel"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="notif-panel-body">
      ${notifs.length === 0
        ? '<p class="notif-empty">No notifications yet</p>'
        : notifs.slice().reverse().map(n => `
          <div class="notif-item">
            <div class="notif-item-icon ${n.type === 'withdraw' ? 'withdraw' : 'deposit'}">
              <i class="fa-solid ${n.type === 'withdraw' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
            </div>
            <div class="notif-item-body">
              <p class="notif-item-msg">${n.message}</p>
              <p class="notif-item-time">${n.time}</p>
            </div>
          </div>
        `).join('')
      }
    </div>
  `;
  document.body.appendChild(panel);
  notifPanelEl = panel;

  document.getElementById('closeNotifPanel').addEventListener('click', () => {
    panel.remove();
    notifPanelEl = null;
  });

  setTimeout(() => {
    document.addEventListener('click', function outsideClick(e) {
      if (!panel.contains(e.target) && e.target !== notifBtn) {
        panel.remove();
        notifPanelEl = null;
        document.removeEventListener('click', outsideClick);
      }
    });
  }, 50);
}

function animateItems() {
  document.querySelectorAll('.ops-item').forEach((item, i) => {
    item.style.opacity = '0';
    item.style.transform = 'translateX(-14px)';
    item.style.transition = `opacity 0.4s ease ${0.08 + i * 0.06}s, transform 0.4s ease ${0.08 + i * 0.06}s`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      item.style.opacity = '1';
      item.style.transform = 'translateX(0)';
    }));
  });
}

// ════════════════════════════════════════════
//  LIVE TICKER
// ════════════════════════════════════════════
function buildTicker() {
  const events = [];
  for (let i = 0; i < 12; i++) {
    const user = USER_POOL[Math.floor(Math.random() * USER_POOL.length)];
    const amount = AMOUNTS[Math.floor(Math.random() * AMOUNTS.length)];
    const isDeposit = Math.random() > 0.45;
    events.push({ user, amount, isDeposit });
  }

  const html = [...events, ...events].map(e => `
    <span class="ticker-item">
      <img src="https://flagcdn.com/w20/${e.user.flag}.png" alt="${e.user.country}" />
      <span class="t-name">${e.user.name.split(' ')[0]}</span>
      <span class="t-amt ${e.isDeposit ? 'up' : 'down'}">${e.isDeposit ? '+' : '-'}$${e.amount.toLocaleString()}</span>
      <span>·</span>
      <span>${e.user.city}</span>
    </span>
  `).join('');

  tickerInner.innerHTML = html;
}

setInterval(buildTicker, 20000);

// ════════════════════════════════════════════
//  LIVE FEED
// ════════════════════════════════════════════
function startLiveFeed() {
  setTimeout(function tick() {
    const user = USER_POOL[Math.floor(Math.random() * USER_POOL.length)];
    const amount = AMOUNTS[Math.floor(Math.random() * AMOUNTS.length)];
    const isDeposit = Math.random() > 0.45;
    addHistoryItem(isDeposit ? 'deposit' : 'withdraw', amount, user);
    setTimeout(tick, 6000 + Math.random() * 5000);
  }, 5000);
}

// ════════════════════════════════════════════
//  BALANCE TOGGLE
// ════════════════════════════════════════════
toggleBalance.addEventListener('click', () => {
  balanceHidden = !balanceHidden;

  if (balanceHidden) {
    balanceAmount.textContent = '••••••';
    balanceAmount.style.letterSpacing = '6px';
    eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
    toggleBalance.querySelector('span').textContent = 'Hide info';
  } else {
    balanceAmount.textContent = formatCurrency(balance);
    balanceAmount.style.letterSpacing = '-0.5px';
    eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
    toggleBalance.querySelector('span').textContent = 'Show info';
  }

  balanceAmount.style.transition = 'transform 0.25s ease';
  balanceAmount.style.transform = 'scale(1.04)';
  setTimeout(() => { balanceAmount.style.transform = ''; }, 220);
});

// ════════════════════════════════════════════
//  MODALS
// ════════════════════════════════════════════
function openModal(modal) {
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  const box = modal.querySelector('.modal-box');
  box.style.transition = 'transform 0.28s cubic-bezier(0.4,0,1,1)';
  box.style.transform = 'translateY(100%)';
  modal.style.transition = 'opacity 0.3s ease';
  modal.style.opacity = '0';
  setTimeout(() => {
    modal.classList.add('hidden');
    box.style.transform = '';
    box.style.transition = '';
    modal.style.opacity = '';
    document.body.style.overflow = '';
  }, 300);
}

closeDeposit.addEventListener('click', () => closeModal(depositModal));
closeWithdraw.addEventListener('click', () => closeModal(withdrawModal));

depositModal.addEventListener('click', e => { if (e.target === depositModal) closeModal(depositModal); });
withdrawModal.addEventListener('click', e => { if (e.target === withdrawModal) closeModal(withdrawModal); });

// ── Confirm Deposit ──────────────────────────
confirmDeposit.addEventListener('click', async () => {
  const val = parseFloat(depositAmountEl.value);
  if (!val || val <= 0) { shakeInput(depositAmountEl); return; }

  balance += val;
  await setBalance(balance);
  updateBalance();

  await pushNotification({
    type: 'deposit',
    message: `Deposit of ${formatCurrency(val)} was successful.`,
    amount: val,
    time: formatDateTime(new Date()),
  });
  renderNotifBadge();

  const usernameEl = document.querySelector('.username');
  const username = usernameEl ? usernameEl.textContent.trim() : 'Investor';
  const me = { name: username, city: 'New York', country: 'USA', flag: 'us' };
  addHistoryItem('deposit', val, me);
  closeModal(depositModal);
  showToast(`+${formatCurrency(val)} deposited successfully`);
});

// ── Confirm Withdraw (modal fallback) ────────
confirmWithdraw.addEventListener('click', async () => {
  const val = parseFloat(withdrawAmountEl.value);
  if (!val || val <= 0) { shakeInput(withdrawAmountEl); return; }
  if (val > balance) { showToast('Insufficient balance', true); shakeInput(withdrawAmountEl); return; }

  balance -= val;
  await setBalance(balance);
  updateBalance();

  await pushNotification({
    type: 'withdraw',
    message: `Withdrawal of ${formatCurrency(val)} submitted. Pending transfer.`,
    amount: val,
    time: formatDateTime(new Date()),
  });
  renderNotifBadge();

  const usernameEl = document.querySelector('.username');
  const username = usernameEl ? usernameEl.textContent.trim() : 'Investor';
  const me = { name: username, city: 'New York', country: 'USA', flag: 'us' };
  addHistoryItem('withdraw', val, me);
  closeModal(withdrawModal);
  showToast(`${formatCurrency(val)} withdrawn successfully`);
});

depositAmountEl.addEventListener('keydown', e => { if (e.key === 'Enter') confirmDeposit.click(); });
withdrawAmountEl.addEventListener('keydown', e => { if (e.key === 'Enter') confirmWithdraw.click(); });

// ── WITHDRAW BUTTON → loading.html → withdraw.html ──
withdrawBtn.addEventListener('click', function () {
  window.location.href = 'loading.html?to=withdraw.html&text=' + encodeURIComponent('Preparing your withdrawal...');
});

// ── DEPOSIT BUTTON → loading.html → deposit.html ──
depositBtn.addEventListener('click', function () {
  window.location.href = 'loading.html?to=deposit.html&text=' + encodeURIComponent('Preparing your deposit...');
});

// ════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════
function formatCurrency(amount) {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function updateBalance() {
  if (!balanceHidden) animateCounter(balanceAmount, balance);
}

function animateCounter(el, target) {
  const start = parseFloat(el.textContent.replace(/[^0-9.-]/g, '')) || 0;
  const duration = 600;
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatCurrency(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = formatCurrency(target);
  }
  requestAnimationFrame(tick);
}

function shakeInput(input) {
  input.style.animation = 'none';
  input.style.borderColor = 'var(--red-light)';
  requestAnimationFrame(() => {
    input.style.animation = 'shake 0.4s ease';
    setTimeout(() => { input.style.borderColor = ''; input.style.animation = ''; }, 600);
  });
}

const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-8px); }
    40%      { transform: translateX(8px); }
    60%      { transform: translateX(-5px); }
    80%      { transform: translateX(5px); }
  }
`;
document.head.appendChild(shakeStyle);

// ── Toast ─────────────────────────────────────
let toastTimer = null;
function showToast(message, isError = false) {
  toastMsg.textContent = message;
  const icon = toast.querySelector('.toast-icon');
  if (isError) {
    icon.className = 'fa-solid fa-circle-exclamation toast-icon';
    icon.style.color = 'var(--red-light)';
  } else {
    icon.className = 'fa-solid fa-circle-check toast-icon';
    icon.style.color = 'var(--green)';
  }
  toast.classList.remove('hidden');
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 350);
  }, 3000);
}

// ── Add history item ──────────────────────────
function addHistoryItem(type, amount, user, timeOverride) {
  if (!todayGroup) return;

  const isDeposit = type === 'deposit';
  const now = timeOverride ? new Date(timeOverride) : new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const item = document.createElement('div');
  item.className = 'ops-item new-item';
  item.dataset.type = isDeposit ? 'debit' : 'credit';
  item.style.opacity = '0';
  item.style.transform = 'translateX(-14px)';

  item.innerHTML = `
    <div class="ops-icon-wrap">
      <img src="https://flagcdn.com/w20/${user.flag}.png" alt="${user.country}" class="flag-img" />
    </div>
    <div class="ops-info">
      <span class="ops-name">${user.name}</span>
      <span class="ops-sub">${user.city}, ${user.country} · ${isDeposit ? 'Deposit' : 'Withdraw'}</span>
    </div>
    <div class="ops-amount-wrap">
      <span class="ops-amount ${isDeposit ? 'debit' : 'credit'}">${isDeposit ? '+' : '-'}${formatCurrency(amount)}</span>
      <span class="ops-time">${time}</span>
    </div>
  `;

  const dateLabel = todayGroup.querySelector('.ops-date');
  if (dateLabel && dateLabel.nextSibling) {
    todayGroup.insertBefore(item, dateLabel.nextSibling);
  } else {
    todayGroup.appendChild(item);
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    item.style.opacity = '1';
    item.style.transform = 'translateX(0)';
  }));

  setTimeout(() => item.classList.remove('new-item'), 1600);
}

// ── Tap ripple ────────────────────────────────
document.addEventListener('click', e => {
  const item = e.target.closest('.ops-item');
  if (!item) return;
  item.style.transition = 'transform 0.15s ease';
  item.style.transform = 'scale(0.98)';
  setTimeout(() => { item.style.transform = ''; }, 150);
});
