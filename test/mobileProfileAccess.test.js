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

  test('uses verified account login and never treats a connected address as identity', () => {
    for (const path of ['webapp/src/pages/MyAccount.jsx', 'webapp/src/pages/Wallet.jsx']) {
      const source = fs.readFileSync(path, 'utf8');
      expect(source).toContain('createAccount(telegramId, googleProfile)');
      expect(source).toContain('const requiresAuth = !telegramId && !googleProfile?.id;');
      expect(source).not.toMatch(/createAccount\([^)]*(?:tonWalletAddress|walletIdentity|connectedTonAddress)/);
    }
    const login = fs.readFileSync('webapp/src/components/LoginOptions.jsx', 'utf8');
    expect(login).toContain('Wallet sign-in is unavailable.');
    expect(login).not.toMatch(/createAccount\([^)]*tonAddress/);
  });

  test('renders the profile returned by account initialization without a second request', () => {
    const profile = fs.readFileSync('webapp/src/pages/MyAccount.jsx', 'utf8');

    expect(profile).toMatch(
      /const data =\s*accountPayload\.profile \|\|\s*\(await getAccountInfo\(accountPayload\.accountId\)\)/
    );
  });
});
