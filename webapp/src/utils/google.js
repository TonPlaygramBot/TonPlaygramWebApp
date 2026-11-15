const GOOGLE_ID_KEY = 'googleId';
const GOOGLE_PROFILE_KEY = 'googleProfile';
const GOOGLE_CREDENTIAL_KEY = 'socialGoogleCredential';

// The server verifies the signature, audience and identity. Decoding here is
// only a freshness check; a cached profile is never an authentication token.
export function storeGoogleCredential(credential) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(GOOGLE_CREDENTIAL_KEY, String(credential || ''));
  } catch { /* A blocked session store requires signing in again. */ }
  window.dispatchEvent(new Event('social-auth-changed'));
}

export function loadGoogleCredential() {
  if (typeof window === 'undefined') return '';
  try {
    const credential = sessionStorage.getItem(GOOGLE_CREDENTIAL_KEY) || '';
    const payload = JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const profileId = localStorage.getItem(GOOGLE_ID_KEY);
    if (!payload.sub || !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now() + 30000 ||
      (profileId && String(payload.sub) !== profileId)) {
      sessionStorage.removeItem(GOOGLE_CREDENTIAL_KEY);
      return '';
    }
    return credential;
  } catch { return ''; }
}

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
  if (typeof window === 'undefined') return null;
  try {
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
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GOOGLE_ID_KEY);
    localStorage.removeItem(GOOGLE_PROFILE_KEY);
    sessionStorage.removeItem(GOOGLE_CREDENTIAL_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event('social-auth-changed'));
}
