import { Router } from 'express';
import { ping, listOnline, countOnline } from '../services/connectionService.js';
import { buildReadinessSnapshot } from '../config/onlineGamePolicy.js';

const router = Router();

router.post('/ping', async (req, res) => {
  const { playerId, accountId, roomId, status } = req.body || {};
  const id = playerId || accountId;
  if (!id) return res.status(400).json({ error: 'playerId required' });
  await ping({ userId: String(id), roomId: roomId || null, status: status || 'online' });
  res.json({ success: true });
});

router.get('/list', async (req, res) => {
  const users = await listOnline();
  res.json({ users });
});

router.get('/count', async (req, res) => {
  const count = await countOnline();
  res.json({ count });
});

router.get('/readiness', (req, res) => {
  res.json({
    generatedAt: new Date().toISOString(),
    games: buildReadinessSnapshot()
  });
});

export default router;
