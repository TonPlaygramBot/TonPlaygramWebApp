import { createFlamingoDownloadGrant, readFlamingoDownloadGrant } from '../bot/utils/flamingoDownloadGrant.js';

describe('Protesta Shqiptare download grants', () => {
  const originalSecret = process.env.FLAMINGO_DOWNLOAD_SECRET;

  beforeEach(() => { process.env.FLAMINGO_DOWNLOAD_SECRET = 'test-download-secret'; });
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.FLAMINGO_DOWNLOAD_SECRET;
    else process.env.FLAMINGO_DOWNLOAD_SECRET = originalSecret;
  });

  test('can be validated after the request that created it has finished', () => {
    const token = createFlamingoDownloadGrant({ file: 'stored-video.mp4', originalName: 'protesta.mp4', size: 123 }, 1_000);
    expect(readFlamingoDownloadGrant(token, 2_000)).toMatchObject({
      file: 'stored-video.mp4', originalName: 'protesta.mp4', size: 123
    });
  });

  test('rejects modified and expired links', () => {
    const token = createFlamingoDownloadGrant({ file: 'stored-video.mp4' }, 1_000);
    expect(readFlamingoDownloadGrant(`${token}changed`, 2_000)).toBeNull();
    expect(readFlamingoDownloadGrant(token, 301_001)).toBeNull();
  });
});
