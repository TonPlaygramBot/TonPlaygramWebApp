import { setFlamingoMediaResponseHeaders } from '../bot/utils/flamingoMediaResponse.js';

describe('Protesta Shqiptare cross-origin video responses', () => {
  test('allows a separately hosted mobile app to consume media and range metadata', () => {
    const headers = new Map();
    setFlamingoMediaResponseHeaders({ setHeader: (name, value) => headers.set(name, value) });

    expect(headers.get('Cross-Origin-Resource-Policy')).toBe('cross-origin');
    expect(headers.get('Accept-Ranges')).toBe('bytes');
    expect(headers.get('Access-Control-Expose-Headers')).toContain('Content-Range');
  });
});
