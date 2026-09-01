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

  test('paints database profile before waiting for Telegram enrichment', () => {
    const profile = fs.readFileSync('webapp/src/pages/MyAccount.jsx', 'utf8');
    const firstPaint = profile.indexOf('setProfile(data)');
    const telegramEnrichment = profile.indexOf(
      'if (telegramId && (!data.photo || !data.firstName || !data.lastName))'
    );

    expect(firstPaint).toBeGreaterThan(-1);
    expect(telegramEnrichment).toBeGreaterThan(firstPaint);
  });

  test('keeps polling when Telegram has not injected its user yet', () => {
    const authHook = fs.readFileSync(
      'webapp/src/hooks/useTelegramAuth.js',
      'utf8'
    );

    expect(authHook).toContain('if (!user?.id) return false;');
    expect(authHook).toContain(
      'if (registeredTelegramId.current === user.id) return true;'
    );
  });
});
