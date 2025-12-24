function getLocalStorageItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

function setLocalStorageItem(key, value) {
  try {
    if (value) {
      localStorage.setItem(key, value);
    }
  } catch (err) {}
}

export function parseGoogleCredential(credential) {
  try {
    if (typeof credential !== 'string') return null;
    const parts = credential.split('.');
    if (parts.length < 2) return null;
    const normalized = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch (err) {
    return null;
  }
}

export function persistGoogleProfile(profile = {}) {
  if (typeof window === 'undefined') return;

  const { googleId, email, firstName, lastName, photo } = profile;
  setLocalStorageItem('googleId', googleId);
  setLocalStorageItem('googleEmail', email);
  setLocalStorageItem('googleFirstName', firstName);
  setLocalStorageItem('googleLastName', lastName);
  setLocalStorageItem('googlePhoto', photo);
}

export function readStoredGoogleProfile() {
  if (typeof window === 'undefined') return {};

  const googleId = getLocalStorageItem('googleId') || undefined;
  const email = getLocalStorageItem('googleEmail') || undefined;
  const firstName = getLocalStorageItem('googleFirstName') || undefined;
  const lastName = getLocalStorageItem('googleLastName') || undefined;
  const photo = getLocalStorageItem('googlePhoto') || undefined;

  return { googleId, email, firstName, lastName, photo };
}

export function isChromeBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const vendor = navigator.vendor || '';
  const isChrome = /Chrome/i.test(ua) || /CriOS/i.test(ua);
  const isGoogleVendor = /Google Inc\.?/i.test(vendor);
  const isEdge = /Edg/i.test(ua);
  const isOpera = /OPR|Opera/i.test(ua);
  return isChrome && isGoogleVendor && !isEdge && !isOpera;
}
