import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { credentialConfiguration, credentials } from '../creator/catalog.js';
import { creatorConfigurationReport, logCreatorConfiguration } from '../creator/configuration.js';

const pairs = [
  ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'], ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
  ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'], ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
  ...['GOOGLE', 'META', 'INSTAGRAM', 'TIKTOK'].map(p => [`CREATOR_${p}_CLIENT_ID`, `CREATOR_${p}_CLIENT_SECRET`])
];
const keys = [...pairs.flat(), 'CREATOR_ENCRYPTION_KEY', 'CREATOR_PUBLIC_URL', 'CREATOR_TIKTOK_APPROVED', 'VITE_GOOGLE_CLIENT_ID'];
const savedEnv = { ...process.env };
beforeEach(() => {
  keys.forEach(key => delete process.env[key]);
  process.env.CREATOR_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  process.env.CREATOR_PUBLIC_URL = 'https://studio.example';
});
afterEach(() => keys.forEach(key => { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key]; }));

test('the report identifies exact missing keys without treating basic Google login as publishing access', () => {
  process.env.VITE_GOOGLE_CLIENT_ID = '123456789-test.apps.googleusercontent.com';
  const report = creatorConfigurationReport();
  assert.equal(report.googleIdentityConfigured, true);
  assert.deepEqual(report.platforms.map(p => p.platform), ['youtube', 'facebook', 'instagram', 'tiktok']);
  assert.deepEqual(report.platforms[0].missingEnvironmentVariables, ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
  for (const platform of report.platforms) {
    assert.equal(platform.configurationReady, false);
    assert.equal(platform.setupReason, 'app_credentials');
    assert.equal(platform.callback, `https://studio.example/api/creator/oauth/${platform.platform}/callback`);
  }
});
test('an incomplete dedicated override is identified without silently mixing different app credentials', () => {
  process.env.CREATOR_GOOGLE_CLIENT_ID = 'dedicated-app';
  process.env.GOOGLE_CLIENT_ID = 'shared-app'; process.env.GOOGLE_CLIENT_SECRET = 'shared-secret';
  const config = credentialConfiguration('youtube');
  assert.equal(config.source, 'dedicated'); assert.equal(config.incompleteOverrideBlocksSharedPair, true);
  assert.deepEqual(config.missingEnvironmentVariables, ['CREATOR_GOOGLE_CLIENT_SECRET']);
  assert.deepEqual(credentials('youtube'), { id: 'dedicated-app', secret: undefined });
  assert.equal(credentialConfiguration('__proto__'), null);
});
test('startup diagnostics never contain IDs, secrets or encryption keys, and keep approval separate', () => {
  for (const [id, secret] of pairs) { process.env[id] = `private-id-${id}`; process.env[secret] = `private-secret-${secret}`; }
  process.env.CREATOR_TIKTOK_APPROVED = 'false';
  const lines = []; logCreatorConfiguration(line => lines.push(line));
  assert.equal(lines.length, 1); assert.ok(lines[0].startsWith('[creator-config] '));
  const report = JSON.parse(lines[0].slice('[creator-config] '.length));
  assert.equal(report.platforms[0].configurationReady, true);
  assert.equal(report.platforms[3].setupReason, 'platform_approval');
  assert.equal(report.platforms[3].directPostApprovalConfirmed, false);
  for (const key of pairs.flat().concat('CREATOR_ENCRYPTION_KEY')) assert.ok(!lines[0].includes(process.env[key]));
});
test('invalid public origin reports unavailable without interrupting startup or disclosing malformed values', () => {
  process.env.CREATOR_PUBLIC_URL = 'invalid-private-origin-value';
  const lines = []; assert.doesNotThrow(() => logCreatorConfiguration(line => lines.push(line)));
  const report = JSON.parse(lines[0].slice('[creator-config] '.length));
  assert.ok(report.platforms.every(p => p.callback === null && !p.secureStorageConfigured && p.setupReason === 'secure_storage'));
  assert.ok(!lines[0].includes(process.env.CREATOR_PUBLIC_URL));
});
