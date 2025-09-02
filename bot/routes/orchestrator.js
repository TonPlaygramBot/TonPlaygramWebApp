import express from 'express';

export default function orchestratorRoutes(orchestrator) {
  const router = express.Router();

  router.get('/healthz', (req, res) => {
    res.json({ status: 'ok' });
  });

  router.post('/queue/join', (req, res) => {
    const { playerId, gameId } = req.body || {};
    res.json(orchestrator.joinQueue(playerId, gameId));
  });

  router.post('/queue/leave', (req, res) => {
    const { playerId, gameId } = req.body || {};
    res.json(orchestrator.leaveQueue(playerId, gameId));
  });

  router.get('/queue/status/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    const q = orchestrator.queue.get(gameId) || [];
    res.json({ size: q.length });
  });

  router.post('/match/claim', (req, res) => {
    const { matchId, playerId } = req.body || {};
    res.json(orchestrator.claimMatch(matchId, playerId));
  });

  router.post('/match/start', (req, res) => {
    const { matchId } = req.body || {};
    res.json(orchestrator.startMatch(matchId));
  });

  router.get('/match/state/:matchId', (req, res) => {
    const state = orchestrator.getState(req.params.matchId);
    if (!state) return res.status(404).json({ error: 'not_found' });
    res.json(state);
  });

  router.post('/match/move', (req, res) => {
    const { matchId, playerId, move } = req.body || {};
    res.json(orchestrator.submitMove(matchId, playerId, move));
  });

  router.post('/match/end', (req, res) => {
    const { matchId, winnerId, reason } = req.body || {};
    res.json(orchestrator.endMatch(matchId, winnerId, reason));
  });

  router.post('/match/forfeit', (req, res) => {
    const { matchId, playerId } = req.body || {};
    res.json(orchestrator.forfeit(matchId, playerId));
  });

  router.post('/match/rejoin', (req, res) => {
    const { matchId, playerId } = req.body || {};
    res.json(orchestrator.rejoinMatch(matchId, playerId));
  });

  return router;
}
