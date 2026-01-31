import crypto from 'crypto';

export function verifyTelegramInitData(initData, botToken = process.env.BOT_TOKEN) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');
    const secret = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken || '')
      .digest();
    const computed = crypto
      .createHmac('sha256', secret)
      .update(dataCheckString)
      .digest('hex');
    if (computed !== hash) return null;
    return Object.fromEntries(params.entries());
  } catch {
    return null;
  }
}

function attachAuth(req, token, initData) {
  const allowedToken = process.env.API_AUTH_TOKEN;
  const ownerToken = req.get('x-account-owner-token');
  const ownerAccountId = req.get('x-account-id');
  if (initData) {
    const data = verifyTelegramInitData(initData);
    if (data) {
      req.auth = {
        telegramId: data.user ? Number(JSON.parse(data.user).id) : undefined
      };
      return true;
    }
  }
  if (allowedToken && token === allowedToken) {
    req.auth = { apiToken: true };
    return true;
  }
  if (ownerToken && ownerAccountId) {
    req.auth = { ownerToken: ownerToken, accountId: ownerAccountId };
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

export function requireApiToken(req, res, next) {
  if (req.auth?.apiToken) {
    return next();
  }
  res.status(403).json({ error: 'forbidden' });
}
