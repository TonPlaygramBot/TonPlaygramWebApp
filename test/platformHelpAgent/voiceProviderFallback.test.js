import { createVoiceProvider, PersonaPlexVoiceProvider } from '../../bot/services/voiceProviders.js';

describe('voice provider fallback behavior', () => {
  const originalFetch = global.fetch;
  const originalProvider = process.env.VOICE_PROVIDER;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.VOICE_PROVIDER = originalProvider;
  });

  test('uses current provider when VOICE_PROVIDER=current', async () => {
    process.env.VOICE_PROVIDER = 'current';
    const provider = createVoiceProvider();
    const result = await provider.synthesize({ text: 'hello' });
    expect(result.provider).toBe('current');
    expect(result.synthesis).toBeNull();
  });

  test('personaplex provider throws when health check fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    const provider = new PersonaPlexVoiceProvider({ serviceUrl: 'http://127.0.0.1:8787' });
    await expect(provider.synthesize({ text: 'hello', voiceId: 'v1' })).rejects.toThrow('unavailable');
  });
});
