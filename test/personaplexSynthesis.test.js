import { afterEach, beforeEach, test } from '@jest/globals';
import assert from 'node:assert/strict';
import { synthesizeWithPersonaPlex } from '../bot/utils/personaplexSynthesis.js';

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.PERSONAPLEX_API_URL = 'https://personaplex.example';
  process.env.PERSONAPLEX_API_KEY = 'token';
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.PERSONAPLEX_API_URL;
  delete process.env.PERSONAPLEX_API_KEY;
});

test('extracts remote audio URL from PersonaPlex response', async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ audio_url: 'https://cdn.example/voice.mp3' })
  });

  const result = await synthesizeWithPersonaPlex({ text: 'hello', voiceId: 'nova_en_us_f', locale: 'en-US' });
  assert.equal(result.audioSource, 'https://cdn.example/voice.mp3');
});

test('extracts base64 audio from PersonaPlex response', async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ audio_base64: 'QUJD' })
  });

  const result = await synthesizeWithPersonaPlex({ text: 'hello', voiceId: 'nova_en_us_f', locale: 'en-US' });
  assert.ok(result.audioSource.startsWith('data:audio/mpeg;base64,'));
});
