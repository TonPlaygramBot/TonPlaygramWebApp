import { Router } from 'express';
import User from '../models/User.js';
import socialAuthenticate from '../middleware/socialAuth.js';
import { createLuckyDaily } from '../services/luckyDaily.js';

export function createLuckyDailyRouter(service = createLuckyDaily({ User })) {
  const router = Router();
  router.use(socialAuthenticate);
  router.post('/claim', async (req, res) => {
    try {
      // All body fields intentionally ignored; identity, day and amount are server-owned.
      const result = await service.claim(req.socialUser._id);
      res.setHeader('Cache-Control', 'no-store');
      res.json(result);
    } catch (error) {
      res.status(error.status || 503).json({ error: error.status ? error.code : 'reward_service_unavailable' });
    }
  });
  return router;
}
export default createLuckyDailyRouter();
