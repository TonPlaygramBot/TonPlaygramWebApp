import type { VoiceProvider, VoiceSpeakOptions } from './VoiceProvider';
import { PERSONA_DEFAULTS, VOICE_PROVIDER } from './voiceConfig';
import { CurrentVoiceProvider } from './providers/CurrentVoiceProvider';
import { PersonaPlexVoiceProvider } from './providers/PersonaPlexVoiceProvider';

let activeProvider: VoiceProvider | null = null;
let fallbackProvider: VoiceProvider | null = null;
let queue: Array<{ text: string; opts: VoiceSpeakOptions; resolve: () => void; reject: (error: Error) => void }> = [];
let speaking = false;

const ensureProvider = (): VoiceProvider => {
  if (activeProvider) return activeProvider;
  activeProvider = VOICE_PROVIDER === 'personaplex' ? new PersonaPlexVoiceProvider() : new CurrentVoiceProvider();
  return activeProvider;
};

const ensureFallbackProvider = (): VoiceProvider | null => {
  if (VOICE_PROVIDER !== 'personaplex') return null;
  if (fallbackProvider) return fallbackProvider;
  fallbackProvider = new CurrentVoiceProvider();
  return fallbackProvider;
};

const next = async () => {
  if (speaking || !queue.length) return;
  speaking = true;
  const item = queue.shift();
  if (!item) {
    speaking = false;
    return;
  }

  try {
    const provider = ensureProvider();
    try {
      await provider.speak(item.text, item.opts);
      item.resolve();
    } catch (primaryError) {
      const fallback = ensureFallbackProvider();
      if (!fallback) {
        throw primaryError;
      }
      console.warn('voice-provider-primary-failed-fallback-to-webspeech', primaryError);
      await fallback.speak(item.text, item.opts);
      item.resolve();
    }
  } catch (error) {
    item.reject(error as Error);
  } finally {
    speaking = false;
    if (queue.length) void next();
  }
};

export const speakWithVoiceProvider = (text: string, opts: Partial<VoiceSpeakOptions> = {}) => {
  const context = opts.context || 'commentary';
  const defaults = PERSONA_DEFAULTS[context];
  const mergedOpts: VoiceSpeakOptions = {
    context,
    voiceId: opts.voiceId || defaults.voiceId,
    persona: opts.persona || defaults.persona,
    gameId: opts.gameId,
    hints: opts.hints || []
  };

  return new Promise<void>((resolve, reject) => {
    queue.push({ text, opts: mergedOpts, resolve, reject });
    void next();
  });
};

export const stopVoicePlayback = () => {
  queue = [];
  speaking = false;
  ensureProvider().stop();
  const fallback = ensureFallbackProvider();
  if (fallback) fallback.stop();
};

export const checkVoiceProviderHealth = async () => {
  const provider = ensureProvider();
  const primaryHealthy = typeof provider.healthCheck === 'function' ? await provider.healthCheck() : true;
  if (primaryHealthy) return true;

  const fallback = ensureFallbackProvider();
  if (!fallback) return false;
  if (typeof fallback.healthCheck === 'function') return fallback.healthCheck();
  return true;
};
