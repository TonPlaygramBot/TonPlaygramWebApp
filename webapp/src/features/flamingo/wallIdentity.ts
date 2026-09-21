export function wallAccountHeaders(extra: Record<string, string> = {}) {
  const headers = { ...extra };
  const account = localStorage.getItem('accountId');
  const google = localStorage.getItem('googleId');
  const initData = (window as any).Telegram?.WebApp?.initData;
  if (account) headers['X-Tpc-Account-Id'] = account;
  if (google) headers['X-Google-Id'] = google;
  if (initData) headers['X-Telegram-Init-Data'] = initData;
  return headers;
}
export const wallProfileEvents = [
  'focus',
  'storage',
  'googleProfileUpdated',
  'profilePhotoUpdated',
  'accountUpdated'
];
export function wallAvatarUrl(value: string | undefined, apiBase: string) {
  return value?.startsWith('/api/') ? `${apiBase}${value}` : value;
}
