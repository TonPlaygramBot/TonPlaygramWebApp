import { post } from '../../utils/api.js';
import type { VoiceProvider, VoiceSpeakOptions } from '../VoiceProvider';
import { VOICE_CACHE_PREFIX } from '../voiceConfig';

const memoryCache = new Map<string, string>();

const makeCacheKey = (text: string, opts: VoiceSpeakOptions) =>
  [opts.voiceId, opts.persona || '', opts.context || '', opts.gameId || '', text].join('::');

const loadCachedAudio = (key: string): string | null => {
  if (memoryCache.has(key)) return memoryCache.get(key) || null;
  if (typeof window === 'undefined') return null;
  const local = window.localStorage.getItem(`${VOICE_CACHE_PREFIX}:${key}`);
  if (local) {
    memoryCache.set(key, local);
    return local;
  }
  return null;
};

const storeCachedAudio = (key: string, source: string) => {
  memoryCache.set(key, source);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(`${VOICE_CACHE_PREFIX}:${key}`, source);
    } catch {
      // ignore quota failures
    }
  }
};

const PERSONAPLEX_UNAVAILABLE = 'PERSONAPLEX_UNAVAILABLE';
const PERSONAPLEX_PLAYBACK_FAILED = 'PERSONAPLEX_PLAYBACK_FAILED';

export class PersonaPlexVoiceProvider implements VoiceProvider {
  private currentAudio: HTMLAudioElement | null = null;

  async speak(text: string, opts: VoiceSpeakOptions): Promise<HTMLAudioElement> {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) throw new Error('text is required');

    const key = makeCacheKey(normalizedText, opts);
    const cachedSource = loadCachedAudio(key);
    const source = cachedSource || (await this.fetchAudioSource(normalizedText, opts));
    if (!cachedSource) storeCachedAudio(key, source);

    const audio = new Audio(source);
    this.currentAudio = audio;

    await new Promise<void>((resolve, reject) => {
      const done = () => {
        audio.removeEventListener('ended', done);
        audio.removeEventListener('error', fail);
        resolve();
      };
      const fail = () => {
        audio.removeEventListener('ended', done);
        audio.removeEventListener('error', fail);
        reject(new Error(PERSONAPLEX_PLAYBACK_FAILED));
      };

      audio.addEventListener('ended', done);
      audio.addEventListener('error', fail);
      audio.play().catch(fail);
    });

    return audio;
  }

  private async fetchAudioSource(text: string, opts: VoiceSpeakOptions): Promise<string> {
    const accountId = typeof window === 'undefined' ? 'guest' : window.localStorage.getItem('accountId') || 'guest';
    const payload = await post('/api/voice-commentary/speak', {
      accountId,
      text,
      voiceId: opts.voiceId,
      personaPrompt: opts.persona,
      gameId: opts.gameId,
      context: opts.context
    });

    if (payload?.provider === 'web-speech-fallback') {
      throw new Error(`${PERSONAPLEX_UNAVAILABLE}:${payload?.warning || 'fallback returned by server'}`);
    }

    const synthesis = payload?.synthesis || {};
    if (synthesis.audioUrl) return synthesis.audioUrl;
    if (synthesis.audioBase64) {
      return `data:${synthesis.mimeType || 'audio/wav'};base64,${synthesis.audioBase64}`;
    }

    throw new Error(`${PERSONAPLEX_UNAVAILABLE}:${payload?.warning || payload?.error || 'missing audio payload'}`);
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  async healthCheck() {
    try {
      const response = await fetch('/api/voice-commentary/health');
      return response.ok;
    } catch {
      return false;
    }
  }
}

export { PERSONAPLEX_UNAVAILABLE, PERSONAPLEX_PLAYBACK_FAILED };
