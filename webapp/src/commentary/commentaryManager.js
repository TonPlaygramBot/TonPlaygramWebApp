import { COMMENTARY_DB, COMMENTARY_EVENT_CATEGORY_MAP } from './commentaryDatabase.js';

const DEFAULT_PLACEHOLDERS = {
  playerName: 'The player',
  opponentName: 'the opponent',
  ball: 'ball',
  points: 'points',
  remaining: 'remaining',
  frameScore: 'the frame score',
  breakPoints: 'the break',
  foulType: 'foul',
  shotType: 'shot',
  difficulty: 'long range',
  streak: 'a streak',
  lead: 'the lead'
};

const normalizeGameMode = (mode) => {
  if (!mode) return 'nineBall';
  const normalized = String(mode).toLowerCase();
  if (normalized.includes('9')) return 'nineBall';
  if (normalized.includes('8')) return 'eightBall';
  if (normalized.includes('snooker')) return 'snooker';
  if (normalized.includes('american')) return 'americanPoints';
  return 'nineBall';
};

const normalizeText = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();

export class CommentaryManager {
  constructor({ database = COMMENTARY_DB, ttsService, locale = 'en', now } = {}) {
    this.database = database;
    this.ttsService = ttsService;
    this.locale = locale;
    this.now = now || (() => performance.now());
    this.history = [];
    this.categoryLastSpoken = new Map();
    this.lastSpokenAt = 0;
    this.pending = null;
    this.processing = false;
  }

  onEvent(gameMode, eventType, context = {}) {
    const entry = this.buildEntry(gameMode, eventType, context);
    if (!entry) return Promise.resolve(null);
    if (this.processing) {
      if (!this.pending || entry.priority > this.pending.priority) {
        this.pending = entry;
      }
      return entry.promise;
    }
    return this.processEntry(entry);
  }

  buildEntry(gameMode, eventType, context) {
    const modeKey = normalizeGameMode(gameMode);
    const localeBundle = this.database.locales?.[this.locale]
      ?? this.database.locales?.[this.database.localeFallback]
      ?? null;
    const mode = localeBundle?.modes?.[modeKey];
    if (!mode) return null;
    const categoryKey =
      COMMENTARY_EVENT_CATEGORY_MAP?.[modeKey]?.[eventType] || eventType;
    const category = mode.categories?.[categoryKey];
    if (!category) return null;
    const now = this.now();
    const globalCooldown = this.database.globalRules?.globalCooldownMs ?? 2500;
    if (now - this.lastSpokenAt < globalCooldown) return null;
    const categoryCooldown = category.cooldownMs ?? 4000;
    const lastCategoryAt = this.categoryLastSpoken.get(categoryKey) ?? 0;
    if (now - lastCategoryAt < categoryCooldown) return null;

    const text = this.pickTemplate(category.lines || [], modeKey, categoryKey);
    if (!text) return null;
    const resolved = this.fillTemplate(text, context);
    const normalized = normalizeText(resolved);
    if (!normalized) return null;

    const priority = Number.isFinite(category.priority)
      ? category.priority
      : 50;
    let resolvePromise;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    return {
      gameMode: modeKey,
      categoryKey,
      text: normalized,
      voiceId: mode.voiceId,
      priority,
      context,
      resolve: resolvePromise,
      promise
    };
  }

  pickTemplate(lines, modeKey, categoryKey) {
    if (!Array.isArray(lines) || lines.length === 0) return null;
    const historyWindow = this.database.globalRules?.historyWindow ?? 8;
    const recent = new Set(
      this.history.slice(-historyWindow).map((entry) => entry.template)
    );
    const available = lines.filter((line) => !recent.has(line));
    const pool = available.length > 0 ? available : lines;
    const index = Math.floor(Math.random() * pool.length);
    const template = pool[index];
    this.history.push({
      template,
      modeKey,
      categoryKey,
      at: this.now()
    });
    return template;
  }

  fillTemplate(template, context = {}) {
    return template.replace(/\{(\w+)\}/g, (_match, key) => {
      if (context[key] != null && context[key] !== '') return String(context[key]);
      if (DEFAULT_PLACEHOLDERS[key]) return DEFAULT_PLACEHOLDERS[key];
      return '';
    });
  }

  async processEntry(entry) {
    this.processing = true;
    const now = this.now();

    let result = null;
    try {
      if (this.ttsService?.speak) {
        result = await this.ttsService.speak(entry.text, {
          voiceId: entry.voiceId,
          gameMode: entry.gameMode
        });
      }
    } catch (error) {
      console.warn('Commentary TTS failed', error);
    }

    if (result) {
      this.lastSpokenAt = now;
      this.categoryLastSpoken.set(entry.categoryKey, now);
    }

    entry.resolve(result);
    this.processing = false;

    if (this.pending) {
      const next = this.pending;
      this.pending = null;
      return this.processEntry(next);
    }

    return result;
  }
}
