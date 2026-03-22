import { logger } from '../logger/index.js';
export function errorHandler(err, _req, res, _next) {
    logger.error({ err }, 'Unhandled API error');
    res.status(500).json({ message: 'Internal server error' });
}
