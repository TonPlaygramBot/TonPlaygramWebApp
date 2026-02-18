import {
  VOICE_PROFILES,
  buildCommentaryText,
  buildSupportSpeech,
  findVoiceProfile,
  normalizeSynthesisPayload,
  requestPersonaplexSynthesis
} from '../../packages/api/src/voiceCommentary';

describe('voice commentary module', () => {
  test('contains multilingual nvidia voice catalog', () => {
    expect(VOICE_PROFILES.length).toBeGreaterThanOrEqual(12);
    expect(VOICE_PROFILES.some((voice) => voice.locale === 'sq-AL')).toBe(true);
  });

  test('requires PersonaPlex credentials for synthesis', async () => {
    const voice = findVoiceProfile(undefined, 'sq-AL');
    const text = buildCommentaryText('pool_royale', 'match_start', 'Arben');

    await expect(
      requestPersonaplexSynthesis({ text, locale: voice.locale, voiceId: voice.id })
    ).rejects.toThrow('PersonaPlex is not configured');
  });

  test('builds localized support script', () => {
    const voice = findVoiceProfile(undefined, 'sq-AL');
    const support = buildSupportSpeech('Nuk po më hapet loja', voice);
    expect(support).toContain('Përshëndetje');
  });

  test('normalizes data-uri base64 synthesis payload', () => {
    const synthesis = normalizeSynthesisPayload({
      output: {
        audio: 'data:audio/wav;base64,QUJDREVGRw==',
        mimeType: 'audio/wav'
      }
    });

    expect(synthesis.audioBase64).toBe('QUJDREVGRw==');
    expect(synthesis.mimeType).toBe('audio/wav');
    expect(synthesis.audioUrl).toBeNull();
  });
});
