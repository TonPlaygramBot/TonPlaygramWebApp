import type { NextFunction, Request, Response } from 'express';
import { readSession } from '../auth/session.js';

export type SessionShape = { accountId: string; telegramUserId?: string; googleSub?: string };

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  (req as Request & { session: SessionShape }).session = {
    accountId: session.accountId,
    telegramUserId: session.telegramUserId,
    googleSub: session.googleSub,
  };
  next();
}
