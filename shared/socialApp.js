export const SOCIAL_APP_BASE = '/social-app';
export const SOCIAL_STUDIO_PATH = `${SOCIAL_APP_BASE}/creator-studio`;
export function creatorReturnPath(value) {
  // Only these two local destinations may be saved in an OAuth state record.
  return value === SOCIAL_STUDIO_PATH ? SOCIAL_STUDIO_PATH : '/creator-studio';
}
export function webappEntry(pathname) {
  return pathname === SOCIAL_APP_BASE || pathname.startsWith(`${SOCIAL_APP_BASE}/`)
    ? 'social-app/index.html' : 'index.html';
}
