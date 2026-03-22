import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { listMatchHistory } from '../../repositories/matchRepository.js';
export const matchesRouter = Router();
matchesRouter.get('/matches/history', authMiddleware, async (req, res, next) => {
    try {
        const history = await listMatchHistory(req.auth.userId);
        res.json({ items: history });
    }
    catch (error) {
        next(error);
    }
});
