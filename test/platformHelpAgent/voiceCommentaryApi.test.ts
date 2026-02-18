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

  test('builds game commentary text and preview synthesis', async () => {
    const voice = findVoiceProfile(undefined, 'sq-AL');
    const text = buildCommentaryText('pool_royale', 'match_start', 'Arben');
    const synthesis = await requestPersonaplexSynthesis({ text, locale: voice.locale, voiceId: voice.id });

    expect(text).toContain('Pool Royale');
    expect(synthesis.mode).toBe('preview');
    if (synthesis.mode === 'preview') {
      expect(synthesis.ssml).toContain('xml:lang="sq-AL"');
    }
  });

  test('builds localized support script', () => {
    const voice = findVoiceProfile(undefined, 'sq-AL');
    const support = buildSupportSpeech('Nuk po më hapet loja', voice);
    expect(support).toContain('Përshëndetje');
  });
});
