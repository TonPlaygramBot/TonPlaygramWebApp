import jwt from 'jsonwebtoken';
import type { Response, Request } from 'express';
import { env } from '../env.js';

export type SessionClaims = {
  accountId: string;
  telegramUserId: string;
  iat?: number;
  exp?: number;
};

const COOKIE_NAME = 'session';

export function signSession(claims: Omit<SessionClaims, 'iat' | 'exp'>): string {
  return jwt.sign(claims, env.jwtSecret, { expiresIn: '7d' });
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME);
}

export function readSession(req: Request): SessionClaims | null {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return null;
  try {
    return jwt.verify(raw, env.jwtSecret) as SessionClaims;
  } catch {
    return null;
  }
}
