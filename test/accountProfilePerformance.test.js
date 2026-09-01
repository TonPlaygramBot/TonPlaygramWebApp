import fs from 'node:fs';

describe('account profile performance', () => {
  test('queries available account identities concurrently', () => {
    const route = fs.readFileSync('bot/routes/account.js', 'utf8');

    expect(route).toMatch(
      /\[existingByAccountId, existingByTelegram, existingByGoogle\] =\s*await Promise\.all/
    );
  });

  test('does not wait for Telegram when the database already has the account', () => {
    const route = fs.readFileSync('bot/routes/account.js', 'utf8');

    expect(route).toMatch(
      /if \(!primaryExisting\) \{[\s\S]*?fetchTelegramInfo\(telegramId\)/
    );
  });

  test('returns the complete profile with account initialization', () => {
    const route = fs.readFileSync('bot/routes/account.js', 'utf8');

    expect(route).toMatch(/profile: \{[\s\S]*?transactions:[\s\S]*?social:/);
  });
});
