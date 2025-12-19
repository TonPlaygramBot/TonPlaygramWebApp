import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sanitizeUser } from '../utils/userUtils.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const COOKIE_NAME = 'auth_token';
const TOKEN_TTL = process.env.JWT_TTL || '7d';

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  return null;
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: TOKEN_TTL
  });
}

export function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

export async function authenticate(req, res, next) {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    req.authUser = user;
    req.authPayload = payload;
    req.sanitizedUser = sanitizeUser(user);
    next();
  } catch (err) {
    console.error('Auth verification failed:', err.message);
    res.status(401).json({ error: 'unauthorized' });
  }
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });
}
