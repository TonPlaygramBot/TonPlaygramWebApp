const DEFAULT_SETTINGS = {
  sampleRate: 24000,
  speed: 1,
  pitch: 1,
  style: 'neutral',
  maxTextLength: 140
};

const normalizeText = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();

const buildCacheKey = (text, settings) => {
  const payload = {
    text,
    voiceId: settings.voiceId,
    speed: settings.speed,
    pitch: settings.pitch,
    style: settings.style,
    sampleRate: settings.sampleRate
  };
  return JSON.stringify(payload);
};

class InMemoryAudioCache {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    return this.cache.get(key) || null;
  }

  set(key, value) {
    this.cache.set(key, value);
  }
}

export class ChatterboxTtsService {
  constructor({ engine, cache, settings } = {}) {
    this.engine = engine;
    this.cache = cache || new InMemoryAudioCache();
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.queue = [];
    this.processing = false;
  }

  async speak(text, overrides = {}) {
    const normalized = normalizeText(text);
    if (!normalized) return null;
    const merged = { ...this.settings, ...overrides };
    const trimmed = normalized.slice(0, merged.maxTextLength);
    const key = buildCacheKey(trimmed, merged);

    const cached = this.cache.get(key);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    return this.enqueue(() => this.synthesize(trimmed, key, merged));
  }

  async enqueue(task) {
    return new Promise((resolve) => {
      this.queue.push({ task, resolve });
      if (!this.processing) {
        this.processing = true;
        this.processQueue();
      }
    });
  }

  async processQueue() {
    while (this.queue.length > 0) {
      const { task, resolve } = this.queue.shift();
      const result = await task();
      resolve(result);
    }
    this.processing = false;
  }

  async synthesize(text, key, settings) {
    if (!this.engine?.synthesize) {
      console.warn('Chatterbox engine is not configured.');
      return null;
    }

    const audioBuffer = await this.engine.synthesize({
      text,
      voiceId: settings.voiceId,
      speed: settings.speed,
      pitch: settings.pitch,
      style: settings.style,
      sampleRate: settings.sampleRate
    });

    if (!audioBuffer) return null;
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const payload = {
      url,
      bytes: audioBuffer,
      mimeType: 'audio/wav',
      text
    };
    this.cache.set(key, payload);
    return payload;
  }

  async preload(lines = [], overrides = {}) {
    const unique = Array.from(new Set(lines));
    for (const line of unique) {
      await this.speak(line, overrides);
    }
  }
}
