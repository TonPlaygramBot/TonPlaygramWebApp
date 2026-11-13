import crypto from 'crypto';
import { verifyAuthSession } from '../utils/authSession.js';

export const TELEGRAM_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;

export function verifyTelegramInitData(initData, botToken = process.env.BOT_TOKEN, now = Date.now()) {
  try {
    if (!botToken || typeof initData !== 'string' || !initData || initData.length > 16384) return null;
    const params = new URLSearchParams(initData);
    if (new Set(params.keys()).size !== [...params.keys()].length) return null;
    const hash = params.get('hash');
    if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) return null;
    const authDate = Number(params.get('auth_date'));
    const nowSeconds = Math.floor(now / 1000);
    if (!Number.isSafeInteger(authDate) || authDate <= 0 || authDate > nowSeconds + 60 || nowSeconds - authDate > TELEGRAM_AUTH_MAX_AGE_SECONDS) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');
    const secret = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();
    const computed = crypto
      .createHmac('sha256', secret)
      .update(dataCheckString)
      .digest();
    if (!crypto.timingSafeEqual(computed, Buffer.from(hash, 'hex'))) return null;
    const user = JSON.parse(params.get('user'));
    if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) return null;
    return Object.fromEntries(params.entries());
  } catch {
    return null;
  }
}

export function resolveAuthCredentials({ token, initData } = {}) {
  const allowedToken = process.env.API_AUTH_TOKEN;
  if (initData) {
    const data = verifyTelegramInitData(initData);
    if (data) {
      return { telegramId: JSON.parse(data.user).id };
    }
  }
  if (allowedToken && token === allowedToken) {
    return { apiToken: true };
  }
  return verifyAuthSession(token);
}

export function bearerToken(authorization) {
  return typeof authorization === 'string' ? authorization.match(/^Bearer\s+(\S+)$/i)?.[1] : undefined;
}

function attachAuth(req) {
  // Never retain an identity previously attached from unverified request data.
  delete req.auth;
  const auth = resolveAuthCredentials({
    token: bearerToken(req.get('authorization')),
    initData: req.get('x-telegram-init-data')
  });
  if (!auth) return false;
  req.auth = auth;
  return true;
}

export default function authenticate(req, res, next) {
  if (attachAuth(req)) {
    return next();
  }

  res.status(401).json({ error: 'unauthorized' });
}

export function optionalAuthenticate(req, _res, next) {
  attachAuth(req);
  next();
}
