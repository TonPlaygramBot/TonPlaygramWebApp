import { COMMENTARY_DATABASE, COMMENTARY_DEFAULT_VOICES } from './commentaryDatabase.js';

const DEFAULT_HISTORY_SIZE = COMMENTARY_DATABASE.rules.historySize ?? 8;
const DEFAULT_GLOBAL_COOLDOWN = COMMENTARY_DATABASE.rules.globalCooldownMs ?? [2000, 4000];
const DEFAULT_MAX_TEXT = COMMENTARY_DATABASE.rules.maxTextLength ?? 140;

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const randomBetween = (minMs, maxMs) => {
  const min = Number.isFinite(minMs) ? minMs : 0;
  const max = Number.isFinite(maxMs) ? maxMs : min;
  if (max <= min) return min;
  return Math.floor(min + Math.random() * (max - min));
};

const resolvePlaceholders = (template, context) => {
  if (!template) return '';
  const fallback = context?.fallback ?? '—';
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = context?.[key];
    if (value == null || value === '') return fallback;
    return String(value);
  });
};

const normalizeText = (text, maxLength = DEFAULT_MAX_TEXT) => {
  if (!text) return '';
  const compact = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
  if (compact.length <= maxLength) return compact;
  return compact.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…';
};

export class CommentaryManager {
  constructor({
    locale = 'en',
    database = COMMENTARY_DATABASE,
    ttsService = null,
    historySize = DEFAULT_HISTORY_SIZE,
    globalCooldownMs = DEFAULT_GLOBAL_COOLDOWN
  } = {}) {
    this.locale = locale;
    this.database = database;
    this.ttsService = ttsService;
    this.historySize = historySize;
    this.globalCooldownMs = globalCooldownMs;
    this.history = [];
    this.categoryCooldowns = new Map();
    this.lastGlobalTime = 0;
    this.queue = [];
  }

  queueEvent(gameMode, eventType, context = {}) {
    this.queue.push({ gameMode, eventType, context, queuedAt: nowMs() });
  }

  drainQueue() {
    if (this.queue.length === 0) return null;
    const queued = [...this.queue];
    this.queue = [];
    let best = null;
    let bestPriority = -Infinity;
    for (const entry of queued) {
      const { category } = this.resolveCategory(entry.gameMode, entry.eventType) ?? {};
      const priority = category?.priority ?? 0;
      if (priority > bestPriority) {
        bestPriority = priority;
        best = entry;
      }
    }
    return best;
  }

  resolveCategory(gameMode, eventType) {
    const localeData = this.database.locales?.[this.locale];
    const modeData = localeData?.modes?.[gameMode];
    if (!modeData) return null;
    const categoryId = modeData.eventMap?.[eventType] ?? eventType;
    const category = modeData.categories?.[categoryId];
    if (!category) return null;
    return { category, categoryId, modeData };
  }

  shouldSuppress(categoryId, category, context) {
    if (context?.suppressCommentary) return true;
    if (context?.isReplay) return true;
    if (context?.isQuietPeriod) return true;
    const now = nowMs();
    const lastGlobal = this.lastGlobalTime ?? 0;
    const [minGlobal, maxGlobal] = this.globalCooldownMs;
    const globalCooldown = randomBetween(minGlobal, maxGlobal);
    if (now - lastGlobal < globalCooldown) return true;
    const lastCategory = this.categoryCooldowns.get(categoryId) ?? 0;
    const categoryCooldown =
      category?.cooldownMs ?? this.database.rules?.defaultCategoryCooldownMs ?? 0;
    if (now - lastCategory < categoryCooldown) return true;
    return false;
  }

  pickTemplate(categoryId, category, context) {
    const lines = Array.isArray(category?.lines) ? category.lines : [];
    if (lines.length === 0) return null;
    const historySet = new Set(this.history.map((entry) => entry.lineId));
    const available = lines
      .map((line, index) => ({ line, index }))
      .filter(({ index }) => !historySet.has(`${categoryId}:${index}`));
    const pool = available.length > 0 ? available : lines.map((line, index) => ({ line, index }));
    const choice = pool[Math.floor(Math.random() * pool.length)];
    return choice ? { line: choice.line, index: choice.index } : null;
  }

  recordHistory(categoryId, index, text) {
    this.history.unshift({ lineId: `${categoryId}:${index}`, text, at: nowMs() });
    if (this.history.length > this.historySize) {
      this.history.length = this.historySize;
    }
  }

  selectLine(gameMode, eventType, context = {}) {
    const resolved = this.resolveCategory(gameMode, eventType);
    if (!resolved) return null;
    const { category, categoryId, modeData } = resolved;
    if (this.shouldSuppress(categoryId, category, context)) return null;
    const template = this.pickTemplate(categoryId, category, context);
    if (!template) return null;
    const filled = resolvePlaceholders(template.line, context);
    const text = normalizeText(filled, this.database.rules?.maxTextLength ?? DEFAULT_MAX_TEXT);
    const now = nowMs();
    this.lastGlobalTime = now;
    this.categoryCooldowns.set(categoryId, now);
    this.recordHistory(categoryId, template.index, text);
    return {
      text,
      categoryId,
      mode: modeData?.label ?? gameMode,
      priority: category?.priority ?? 0
    };
  }

  async onEvent(gameMode, eventType, context = {}) {
    const selection = this.selectLine(gameMode, eventType, context);
    if (!selection) return null;
    if (!this.ttsService) return selection;
    const voiceId =
      context.voiceId || COMMENTARY_DEFAULT_VOICES[gameMode] || selection.voiceId || 'default';
    const audio = await this.ttsService.synthesize({
      text: selection.text,
      voiceId,
      speed: context.speed,
      pitch: context.pitch,
      style: context.style
    });
    return { ...selection, audio };
  }

  async handleQueuedEvents() {
    const event = this.drainQueue();
    if (!event) return null;
    return this.onEvent(event.gameMode, event.eventType, event.context);
  }
}

export const createCommentaryManager = (options = {}) => new CommentaryManager(options);
