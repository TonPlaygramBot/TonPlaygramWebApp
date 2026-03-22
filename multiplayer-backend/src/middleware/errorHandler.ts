import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger/index.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err }, 'Unhandled API error');
  res.status(500).json({ message: 'Internal server error' });
}
