/* ══════════════════════════════════════════════
   SAGE WEALTH — admin.js
   ══════════════════════════════════════════════ */

import {
  adminLogin, adminLogout, adminSearchUsers, adminGetUserTransactions,
  adminUpdateUserBalance, adminAddDeposit, adminAddWithdrawal, adminUpdateTxStatus,
  adminSendAlert, adminClearAlert, adminGetActiveAlert,
  adminUpdateWithdrawalMessage, adminUpdatePaymentCharge,
} from './session.js';

// The admin account is a real Supabase Auth user — this fixed email is
// paired with whatever passphrase was set as its password. The login form
// only asks for the passphrase; the email is an internal implementation
// detail the admin never needs to type.
const ADMIN_EMAIL = 'admin@sagewealth.app';

let selectedUser = null;

function formatCurrency(n) {
  return '$' + parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(el, msg, isError) {
  el.textContent = msg;
  el.classList.remove('hidden', 'error');
  if (isError) el.classList.add('error');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

/* ── Login ── */
const loginScreen = document.getElementById('loginScreen');
const dashScreen  = document.getElementById('dashScreen');
const loginBtn    = document.getElementById('loginBtn');
const passInput   = document.getElementById('adminPassphrase');
const loginError  = document.getElementById('loginError');
const loginErrorText = document.getElementById('loginErrorText');

document.getElementById('pwToggle').addEventListener('click', function () {
  const shown = passInput.type === 'text';
  passInput.type = shown ? 'password' : 'text';
  this.classList.toggle('fa-eye', shown);
  this.classList.toggle('fa-eye-slash', !shown);
});

async function handleLogin() {
  const phrase = passInput.value;
  loginError.classList.add('hidden');
  if (!phrase) return;

  loginBtn.classList.add('loading');
  try {
    await adminLogin(ADMIN_EMAIL, phrase);
    loginBtn.classList.remove('loading');
    loginScreen.classList.add('hidden');
    dashScreen.classList.remove('hidden');
    initDashboard();
  } catch (err) {
    loginBtn.classList.remove('loading');
    loginErrorText.textContent = 'Incorrect passphrase, or this account is not authorized as admin.';
    loginError.classList.remove('hidden');
  }
}

loginBtn.addEventListener('click', handleLogin);
passInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });

document.getElementById('logoutBtn').addEventListener('click', () => adminLogout());

/* ── Dashboard init (runs once, after login) ── */
let dashInitialized = false;
function initDashboard() {
  if (dashInitialized) return;
  dashInitialized = true;
  wireSearch();
  wireUserPanel();
}

/* ── Alert (scoped to whichever user is currently selected) ── */
const currentAlertBox  = document.getElementById('currentAlertBox');
const currentAlertText = document.getElementById('currentAlertText');

async function loadUserAlert(uid) {
  const alert = await adminGetActiveAlert(uid);
  if (alert) {
    currentAlertText.textContent = alert.message;
    currentAlertBox.classList.remove('hidden');
  } else {
    currentAlertBox.classList.add('hidden');
  }
}

/* ── User search ── */
function wireSearch() {
  const input   = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');

  async function runSearch() {
    const q = input.value.trim();
    if (!q) { results.innerHTML = ''; return; }
    const users = await adminSearchUsers(q);
    if (!users.length) {
      results.innerHTML = '<div class="admin-empty">No users found.</div>';
      return;
    }
    results.innerHTML = users.map((u, i) => `
      <div class="admin-result-item" data-idx="${i}">
        <img class="admin-result-avatar" src="${u.photoURL || ''}" alt="" />
        <div class="admin-result-info">
          <div class="admin-result-name">${u.name}</div>
          <div class="admin-result-sub">${u.email} · ${u.phone || 'no phone'}</div>
        </div>
        <div class="admin-result-balance">${formatCurrency(u.balance)}</div>
      </div>
    `).join('');
    results.querySelectorAll('.admin-result-item').forEach((el) => {
      el.addEventListener('click', () => selectUser(users[Number(el.dataset.idx)]));
    });
  }

  document.getElementById('searchBtn').addEventListener('click', runSearch);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
}

/* ── Selected user panel ── */
function wireUserPanel() {
  document.getElementById('sendAlertBtn').addEventListener('click', async () => {
    if (!selectedUser) return;
    const toast = document.getElementById('userActionToast');
    const msgEl = document.getElementById('alertMessage');
    const raw = msgEl.value.trim();
    if (!raw) return;
    const firstName = (selectedUser.name || '').trim().split(/\s+/)[0] || 'there';
    const fullMessage = `Dear ${firstName}, ${raw}`;
    try {
      await adminSendAlert(selectedUser.id, fullMessage);
      msgEl.value = '';
      loadUserAlert(selectedUser.id);
      showToast(toast, 'Alert sent to ' + selectedUser.name + '.');
    } catch (err) {
      showToast(toast, 'Failed to send alert.', true);
    }
  });

  document.getElementById('clearAlertBtn').addEventListener('click', async () => {
    if (!selectedUser) return;
    const toast = document.getElementById('userActionToast');
    try {
      await adminClearAlert(selectedUser.id);
      loadUserAlert(selectedUser.id);
      showToast(toast, 'Alert cleared.');
    } catch (err) {
      showToast(toast, 'Failed to clear alert.', true);
    }
  });

  document.getElementById('updateBalanceBtn').addEventListener('click', async () => {
    if (!selectedUser) return;
    const val = document.getElementById('balanceInput').value;
    if (val === '') return;
    const toast = document.getElementById('userActionToast');
    try {
      const newBal = await adminUpdateUserBalance(selectedUser.id, val);
      selectedUser.balance = newBal;
      showToast(toast, 'Balance updated to ' + formatCurrency(newBal) + '.');
    } catch (err) {
      showToast(toast, 'Failed to update balance.', true);
    }
  });

  document.getElementById('saveWithdrawalMessageBtn').addEventListener('click', async () => {
    if (!selectedUser) return;
    const toast = document.getElementById('userActionToast');
    const msg = document.getElementById('withdrawalMessageInput').value.trim();
    try {
      await adminUpdateWithdrawalMessage(selectedUser.id, msg);
      selectedUser.withdrawalMessage = msg;
      showToast(toast, msg ? 'Custom withdrawal message saved.' : 'Reverted to the default message.');
    } catch (err) {
      showToast(toast, 'Failed to save message.', true);
    }
  });

  document.getElementById('savePaymentChargeBtn').addEventListener('click', async () => {
    if (!selectedUser) return;
    const toast = document.getElementById('userActionToast');
    const val = document.getElementById('paymentChargeInput').value;
    try {
      const newCharge = await adminUpdatePaymentCharge(selectedUser.id, val);
      selectedUser.paymentCharge = newCharge;
      showToast(toast, 'Payment charges updated to ' + formatCurrency(newCharge) + '.');
    } catch (err) {
      showToast(toast, 'Failed to update payment charges.', true);
    }
  });

  document.getElementById('addDepositBtn').addEventListener('click', async () => {
    if (!selectedUser) return;
    const toast = document.getElementById('userActionToast');
    const amount = document.getElementById('depositAmount').value;
    const date = document.getElementById('depositDate').value;
    const time = document.getElementById('depositTime').value;
    const status = document.getElementById('depositStatus').value;
    const message = document.getElementById('depositMessage').value.trim();
    if (!amount || Number(amount) <= 0) { showToast(toast, 'Enter a valid deposit amount.', true); return; }
    if (!date || !time) { showToast(toast, 'Pick a date and time for this deposit.', true); return; }

    const dateTimeStr = combineDateTime(date, time);
    try {
      const newBal = await adminAddDeposit(selectedUser.id, amount, dateTimeStr, message, status);
      selectedUser.balance = newBal;
      document.getElementById('balanceInput').value = newBal;
      document.getElementById('depositAmount').value = '';
      document.getElementById('depositMessage').value = '';
      showToast(toast, 'Deposit of ' + formatCurrency(amount) + ' added.');
      loadUserTransactions(selectedUser.id);
    } catch (err) {
      showToast(toast, 'Failed to add deposit.', true);
    }
  });

  document.getElementById('addWithdrawalBtn').addEventListener('click', async () => {
    if (!selectedUser) return;
    const toast = document.getElementById('userActionToast');
    const amount = document.getElementById('withdrawalAmount').value;
    const date = document.getElementById('withdrawalDate').value;
    const time = document.getElementById('withdrawalTime').value;
    const status = document.getElementById('withdrawalStatus').value;
    const message = document.getElementById('withdrawalMessageForTx').value.trim();
    if (!amount || Number(amount) <= 0) { showToast(toast, 'Enter a valid withdrawal amount.', true); return; }
    if (!date || !time) { showToast(toast, 'Pick a date and time for this withdrawal.', true); return; }

    const dateTimeStr = combineDateTime(date, time);
    try {
      const newBal = await adminAddWithdrawal(selectedUser.id, amount, dateTimeStr, message, status);
      selectedUser.balance = newBal;
      document.getElementById('balanceInput').value = newBal;
      document.getElementById('withdrawalAmount').value = '';
      document.getElementById('withdrawalMessageForTx').value = '';
      showToast(toast, 'Withdrawal of ' + formatCurrency(amount) + ' added.');
      loadUserTransactions(selectedUser.id);
    } catch (err) {
      showToast(toast, 'Failed to add withdrawal.', true);
    }
  });
}

function combineDateTime(date, time) {
  return `${date} ${time.length === 5 ? time + ':00' : time}`;
}

async function selectUser(user) {
  selectedUser = user;
  document.getElementById('userPanel').classList.remove('hidden');
  document.getElementById('selectedUserName').textContent = user.name;
  document.getElementById('selectedUserAvatar').src = user.photoURL || '';
  document.getElementById('selectedUserEmail').textContent = user.email;
  document.getElementById('selectedUserPhone').textContent = user.phone || '—';
  document.getElementById('selectedUserPin').textContent = user.pin || '—';
  document.getElementById('balanceInput').value = user.balance;
  document.getElementById('withdrawalMessageInput').value = user.withdrawalMessage || '';
  document.getElementById('paymentChargeInput').value = user.paymentCharge || 0;
  document.getElementById('alertGreetingName').textContent = (user.name || '').trim().split(/\s+/)[0] || 'there';
  document.getElementById('alertMessage').value = '';
  loadUserAlert(user.id);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  document.getElementById('depositDate').value = todayStr;
  document.getElementById('depositTime').value = timeStr;
  document.getElementById('depositStatus').value = 'success';
  document.getElementById('withdrawalDate').value = todayStr;
  document.getElementById('withdrawalTime').value = timeStr;
  document.getElementById('withdrawalStatus').value = 'pending';

  document.getElementById('userPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  loadUserTransactions(user.id);
}

const STATUS_OPTIONS = ['pending', 'processing', 'success', 'failed'];

async function loadUserTransactions(uid) {
  const list = document.getElementById('txList');
  list.innerHTML = '<div class="admin-empty">Loading…</div>';
  const txs = await adminGetUserTransactions(uid);
  if (!txs.length) {
    list.innerHTML = '<div class="admin-empty">No transactions yet.</div>';
    return;
  }
  list.innerHTML = txs.map((tx) => `
    <div class="admin-tx-item" data-id="${tx.id}">
      <div class="admin-tx-top">
        <span class="admin-tx-type ${tx.type}">${tx.type === 'deposit' ? 'Deposit' : 'Withdrawal'}</span>
        <span class="admin-tx-amount">${formatCurrency(tx.amount)}</span>
      </div>
      <div class="admin-tx-meta">${tx.time || ''} ${tx.message ? '· ' + tx.message : ''}</div>
      <div class="admin-tx-status-row">
        <select class="admin-tx-status-select">
          ${STATUS_OPTIONS.map(s => `<option value="${s}" ${s === tx.status ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}
        </select>
        <button class="admin-tx-save-btn">Save</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.admin-tx-item').forEach((item) => {
    const id = item.dataset.id;
    item.querySelector('.admin-tx-save-btn').addEventListener('click', async () => {
      const select = item.querySelector('.admin-tx-status-select');
      const toast = document.getElementById('userActionToast');
      try {
        await adminUpdateTxStatus(id, select.value);
        showToast(toast, 'Transaction status updated.');
      } catch (err) {
        showToast(toast, 'Failed to update status.', true);
      }
    });
  });
}
