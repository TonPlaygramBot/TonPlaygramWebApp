import fs from 'node:fs';

describe('mobile profile access', () => {
  test('keeps the profile route directly accessible with an account alias', () => {
    const app = fs.readFileSync('webapp/src/App.jsx', 'utf8');

    expect(app).toContain('<Route path="/profile" element={<MyAccount />} />');
    expect(app).toMatch(/path="\/account"[\s\S]*?<Navigate to="\/profile" replace \/>/);
  });

  test('keeps all six portrait navigation items inside equal-width columns', () => {
    const navbar = fs.readFileSync('webapp/src/components/Navbar.jsx', 'utf8');
    const navItem = fs.readFileSync('webapp/src/components/NavItem.jsx', 'utf8');

    expect(navbar).toContain('grid-cols-6');
    expect(navbar).toContain('to="/profile"');
    expect(navItem).toContain('min-w-0');
    expect(navItem).toContain('aria-label={label}');
  });

  test('loads the profile with the live TonConnect wallet identity', () => {
    const profile = fs.readFileSync('webapp/src/pages/MyAccount.jsx', 'utf8');

    expect(profile).toContain(
      'const walletIdentity = connectedTonAddress || tonWalletAddress;'
    );
    expect(profile).toMatch(
      /createAccount\([\s\S]*?telegramId,[\s\S]*?googleProfile,[\s\S]*?undefined,[\s\S]*?walletIdentity[\s\S]*?\)/
    );
    expect(profile).toMatch(
      /\[telegramId, googleProfile\?\.id, walletIdentity, requiresAuth, reloadNonce\]/
    );
  });
});
