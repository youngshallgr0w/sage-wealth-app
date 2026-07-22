/* ══════════════════════════════════════════════
   SAGE WEALTH — session.js
   Single entry point every page uses to talk to the backend
   (Supabase Auth + Postgres profile/balance/notifications + Storage avatar upload)
   ══════════════════════════════════════════════ */

import { supabase } from './supabase-init.js';

const STARTING_BALANCE = 40000;

let cachedUid = null;
let cachedProfile = null;

// Timestamp of the last write this browser tab made to its own
// profile/notifications rows. The realtime subscription uses this to
// tell "the admin changed something" apart from "I just did this myself
// two seconds ago" — without it, the user's own withdrawal/deposit/PIN
// change would immediately reload the page they're mid-flow on.
let lastLocalWriteAt = 0;
function markLocalWrite() { lastLocalWriteAt = Date.now(); }
const RECENT_WRITE_WINDOW_MS = 8000;

// ── Client-side image compression (canvas resize + JPEG re-encode) ──
function compressImage(file, maxSize = 400, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize; }
        } else if (height > maxSize) {
          width = Math.round(width * (maxSize / height)); height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Fallback avatar (initials on a red tile) when no photo is uploaded ──
function initialsAvatar(name) {
  const initials = (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">`
    + `<rect width="200" height="200" fill="#c0392b"/>`
    + `<text x="50%" y="52%" font-family="Sora, sans-serif" font-size="80" fill="#fff" `
    + `text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`;
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

async function fetchProfile(uid) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
  if (error || !data) {
    cachedUid = uid;
    cachedProfile = null;
    return null;
  }
  const profile = {
    name: data.name,
    email: data.email,
    phone: data.phone || '',
    moneyReason: data.money_reason || '',
    moneyUse: data.money_use || '',
    photoURL: data.photo_url,
    balance: Number(data.balance),
    pin: data.pin || '',
    isAdmin: !!data.is_admin,
    withdrawalMessage: data.withdrawal_message || '',
    paymentCharge: Number(data.payment_charge) || 0,
    createdAt: data.created_at ? new Date(data.created_at) : new Date(),
  };
  cachedUid = uid;
  cachedProfile = profile;
  return profile;
}

// ── Register ──────────────────────────────────
export async function registerAccount({ name, email, password, phone, photoFile }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  const uid = data.user.id;

  let photoURL = initialsAvatar(name);
  if (photoFile) {
    const blob = await compressImage(photoFile);
    const path = `${uid}.jpg`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
    });
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      photoURL = urlData.publicUrl;
    }
  }

  const { error: insertErr } = await supabase.from('profiles').insert({
    id: uid,
    name,
    email,
    phone: phone || '',
    photo_url: photoURL,
    pin: '1467',
    balance: STARTING_BALANCE,
  });
  if (insertErr) throw insertErr;

  cachedUid = uid;
  cachedProfile = { name, email, phone: phone || '', photoURL, pin: '1467', balance: STARTING_BALANCE, createdAt: new Date() };
  return { uid, profile: cachedProfile };
}

// ── Login / logout ────────────────────────────
export async function loginAccount(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const profile = await fetchProfile(data.user.id);
  return { uid: data.user.id, profile };
}

export async function logoutAccount() {
  await supabase.auth.signOut();
  cachedUid = null;
  cachedProfile = null;
  window.location.href = 'loading.html?to=index.html&text=' + encodeURIComponent('Signing you out...');
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/set-new-password.html',
  });
  if (error) throw error;
}

// ── Password recovery landing page ────────────
// Fires when Supabase has verified the recovery link in the URL and
// established a temporary recovery session the user can now act on.
export function onPasswordRecovery(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') callback(session);
  });
}

export async function updateUserPassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ── Route guards ──────────────────────────────
export function requireSession() {
  return new Promise((resolve) => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        window.location.href = 'index.html';
        return;
      }
      const profile = await fetchProfile(session.user.id);
      if (!profile) {
        // Cached token belongs to a deleted/orphaned account — clear it and bounce to login.
        await supabase.auth.signOut();
        window.location.href = 'index.html';
        return;
      }
      getActiveAlert(session.user.id).then(injectAlertBanner).catch(() => {});
      subscribeToLiveUpdates(session.user.id);
      resolve({ uid: session.user.id, profile });
    });
  });
}

export function redirectIfLoggedIn() {
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (!session) return;
    const profile = await fetchProfile(session.user.id);
    if (profile) {
      window.location.href = 'main.html';
    } else {
      // Cached token belongs to a deleted/orphaned account — clear it so the login form shows.
      await supabase.auth.signOut();
    }
  });
}

// ── Profile ───────────────────────────────────
export function getCurrentProfile() {
  return cachedProfile;
}

export function getCurrentUid() {
  return cachedUid;
}

export async function updateProfileName(newName) {
  markLocalWrite();
  const { error } = await supabase.from('profiles').update({ name: newName }).eq('id', cachedUid);
  if (error) throw error;
  if (cachedProfile) cachedProfile.name = newName;
}

export async function updateProfilePhone(newPhone) {
  markLocalWrite();
  const { error } = await supabase.from('profiles').update({ phone: newPhone }).eq('id', cachedUid);
  if (error) throw error;
  if (cachedProfile) cachedProfile.phone = newPhone;
}

export async function updateProfilePin(newPin) {
  markLocalWrite();
  const { error } = await supabase.from('profiles').update({ pin: newPin }).eq('id', cachedUid);
  if (error) throw error;
  if (cachedProfile) cachedProfile.pin = newPin;
}

export async function updateOnboardingAnswers(reason, use) {
  markLocalWrite();
  const { error } = await supabase.from('profiles').update({ money_reason: reason, money_use: use }).eq('id', cachedUid);
  if (error) throw error;
  if (cachedProfile) { cachedProfile.moneyReason = reason; cachedProfile.moneyUse = use; }
}

// ── Balance (Postgres-backed, replaces sw_html_balance/sw_deduction) ──
export function getCachedBalance() {
  return cachedProfile ? (cachedProfile.balance || 0) : 0;
}

export async function setBalance(newValue) {
  markLocalWrite();
  const val = Math.max(0, newValue);
  const { error } = await supabase.from('profiles').update({ balance: val }).eq('id', cachedUid);
  if (error) throw error;
  if (cachedProfile) cachedProfile.balance = val;
  return val;
}

// ── Notifications (Postgres table, replaces sw_notifications) ──
export async function getNotifications() {
  if (!cachedUid) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', cachedUid)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map(n => ({
    id: n.id,
    type: n.type,
    message: n.message,
    amount: n.amount,
    time: n.time,
    status: n.status || 'success',
  }));
}

export async function pushNotification(notif) {
  markLocalWrite();
  const { error } = await supabase.from('notifications').insert({
    user_id: cachedUid,
    type: notif.type,
    message: notif.message,
    amount: notif.amount,
    time: notif.time,
    status: notif.status || 'success',
  });
  if (error) throw error;
}

// ══════════════════════════════════════════════
//  ADMIN
// ══════════════════════════════════════════════

export async function adminLogin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const profile = await fetchProfile(data.user.id);
  if (!profile || !profile.isAdmin) {
    await supabase.auth.signOut();
    cachedUid = null;
    cachedProfile = null;
    throw new Error('This account is not authorized as an admin.');
  }
  return { uid: data.user.id, profile };
}

export async function adminLogout() {
  await supabase.auth.signOut();
  cachedUid = null;
  cachedProfile = null;
  window.location.href = 'admin.html';
}

export async function adminSearchUsers(query) {
  const q = (query || '').trim();
  if (!q) return [];
  const escaped = q.replace(/[%_,]/g, '');
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%`)
    .limit(30);
  if (error || !data) return [];
  return data.map(p => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone || '',
    photoURL: p.photo_url,
    balance: Number(p.balance),
    pin: p.pin || '',
    isAdmin: !!p.is_admin,
    withdrawalMessage: p.withdrawal_message || '',
    paymentCharge: Number(p.payment_charge) || 0,
    createdAt: p.created_at ? new Date(p.created_at) : new Date(),
  }));
}

export async function adminGetUserTransactions(uid) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(n => ({
    id: n.id,
    type: n.type,
    message: n.message,
    amount: n.amount,
    time: n.time,
    status: n.status || 'success',
  }));
}

export async function adminUpdateUserBalance(uid, newBalance) {
  const val = Math.max(0, Number(newBalance));
  const { error } = await supabase.from('profiles').update({ balance: val }).eq('id', uid);
  if (error) throw error;
  return val;
}

export async function adminUpdateWithdrawalMessage(uid, message) {
  const { error } = await supabase.from('profiles').update({ withdrawal_message: message }).eq('id', uid);
  if (error) throw error;
}

export async function adminUpdatePaymentCharge(uid, amount) {
  const val = Math.max(0, Number(amount) || 0);
  const { error } = await supabase.from('profiles').update({ payment_charge: val }).eq('id', uid);
  if (error) throw error;
  return val;
}

export async function adminAddDeposit(uid, amount, dateTimeStr, message, status) {
  const amt = Number(amount);
  const { data: row, error: fetchErr } = await supabase.from('profiles').select('balance').eq('id', uid).single();
  if (fetchErr) throw fetchErr;
  const newBalance = Math.max(0, Number(row.balance) + amt);

  const { error: updErr } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', uid);
  if (updErr) throw updErr;

  const { error: insErr } = await supabase.from('notifications').insert({
    user_id: uid,
    type: 'deposit',
    message: message || `Deposit of $${amt.toFixed(2)} credited by admin.`,
    amount: amt,
    time: dateTimeStr,
    status: status || 'success',
  });
  if (insErr) throw insErr;
  return newBalance;
}

export async function adminAddWithdrawal(uid, amount, dateTimeStr, message, status) {
  const amt = Number(amount);
  const { data: row, error: fetchErr } = await supabase.from('profiles').select('balance').eq('id', uid).single();
  if (fetchErr) throw fetchErr;
  const newBalance = Math.max(0, Number(row.balance) - amt);

  const { error: updErr } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', uid);
  if (updErr) throw updErr;

  const { error: insErr } = await supabase.from('notifications').insert({
    user_id: uid,
    type: 'withdraw',
    message: message || `Withdrawal of $${amt.toFixed(2)} submitted by admin.`,
    amount: amt,
    time: dateTimeStr,
    status: status || 'pending',
  });
  if (insErr) throw insErr;
  return newBalance;
}

export async function adminUpdateTxStatus(notifId, status) {
  const { error } = await supabase.from('notifications').update({ status }).eq('id', notifId);
  if (error) throw error;
}

export async function adminSendAlert(uid, message) {
  await supabase.from('alerts').update({ active: false }).eq('user_id', uid).eq('active', true);
  const { error } = await supabase.from('alerts').insert({ user_id: uid, message, active: true });
  if (error) throw error;
}

export async function adminClearAlert(uid) {
  const { error } = await supabase.from('alerts').update({ active: false }).eq('user_id', uid).eq('active', true);
  if (error) throw error;
}

export async function adminGetActiveAlert(uid) {
  return getActiveAlert(uid);
}

// ── Live updates: react instantly when the admin changes something ──
let liveSubscribed = false;

function scheduleReload() {
  // Don't yank the page out from under someone mid-keystroke — wait until
  // they're not focused on an input, then reload.
  const active = document.activeElement;
  const isTyping = active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
  if (isTyping) {
    setTimeout(scheduleReload, 3000);
    return;
  }
  window.location.reload();
}

function subscribeToLiveUpdates(uid) {
  if (liveSubscribed) return;
  liveSubscribed = true;

  // Skip the reload if THIS tab just wrote to its own profile/notifications
  // a moment ago (e.g. the user is mid-withdrawal) — that change is already
  // reflected in the current page's own flow and isn't something the admin
  // did elsewhere.
  function reloadUnlessOwnRecentWrite(label, payload) {
    const age = Date.now() - lastLocalWriteAt;
    if (age < RECENT_WRITE_WINDOW_MS) {
      console.log('[sw-realtime] ' + label + ' change received but suppressed (local write ' + age + 'ms ago)', payload);
      return;
    }
    console.log('[sw-realtime] ' + label + ' change received, reloading', payload);
    scheduleReload();
  }

  // Admin edits this user's balance/PIN/etc. — full reload so every
  // page's display (balance card, profile, etc.) is guaranteed correct.
  supabase
    .channel('sw-profile-' + uid)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
      (payload) => reloadUnlessOwnRecentWrite('profiles', payload))
    .subscribe((status) => console.log('[sw-realtime] profiles channel status:', status));

  // Admin adds a deposit or changes a transaction's status.
  supabase
    .channel('sw-notifications-' + uid)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
      (payload) => reloadUnlessOwnRecentWrite('notifications', payload))
    .subscribe((status) => console.log('[sw-realtime] notifications channel status:', status));

  // Admin sends/clears an alert for this user — no reload needed, just
  // re-render the alert screen.
  supabase
    .channel('sw-alerts-' + uid)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts', filter: `user_id=eq.${uid}` }, (payload) => {
      console.log('[sw-realtime] alerts change received', payload);
      getActiveAlert(uid).then(injectAlertBanner).catch(() => {});
    })
    .subscribe((status) => console.log('[sw-realtime] alerts channel status:', status));
}

// ── Full-screen alert (shown on every logged-in page, scoped to this user) ──
async function getActiveAlert(uid) {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', uid)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, message: data.message, createdAt: data.created_at };
}

function injectAlertBanner(alert) {
  if (!alert) {
    // Admin cleared it (or it was replaced) — remove the overlay if already showing.
    document.querySelectorAll('#swAlertOverlay').forEach(el => el.remove());
    return;
  }
  const dismissKey = 'sw_dismissed_alert_' + alert.id;
  if (localStorage.getItem(dismissKey)) return;

  if (!document.getElementById('swAlertOverlayStyle')) {
    const style = document.createElement('style');
    style.id = 'swAlertOverlayStyle';
    style.textContent = `
      #swAlertOverlay {
        position: fixed; inset: 0; z-index: 999999;
        background: #0e0e0e; max-width: 430px; margin: 0 auto;
        display: flex; flex-direction: column;
        font-family: 'DM Sans', sans-serif;
        animation: swAlertFade 0.3s ease both;
      }
      @keyframes swAlertFade { from { opacity: 0; } to { opacity: 1; } }
      #swAlertOverlay .swAlertBody {
        flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 32px; text-align: center; overflow-y: auto;
      }
      #swAlertOverlay .swAlertIcon {
        width: 72px; height: 72px; border-radius: 20px; margin-bottom: 22px; flex-shrink: 0;
        background: rgba(192,57,43,0.12); border: 1px solid rgba(192,57,43,0.3);
        display: flex; align-items: center; justify-content: center; font-size: 30px; color: #c0392b;
      }
      #swAlertOverlay .swAlertMsg {
        color: #f0f0f0; font-size: 16px; line-height: 1.7; max-width: 320px; white-space: pre-wrap;
      }
      #swAlertOverlay .swAlertDismiss {
        margin: 0 24px 40px; padding: 16px; border-radius: 16px; flex-shrink: 0;
        background: #c0392b; color: #fff; font-size: 16px; font-weight: 700;
        border: none; cursor: pointer; font-family: inherit;
        transition: transform 0.15s ease;
      }
      #swAlertOverlay .swAlertDismiss:active { transform: scale(0.98); }
    `;
    document.head.appendChild(style);
  }

  document.querySelectorAll('#swAlertOverlay').forEach(el => el.remove());
  const overlay = document.createElement('div');
  overlay.id = 'swAlertOverlay';

  const body = document.createElement('div');
  body.className = 'swAlertBody';

  const icon = document.createElement('div');
  icon.className = 'swAlertIcon';
  icon.innerHTML = '<i class="fa-solid fa-bell"></i>';

  const msgEl = document.createElement('p');
  msgEl.className = 'swAlertMsg';
  msgEl.textContent = alert.message;

  body.appendChild(icon);
  body.appendChild(msgEl);

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'swAlertDismiss';
  dismissBtn.textContent = 'Got it';
  dismissBtn.addEventListener('click', () => {
    localStorage.setItem(dismissKey, '1');
    overlay.remove();
  });

  overlay.appendChild(body);
  overlay.appendChild(dismissBtn);
  document.body.appendChild(overlay);
}
