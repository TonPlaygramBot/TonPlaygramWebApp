import { synthesizeVoice } from '../bot/routes/voiceCommentary.js';

describe('voice provider fallback behavior', () => {
  const prior = process.env.VOICE_PROVIDER;

  afterEach(() => {
    process.env.VOICE_PROVIDER = prior;
  });

  test('uses current-provider fallback path when VOICE_PROVIDER=current', async () => {
    process.env.VOICE_PROVIDER = 'current';
    await expect(
      synthesizeVoice({ text: 'hello', voiceId: 'NATF0', locale: 'en-US', metadata: {} })
    ).rejects.toThrow('Current provider selected');
  });
});
