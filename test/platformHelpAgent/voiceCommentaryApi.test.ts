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

  test('returns local preview when PersonaPlex credentials are missing', async () => {
    const voice = findVoiceProfile(undefined, 'sq-AL');
    const text = buildCommentaryText('pool_royale', 'match_start', 'Arben');

    const response = await requestPersonaplexSynthesis({ text, locale: voice.locale, voiceId: voice.id });
    expect(response.mode).toBe('local_preview');
    expect(response.provider).toBe('nvidia-personaplex');
  });

  test('builds localized support script', () => {
    const voice = findVoiceProfile(undefined, 'sq-AL');
    const support = buildSupportSpeech('Nuk po më hapet loja', voice);
    expect(support).toContain('Përshëndetje');
  });
});
