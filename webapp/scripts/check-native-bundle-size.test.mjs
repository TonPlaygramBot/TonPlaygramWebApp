import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkBundle, readBudget, DEFAULT_MAX_BYTES } from './check-native-bundle-size.mjs';

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'native-size-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  await fs.writeFile(path.join(dir, 'index.html'), 'abc');
  return dir;
}
test('default is an explicit 200 MiB project budget', () => {
  assert.deepEqual(readBudget({}), { maxBytes: 209715200, reason: null });
});
test('rejects invalid/unbounded overrides', () => {
  for (const value of ['', '0', '-1', 'Infinity', 'NaN', '1.5', '2e8', '9007199254740992', ' 10']) {
    assert.throws(() => readBudget({ NATIVE_BUNDLE_MAX_BYTES: value }));
  }
});
test('raising budget requires reason, lowering does not', () => {
  assert.throws(() => readBudget({ NATIVE_BUNDLE_MAX_BYTES: String(DEFAULT_MAX_BYTES + 1) }));
  assert.equal(readBudget({ NATIVE_BUNDLE_MAX_BYTES: '10' }).maxBytes, 10);
  assert.equal(readBudget({ NATIVE_BUNDLE_MAX_BYTES: '300000000', NATIVE_BUNDLE_SIZE_OVERRIDE_REASON: 'Reviewed internal device experiment' }).maxBytes, 300000000);
});
test('measures hidden/nested files and hardlinks as copied bytes, without modifying input', async t => {
  const dir = await fixture(t);
  await fs.mkdir(path.join(dir, 'assets'));
  await fs.writeFile(path.join(dir, 'assets', '.hidden'), '12345');
  await fs.link(path.join(dir, 'assets', '.hidden'), path.join(dir, 'copy'));
  const report = await checkBundle({ distDir: dir, env: { NATIVE_BUNDLE_MAX_BYTES: '13' } });
  assert.equal(report.totalBytes, 13);
  assert.equal(report.fileCount, 3);
  assert.equal(report.passed, true);
  assert.equal(report.largestFiles[0].bytes, 5);
  assert.equal(report.largestGroups.find(g => g.path === 'copy').bytes, 5);
  assert.equal(await fs.readFile(path.join(dir, 'assets', '.hidden'), 'utf8'), '12345');
  assert.equal((await checkBundle({ distDir: dir, env: { NATIVE_BUNDLE_MAX_BYTES: '12' } })).passed, false);
});
test('missing, empty and invalid dist fail closed', async t => {
  const dir = await fixture(t);
  await assert.rejects(checkBundle({ distDir: path.join(dir, 'missing'), env: {} }));
  await fs.writeFile(path.join(dir, 'index.html'), '');
  await assert.rejects(checkBundle({ distDir: dir, env: {} }));
});
test('symlinks fail closed rather than undercounting', async t => {
  const dir = await fixture(t);
  await fs.symlink('index.html', path.join(dir, 'link'));
  await assert.rejects(checkBundle({ distDir: dir, env: {} }), /symlink/);
});
test('release workflows gate before sync and signing; development sync stays unchanged', async () => {
  const root = new URL('../../', import.meta.url);
  for (const name of ['android-store-release.yml', 'android-apk-release.yml']) {
    const workflow = await fs.readFile(new URL(`.github/workflows/${name}`, root), 'utf8');
    assert.ok(workflow.indexOf('run: npm run check:native-size') < workflow.indexOf('cap sync'));
    assert.match(workflow, /NATIVE_BUNDLE_SIZE_OVERRIDE_REASON: \$\{\{ inputs.native_bundle_size_override_reason \}\}/);
  }
  const pkg = JSON.parse(await fs.readFile(new URL('package.json', new URL('../', import.meta.url)), 'utf8'));
  assert.equal(pkg.scripts['native:sync'], 'npm run build && cap sync');
});

test('CLI reports JSON and fails oversized or missing bundles', async t => {
  const dir = await fixture(t);
  const scripts = path.join(dir, 'scripts');
  const dist = path.join(dir, 'dist');
  await fs.mkdir(scripts);
  await fs.mkdir(dist);
  await fs.copyFile(fileURLToPath(new URL('./check-native-bundle-size.mjs', import.meta.url)), path.join(scripts, 'check.mjs'));
  const run = budget => spawnSync(process.execPath, [path.join(scripts, 'check.mjs')], {
    env: { ...process.env, NATIVE_BUNDLE_MAX_BYTES: budget, NATIVE_BUNDLE_SIZE_OVERRIDE_REASON: '' }, encoding: 'utf8'
  });
  assert.equal(run('3').status, 1);
  await fs.writeFile(path.join(dist, 'index.html'), 'abc');
  assert.equal(run('3').status, 0);
  const failed = run('2');
  assert.equal(failed.status, 1);
  assert.equal(JSON.parse(failed.stdout).passed, false);
  assert.equal(await fs.readFile(path.join(dist, 'index.html'), 'utf8'), 'abc');
});
test('Capacitor webDir matches the measured dist directory', async () => {
  const config = await fs.readFile(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
  assert.match(config, /webDir: ['"]dist['"]/);
});
