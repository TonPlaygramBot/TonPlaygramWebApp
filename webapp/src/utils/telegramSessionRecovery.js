export const TELEGRAM_SESSION_EVENT = 'telegramSessionRecoveryChanged';
let rejectedCredential = '';

function currentCredential() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData || '' : '';
}

export function getRejectedTelegramSession() {
  const current = currentCredential();
  return current && current === rejectedCredential ? current : '';
}

// UX only: the server remains the authority. Never clear or replace credentials,
// retry mutations, or fall back to unsigned account/Google identity headers.
export function observeTelegramSessionResponse(response, headers) {
  if (typeof window === 'undefined') return;
  const sent = new Headers(headers).get('X-Telegram-Init-Data');
  if (!sent || sent !== currentCredential()) return; // Ignore old in-flight requests.
  if (response.status === 401 && rejectedCredential !== sent) {
    rejectedCredential = sent;
    window.dispatchEvent(new Event(TELEGRAM_SESSION_EVENT));
  }
}
