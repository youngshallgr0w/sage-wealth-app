/* ============================================
   SAGE WEALTH — withdraw.js
   ============================================ */

'use strict';



const NETWORKS = {
  USDT: { name: 'Tron (TRC20)', short: 'TRC20', fee: '1 USDT',      coinName: 'USDT' },
  BTC:  { name: 'Bitcoin',      short: 'BTC',   fee: '0.00001 BTC', coinName: 'BTC'  },
};

let selectedNet   = 'USDT';
let enteredAmount = 0;

function getBalance() {
  return window.sw.getCachedBalance();
}

async function queueWithdrawNotif(amount, net, time) {
  await window.sw.pushNotification({
    type:    'withdraw',
    message: 'Withdrawal of ' + amount + ' ' + net + ' submitted. Pending transfer to wallet.',
    amount:  parseFloat(amount),
    time:    time,
  });
}

function formatDateTime(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function generateRefNo() {
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

function generateTxid() {
  const chars = '0123456789abcdef';
  let tx = '';
  for (let i = 0; i < 64; i++) tx += chars[Math.floor(Math.random() * chars.length)];
  return tx;
}

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'toast show toast-' + type;
  setTimeout(() => (el.className = 'toast'), 3200);
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const t = document.getElementById(id);
  if (t) t.classList.add('active');
}

function initFormPage() {
  const balEl = document.getElementById('availBalDisplay');
  if (balEl) balEl.textContent = '$' + getBalance().toFixed(2);

  document.querySelectorAll('.network-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.network-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedNet = pill.dataset.net;
      updateNetworkUI();
    });
  });

  const maxBtn = document.getElementById('maxBtn');
  maxBtn && maxBtn.addEventListener('click', () => {
    const input = document.getElementById('withdrawAmount');
    if (input) { input.value = getBalance().toFixed(2); }
  });

  const copyBtn = document.getElementById('copyAddressBtn');
  copyBtn && copyBtn.addEventListener('click', () => {
    const addrInput = document.getElementById('walletAddress');
    const addr = addrInput ? addrInput.value.trim() : '';
    if (!addr) { showToast('No address entered.', 'error'); return; }
    navigator.clipboard.writeText(addr)
      .then(() => showToast('Address copied!'))
      .catch(() => showToast('Address copied!'));
  });

  const wdBtn = document.getElementById('withdrawBtn');
  wdBtn && wdBtn.addEventListener('click', () => {
    const addrEl = document.getElementById('walletAddress');
    const addr   = addrEl ? addrEl.value.trim() : '';
    if (!addr) { showToast('Please enter your wallet address.', 'error'); return; }

    const input  = document.getElementById('withdrawAmount');
    const rawVal = (input && input.value) ? input.value.replace(/[^0-9.]/g, '') : '0';
    const amount = parseFloat(rawVal) || 0;
    const bal    = getBalance();
    if (!amount || amount <= 0) { showToast('Please enter an amount.', 'error'); return; }
    if (amount > bal) { showToast('Insufficient balance. Max: $' + bal.toFixed(2), 'error'); return; }
    enteredAmount = amount;
    populateConfirmPage(amount);
    showPage('page-confirm');
  });

  updateNetworkUI();
}

function updateNetworkUI() {
  const net = NETWORKS[selectedNet];
  const coinLabel    = document.getElementById('coinLabel');
  const netNameInBox = document.getElementById('netNameInBox');
  if (coinLabel)    coinLabel.textContent    = net.coinName;
  if (netNameInBox) netNameInBox.textContent = net.short;
}

function populateConfirmPage(amount) {
  const net      = NETWORKS[selectedNet];
  const decimals = selectedNet === 'BTC' ? 5 : 2;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('confirmNetAmt',   amount.toFixed(decimals));
  set('confirmCoin',     net.coinName);
  set('confirmUsdEquiv', '≈ $' + amount.toFixed(2));
  set('confirmNetwork',  net.name);
  set('confirmCoinRow',  net.coinName);
  set('confirmAmtRow',   amount.toFixed(decimals) + ' ' + net.coinName);

  // Also populate address in confirm page
  const addrInput = document.getElementById('walletAddress');
  const addrVal = addrInput ? addrInput.value.trim() : '';
  document.querySelectorAll('.addr-val').forEach(el => { el.textContent = addrVal; });
}

function initConfirmPage() {
  const backBtn    = document.getElementById('backToForm');
  const closeBtn   = document.getElementById('closeConfirm');
  const confirmBtn = document.getElementById('confirmWithdrawBtn');

  backBtn  && backBtn.addEventListener('click', () => showPage('page-form'));
  closeBtn && closeBtn.addEventListener('click', () => { window.location.href = 'main.html'; });

  confirmBtn && confirmBtn.addEventListener('click', () => {
    showPage('page-pin');
    resetPin();
  });
}

function populateReceiptPage(amount, dateObj) {
  const net      = NETWORKS[selectedNet];
  const now      = dateObj || new Date();
  const decimals = selectedNet === 'BTC' ? 5 : 2;
  const refNo    = generateRefNo();
  const timeStr  = formatDateTime(now);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('receiptAmount',   amount.toFixed(decimals));
  set('receiptCoin',     net.coinName);
  set('receiptNetwork',  net.short);
  set('receiptFee',      net.fee);
  set('receiptDate',     timeStr);
  set('tlSubmittedTime', timeStr);
  set('receiptRef',      refNo);

  const copyAddr  = document.getElementById('copyReceiptAddr');
  const addrInput = document.getElementById('walletAddress');
  const addrVal   = addrInput ? addrInput.value.trim() : '';
  copyAddr && copyAddr.addEventListener('click', () => {
    navigator.clipboard.writeText(addrVal).catch(() => {});
    showToast('Address copied!');
  });

  const copyRefEl = document.getElementById('copyRef');
  copyRefEl && copyRefEl.addEventListener('click', () => {
    navigator.clipboard.writeText(refNo).catch(() => {});
    showToast('Reference number copied!');
  });
}

// ════════════════════════════════════════════
//  PIN ENTRY
// ════════════════════════════════════════════
let pinEntry = '';
let pinLength = 4;

function currentStoredPin() {
  return localStorage.getItem('sw_user_pin') || '1467';
}

function renderPinDots() {
  pinLength = currentStoredPin().length;
  const row = document.getElementById('pinDotsRow');
  if (!row) return;
  row.innerHTML = '';
  for (let i = 0; i < pinLength; i++) {
    const dot = document.createElement('div');
    dot.className = 'pin-dot';
    dot.id = 'pd' + i;
    row.appendChild(dot);
  }
}

function resetPin() {
  pinEntry = '';
  renderPinDots();
  updatePinDots();
  const err = document.getElementById('pinError');
  if (err) err.classList.add('hidden');
}

function updatePinDots() {
  for (let i = 0; i < pinLength; i++) {
    const dot = document.getElementById('pd' + i);
    if (!dot) continue;
    dot.classList.remove('filled', 'error', 'shake');
    if (i < pinEntry.length) dot.classList.add('filled');
  }
}

function shakePin() {
  for (let i = 0; i < pinLength; i++) {
    const dot = document.getElementById('pd' + i);
    if (!dot) continue;
    dot.classList.remove('filled');
    dot.classList.add('error');
    void dot.offsetWidth;
    dot.classList.add('shake');
  }
  setTimeout(() => {
    for (let i = 0; i < pinLength; i++) {
      const dot = document.getElementById('pd' + i);
      if (dot) dot.classList.remove('error', 'shake');
    }
    pinEntry = '';
    updatePinDots();
  }, 700);
}

function initPinPage() {
  const backBtn = document.getElementById('backToConfirm');
  backBtn && backBtn.addEventListener('click', () => {
    resetPin();
    showPage('page-confirm');
  });

  document.querySelectorAll('.key-btn[data-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (pinEntry.length >= pinLength) return;
      pinEntry += btn.dataset.val;
      updatePinDots();

      if (pinEntry.length === pinLength) {
        setTimeout(() => {
          const currentPin = currentStoredPin();
          if (pinEntry === currentPin) {
            // PIN correct — process withdrawal
            processWithdrawal();
          } else {
            const err = document.getElementById('pinError');
            const msg = document.getElementById('pinErrorMsg');
            shakePin();
            if (msg) msg.textContent = 'Incorrect PIN. Please try again.';
            if (err) { err.classList.remove('hidden'); }
            setTimeout(() => { if (err) err.classList.add('hidden'); }, 2500);
          }
        }, 120);
      }
    });
  });

  const delBtn = document.getElementById('keyDel');
  delBtn && delBtn.addEventListener('click', () => {
    if (pinEntry.length > 0) {
      pinEntry = pinEntry.slice(0, -1);
      updatePinDots();
    }
  });
}

function processWithdrawal() {
  for (let i = 0; i < pinLength; i++) {
    const dot = document.getElementById('pd' + i);
    if (dot) { dot.classList.remove('error'); dot.classList.add('filled'); }
  }

  setTimeout(() => {
    const overlay = document.getElementById('procOverlay');
    if (overlay) overlay.classList.remove('hidden');

    setTimeout(async () => {
      await window.sw.setBalance(getBalance() - enteredAmount);

      const now = new Date();
      const net = NETWORKS[selectedNet];
      await queueWithdrawNotif(
        enteredAmount.toFixed(selectedNet === 'BTC' ? 5 : 2),
        net.coinName,
        formatDateTime(now)
      );

      populateReceiptPage(enteredAmount, now);

      if (overlay) overlay.classList.add('hidden');
      showPage('page-receipt');
      resetPin();

      // Start 3-second countdown then show congrats page
      startReceiptCountdown(enteredAmount);

    }, 2000);

  }, 350);
}

// ── RECEIPT COUNTDOWN → CONGRATS PAGE ────────
function startReceiptCountdown(amount) {
  let count = 3;
  const countEl = document.getElementById('redirectCountdown');
  if (countEl) countEl.textContent = count;

  const interval = setInterval(() => {
    count--;
    if (countEl) countEl.textContent = count;
    if (count <= 0) {
      clearInterval(interval);
      showCongratsPage(amount);
    }
  }, 1000);
}

function showCongratsPage(amount) {
  // Populate wallet address (the address the user withdrew to)
  const walletEl = document.getElementById('congratsWallet');
  const addrInput = document.getElementById('walletAddress');
  if (walletEl) walletEl.textContent = addrInput ? addrInput.value.trim() : '';

  // Populate total
  const totalEl = document.getElementById('congratsTotal');
  if (totalEl) totalEl.textContent = '-$' + parseFloat(amount).toFixed(2);

  showPage('page-congrats');

  // Continue button → go to dashboard
  const btn = document.getElementById('congratsContinueBtn');
  if (btn) {
    btn.addEventListener('click', () => {
      window.location.href = 'main.html';
    });
  }
}

document.addEventListener('sw:ready', () => {
  initFormPage();
  initConfirmPage();
  initPinPage();
});