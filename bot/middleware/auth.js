import crypto from 'crypto';

function verifyTelegramInitData(initData) {
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
      .update(process.env.BOT_TOKEN || '')
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

export default function authenticate(req, res, next) {
  const auth = req.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const allowedToken = process.env.API_AUTH_TOKEN;
  const initData = req.get('x-telegram-init-data');

  if (initData) {
    const data = verifyTelegramInitData(initData);
    if (data) {
      req.auth = { telegramId: data.user ? Number(JSON.parse(data.user).id) : undefined };
      return next();
    }
  }

  if (allowedToken && token === allowedToken) {
    return next();
  }

  res.status(401).json({ error: 'unauthorized' });
}
