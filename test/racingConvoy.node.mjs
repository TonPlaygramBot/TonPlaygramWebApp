import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from '../webapp/node_modules/esbuild/lib/main.js';
import { createRacer, makeTrack, STEP } from '../webapp/src/games/kartroyale/simulation.mjs';
import { sampleCircuitDistance } from '../webapp/src/games/kartroyale/circuitMetrics.mjs';
import { validateSeatTableRequest } from '../bot/config/onlineGamePolicy.js';
import games from '../webapp/src/config/gamesCatalog.js';

const simulation = new URL('../webapp/src/games/kartroyale/simulation.mjs', import.meta.url);
const source = new URL('../webapp/src/games/kartroyale/ConvoyRun.ts', import.meta.url);
const compiled = await build({
  entryPoints: [source.pathname],
  bundle: true,
  write: false,
  format: 'esm',
  plugins: [{
    name: 'use-production-simulation',
    setup(builder) {
      builder.onResolve({ filter: /^\.\/simulation\.mjs$/ }, () => ({ path: simulation.href, external: true }));
    }
  }]
});
const { ConvoyRun, CONVOY_TIME_LIMIT } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));

const track = makeTrack('lana');
const input = { steer: 0, brake: false, drift: false, boost: false, shield: false, fire: false };
function fixture() {
  const player = createRacer(track, 'you', 'Player');
  const start = sampleCircuitDistance(track, 0);
  Object.assign(player, { x: start.x, z: start.z, yaw: start.yaw, velocityYaw: start.yaw, index: start.index });
  return { run: new ConvoyRun(track), player };
}

test('the public catalog and matchmaking retire the standalone city game', () => {
  assert.equal(games.some(game => game.slug === 'tiranastreets'), false);
  assert.equal(games.find(game => game.slug === 'kartroyale').modes.includes('Convoy Run'), true);
  const config = { stake: 1, maxPlayers: 2, matchMeta: { mode: 'online', token: 'TPG' } };
  assert.equal(validateSeatTableRequest({ ...config, gameType: 'blackwater' }).error, 'unsupported_game_type');
  assert.equal(validateSeatTableRequest({ ...config, gameType: 'kartroyale' }).ok, true);
});

test('a timed run spawns a convoy, auto-fires, uses rocket ammunition, and restarts cleanly', () => {
  const { run, player } = fixture();
  for (let i = 0; i < 68; i++) run.step(player, input, STEP);
  assert.equal(run.summary().wave, 1);
  assert.equal(run.enemies.length, 2);
  assert.ok(run.summary().shots > 0);
  run.step(player, { ...input, fire: true }, STEP);
  assert.equal(run.summary().rockets, 1);
  assert.equal(run.summary().launches, 1);
  run.step(player, { ...input, fire: true }, STEP);
  assert.equal(run.summary().rockets, 1);
  for (let i = 0; i < 150; i++) run.step(player, input, STEP);
  assert.ok(run.summary().destroyed > 0);
  assert.ok(run.summary().blasts > 0);
  assert.ok(run.pickups.length > 0);
  assert.equal(fixture().run.summary().rockets, 2);
});

test('incoming fire can end the run, and an idle run eventually expires', () => {
  const { run, player } = fixture();
  for (let i = 0; i < 9; i++) {
    run.projectiles.push({ ...player, kind: 'hostile', vx: 0, vz: 0, life: 1 });
    run.step(player, input, STEP);
  }
  assert.equal(run.summary().hull, 0);
  assert.equal(run.summary().status, 'wrecked');
  const idle = fixture();
  for (let i = 0; i <= CONVOY_TIME_LIMIT * 60; i++) idle.run.step(idle.player, input, STEP);
  assert.equal(idle.run.summary().status, 'timeout');
});
