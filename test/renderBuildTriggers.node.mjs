import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
// Existing root lockfile dependencies; no install scripts or network required.
const { load } = require('js-yaml');
const minimatch = require('minimatch');
const config = load(fs.readFileSync(new URL('../render.yaml', import.meta.url), 'utf8'));
const service = config.services.find(({ name }) => name === 'tonplaygram-bot');
const matches = file => service.buildFilter.paths.some(pattern => minimatch(file, pattern));

test('keeps the existing service and build/runtime working directory unchanged', () => {
  assert.equal(config.services.length, 1);
  assert.equal(service.rootDir, 'bot');
  assert.equal(service.branch, 'main');
  assert.equal(service.startCommand, 'npm start');
  assert.equal(service.buildCommand, 'npm install && npm --prefix ../webapp install && WEBAPP_BUILD_MAX_OLD_SPACE_SIZE=3072 npm --prefix ../webapp run build');
  assert.equal(service.healthCheckPath, '/api/health');
  assert.equal(service.disk.mountPath, '/var/data/tonplaygram');
  assert.equal(service.disk.sizeGB, 100);
  assert.equal(service.buildFilter.ignoredPaths, undefined);
});

test('includes all backend paths and the previously skipped UI fixes', () => {
  for (const file of ['bot/server.js', 'bot/routes/account.js', 'bot/tests/example.test.js',
    'webapp/src/pages/Games/ChessBattleRoyal.jsx', 'webapp/src/components/SceneStartupError.jsx',
    'webapp/src/config/gamesCatalog.js', 'webapp/public/assets/example.glb', 'webapp/package-lock.json']) {
    assert.equal(matches(file), true, file);
  }
});

test('includes shared runtime, build scripts, matchmaking and root dependency inputs', () => {
  for (const file of ['shared/socialApp.js', 'src/physics.ts', 'lib/example.js',
    'scripts/buildOfflineAssets.mjs', 'chess-multiplayer-server/src/index.ts',
    'assets-source/tirana/model.gltf', 'package.json', 'package-lock.json', 'tsconfig.build.json', 'render.yaml']) {
    assert.equal(matches(file), true, file);
  }
});

test('root documentation and test-only changes do not add unnecessary builds', () => {
  for (const file of ['README.md', 'docs/deployment/render-build-triggers.md',
    'test/renderBuildTriggers.node.mjs', 'tests/example.test.js', '.github/ISSUE_TEMPLATE/bug.md']) {
    assert.equal(matches(file), false, file);
  }
});
