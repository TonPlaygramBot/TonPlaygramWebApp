import express from 'express';
import { healthRouter } from './routes/health.js';
import { matchesRouter } from './routes/matches.js';
import { logger } from '../logger/index.js';
import { apiRateLimiter, corsMiddleware, helmetMiddleware } from '../middleware/security.js';
import { errorHandler } from '../middleware/errorHandler.js';
export function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.use((req, _res, next) => {
        logger.info({ method: req.method, path: req.path }, 'HTTP request');
        next();
    });
    app.use(express.json({ limit: '256kb' }));
    app.use(corsMiddleware);
    app.use(helmetMiddleware);
    app.use('/api', apiRateLimiter, healthRouter, matchesRouter);
    app.use(errorHandler);
    return app;
}
