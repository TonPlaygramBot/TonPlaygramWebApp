import { Router } from 'express';
import User from '../models/User.js';
import socialAuthenticate from '../middleware/socialAuth.js';
import { createSpinRewards } from '../services/spinRewards.js';

export function createSpinRewardsRouter(service = createSpinRewards({ User })) {
const router = Router();
// Resolves the account from signed Telegram/Google credentials, never body/header IDs.
router.use(socialAuthenticate);
for (const action of ['status', 'start', 'claim']) {
  router.post(`/${action}`, async (req, res) => {
    try {
      const body = req.body || {};
      const result = await service[action](req.socialUser._id, body.kind,
        action === 'start' ? body.requestId : body.id);
      res.setHeader('Cache-Control', 'no-store');
      res.json(result);
    } catch (error) {
      const status = error.status || 503;
      res.status(status).json({ error: error.status ? error.code : 'reward_service_unavailable' });
    }
  });
}
return router;
}
export default createSpinRewardsRouter();
