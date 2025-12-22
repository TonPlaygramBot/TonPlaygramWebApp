import crypto from 'crypto';
import { createState, consumeState } from '../bot/utils/authState.js';
import { verifyTelegramLogin } from '../bot/utils/telegramAuth.js';

describe('auth state and telegram hash', () => {
  test('creates and consumes state per provider', () => {
    const { state } = createState('telegram', 'https://example.com');
    expect(consumeState(state, 'telegram')).toBeTruthy();
    expect(consumeState(state, 'telegram')).toBeNull();
  });

  test('rejects invalid provider consumption', () => {
    const { state } = createState('google', 'https://example.com');
    expect(consumeState(state, 'wallet')).toBeNull();
  });

  test('verifies telegram login hash', () => {
    const botToken = 'TEST_TOKEN';
    process.env.BOT_TOKEN = botToken;
    const payload = {
      auth_date: Math.floor(Date.now() / 1000),
      first_name: 'Alice',
      id: '12345',
      username: 'alice',
      photo_url: 'https://example.com/avatar.png'
    };
    const dataCheckString = Object.entries(payload)
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    const verified = verifyTelegramLogin({ ...payload, hash });
    expect(verified).toMatchObject({ id: 12345, username: 'alice' });
  });
});
