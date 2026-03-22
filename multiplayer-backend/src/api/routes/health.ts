import { Router } from 'express';
import { prisma } from '../../db/prisma.js';
import { redis } from '../../redis/redisClient.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const startedAt = Date.now();
  const dbStatus = await prisma.$queryRaw`SELECT 1`
    .then(() => 'ok')
    .catch(() => 'error');
  const redisStatus = await redis
    .ping()
    .then(() => 'ok')
    .catch(() => 'error');

  res.json({
    status: dbStatus === 'ok' && redisStatus === 'ok' ? 'ok' : 'degraded',
    checks: { db: dbStatus, redis: redisStatus },
    responseTimeMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
});
