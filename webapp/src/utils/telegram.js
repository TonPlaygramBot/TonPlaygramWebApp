export function getTelegramId() {
  if (typeof window !== 'undefined') {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (user?.id) {
      localStorage.setItem('telegramId', user.id);
      return user.id;
    }
imw5g8-codex/suggest-next-steps-for-the-project
    const stored = localStorage.getItem('telegramId');
    if (stored) return Number(stored);
    const param = new URLSearchParams(window.location.search).get('id');
    if (param) {
      localStorage.setItem('telegramId', param);
      return Number(param);
    }
  }
  return null;
}
