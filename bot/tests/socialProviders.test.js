import test from 'node:test';
import assert from 'node:assert/strict';
import { getSocialProvider, SOCIAL_PLATFORMS, validateSocialContent } from '../services/socialProviders.js';

test('provider registry supports every initial platform without hardcoding the composer', () => {
  assert.deepEqual(SOCIAL_PLATFORMS, ['instagram', 'facebook', 'tiktok', 'youtube', 'x', 'threads']);
  for (const platform of SOCIAL_PLATFORMS) assert.equal(getSocialProvider(platform).platform, platform);
});

test('validation reports provider-specific problems without truncating content', () => {
  const content = { caption: 'x'.repeat(281), media: [] };
  assert.deepEqual(validateSocialContent('x', content), { ready: false, errors: ['Caption exceeds maximum length (280)'] });
  assert.equal(content.caption.length, 281);
  assert.deepEqual(validateSocialContent('youtube', content).errors, ['Title required', 'Media required']);
});

test('mock providers fail independently according to provider controls', async () => {
  process.env.SOCIAL_PROVIDER_MODE = 'mock';
  process.env.SOCIAL_MOCK_FACEBOOK_RESULT = 'retryable_failure';
  const content = { caption: 'Campaign', media: [{ mimeType: 'image/png' }], overrides: {} };
  const instagram = await getSocialProvider('instagram').publish(content);
  assert.match(instagram.externalId, /^mock-instagram-/);
  await assert.rejects(getSocialProvider('facebook').publish(content), (error) => error.type === 'RETRYABLE_ERROR');
  delete process.env.SOCIAL_MOCK_FACEBOOK_RESULT;
});
