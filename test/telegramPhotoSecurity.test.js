import express from 'express';
import { sanitizePublicPhoto, redactTelegramCredentialUrls } from '../bot/utils/publicPhoto.js';
import { fetchTelegramInfo } from '../bot/utils/telegram.js';

jest.mock('../bot/utils/proxyAgent.js', () => ({ withProxy: (options) => options }));

const credentialUrl = 'https://api.telegram.org/file/bot12345:legacy-secret/photos/photo.jpg';
const originalFetch = global.fetch;
const originalToken = process.env.BOT_TOKEN;

afterEach(() => {
  global.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.BOT_TOKEN;
  else process.env.BOT_TOKEN = originalToken;
  jest.restoreAllMocks();
});

test.each([
  credentialUrl,
  'https://api.telegram.org/bot12345:legacy-secret/getFile?file_id=photo',
  'https%3A%2F%2Fapi.telegram.org%2Ffile%2Fbot12345%3Alegacy-secret%2Fphoto.jpg',
  `Profile image: ${credentialUrl}`
])('redacts a credential-bearing Telegram API URL', (value) => {
  expect(sanitizePublicPhoto(value)).toBe('');
});

test.each([
  'https://t.me/i/userpic/320/public-photo.jpg',
  'https://images.example.com/robot.jpg',
  '/avatars/bot.png',
  'A bot helped me play a game',
  'data:image/png;base64,AAAA'
])('preserves ordinary profile or JSON text', (value) => {
  expect(sanitizePublicPhoto(value)).toBe(value);
});

test('Express serialization redacts nested legacy photos including document toJSON values', async () => {
  const app = express();
  app.set('json replacer', redactTelegramCredentialUrls);
  app.get('/profile', (_req, res) => res.json({
    profile: { toJSON: () => ({ photo: credentialUrl, nickname: 'Robot' }) },
    friends: [{ photo: credentialUrl }],
    count: 1, active: true, absent: null
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/profile`);
    const body = await response.json();
    expect(body).toEqual({
      profile: { photo: '', nickname: 'Robot' }, friends: [{ photo: '' }],
      count: 1, active: true, absent: null
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Telegram enrichment returns names without generating a credential-bearing photo URL', async () => {
  process.env.BOT_TOKEN = 'test-only-secret';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, result: {
      first_name: 'Safe', last_name: 'User', photo: { big_file_id: 'photo-id' }
    } })
  });
  const result = await fetchTelegramInfo(42);
  expect(result).toEqual({ firstName: 'Safe', lastName: 'User', photoUrl: '' });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(result)).not.toContain(process.env.BOT_TOKEN);
});

test('Telegram request failures do not log credential-bearing fetch errors', async () => {
  process.env.BOT_TOKEN = 'test-only-secret';
  const logger = jest.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = jest.fn().mockRejectedValue(new Error(`Request failed: ${credentialUrl}`));
  expect(await fetchTelegramInfo(42)).toBeNull();
  expect(logger).toHaveBeenCalledWith('fetchTelegramInfo failed');
  expect(JSON.stringify(logger.mock.calls)).not.toContain('legacy-secret');
});
