// Telegram Bot API file URLs contain a bot credential in their path. Older
// profiles may already have stored one; never send these strings back to a
// client (including inside nested JSON or socket profile payloads).
const BOT_API_CREDENTIAL_URL = /api\.telegram\.org(?:\/|%2f)(?:file(?:\/|%2f))?bot/i;

export function sanitizePublicPhoto(value) {
  if (typeof value !== 'string') return '';
  return BOT_API_CREDENTIAL_URL.test(value) ? '' : value;
}

export function redactTelegramCredentialUrls(_key, value) {
  return typeof value === 'string' ? sanitizePublicPhoto(value) : value;
}
