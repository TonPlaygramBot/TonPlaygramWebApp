import fs from 'node:fs';

describe('native profile API configuration', () => {
  const api = fs.readFileSync('webapp/src/utils/api.js', 'utf8');
  const capacitor = fs.readFileSync('webapp/capacitor.config.ts', 'utf8');

  test('keeps installed mobile shells and profile requests on the live API', () => {
    expect(api).toContain(
      "export const PRODUCTION_API_BASE_URL = 'https://tonplaygram-bot.onrender.com'"
    );
    expect(api).toMatch(
      /resolvedEnv\.VITE_API_BASE_URL \|\| \(isNative \? PRODUCTION_API_BASE_URL : defaultBase\)/
    );
    expect(capacitor).toContain("hostname: 'tonplaygram-bot.onrender.com'");
  });
});
