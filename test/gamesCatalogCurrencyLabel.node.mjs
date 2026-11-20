import test from 'node:test';
import assert from 'node:assert/strict';
import gamesCatalog from '../webapp/src/config/gamesCatalog.js';

test('Table Tennis catalog uses TPG display branding and preserves its game identity', () => {
  const game = gamesCatalog.find(entry => entry.slug === 'tabletennisroyal');
  assert.equal(game.name, 'Table Tennis Royal');
  assert.equal(game.route, '/games/tabletennisroyal/lobby');
  assert.equal(game.description, 'Human players, spin rallies, a career tour and TPG online matches.');
  assert.ok(!/\bTPC\b/.test(game.description));
});
