import type { VoiceProvider, VoiceSpeakOptions } from './VoiceProvider';
import { PERSONA_DEFAULTS, VOICE_PROVIDER } from './voiceConfig';
import { CurrentVoiceProvider } from './providers/CurrentVoiceProvider';
import { PersonaPlexUnavailableError, PersonaPlexVoiceProvider } from './providers/PersonaPlexVoiceProvider';

let activeProvider: VoiceProvider | null = null;
let queue: Array<{ text: string; opts: VoiceSpeakOptions; resolve: () => void; reject: (error: Error) => void }> = [];
let speaking = false;

const ensureProvider = (): VoiceProvider => {
  if (activeProvider) return activeProvider;
  activeProvider = VOICE_PROVIDER === 'personaplex' ? new PersonaPlexVoiceProvider() : new CurrentVoiceProvider();
  return activeProvider;
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
    await provider.speak(item.text, item.opts);
    item.resolve();
  } catch (error) {
    if (VOICE_PROVIDER === 'personaplex' && error instanceof PersonaPlexUnavailableError) {
      try {
        const fallback = new CurrentVoiceProvider();
        await fallback.speak(item.text, item.opts);
        item.resolve();
      } catch (fallbackError) {
        item.reject(fallbackError as Error);
      }
    } else {
      item.reject(error as Error);
    }
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
};

export const checkVoiceProviderHealth = async () => {
  const provider = ensureProvider();
  if (typeof provider.healthCheck === 'function') return provider.healthCheck();
  return true;
};
