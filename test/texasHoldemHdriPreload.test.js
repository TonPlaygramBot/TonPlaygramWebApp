import { resolveTexasHoldemHdriUrl } from '../webapp/src/utils/texasHoldemHdriPreload.js';

describe('resolveTexasHoldemHdriUrl', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('prioritizes requested resolution over config default resolution', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        hdr: {
          '8k': {
            hdr: 'https://cdn.example.com/hdr/studio_8k.hdr'
          },
          '2k': {
            hdr: 'https://cdn.example.com/hdr/studio_2k.hdr'
          }
        }
      })
    }));

    const url = await resolveTexasHoldemHdriUrl(
      {
        id: 'studio',
        assetId: 'studio',
        preferredResolutions: ['2k']
      },
      ['8k', '6k', '4k', '2k', '1k']
    );

    expect(url).toBe('https://cdn.example.com/hdr/studio_8k.hdr');
  });

  test('prefers hdr over exr for the same requested resolution', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        exr: {
          '8k': {
            exr: 'https://cdn.example.com/exr/studio_8k.exr'
          }
        },
        hdr: {
          '8k': {
            hdr: 'https://cdn.example.com/hdr/studio_8k.hdr'
          }
        }
      })
    }));

    const url = await resolveTexasHoldemHdriUrl(
      {
        id: 'studio',
        assetId: 'studio'
      },
      ['8k', '4k', '2k']
    );

    expect(url).toBe('https://cdn.example.com/hdr/studio_8k.hdr');
  });
});
