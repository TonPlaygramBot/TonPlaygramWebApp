import { post } from '../utils/api.js';

export type VoiceContext = 'help' | 'commentary';

export interface VoiceSpeakOptions {
  voiceId: string;
  persona?: string;
  context?: VoiceContext;
  gameId?: string;
  locale?: string;
  speaker?: string;
}

export interface VoiceProvider {
  speak(text: string, opts: VoiceSpeakOptions): Promise<HTMLAudioElement | AudioBuffer | null>;
  stop(): void;
  skip(): void;
}

const memoryCache = new Map<string, string>();
let queue: Promise<unknown> = Promise.resolve();
let currentAudio: HTMLAudioElement | null = null;

function getProviderMode(): 'personaplex' | 'current' {
  const envProvider = String(import.meta.env.VITE_VOICE_PROVIDER || '').toLowerCase();
  const globalProvider = typeof window !== 'undefined' ? String((window as any).__VOICE_PROVIDER__ || '').toLowerCase() : '';
  const provider = envProvider || globalProvider;
  return provider === 'personaplex' ? 'personaplex' : 'current';
}

function getCacheKey(text: string, opts: VoiceSpeakOptions): string {
  return JSON.stringify({ text, voiceId: opts.voiceId, persona: opts.persona || '', context: opts.context || 'commentary' });
}

async function playAudioSource(source: string): Promise<HTMLAudioElement> {
  const audio = new Audio(source);
  currentAudio = audio;
  await new Promise<void>((resolve, reject) => {
    const done = () => {
      audio.removeEventListener('ended', done);
      audio.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      audio.removeEventListener('ended', done);
      audio.removeEventListener('error', fail);
      reject(new Error('Audio playback failed'));
    };
    audio.addEventListener('ended', done);
    audio.addEventListener('error', fail);
    audio.play().catch(fail);
  });
  return audio;
}

async function speakWithWebSpeech(text: string, locale = 'en-US'): Promise<null> {
  if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return null;
  return new Promise((resolve) => {
    const utterance = new window.SpeechSynthesisUtterance(String(text || '').trim());
    utterance.lang = locale;
    utterance.onend = () => resolve(null);
    utterance.onerror = () => resolve(null);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

class AppVoiceProvider implements VoiceProvider {
  async speak(text: string, opts: VoiceSpeakOptions): Promise<HTMLAudioElement | AudioBuffer | null> {
    const normalized = String(text || '').trim();
    if (!normalized) return null;

    queue = queue.then(async () => {
      const mode = getProviderMode();
      if (mode !== 'personaplex') {
        return speakWithWebSpeech(normalized, opts.locale || 'en-US');
      }

      const key = getCacheKey(normalized, opts);
      const cached = memoryCache.get(key);
      if (cached) {
        return playAudioSource(cached);
      }

      const payload = await post('/api/voice-commentary/speak', {
        text: normalized,
        voiceId: opts.voiceId,
        locale: opts.locale,
        speaker: opts.speaker,
        context: opts.context || 'commentary',
        gameId: opts.gameId,
        personaPrompt: opts.persona
      });

      const synthesis = payload?.synthesis || {};
      const source = synthesis.audioUrl || (synthesis.audioBase64 ? `data:${synthesis.mimeType || 'audio/wav'};base64,${synthesis.audioBase64}` : '');
      if (!source) {
        return speakWithWebSpeech(payload?.text || normalized, opts.locale || 'en-US');
      }
      memoryCache.set(key, source);
      try {
        localStorage.setItem(`voice-cache:${key}`, source);
      } catch {
        // ignore storage failures
      }
      return playAudioSource(source);
    });

    await queue;
    return currentAudio;
  }

  stop(): void {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  skip(): void {
    this.stop();
  }
}

let singleton: VoiceProvider | null = null;

export function getVoiceProvider(): VoiceProvider {
  if (!singleton) singleton = new AppVoiceProvider();
  return singleton;
}
