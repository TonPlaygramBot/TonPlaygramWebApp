import test from 'node:test';
import assert from 'node:assert/strict';
import { withPoolRoyalActivePlayer, lowestPoolRoyalBall, ALBANIAN_61_RACK,
  poolRoyalBallsToSpot, findPoolRoyalSpot } from '../webapp/src/pages/Games/poolRoyaleShotLifecycle.js';

test('random breaker and rematch keep the frame and serialized rules on the same seat without mutating the prior rack', () => {
  const frame = { activePlayer: 'A', meta: { variant: 'uk', state: { currentPlayer: 'A', lastEvent: 'BREAK_START' } } };
  for (const seat of ['B', 'A', 'B']) {
    const next = withPoolRoyalActivePlayer(frame, seat);
    assert.equal(next.activePlayer, seat);
    assert.equal(next.meta.state.currentPlayer, seat);
    assert.equal(next.meta.state.lastEvent, 'BREAK_START');
  }
  assert.equal(frame.meta.state.currentPlayer, 'A');
});

test('rotation targets sort numbered ball IDs numerically and ignore pocketed balls', () => {
  const balls = [{ id: 'cue', active: true }, { id: 'ball_10', active: true },
    { id: 'ball_2', active: true }, { id: 'ball_1', active: false }, { id: 'ball_8', active: true }];
  assert.equal(lowestPoolRoyalBall(balls).id, 'ball_2');
  balls[2].active = false;
  assert.equal(lowestPoolRoyalBall(balls).id, 'ball_8');
  assert.equal(lowestPoolRoyalBall([{ id: 'cue', active: true }]), null);
});

test('61 rack has all fifteen unique numbers with prescribed apex, center and corners', () => {
  assert.deepEqual([...ALBANIAN_61_RACK].sort((a, b) => a - b), Array.from({ length: 15 }, (_, i) => i + 1));
  assert.equal(ALBANIAN_61_RACK[0], 1);
  assert.equal(ALBANIAN_61_RACK[4], 15);
  assert.deepEqual([ALBANIAN_61_RACK[10], ALBANIAN_61_RACK[14]], [2, 3]);
});

test('all foul-potted 61 balls are restored in sequence without overlap, while legal pots stay down', () => {
  const balls = [{ id: 'ball_1', active: false, pos: { x: 0, y: 0 } },
    { id: 'ball_8', active: false, pos: { x: 0, y: 0 } },
    { id: 'ball_15', active: false, pos: { x: 0, y: 0 } },
    { id: 'ball_2', active: true, pos: { x: 0, y: 5 } }];
  const frame = { meta: { variant: 'albanian61', state: { ballsOnTable: [1, 2, 8] } } };
  const restored = poolRoyalBallsToSpot(balls, frame);
  assert.deepEqual(restored.map(ball => ball.id), ['ball_1', 'ball_8']);
  for (const ball of restored) {
    ball.pos = findPoolRoyalSpot(balls, ball.id, { y: 5, minY: -10, maxY: 10, radius: 1 });
    assert.ok(ball.pos);
    ball.active = true;
  }
  const active = balls.filter(ball => ball.active);
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    assert.ok(Math.hypot(active[i].pos.x - active[j].pos.x, active[i].pos.y - active[j].pos.y) >= 2.01 - 1e-8);
  }
  assert.equal(balls[2].active, false);
});
