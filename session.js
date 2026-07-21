/* ══════════════════════════════════════════════
   SAGE WEALTH — session.js
   Single entry point every page uses to talk to the backend
   (Supabase Auth + Postgres profile/balance/notifications + Storage avatar upload)
   ══════════════════════════════════════════════ */

import { supabase } from './supabase-init.js';

const STARTING_BALANCE = 40000;

let cachedUid = null;
let cachedProfile = null;

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
    balance: STARTING_BALANCE,
  });
  if (insertErr) throw insertErr;

  cachedUid = uid;
  cachedProfile = { name, email, phone: phone || '', photoURL, balance: STARTING_BALANCE, createdAt: new Date() };
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
  const { error } = await supabase.from('profiles').update({ name: newName }).eq('id', cachedUid);
  if (error) throw error;
  if (cachedProfile) cachedProfile.name = newName;
}

export async function updateProfilePhone(newPhone) {
  const { error } = await supabase.from('profiles').update({ phone: newPhone }).eq('id', cachedUid);
  if (error) throw error;
  if (cachedProfile) cachedProfile.phone = newPhone;
}

export async function updateOnboardingAnswers(reason, use) {
  const { error } = await supabase.from('profiles').update({ money_reason: reason, money_use: use }).eq('id', cachedUid);
  if (error) throw error;
  if (cachedProfile) { cachedProfile.moneyReason = reason; cachedProfile.moneyUse = use; }
}

// ── Balance (Postgres-backed, replaces sw_html_balance/sw_deduction) ──
export function getCachedBalance() {
  return cachedProfile ? (cachedProfile.balance || 0) : 0;
}

export async function setBalance(newValue) {
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
  }));
}

export async function pushNotification(notif) {
  const { error } = await supabase.from('notifications').insert({
    user_id: cachedUid,
    type: notif.type,
    message: notif.message,
    amount: notif.amount,
    time: notif.time,
  });
  if (error) throw error;
}
