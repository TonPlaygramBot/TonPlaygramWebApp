import { post } from '../../utils/api.js';
import type { VoiceProvider, VoiceSpeakOptions } from '../VoiceProvider';
import { VOICE_CACHE_PREFIX } from '../voiceConfig';
import { CurrentVoiceProvider } from './CurrentVoiceProvider';

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

export class PersonaPlexVoiceProvider implements VoiceProvider {
  private currentAudio: HTMLAudioElement | null = null;

  private readonly localProvider = new CurrentVoiceProvider();

  async speak(text: string, opts: VoiceSpeakOptions): Promise<HTMLAudioElement> {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) throw new Error('text is required');

    try {
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
          reject(new Error('Audio playback failed'));
        };
        audio.addEventListener('ended', done);
        audio.addEventListener('error', fail);
        audio.play().catch(fail);
      });

      return audio;
    } catch {
      return this.localProvider.speak(normalizedText, opts);
    }
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

    const synthesis = payload?.synthesis || {};
    if (synthesis.audioUrl) return synthesis.audioUrl;
    if (synthesis.audioBase64) {
      return `data:${synthesis.mimeType || 'audio/wav'};base64,${synthesis.audioBase64}`;
    }
    if (synthesis.mode === 'local_preview') {
      throw new Error(synthesis.reason || 'PersonaPlex returned local preview mode');
    }
    throw new Error(payload?.warning || payload?.error || 'PersonaPlex response missing audio payload');
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.localProvider.stop();
  }

  async healthCheck() {
    try {
      const response = await fetch('/api/voice-commentary/health');
      if (response.ok) return true;
    } catch {
      // ignore and check local fallback below
    }
    return this.localProvider.healthCheck();
  }
}
