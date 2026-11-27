/** Query from verified server-side claims only; the caller's header/account UUID
 * is intentionally not accepted, and an unrelated browser Google identity
 * cannot override active Telegram identity. */
export function verifiedSelfBalanceFilter(claims) {
  if (Number.isSafeInteger(claims?.telegramId) && claims.telegramId > 0) {
    return {telegramId: claims.telegramId};
  }
  if (typeof claims?.googleId === 'string' && claims.googleId.trim() &&
      claims.googleId.length <= 255) {
    return {googleId: claims.googleId};
  }
  return null;
}
