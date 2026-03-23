import { canManageUserTransactions } from '../bot/routes/profile.js';

describe('canManageUserTransactions', () => {
  test('allows telegram-owned account with matching telegram id', () => {
    const allowed = canManageUserTransactions(
      { telegramId: 123 },
      { telegramId: 123, accountId: 'acc-1' },
      123
    );
    expect(allowed).toBe(true);
  });

  test('blocks telegram auth when telegram id mismatches payload', () => {
    const allowed = canManageUserTransactions(
      { telegramId: 123 },
      { telegramId: 123, accountId: 'acc-1' },
      456
    );
    expect(allowed).toBe(false);
  });

  test('allows account-id owned user for non-telegram auth', () => {
    const allowed = canManageUserTransactions(
      { accountId: 'acc-google' },
      { accountId: 'acc-google' },
      null
    );
    expect(allowed).toBe(true);
  });

  test('allows google-owned user for google auth', () => {
    const allowed = canManageUserTransactions(
      { googleId: 'gid-9' },
      { accountId: 'acc-2', googleId: 'gid-9' },
      null
    );
    expect(allowed).toBe(true);
  });
});
