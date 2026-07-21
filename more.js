/* ══════════════════════════════════════════════
   SAGE WEALTH — more.js
   ══════════════════════════════════════════════ */

'use strict';

// ── BALANCE ────────────────────────────────────
function getBalance() {
  return window.sw.getCachedBalance();
}

function formatCurrency(n) {
  return '$' + parseFloat(n).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

function renderBalance() {
  const el = document.getElementById('moreBalance');
  if (el) el.textContent = formatCurrency(getBalance());
}

// ── BALANCE TOGGLE ("Show info" on the card) ────
let moreBalanceHidden = false;

function initBalanceToggle() {
  const toggleBtn = document.getElementById('toggleBalanceMore');
  const eyeIcon   = document.getElementById('eyeIconMore');
  const amountEl  = document.getElementById('moreBalance');
  if (!toggleBtn || !eyeIcon || !amountEl) return;

  toggleBtn.addEventListener('click', () => {
    moreBalanceHidden = !moreBalanceHidden;

    if (moreBalanceHidden) {
      amountEl.textContent = '••••••';
      amountEl.style.letterSpacing = '6px';
      eyeIcon.classList.replace('fa-eye', 'fa-eye-slash');
      toggleBtn.querySelector('span').textContent = 'Hide info';
    } else {
      amountEl.textContent = formatCurrency(getBalance());
      amountEl.style.letterSpacing = '-0.5px';
      eyeIcon.classList.replace('fa-eye-slash', 'fa-eye');
      toggleBtn.querySelector('span').textContent = 'Show info';
    }
  });
}

// ── TOAST ──────────────────────────────────────
function showToast(msg, duration) {
  const el = document.getElementById('mToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 350);
  }, duration || 2200);
}

// ── THEME ──────────────────────────────────────
function applyTheme(dark) {
  const root = document.documentElement;
  root.setAttribute('data-theme', dark ? 'dark' : 'light');

  const icon  = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');

  if (icon)  icon.className  = dark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  if (label) label.textContent = dark ? 'Dark Mode' : 'Light Mode';

  localStorage.setItem('sw_theme', dark ? 'dark' : 'light');
}

function initTheme() {
  const saved  = localStorage.getItem('sw_theme');
  const isDark = saved ? saved === 'dark' : true;

  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.checked = isDark;
    applyTheme(isDark);

    toggle.addEventListener('change', () => {
      applyTheme(toggle.checked);
      showToast(toggle.checked ? '🌙 Dark mode on' : '☀️ Light mode on');
    });
  }
}

// ── OVERLAYS ───────────────────────────────────
function openOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeOverlay(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const sheet = el.querySelector('.sheet');
  if (sheet) {
    sheet.style.transition = 'transform 0.28s ease';
    sheet.style.transform  = 'translateY(100%)';
  }
  el.style.transition = 'opacity 0.3s ease';
  el.style.opacity    = '0';
  setTimeout(() => {
    el.classList.add('hidden');
    el.style.opacity    = '';
    el.style.transition = '';
    if (sheet) { sheet.style.transform = ''; sheet.style.transition = ''; }
  }, 300);
}

function initOverlays() {
  // Open
  const map = {
    editProfileBtn:    'profileOverlay',
    profileSettingBtn: 'profileOverlay',
    securityBtn:       'securityOverlay',
    referBtn:          'referOverlay',
    supportBtn:        'supportOverlay',
    statementsBtn:     'statementsOverlay',
    privacyBtn:        'privacyOverlay',
    termsBtn:          'termsOverlay',
    changePinBtn:      'pinOverlay',
  };

  Object.entries(map).forEach(([btnId, overlayId]) => {
    const btn = document.getElementById(btnId);
    btn && btn.addEventListener('click', () => openOverlay(overlayId));
  });

  // Close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeOverlay(btn.dataset.close));
  });

  // Close on backdrop click
  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeOverlay(overlay.id);
    });
  });
}

// ── PROFILE SETTINGS ───────────────────────────
function initProfileSettings() {
  const saveBtn = document.getElementById('saveProfileBtn');
  saveBtn && saveBtn.addEventListener('click', async () => {
    const name  = document.getElementById('editName');
    const phone = document.getElementById('editPhone');
    if (name && name.value.trim()) {
      const trimmed = name.value.trim();
      await window.sw.updateProfileName(trimmed);
      const nameEl = document.getElementById('profileName');
      if (nameEl) nameEl.textContent = trimmed;
    }
    if (phone) {
      const trimmedPhone = phone.value.trim();
      await window.sw.updateProfilePhone(trimmedPhone);
      const phoneEl = document.getElementById('profilePhone');
      if (phoneEl) phoneEl.textContent = trimmedPhone;
    }
    closeOverlay('profileOverlay');
    showToast('✅ Profile updated');
  });
}

// ── PIN CHANGE ─────────────────────────────────
function initPinChange() {
  const saveBtn = document.getElementById('savePinBtn');
  saveBtn && saveBtn.addEventListener('click', () => {
    const current = document.getElementById('currentPin');
    const newP    = document.getElementById('newPin');
    const confirm = document.getElementById('confirmPin');

    const CORRECT = localStorage.getItem('sw_user_pin') || '1467';

    if (!current || current.value !== CORRECT) {
      showToast('❌ Current PIN is incorrect'); return;
    }
    if (!newP || newP.value.length < 4) {
      showToast('❌ PIN must be 4 digits'); return;
    }
    if (!confirm || newP.value !== confirm.value) {
      showToast('❌ PINs do not match'); return;
    }

    localStorage.setItem('sw_user_pin', newP.value);
    if (window.sw && typeof window.sw.updateProfilePin === 'function') {
      window.sw.updateProfilePin(newP.value).catch(() => {});
    }
    current.value = ''; newP.value = ''; confirm.value = '';
    closeOverlay('pinOverlay');
    showToast('🔐 PIN updated successfully');
  });
}

// ── REFERRAL ───────────────────────────────────
function initRefer() {
  const copyBtn = document.getElementById('copyReferCode');
  copyBtn && copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText('SAGE-NM2026').catch(() => {});
    showToast('📋 Referral code copied!');
  });
}

// ── STATEMENTS ─────────────────────────────────
function initStatements() {
  const dlApril = document.getElementById('dlAprilBtn');
  const dlFull  = document.getElementById('dlFullBtn');

  dlApril && dlApril.addEventListener('click', () => showToast('📄 Generating April statement…'));
  dlFull  && dlFull.addEventListener('click',  () => showToast('📊 Preparing full export…'));
}

// ── LOGOUT ─────────────────────────────────────
function initLogout() {
  const btn = document.getElementById('logoutBtn');
  btn && btn.addEventListener('click', () => {
    if (confirm('Are you sure you want to sign out?')) {
      window.sw.logoutAccount();
    }
  });
}

// ── SUPPORT CHAT ────────────────────────────────
const SUPPORT_EMAIL = 'sagewealthsupport@gmail.com';

const BOT_TOPICS = [
  {
    keywords: ['deposit', 'add money', 'add funds', 'top up', 'fund my account', 'fund account'],
    replies: [
      "To deposit, go to the Home page and tap the <b>Deposit</b> button.",
      "You'll see your BTC wallet address. Copy it and send BTC from any wallet or exchange.",
      "Deposits typically confirm within 30–60 minutes. You'll be notified once credited! 🎉"
    ],
  },
  {
    keywords: ['withdraw', 'withdrawal', 'cash out', 'cashout', 'take out money', 'get my money', 'pull out money'],
    replies: [
      "Sure — here's how to withdraw your funds:",
      "1️⃣ Go to Home and tap <b>Withdraw</b>.<br>2️⃣ Pick your network (USDT or BTC) and enter your wallet address.<br>3️⃣ Type in the amount you want to withdraw, then tap <b>Withdraw</b>.",
      "4️⃣ Review the order on the confirmation screen and tap <b>Confirm</b>.<br>5️⃣ Enter your 4-digit withdrawal PIN to authorize it.",
      "Once verified you'll get a receipt, and the status of your withdrawl will be visible in <b>Hiatory section</b> on your History page. Most withdrawals are processed within 10-15 Min. 📤",
      "Need a hand with a specific withdrawal? Email <b>" + SUPPORT_EMAIL + "</b> with your reference number and our team will look into it."
    ],
  },
  {
    keywords: ['balance', 'how much do i have', 'my funds', 'my money'],
    replies: () => [
      "Your current balance is <b>" + formatCurrency(getBalance()) + "</b>.",
      "You can always see your balance on the Home page or the History page. 💳"
    ],
  },
  {
    keywords: ['pin', 'change my pin', 'security code', 'passcode'],
    replies: [
      "Go to Profile → Security & PIN → Change PIN.",
      "You'll need to enter your current 4-digit PIN, then set a new 4-digit PIN. 🔐"
    ],
  },
];

function getDefaultReply(msg) {
  const lower = msg.toLowerCase();
  for (const topic of BOT_TOPICS) {
    if (topic.keywords.some(k => lower.includes(k))) {
      return typeof topic.replies === 'function' ? topic.replies() : topic.replies;
    }
  }
  // Generic fallback — always point to support for anything we can't answer
  return [
    "Thanks for reaching out! I can help with deposits, withdrawals, balance checks, or your PIN — just ask.",
    "For anything else, please email our support team at <b>" + SUPPORT_EMAIL + "</b> and we'll get back to you within 24 hours. Is there anything else I can help with? 😊"
  ];
}

function addChatMsg(text, isUser) {
  const body = document.getElementById('chatBody');
  if (!body) return;

  const now    = new Date();
  const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + (isUser ? 'chat-user' : 'chat-bot');

  if (isUser) {
    bubble.innerHTML = `
      <div class="chat-msg-wrap">
        <p class="chat-msg-text">${text}</p>
        <span class="chat-time">${timeStr}</span>
      </div>`;
  } else {
    bubble.innerHTML = `
      <div class="chat-av">SW</div>
      <div class="chat-msg-wrap">
        <p class="chat-msg-text">${text}</p>
        <span class="chat-time">${timeStr}</span>
      </div>`;
  }

  body.appendChild(bubble);
  bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function addTypingIndicator() {
  const body = document.getElementById('chatBody');
  if (!body) return null;

  const el = document.createElement('div');
  el.className = 'chat-bubble chat-bot';
  el.id        = 'typingIndicator';
  el.innerHTML = `
    <div class="chat-av">SW</div>
    <div class="chat-msg-wrap" style="padding:14px 16px">
      <div style="display:flex;gap:5px;align-items:center">
        <span style="width:7px;height:7px;border-radius:50%;background:var(--text-dim);animation:typingDot 1s ease-in-out infinite"></span>
        <span style="width:7px;height:7px;border-radius:50%;background:var(--text-dim);animation:typingDot 1s ease-in-out 0.2s infinite"></span>
        <span style="width:7px;height:7px;border-radius:50%;background:var(--text-dim);animation:typingDot 1s ease-in-out 0.4s infinite"></span>
      </div>
    </div>`;

  // Inject keyframes if not already
  if (!document.getElementById('typingKf')) {
    const style = document.createElement('style');
    style.id = 'typingKf';
    style.textContent = '@keyframes typingDot { 0%,100%{opacity:0.3;transform:translateY(0)} 50%{opacity:1;transform:translateY(-4px)} }';
    document.head.appendChild(style);
  }

  body.appendChild(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return el;
}

let chatBusy = false;

function sendMessage(text) {
  if (!text.trim() || chatBusy) return;
  chatBusy = true;

  // Hide suggestions
  const sugg = document.getElementById('chatSugg');
  if (sugg) sugg.style.display = 'none';

  addChatMsg(text, true);

  let typing = addTypingIndicator();
  const replies = getDefaultReply(text);

  let delay = 900;
  replies.forEach((reply, i) => {
    setTimeout(() => {
      if (typing) { typing.remove(); typing = null; }
      addChatMsg(reply, false);

      // Add new typing indicator between messages
      if (i < replies.length - 1) {
        typing = addTypingIndicator();
      } else {
        chatBusy = false;
      }
    }, delay);
    delay += 900 + reply.length * 12;
  });
}

function initChat() {
  const sendBtn = document.getElementById('chatSend');
  const input   = document.getElementById('chatInput');

  sendBtn && sendBtn.addEventListener('click', () => {
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    sendMessage(msg);
  });

  input && input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const msg = input.value.trim();
      if (!msg) return;
      input.value = '';
      sendMessage(msg);
    }
  });

  // Suggestion buttons
  document.querySelectorAll('.sugg-btn').forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.dataset.msg));
  });
}

// ── BOOT ──────────────────────────────────────
document.addEventListener('sw:ready', (e) => {
  const { profile } = e.detail;

  const avatarImg = document.getElementById('profileAvatar');
  const nameEl    = document.getElementById('profileName');
  const emailEl   = document.getElementById('profileEmail');
  const phoneEl   = document.getElementById('profilePhone');
  const editName  = document.getElementById('editName');
  const editEmail = document.getElementById('editEmail');
  const editPhone = document.getElementById('editPhone');
  const greeting  = document.getElementById('supportGreeting');
  if (avatarImg) avatarImg.src = profile.photoURL;
  if (nameEl)    nameEl.textContent = profile.name;
  if (emailEl)   emailEl.textContent = profile.email;
  if (phoneEl)   phoneEl.textContent = profile.phone || '';
  if (editName)  editName.value = profile.name;
  if (editEmail) editEmail.value = profile.email;
  if (editPhone) editPhone.value = profile.phone || '';
  if (greeting)  greeting.textContent = `Hi ${(profile.name || '').split(' ')[0]}! 👋 Welcome to Sage Wealth Support. How can I help you today?`;

  renderBalance();
  initBalanceToggle();
  initTheme();
  initOverlays();
  initProfileSettings();
  initPinChange();
  initRefer();
  initStatements();
  initLogout();
  initChat();
});
