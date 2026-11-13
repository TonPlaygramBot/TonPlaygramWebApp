import { clearAccountSessionToken, getAccountSessionToken } from './accountSession.js';

const GOOGLE_ID_KEY = 'googleId';
const GOOGLE_PROFILE_KEY = 'googleProfile';
const GOOGLE_SESSION_ACCOUNT_KEY = 'googleSessionAccountId';

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function decodeGoogleCredential(jwt) {
  if (!jwt || typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const id = payload.sub || payload.user_id;
    if (!id) return null;
    return {
      id,
      email: payload.email || '',
      firstName: payload.given_name || '',
      lastName: payload.family_name || '',
      photo: payload.picture || ''
    };
  } catch {
    return null;
  }
}

export function storeGoogleProfile(profile) {
  if (typeof window === 'undefined' || !profile?.id) return;
  try {
    const accountId = localStorage.getItem('accountId');
    if (!accountId || !getAccountSessionToken()) return;
    localStorage.setItem(GOOGLE_SESSION_ACCOUNT_KEY, accountId);
    localStorage.setItem(GOOGLE_ID_KEY, profile.id);
    localStorage.setItem(
      GOOGLE_PROFILE_KEY,
      JSON.stringify({
        id: profile.id,
        email: profile.email || '',
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        photo: profile.photo || ''
      })
    );
    window.dispatchEvent(new Event('googleProfileUpdated'));
  } catch {
    // ignore
  }
}

export function loadGoogleProfile() {
  if (typeof window === 'undefined' || !getAccountSessionToken()) return null;
  try {
    if (localStorage.getItem(GOOGLE_SESSION_ACCOUNT_KEY) !== localStorage.getItem('accountId')) return null;
    if (!localStorage.getItem(GOOGLE_SESSION_ACCOUNT_KEY)) return null;
    const cached = safeParse(localStorage.getItem(GOOGLE_PROFILE_KEY));
    const storedId = localStorage.getItem(GOOGLE_ID_KEY);
    if (cached?.id) return cached;
    if (storedId) return { id: storedId };
  } catch {
    return null;
  }
  return null;
}

export function clearGoogleProfile() {
  clearAccountSessionToken();
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GOOGLE_ID_KEY);
    localStorage.removeItem(GOOGLE_PROFILE_KEY);
    localStorage.removeItem(GOOGLE_SESSION_ACCOUNT_KEY);
  } catch {
    // ignore
  }
}
