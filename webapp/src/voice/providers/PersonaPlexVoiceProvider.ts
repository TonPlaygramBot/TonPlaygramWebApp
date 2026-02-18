import { post } from '../../utils/api.js';
import type { VoiceProvider, VoiceSpeakOptions } from '../VoiceProvider';
import { VOICE_CACHE_PREFIX } from '../voiceConfig';

const memoryCache = new Map<string, string>();

const TINY_SILENCE_MP3 =
  'data:audio/mpeg;base64,SUQzAwAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjE1LjEwNAAAAAAAAAAAAAAA//tQxAADBzQASQAAABhAAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgP/7UMQAAwcoAEkAAABoAAAACAAADSAAAAAEAAANIAAAAAExhdmM1Ni4xNAAAAAAAAAAAAAAAACQCkAAAAAAAAAAAAAAAAAAAA//sQxAADAgAASAAAABgAAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg';

let audioUnlocked = false;
let unlockPromise: Promise<void> | null = null;

const unlockAudioPlayback = async () => {
  if (audioUnlocked || typeof window === 'undefined') return;
  if (!unlockPromise) {
    unlockPromise = (async () => {
      try {
        const audio = new Audio(TINY_SILENCE_MP3);
        audio.muted = true;
        audio.volume = 0;
        const maybePlay = audio.play();
        if (maybePlay?.then) await maybePlay;
        audio.pause();
        audio.currentTime = 0;
        audioUnlocked = true;
      } finally {
        unlockPromise = null;
      }
    })();
  }
  await unlockPromise;
};


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

  async speak(text: string, opts: VoiceSpeakOptions): Promise<HTMLAudioElement> {
    const normalizedText = String(text || '').trim();
    if (!normalizedText) throw new Error('text is required');

    const key = makeCacheKey(normalizedText, opts);
    const cachedSource = loadCachedAudio(key);
    const source = cachedSource || (await this.fetchAudioSource(normalizedText, opts));
    if (!cachedSource) storeCachedAudio(key, source);

    const audio = new Audio(source);
    this.currentAudio = audio;
    await unlockAudioPlayback().catch(() => {});

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
      audio.play().catch(async (error) => {
        if (error?.name === 'NotAllowedError') {
          await unlockAudioPlayback().catch(() => {});
          audio.play().catch(fail);
          return;
        }
        fail();
      });
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

    const synthesis = payload?.synthesis || {};
    if (synthesis.audioUrl) return synthesis.audioUrl;
    if (synthesis.audioBase64) {
      return `data:${synthesis.mimeType || 'audio/wav'};base64,${synthesis.audioBase64}`;
    }
    throw new Error(payload?.warning || payload?.error || 'PersonaPlex response missing audio payload');
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
