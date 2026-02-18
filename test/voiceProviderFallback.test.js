import { synthesizeVoice } from '../bot/routes/voiceCommentary.js';

describe('voice provider fallback behavior', () => {
  const priorVoiceProvider = process.env.VOICE_PROVIDER;
  const priorMode = process.env.PERSONAPLEX_MODE;
  const priorApi = process.env.PERSONAPLEX_API_URL;
  const priorService = process.env.PERSONAPLEX_SERVICE_URL;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.VOICE_PROVIDER = priorVoiceProvider;
    process.env.PERSONAPLEX_MODE = priorMode;
    process.env.PERSONAPLEX_API_URL = priorApi;
    process.env.PERSONAPLEX_SERVICE_URL = priorService;
    global.fetch = originalFetch;
  });

  test('uses current-provider fallback path when VOICE_PROVIDER=current', async () => {
    process.env.VOICE_PROVIDER = 'current';
    await expect(
      synthesizeVoice({ text: 'hello', voiceId: 'NATF0', locale: 'en-US', metadata: {} })
    ).rejects.toThrow('Current provider selected');
  });

  test('auto mode retries remote api when local service is unavailable', async () => {
    process.env.VOICE_PROVIDER = 'personaplex';
    process.env.PERSONAPLEX_MODE = 'auto';
    process.env.PERSONAPLEX_SERVICE_URL = 'http://127.0.0.1:65531';
    process.env.PERSONAPLEX_API_URL = 'https://example.personaplex.local';

    let callCount = 0;
    global.fetch = jest.fn(async (url) => {
      callCount += 1;
      if (String(url).includes('127.0.0.1:65531')) {
        throw new Error('connect ECONNREFUSED 127.0.0.1:65531');
      }

      return {
        ok: true,
        async json() {
          return { audioBase64: 'UklGRjQAAABXQVZF', mimeType: 'audio/wav' };
        }
      };
    });

    const result = await synthesizeVoice({ text: 'hello', voiceId: 'NATF0', locale: 'en-US', metadata: {} });
    expect(result.provider).toBe('nvidia-personaplex');
    expect(callCount).toBe(2);
  });
});
