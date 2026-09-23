export const SOCIAL_APP_BASE = '/social-app'
export function webappEntry (pathname) {
  return pathname === SOCIAL_APP_BASE || pathname.startsWith(`${SOCIAL_APP_BASE}/`)
    ? 'social-app/index.html'
    : 'index.html'
}
