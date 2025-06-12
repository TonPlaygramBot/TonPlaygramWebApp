export function getTelegramId() {
  if (typeof window !== 'undefined') {
    const tgId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (tgId) return tgId;
    const stored = localStorage.getItem('telegramId');
    if (stored) return Number(stored);
  }
  return 1; // demo fallback
}

export function getTelegramUsername() {
  if (typeof window !== 'undefined') {
    const name = window?.Telegram?.WebApp?.initDataUnsafe?.user?.username;
    if (name) return name;
    const stored = localStorage.getItem('telegramUsername');
    if (stored) return stored;
  }
  return '';
}
