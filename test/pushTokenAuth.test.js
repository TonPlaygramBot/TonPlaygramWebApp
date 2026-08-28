import { pushTokenOwnerSelector } from '../bot/routes/push.js';

describe('push token ownership', () => {
  test('uses the authenticated account instead of a request-body identity', () => {
    expect(pushTokenOwnerSelector({ accountId: 'owner-account' })).toEqual({
      accountId: 'owner-account'
    });
  });

  test('supports authenticated Telegram and Google identities', () => {
    expect(pushTokenOwnerSelector({ telegramId: 123 })).toEqual({ telegramId: 123 });
    expect(pushTokenOwnerSelector({ googleId: 'google-owner' })).toEqual({
      googleId: 'google-owner'
    });
  });

  test('requires an explicit selector for trusted server calls', () => {
    expect(pushTokenOwnerSelector({ apiToken: true })).toBeNull();
    expect(pushTokenOwnerSelector({})).toBeNull();
  });
});
