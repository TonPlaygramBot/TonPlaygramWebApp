import crypto from 'crypto';
import { sanitizeText, sanitizeUrl } from './sanitize.js';

function verifyTelegramLogin(data) {
  const requiredFields = ['id', 'hash', 'auth_date'];
  for (const field of requiredFields) {
    if (!data[field]) return null;
  }
  const checkData = Object.entries(data)
    .filter(([key]) => key !== 'hash')
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN || '').digest();
  const computedHash = crypto.createHmac('sha256', secret).update(checkData).digest('hex');
  if (computedHash !== data.hash) return null;

  return {
    id: Number(data.id),
    username: sanitizeText(data.username || ''),
    firstName: sanitizeText(data.first_name || ''),
    lastName: sanitizeText(data.last_name || ''),
    photoUrl: sanitizeUrl(data.photo_url || '')
  };
}

export { verifyTelegramLogin };
