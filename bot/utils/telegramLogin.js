import crypto from 'crypto';

// Verification follows the official Telegram Login Widget guidance:
// https://core.telegram.org/widgets/login#checking-authorization
export function verifyTelegramLogin(authData = {}) {
  try {
    if (!authData.hash) return false;
    const entries = Object.keys(authData)
      .filter((k) => k !== 'hash' && authData[k] !== undefined)
      .sort()
      .map((key) => `${key}=${authData[key]}`);

    const dataCheckString = entries.join('\n');
    const secretKey = crypto
      .createHash('sha256')
      .update(process.env.BOT_TOKEN || '')
      .digest();
    const computed = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return computed === authData.hash;
  } catch (err) {
    console.error('Failed to verify Telegram login', err);
    return false;
  }
}

export default verifyTelegramLogin;
