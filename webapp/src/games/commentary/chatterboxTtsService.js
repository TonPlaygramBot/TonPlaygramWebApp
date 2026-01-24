const DEFAULT_SAMPLE_RATE = 24000;
const DEFAULT_MAX_TEXT_LENGTH = 180;

const normalizeText = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();

export class ChatterboxTtsService {
  constructor({
    synthesizer,
    cache = new Map(),
    sampleRate = DEFAULT_SAMPLE_RATE,
    maxTextLength = DEFAULT_MAX_TEXT_LENGTH,
    format = 'wav'
  } = {}) {
    this.synthesizer = synthesizer;
    this.cache = cache;
    this.sampleRate = sampleRate;
    this.maxTextLength = maxTextLength;
    this.format = format;
    this.queue = Promise.resolve();
  }

  buildCacheKey(text, options) {
    const normalized = normalizeText(text).slice(0, this.maxTextLength);
    const voiceId = options?.voiceId ?? 'default';
    const speed = options?.speed ?? 1;
    const pitch = options?.pitch ?? 1;
    const style = options?.style ?? 'neutral';
    const rate = options?.sampleRate ?? this.sampleRate;
    const format = options?.format ?? this.format;
    return [voiceId, speed, pitch, style, rate, format, normalized].join('::');
  }

  enqueue(task) {
    this.queue = this.queue.then(task, task);
    return this.queue;
  }

  async synthesize(text, options = {}) {
    const normalized = normalizeText(text).slice(0, this.maxTextLength);
    if (!normalized) return null;
    const cacheKey = this.buildCacheKey(normalized, options);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    if (!this.synthesizer) {
      throw new Error('Chatterbox synthesizer is not configured.');
    }
    return this.enqueue(async () => {
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }
      const result = await this.synthesizer({
        text: normalized,
        voiceId: options.voiceId,
        speed: options.speed,
        pitch: options.pitch,
        style: options.style,
        sampleRate: options.sampleRate ?? this.sampleRate,
        format: options.format ?? this.format
      });
      this.cache.set(cacheKey, result);
      return result;
    });
  }

  preload(lines = [], options = {}) {
    const tasks = lines.map((line) => this.synthesize(line, options));
    return Promise.all(tasks);
  }
}
