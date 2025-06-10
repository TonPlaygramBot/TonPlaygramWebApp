export function getTelegramId() {
  return window?.Telegram?.WebApp?.initDataUnsafe?.user?.id || null;
}
