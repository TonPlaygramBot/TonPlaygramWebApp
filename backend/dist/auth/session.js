import jwt from 'jsonwebtoken';
import { env } from '../env.js';
const COOKIE_NAME = 'session';
export function signSession(claims) {
    return jwt.sign(claims, env.jwtSecret, { expiresIn: '7d' });
}
export function setSessionCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.nodeEnv === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}
export function clearSessionCookie(res) {
    res.clearCookie(COOKIE_NAME);
}
export function readSession(req) {
    const raw = req.cookies?.[COOKIE_NAME];
    if (!raw)
        return null;
    try {
        return jwt.verify(raw, env.jwtSecret);
    }
    catch {
        return null;
    }
}
