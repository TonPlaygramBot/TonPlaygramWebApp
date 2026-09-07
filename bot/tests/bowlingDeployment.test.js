import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const bot = fileURLToPath(new URL('../', import.meta.url));
const sharedPath = 'webapp/src/games/royallanes/shared';
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));

test('bowling starts and simulates with only backend production dependencies', async (t) => {
  const manifest = await json(join(bot, 'package.json'));
  const lock = await json(join(bot, 'package-lock.json'));
  const enginePath = join(bot, 'node_modules/cannon-es');
  const engine = await json(join(enginePath, 'package.json'));
  assert.equal(manifest.dependencies['cannon-es'], engine.version);
  assert.equal(lock.packages[''].dependencies['cannon-es'], engine.version);
  assert.equal(lock.packages['node_modules/cannon-es'].version, engine.version);

  // Reproduce Render's directory layout, without dependencies under webapp
  // or the repository root that could hide an incorrect sibling import.
  const fixture = await mkdtemp(join(tmpdir(), 'bowling-deployment-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const fixtureBot = join(fixture, 'bot');
  await mkdir(join(fixtureBot, 'services'), { recursive: true });
  await cp(join(bot, 'package.json'), join(fixtureBot, 'package.json'));
  await mkdir(join(fixtureBot, 'node_modules'), { recursive: true });
  await cp(enginePath, join(fixtureBot, 'node_modules/cannon-es'), {
    recursive: true
  });
  for (const file of [
    'royalLanes.js',
    'bowlingSimulationPool.mjs',
    'bowlingSimulation.worker.mjs'
  ]) {
    await cp(join(bot, 'services', file), join(fixtureBot, 'services', file));
  }
  await cp(join(dirname(bot), sharedPath), join(fixture, sharedPath), {
    recursive: true
  });

  await writeFile(
    join(fixtureBot, 'smoke.mjs'),
    `import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import { attachRoyalLanes } from './services/royalLanes.js';
import { createBowlingSimulationPool } from './services/bowlingSimulationPool.mjs';
import { ALL_PINS, chooseAiShot } from '../${sharedPath}/replay.mjs';

assert.equal(existsSync('../node_modules'), false);
assert.equal(existsSync('../webapp/node_modules'), false);
const service = attachRoyalLanes(new EventEmitter(), {
  autoTick: false,
  settleMatch: async () => assert.fail('startup must not settle stakes')
});
const pool = createBowlingSimulationPool({ size: 1 });
try {
  service.createMatch({
    id: 'deploy-smoke', stake: 100, maxPlayers: 2,
    players: [{ id: 'A' }, { id: 'B' }]
  });
  const match = service.rooms.get('deploy-smoke').match;
  assert.equal(match.phase, 'waiting');
  assert.deepEqual(match.players.map((p) => p.id), ['A', 'B']);
  const hit = await pool.simulate({
    shot: { aim: 0.055, hook: 0, power: 75 }, standing: ALL_PINS
  });
  assert.ok(hit.knocked >= 6);
  assert.ok(hit.frames.length > 70);
  assert.ok(hit.frames.every((f) => f.length === 77 && f.every(Number.isFinite)));
  assert.equal(hit.knocked + hit.standing.length, 10);
  const gutter = await pool.simulate({
    shot: { aim: 1.2, hook: 0, power: 75 }, standing: ALL_PINS
  });
  assert.equal(gutter.knocked, 0);
  assert.equal(gutter.gutter, true);
  const spare = await pool.simulate({
    shot: chooseAiShot([6], 'pro', () => 0.5), standing: [6]
  });
  assert.equal(spare.knocked, 1);
  assert.equal(spare.gutter, false);
  await assert.rejects(pool.simulate({ shot: { aim: 0, hook: 0, power: 999 } }),
    /invalid_roll/);
  console.log('Backend-only startup, hit, gutter, spare and validation passed.');
} finally {
  await pool.close();
  await service.close();
}
`
  );
  const env = { ...process.env };
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  const { stdout } = await run(process.execPath, ['smoke.mjs'], {
    cwd: fixtureBot,
    env,
    timeout: 30_000
  });
  assert.match(
    stdout,
    /Backend-only startup, hit, gutter, spare and validation passed/
  );
});
