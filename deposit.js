/* ══════════════════════════════════════════════
   SAGE WEALTH — deposit.js
   ══════════════════════════════════════════════ */

'use strict';

const WALLET_ADDRESS = '39inDCRsS4A7b3PLPfZUySeD8ZnuHXt7dz';
const BTC_USD_RATE    = 60000; // illustrative BTC → USD conversion for crediting deposits

let enteredBtc = 0;
let enteredUsd = 0;
let currentRefNo = '';

function getBalance() {
  return window.sw.getCachedBalance();
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const t = document.getElementById(id);
  if (t) t.classList.add('active');
}

function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'toast show toast-' + type;
  setTimeout(() => (el.className = 'toast'), 3200);
}

function formatDateTime(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function generateRefNo() {
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

function copyToClipboard(text, msg) {
  navigator.clipboard.writeText(text)
    .then(() => showToast(msg || 'Copied!'))
    .catch(() => showToast(msg || 'Copied!'));
}

// ── PAGE 1: DEPOSIT ADDRESS ────────────────────
function initDepositPage() {
  const copyAddrBtn = document.getElementById('copyAddrBtn');
  const bigCopyBtn  = document.getElementById('bigCopyBtn');
  copyAddrBtn && copyAddrBtn.addEventListener('click', () => copyToClipboard(WALLET_ADDRESS, 'Address copied!'));
  bigCopyBtn  && bigCopyBtn.addEventListener('click',  () => copyToClipboard(WALLET_ADDRESS, 'Address copied!'));

  const paidBtn = document.getElementById('paidBtn');
  paidBtn && paidBtn.addEventListener('click', () => showPage('page-details'));
}

// ── PAGE 2: PAYMENT DETAILS ─────────────────────
function initDetailsPage() {
  const backBtn = document.getElementById('backToDeposit');
  backBtn && backBtn.addEventListener('click', () => showPage('page-deposit'));

  const submitBtn = document.getElementById('dpSubmitBtn');
  submitBtn && submitBtn.addEventListener('click', () => {
    const amountEl = document.getElementById('dpAmount');
    const btc = parseFloat((amountEl && amountEl.value) || '0');
    if (!btc || btc <= 0) { showToast('Please enter the amount you sent.', 'error'); return; }

    enteredBtc = btc;
    enteredUsd = btc * BTC_USD_RATE;
    processDeposit();
  });
}

async function processDeposit() {
  const overlay = document.getElementById('procOverlay');
  if (overlay) overlay.classList.remove('hidden');

  setTimeout(async () => {
    await window.sw.setBalance(getBalance() + enteredUsd);

    await window.sw.pushNotification({
      type:    'deposit',
      message: `Deposit of ${enteredBtc.toFixed(8)} BTC (≈ $${enteredUsd.toFixed(2)}) submitted. Awaiting confirmation.`,
      amount:  enteredUsd,
      time:    formatDateTime(new Date()),
    });

    populateReceiptPage();

    if (overlay) overlay.classList.add('hidden');
    showPage('page-receipt');
  }, 2000);
}

// ── PAGE 3: RECEIPT ─────────────────────────────
function populateReceiptPage() {
  const now      = new Date();
  const timeStr  = formatDateTime(now);
  const txidEl   = document.getElementById('dpTxid');
  const walletEl = document.getElementById('dpWallet');
  const txid     = (txidEl && txidEl.value.trim()) || '—';
  const wallet   = (walletEl && walletEl.value.trim()) || '—';

  currentRefNo = generateRefNo();

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('rcAmount', enteredBtc.toFixed(8));
  set('rcTime',   timeStr);
  set('rcDate',   timeStr);
  set('rcTxid',   txid);
  set('rcWallet', wallet);
  set('rcRef',    currentRefNo);
}

function initReceiptPage() {
  const copyRcAddr = document.getElementById('copyRcAddr');
  copyRcAddr && copyRcAddr.addEventListener('click', () => copyToClipboard(WALLET_ADDRESS, 'Address copied!'));

  const copyRcRef = document.getElementById('copyRcRef');
  copyRcRef && copyRcRef.addEventListener('click', () => copyToClipboard(currentRefNo, 'Reference number copied!'));
}

// ── BOOT ──────────────────────────────────────
document.addEventListener('sw:ready', () => {
  initDepositPage();
  initDetailsPage();
  initReceiptPage();
});
