import { mediaByteRange } from '../bot/routes/flamingoWall.js';

describe('Protesta Shqiptare video byte ranges', () => {
  test('serves the explicit ranges used for playback and seeking', () => {
    expect(mediaByteRange('bytes=0-1023', 5000)).toEqual({ start: 0, end: 1023 });
    expect(mediaByteRange('bytes=2048-', 5000)).toEqual({ start: 2048, end: 4999 });
  });

  test('serves suffix ranges used by mobile video players', () => {
    expect(mediaByteRange('bytes=-500', 5000)).toEqual({ start: 4500, end: 4999 });
    expect(mediaByteRange('bytes=-9999', 5000)).toEqual({ start: 0, end: 4999 });
  });

  test('rejects unsatisfiable or unsupported ranges', () => {
    expect(mediaByteRange('bytes=5000-', 5000)).toBe(false);
    expect(mediaByteRange('bytes=0-1,4-5', 5000)).toBe(false);
    expect(mediaByteRange('bytes=-0', 5000)).toBe(false);
    expect(mediaByteRange('', 5000)).toBeNull();
  });
});
