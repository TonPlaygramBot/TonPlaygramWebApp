const DEFAULT_SAMPLE_RATE = 24000;
const DEFAULT_FORMAT = 'wav';
const DEFAULT_MAX_LENGTH = 140;

const normalizeText = (text, maxLength = DEFAULT_MAX_LENGTH) => {
  if (!text) return '';
  const compact = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
  if (compact.length <= maxLength) return compact;
  return compact.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…';
};

const fnv1a = (value) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return hash.toString(16);
};

export class MemoryAudioCache {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    return this.cache.get(key) ?? null;
  }

  set(key, value) {
    this.cache.set(key, value);
  }
}

export class ChatterboxTtsService {
  constructor({
    adapter,
    cache = new MemoryAudioCache(),
    sampleRate = DEFAULT_SAMPLE_RATE,
    format = DEFAULT_FORMAT,
    maxTextLength = DEFAULT_MAX_LENGTH,
    concurrency = 1
  } = {}) {
    this.adapter = adapter;
    this.cache = cache;
    this.sampleRate = sampleRate;
    this.format = format;
    this.maxTextLength = maxTextLength;
    this.concurrency = Math.max(1, concurrency);
    this.activeCount = 0;
    this.queue = [];
  }

  buildCacheKey({ voiceId, text, speed, pitch, style, sampleRate, format }) {
    const payload = JSON.stringify({
      voiceId: voiceId ?? 'default',
      text,
      speed: Number.isFinite(speed) ? speed : 1,
      pitch: Number.isFinite(pitch) ? pitch : 0,
      style: style ?? 'neutral',
      sampleRate: sampleRate ?? this.sampleRate,
      format: format ?? this.format
    });
    return fnv1a(payload);
  }

  enqueue(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  processQueue() {
    if (this.activeCount >= this.concurrency) return;
    const next = this.queue.shift();
    if (!next) return;
    this.activeCount += 1;
    Promise.resolve()
      .then(next.task)
      .then((result) => next.resolve(result))
      .catch((error) => next.reject(error))
      .finally(() => {
        this.activeCount -= 1;
        this.processQueue();
      });
  }

  async synthesize({
    text,
    voiceId,
    speed = 1,
    pitch = 0,
    style = 'neutral',
    sampleRate = this.sampleRate,
    format = this.format
  }) {
    if (!this.adapter?.synthesize) {
      throw new Error('Chatterbox adapter missing. Provide an adapter with synthesize().');
    }
    const normalizedText = normalizeText(text, this.maxTextLength);
    const cacheKey = this.buildCacheKey({
      voiceId,
      text: normalizedText,
      speed,
      pitch,
      style,
      sampleRate,
      format
    });
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cacheKey, fromCache: true };
    }
    const task = async () => {
      const audio = await this.adapter.synthesize({
        text: normalizedText,
        voiceId,
        speed,
        pitch,
        style,
        sampleRate,
        format
      });
      const payload = { audio, format, sampleRate };
      this.cache.set(cacheKey, payload);
      return { ...payload, cacheKey, fromCache: false };
    };
    return this.enqueue(task);
  }

  async warmUp(lines = [], options = {}) {
    const jobs = lines.map((text) =>
      this.synthesize({
        text,
        voiceId: options.voiceId,
        speed: options.speed,
        pitch: options.pitch,
        style: options.style,
        sampleRate: options.sampleRate,
        format: options.format
      })
    );
    return Promise.allSettled(jobs);
  }
}
