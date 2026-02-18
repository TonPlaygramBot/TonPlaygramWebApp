import { synthesizeVoice } from '../bot/routes/voiceCommentary.js';

describe('voice provider fallback behavior', () => {
  const priorProvider = process.env.VOICE_PROVIDER;
  const priorMode = process.env.PERSONAPLEX_MODE;
  const priorService = process.env.PERSONAPLEX_SERVICE_URL;
  const priorRemote = process.env.PERSONAPLEX_API_URL;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.VOICE_PROVIDER = priorProvider;
    process.env.PERSONAPLEX_MODE = priorMode;
    process.env.PERSONAPLEX_SERVICE_URL = priorService;
    process.env.PERSONAPLEX_API_URL = priorRemote;
    global.fetch = originalFetch;
  });

  test('uses current-provider fallback path when VOICE_PROVIDER=current', async () => {
    process.env.VOICE_PROVIDER = 'current';
    await expect(
      synthesizeVoice({ text: 'hello', voiceId: 'NATF0', locale: 'en-US', metadata: {} })
    ).rejects.toThrow('Current provider selected');
  });

  test('auto mode uses remote api when local service is unavailable', async () => {
    process.env.VOICE_PROVIDER = 'personaplex';
    process.env.PERSONAPLEX_MODE = 'auto';
    process.env.PERSONAPLEX_SERVICE_URL = 'http://127.0.0.1:65535';
    process.env.PERSONAPLEX_API_URL = 'http://mock.personaplex.local';

    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ audioBase64: 'UklGRg==', mimeType: 'audio/wav' })
      });

    const result = await synthesizeVoice({ text: 'hello', voiceId: 'NATF0', locale: 'en-US', metadata: {} });
    expect(result.provider).toBe('nvidia-personaplex');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
