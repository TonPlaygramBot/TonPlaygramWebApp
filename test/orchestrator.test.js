import test from 'node:test';
import assert from 'node:assert/strict';
import { MatchmakingOrchestrator } from '../bot/orchestrator/orchestrator.js';

function create() {
  return new MatchmakingOrchestrator({ afkTimeout: 100 });
}

test('queue pairs players and emits match_ready', (t) => {
  const orch = create();
  let ready = 0;
  orch.on('match_ready', (m) => {
    ready++;
    assert.equal(m.players.length, 2);
  });
  orch.joinQueue('p1', 'g');
  orch.joinQueue('p2', 'g');
  assert.equal(ready, 1);
  const matchId = [...orch.matches.keys()][0];
  assert.ok(matchId);
  const match = orch.matches.get(matchId);
  assert.equal(match.status, 'ready');
});

test('claims start the match', () => {
  const orch = create();
  orch.joinQueue('a', 'g');
  orch.joinQueue('b', 'g');
  const matchId = [...orch.matches.keys()][0];
  orch.claimMatch(matchId, 'a');
  orch.claimMatch(matchId, 'b');
  const match = orch.matches.get(matchId);
  assert.equal(match.status, 'active');
});

test('enforces turn order', () => {
  const orch = create();
  orch.joinQueue('p1', 'g');
  orch.joinQueue('p2', 'g');
  const matchId = [...orch.matches.keys()][0];
  orch.claimMatch(matchId, 'p1');
  orch.claimMatch(matchId, 'p2');
  const resWrong = orch.submitMove(matchId, 'p2', { x: 1 });
  assert.equal(resWrong.error, 'not_your_turn');
  const resRight = orch.submitMove(matchId, 'p1', { x: 1 });
  assert.equal(resRight.success, true);
});

test('afk player forfeits', async () => {
  const orch = create();
  orch.joinQueue('p1', 'g');
  orch.joinQueue('p2', 'g');
  const matchId = [...orch.matches.keys()][0];
  orch.claimMatch(matchId, 'p1');
  orch.claimMatch(matchId, 'p2');
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(orch.matches.size, 0);
});
