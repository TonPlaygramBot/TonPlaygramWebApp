export function getTelegramId() {
  if (typeof window !== 'undefined') {
    const tgId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (tgId) return tgId;
    const stored = localStorage.getItem('telegramId');
    if (stored) return Number(stored);
  }
  return 1; // demo fallback
}
