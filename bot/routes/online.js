import { Router } from 'express';
import {
  ping,
  listOnline,
  countOnline
} from '../services/connectionService.js';
import { buildReadinessSnapshot } from '../config/onlineGamePolicy.js';
import {
  TPG_GAME_CONTRACTS,
  getTpgGameContract
} from '../config/tpgGameContracts.js';

const router = Router();

router.post('/ping', async (req, res) => {
  const {
    playerId,
    accountId,
    tpcAccountId,
    tpcAccountNumber,
    roomId,
    status
  } = req.body || {};
  const id = tpcAccountNumber || tpcAccountId || accountId || playerId;
  if (!id) return res.status(400).json({ error: 'tpcAccountNumber required' });
  await ping({
    userId: String(id),
    roomId: roomId || null,
    status: status || 'online'
  });
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

router.get('/tpg-contracts/:gameType?', (req, res) => {
  const gameType = String(req.params.gameType || '')
    .trim()
    .toLowerCase();
  if (gameType) {
    const contract = getTpgGameContract(gameType);
    if (!contract)
      return res.status(404).json({ error: 'game_contract_not_found' });
    return res.json({ contract });
  }
  return res.json({ contracts: TPG_GAME_CONTRACTS });
});

router.get('/readiness', (req, res) => {
  res.json({
    generatedAt: new Date().toISOString(),
    games: buildReadinessSnapshot()
  });
});

export default router;
