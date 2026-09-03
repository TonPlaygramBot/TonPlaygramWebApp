import { isAllowedApiOrigin } from '../bot/utils/corsOrigin.js';

describe('API CORS origins', () => {
  test.each([
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost'
  ])('allows the installed mobile app origin in production: %s', origin => {
    expect(isAllowedApiOrigin(origin, ['https://tonplaygram.com'], true)).toBe(true);
  });

  test('allows configured web origins and requests without an Origin header', () => {
    expect(isAllowedApiOrigin('https://tonplaygram.com', ['https://tonplaygram.com'], true)).toBe(true);
    expect(isAllowedApiOrigin(undefined, [], true)).toBe(true);
  });

  test('does not open production CORS to arbitrary browser origins', () => {
    expect(isAllowedApiOrigin('https://example.com', [], true)).toBe(false);
    expect(isAllowedApiOrigin('http://127.0.0.1:5173', [], true)).toBe(false);
  });

  test('keeps loopback development servers available outside production', () => {
    expect(isAllowedApiOrigin('http://127.0.0.1:5173', [], false)).toBe(true);
    expect(isAllowedApiOrigin('http://localhost:4173', [], false)).toBe(true);
  });
});
