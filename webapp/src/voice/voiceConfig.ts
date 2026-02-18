export type VoiceContext = 'help' | 'commentary';

export const VOICE_PROVIDER = (import.meta.env.VITE_VOICE_PROVIDER || 'personaplex').toLowerCase();

export const PERSONA_DEFAULTS: Record<VoiceContext, { voiceId: string; persona: string }> = {
  help: {
    voiceId: 'NATF0',
    persona: 'Concise, helpful, instructional tone. Keep guidance practical and clear.'
  },
  commentary: {
    voiceId: 'NATM1',
    persona: 'Energetic game commentator style. Keep lines short, exciting, and easy to follow.'
  }
};

export const VOICE_CACHE_PREFIX = 'tonplaygram.voice.cache.v1';
