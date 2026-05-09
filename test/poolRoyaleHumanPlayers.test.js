import assert from 'node:assert/strict';
import test from 'node:test';
import {
  POOL_ROYALE_HUMAN_PLAYERS,
  applyPoolRoyaleHumanAiProfile,
  choosePoolRoyaleHumanPlan,
  resolvePoolRoyaleHumanPlayer
} from '../webapp/src/config/poolRoyaleHumanPlayers.js';

test('Pool Royale exposes five selectable Murlan-backed human players', () => {
  assert.equal(POOL_ROYALE_HUMAN_PLAYERS.length, 5);
  const ids = new Set(POOL_ROYALE_HUMAN_PLAYERS.map((player) => player.id));
  assert.equal(ids.size, 5);
  for (const player of POOL_ROYALE_HUMAN_PLAYERS) {
    assert.ok(
      player.modelUrl,
      `${player.id} should reuse a Murlan character model`
    );
    assert.ok(
      player.ai?.planStyle,
      `${player.id} should define a shot logic style`
    );
  }
});

test('resolvePoolRoyaleHumanPlayer falls back to the default profile', () => {
  assert.equal(
    resolvePoolRoyaleHumanPlayer('geometry-master').id,
    'geometry-master'
  );
  assert.equal(
    resolvePoolRoyaleHumanPlayer('missing-profile').id,
    POOL_ROYALE_HUMAN_PLAYERS[0].id
  );
});

test('safety profile selects safety when pot quality is below threshold', () => {
  const safety = resolvePoolRoyaleHumanPlayer('safety-captain');
  const plan = choosePoolRoyaleHumanPlan(
    {
      bestPot: { type: 'pot', quality: 0.2 },
      bestSafety: { type: 'safety', quality: 0.7 }
    },
    safety
  );
  assert.equal(plan.type, 'safety');
});

test('human AI profile clamps power and biases spin', () => {
  const power = resolvePoolRoyaleHumanPlayer('power-breaker');
  const plan = applyPoolRoyaleHumanAiProfile(
    {
      type: 'pot',
      power: 0.96,
      spin: { x: 0, y: 0.44 },
      aimDir: { clone: null }
    },
    power,
    1
  );
  assert.equal(plan.power, 1);
  assert.equal(plan.spin.y, 0.5);
  assert.equal(plan.aiMeta.humanProfileId, 'power-breaker');
});
