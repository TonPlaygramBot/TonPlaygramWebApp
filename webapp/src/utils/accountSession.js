const SESSION_KEY = 'tpgSessionToken';

export function getAccountSessionToken() {
  try {
    return typeof window === 'undefined' ? '' : window.localStorage?.getItem(SESSION_KEY) || '';
  } catch {
    return '';
  }
}

export function storeAccountSessionToken(token) {
  if (typeof token !== 'string' || !token || typeof window === 'undefined') return;
  try {
    if (getAccountSessionToken() === token) return;
    window.localStorage.setItem(SESSION_KEY, token);
    window.dispatchEvent(new Event('accountSessionUpdated'));
  } catch {
    // Storage can be unavailable in restricted WebViews.
  }
}

export function clearAccountSessionToken() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.dispatchEvent(new Event('accountSessionUpdated'));
  } catch {
    // Storage can be unavailable in restricted WebViews.
  }
}
