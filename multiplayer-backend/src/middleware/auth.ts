import type { Request, Response, NextFunction } from 'express';

export interface AuthContext {
  userId: string;
  username: string;
}

export type AuthenticatedRequest = Request & { auth?: AuthContext };

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing bearer token' });
    return;
  }

  const raw = authHeader.replace('Bearer ', '').trim();
  const [userId, username] = raw.split(':');
  if (!userId || !username) {
    res.status(401).json({ message: 'Invalid token format' });
    return;
  }

  req.auth = { userId, username };
  next();
}
