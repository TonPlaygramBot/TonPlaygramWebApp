import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRACKS,
  collectPowerup,
  createRacer,
  damageRacer,
  makeTrack,
  useWeapon
} from '../webapp/src/games/kartroyale/simulation.mjs';

test('Racing Royal ships five distinct race environments', () => {
  assert.equal(TRACKS.length, 5);
  assert.equal(new Set(TRACKS.map(({ id }) => id)).size, 5);
  for (const track of TRACKS) assert.equal(makeTrack(track.id).points.length, 360);
});

test('shield, repair, nitro, damage and rocket combat form a complete power-up loop', () => {
  const track = makeTrack('harbor');
  const attacker = createRacer(track, 'player', 'Player');
  const target = createRacer(track, 'target', 'Target', 1, true);

  target.health = 50;
  assert.equal(collectPowerup(target, 'repair'), true);
  assert.equal(target.health, 88);
  assert.equal(collectPowerup(target, 'shield'), true);
  assert.equal(damageRacer(target, 40), 0);
  assert.equal(target.health, 88);

  target.shield = 0;
  assert.equal(damageRacer(target, 30), 30);
  assert.equal(target.health, 58);
  assert.equal(collectPowerup(attacker, 'nitro'), true);
  assert.equal(attacker.turbo, 3.2);

  target.x = attacker.x + Math.sin(attacker.yaw) * 12;
  target.z = attacker.z + Math.cos(attacker.yaw) * 12;
  assert.equal(collectPowerup(attacker, 'rocket'), true);
  assert.equal(useWeapon(attacker, [attacker, target]), target.id);
  assert.equal(attacker.weapon, null);
  assert.equal(target.health, 24);
});
