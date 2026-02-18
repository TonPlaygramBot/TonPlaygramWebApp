import { buildHelpAnswer, synthesizeVoice } from '../bot/routes/voiceCommentary.js';

describe('voice provider fallback behavior', () => {
  const priorProvider = process.env.VOICE_PROVIDER;
  const priorMode = process.env.PERSONAPLEX_MODE;
  const priorApi = process.env.PERSONAPLEX_API_URL;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.VOICE_PROVIDER = priorProvider;
    process.env.PERSONAPLEX_MODE = priorMode;
    process.env.PERSONAPLEX_API_URL = priorApi;
    global.fetch = originalFetch;
  });

  test('uses current-provider fallback path when VOICE_PROVIDER=current', async () => {
    process.env.VOICE_PROVIDER = 'current';
    await expect(
      synthesizeVoice({ text: 'hello', voiceId: 'NATF0', locale: 'en-US', metadata: {} })
    ).rejects.toThrow('Current provider selected');
  });

  test('auto mode uses remote api when configured', async () => {
    process.env.VOICE_PROVIDER = 'personaplex';
    process.env.PERSONAPLEX_MODE = 'auto';
    process.env.PERSONAPLEX_API_URL = 'https://personaplex.example';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ audioBase64: 'UklGRg==', mimeType: 'audio/wav' })
    });

    const result = await synthesizeVoice({
      text: 'hello',
      voiceId: 'NATF0',
      locale: 'en-US',
      metadata: {}
    });

    expect(result.provider).toBe('nvidia-personaplex');
    expect(global.fetch).toHaveBeenCalled();
  });

  test('help knowledge includes performance and commentary guidance', () => {
    expect(buildHelpAnswer('commentary is not working')).toMatch(/fallback|commentary/i);
    expect(buildHelpAnswer('I have lag and disconnect')).toMatch(/lag|disconnect|platform|version/i);
  });
});
