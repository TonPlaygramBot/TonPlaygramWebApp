export function getTelegramId() {
  if (typeof window !== 'undefined') {
    const tgId = window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (tgId) return tgId;
  }
  throw new Error(
    'Telegram user not found. Please open this application via the Telegram bot.'
  );
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

export function getTelegramFirstName() {
  if (typeof window !== 'undefined') {
    const first = window?.Telegram?.WebApp?.initDataUnsafe?.user?.first_name;
    if (first) return first;
    const stored = localStorage.getItem('telegramFirstName');
    if (stored) return stored;
  }
  return '';
}

export function getTelegramLastName() {
  if (typeof window !== 'undefined') {
    const last = window?.Telegram?.WebApp?.initDataUnsafe?.user?.last_name;
    if (last) return last;
    const stored = localStorage.getItem('telegramLastName');
    if (stored) return stored;
  }
  return '';
}

export function getTelegramUserData() {
  if (typeof window !== 'undefined') {
    const user = window?.Telegram?.WebApp?.initDataUnsafe?.user;
    if (user) return user;
    const stored = localStorage.getItem('telegramUserData');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
  }
  return null;
}
