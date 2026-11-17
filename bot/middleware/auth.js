import crypto from 'crypto';

/** Validate Telegram's signed payload before any route trusts its user id.
 * Keep the legacy return shape for matchmaking and Socket.IO callers.
 */
export function verifyTelegramInitData(
  initData,
  botToken = process.env.BOT_TOKEN,
  { now = Date.now(), maxAgeSeconds = 86400 } = {}
) {
  try {
    if (typeof botToken !== 'string' || !botToken || typeof initData !== 'string' ||
        !initData || initData.length > 16384 || !Number.isFinite(now) ||
        !Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0 || maxAgeSeconds > 86400) return null;
    const params = new URLSearchParams(initData);
    if ([...params.keys()].some((key) => params.getAll(key).length !== 1)) return null;
    const hash = params.get('hash');
    if (!/^[a-fA-F0-9]{64}$/.test(hash || '')) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest();
    if (!crypto.timingSafeEqual(computed, Buffer.from(hash, 'hex'))) return null;
    const authDate = Number(params.get('auth_date'));
    if (!Number.isSafeInteger(authDate) || authDate <= 0 ||
        authDate * 1000 > now + 60000 || now >= (authDate + maxAgeSeconds) * 1000) return null;
    const user = JSON.parse(params.get('user'));
    if (!Number.isSafeInteger(user?.id) || user.id <= 0) return null;
    return Object.fromEntries(params.entries());
  } catch {
    return null;
  }
}

function attachAuth(req, token, initData) {
  const allowedToken = process.env.API_AUTH_TOKEN;
  const accountId = req.get('x-tpc-account-id');
  const googleId = req.get('x-google-id');
  if (initData) {
    const data = verifyTelegramInitData(initData);
    if (data) {
      req.auth = {
        telegramId: data.user ? Number(JSON.parse(data.user).id) : undefined,
        accountId: accountId || undefined,
        googleId: googleId || undefined
      };
      return true;
    }
    // A separately configured server credential remains valid. Never
    // downgrade invalid/expired signed credentials to identity hints.
    if (allowedToken && token === allowedToken) {
      req.auth = { apiToken: true };
      return true;
    }
    return false;
  }
  if (allowedToken && token === allowedToken) {
    req.auth = { apiToken: true };
    return true;
  }
  if (accountId || googleId) {
    req.auth = {
      accountId: accountId || undefined,
      googleId: googleId || undefined
    };
    return true;
  }
  return false;
}

export default function authenticate(req, res, next) {
  const auth = req.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const initData = req.get('x-telegram-init-data');

  if (attachAuth(req, token, initData)) {
    return next();
  }

  res.status(401).json({ error: 'unauthorized' });
}

export function optionalAuthenticate(req, _res, next) {
  const auth = req.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const initData = req.get('x-telegram-init-data');
  attachAuth(req, token, initData);
  next();
}
