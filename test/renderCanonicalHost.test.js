import fs from 'node:fs';

describe('Render canonical host configuration', () => {
  const renderConfig = fs.readFileSync('render.yaml', 'utf8');

  test('deploys the API on the public host used by the profile client', () => {
    expect(renderConfig).toMatch(/name: tonplaygram-bot/);
    expect(renderConfig).toMatch(
      /key: ACCOUNT_API_URL\s+value: https:\/\/tonplaygram-bot\.onrender\.com/
    );
    expect(renderConfig).toMatch(
      /key: VITE_API_BASE_URL\s+value: https:\/\/tonplaygram-bot\.onrender\.com/
    );
    expect(renderConfig).not.toMatch(/name: tonplaygram-api/);
  });
});
