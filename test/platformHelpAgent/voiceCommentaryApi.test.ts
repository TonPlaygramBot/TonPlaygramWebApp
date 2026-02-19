import {
  VOICE_PROFILES,
  buildCommentaryText,
  buildSupportSpeech,
  findVoiceProfile,
  requestPersonaplexSynthesis
} from '../../packages/api/src/voiceCommentary';

describe('voice commentary module', () => {
  test('contains multilingual nvidia voice catalog', () => {
    expect(VOICE_PROFILES.length).toBeGreaterThanOrEqual(12);
    expect(VOICE_PROFILES.some((voice) => voice.locale === 'sq-AL')).toBe(true);
  });

  test('returns local fallback synthesis when PersonaPlex credentials are missing', async () => {
    const voice = findVoiceProfile(undefined, 'sq-AL');
    const text = buildCommentaryText('pool_royale', 'match_start', 'Arben');

    const result = await requestPersonaplexSynthesis({ text, locale: voice.locale, voiceId: voice.id });
    expect(result.mode).toBe('local-fallback');
    if (result.mode === 'local-fallback') {
      expect(result.reason).toBe('missing_credentials');
      expect(result.payload.voiceId).toBe(voice.id);
    }
  });

  test('still allows strict mode that requires PersonaPlex credentials', async () => {
    const previous = process.env.PERSONAPLEX_LOCAL_FALLBACK;
    process.env.PERSONAPLEX_LOCAL_FALLBACK = '0';

    const voice = findVoiceProfile(undefined, 'sq-AL');
    const text = buildCommentaryText('pool_royale', 'match_start', 'Arben');

    await expect(requestPersonaplexSynthesis({ text, locale: voice.locale, voiceId: voice.id })).rejects.toThrow(
      'PersonaPlex is not configured'
    );

    if (typeof previous === 'undefined') {
      delete process.env.PERSONAPLEX_LOCAL_FALLBACK;
    } else {
      process.env.PERSONAPLEX_LOCAL_FALLBACK = previous;
    }
  });

  test('builds localized support script', () => {
    const voice = findVoiceProfile(undefined, 'sq-AL');
    const support = buildSupportSpeech('Nuk po më hapet loja', voice);
    expect(support).toContain('Përshëndetje');
  });
});
