import crypto from 'node:crypto';

export const problem = (status, message) => Object.assign(new Error(message), { status, publicMessage: message });
export const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex');
export const random = () => crypto.randomBytes(32).toString('base64url');
export function secret() {
  const key = Buffer.from(process.env.CREATOR_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw problem(503, 'Creator Studio account connections are being prepared. Please try again later.');
  return key;
}
export function configured() { try { secret(); return Boolean(publicOrigin()); } catch { return false; } }
export function publicOrigin() {
  const url = new URL(process.env.CREATOR_PUBLIC_URL || 'https://tonplaygram-bot.onrender.com');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw problem(503, 'Studio needs a secure address.');
  return url.origin;
}
export function seal(data, context) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secret(), iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(x => x.toString('base64url')).join('.');
}
export function unseal(value, context) {
  const [iv, tag, body] = String(value).split('.').map(x => Buffer.from(x, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', secret(), iv);
  decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString());
}
export function sign(value) { return crypto.createHmac('sha256', secret()).update(value).digest('base64url'); }
export function matches(a, b) {
  const left = Buffer.from(String(a || '')), right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
export function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(x => x.trim().split(/=(.*)/s).slice(0, 2)));
}
export function setCookie(res, name, value, maxAge = 604800000) {
  res.cookie(name, value, { httpOnly: true, secure: publicOrigin().startsWith('https:'), sameSite: 'lax', path: '/api/creator', maxAge });
}
export function issueSession(res, owner, name) {
  const data = Buffer.from(JSON.stringify({ owner, name: String(name || 'Creator').slice(0, 100), exp: Date.now() + 7 * 86400000, nonce: random() })).toString('base64url');
  setCookie(res, 'tpg_creator', `${data}.${sign(data)}`);
}
export function session(req) {
  try {
    const [data, signature] = String(cookies(req).tpg_creator || '').split('.');
    if (!data || !matches(sign(data), signature)) return null;
    const user = JSON.parse(Buffer.from(data, 'base64url'));
    return user.exp > Date.now() && /^(telegram|google):[a-zA-Z0-9_-]+$/.test(user.owner) ? user : null;
  } catch { return null; }
}
export function requireSession(req, _res, next) {
  req.creator = session(req);
  if (!req.creator) return next(problem(401, 'Sign in to Creator Studio to continue.'));
  next();
}
export function csrf(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin !== publicOrigin() || req.get('x-creator-request') !== '1') return next(problem(403, 'Please reopen Creator Studio in your browser.'));
  next();
}
export const safeConnection = c => ({ id: String(c._id), platform: c.platform, name: c.name, status: c.status, connectedAt: c.createdAt });
