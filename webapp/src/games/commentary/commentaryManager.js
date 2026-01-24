const DEFAULT_GLOBAL_COOLDOWN_MS = 2500;
const DEFAULT_CATEGORY_COOLDOWN_MS = 4000;
const DEFAULT_HISTORY_SIZE = 8;

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });

const normalizeText = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();

export class CommentaryManager {
  constructor({
    database,
    ttsService,
    locale = 'en',
    globalCooldownMs = DEFAULT_GLOBAL_COOLDOWN_MS,
    historySize = DEFAULT_HISTORY_SIZE
  }) {
    this.database = database;
    this.ttsService = ttsService;
    this.locale = locale;
    this.globalCooldownMs = globalCooldownMs;
    this.historySize = historySize;
    this.pendingEvents = [];
    this.processing = false;
    this.lastSpokenAt = 0;
    this.categoryCooldowns = new Map();
    this.suppressedUntil = new Map();
    this.recentLines = [];
  }

  onEvent(gameMode, eventType, context = {}) {
    return new Promise((resolve) => {
      const event = {
        gameMode,
        eventType,
        context,
        createdAt: nowMs(),
        resolve
      };
      this.pendingEvents.push(event);
      this.processQueue();
    });
  }

  preload(gameMode, eventTypes = [], context = {}) {
    const tasks = eventTypes.map((eventType) =>
      this.onEvent(gameMode, eventType, context)
    );
    return Promise.all(tasks);
  }

  resolveMode(gameMode) {
    const modes = this.database?.modes ?? {};
    return modes[gameMode] ?? null;
  }

  resolveCategory(mode, eventType) {
    if (!mode?.categories) return null;
    const categories = Object.entries(mode.categories);
    for (const [key, category] of categories) {
      const eventTypes = category?.eventTypes ?? [];
      if (eventTypes.includes(eventType) || key === eventType) {
        return { key, category };
      }
    }
    return null;
  }

  pickBestEvent() {
    const now = nowMs();
    let best = null;
    let bestScore = -Infinity;
    for (const event of this.pendingEvents) {
      const mode = this.resolveMode(event.gameMode);
      const resolved = this.resolveCategory(mode, event.eventType);
      if (!resolved) continue;
      const { key, category } = resolved;
      const suppressedUntil = this.suppressedUntil.get(key) ?? 0;
      if (suppressedUntil > now) continue;
      const categoryCooldown = this.categoryCooldowns.get(key) ?? 0;
      if (categoryCooldown > now) continue;
      const priority = category?.priority ?? 0;
      const age = Math.min((now - event.createdAt) / 1000, 5);
      const score = priority + age;
      if (score > bestScore) {
        bestScore = score;
        best = { event, key, category, mode };
      }
    }
    return best;
  }

  buildTemplateLine(category) {
    const lines = Array.isArray(category?.lines) ? category.lines : [];
    if (!lines.length) return null;
    const recent = new Set(this.recentLines);
    const available = lines.filter((line) => !recent.has(line));
    const pool = available.length ? available : lines;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    if (!choice) return null;
    this.recentLines.unshift(choice);
    this.recentLines = this.recentLines.slice(0, this.historySize);
    return choice;
  }

  fillTemplate(template, context) {
    const defaults = {
      playerName: context.playerName ?? 'Player',
      opponentName: context.opponentName ?? 'Opponent',
      ball: context.ball ?? 'ball',
      points: context.points ?? context.score ?? '',
      remaining: context.remaining ?? '',
      frameScore: context.frameScore ?? '',
      breakPoints: context.breakPoints ?? context.points ?? '',
      foulType: context.foulType ?? 'foul',
      shotType: context.shotType ?? 'shot',
      difficulty: context.difficulty ?? 'tough',
      streak: context.streak ?? '',
      lead: context.lead ?? ''
    };
    return normalizeText(
      String(template).replace(/\{(\w+)\}/g, (match, key) => {
        const value = context[key] ?? defaults[key];
        if (value == null) return '';
        return String(value);
      })
    );
  }

  applySuppression(categoryKey, category) {
    const suppresses = Array.isArray(category?.suppresses) ? category.suppresses : [];
    const suppressMs = Number.isFinite(category?.suppressMs)
      ? category.suppressMs
      : 0;
    if (!suppressMs) return;
    const until = nowMs() + suppressMs;
    suppresses.forEach((key) => {
      this.suppressedUntil.set(key, until);
    });
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;
    while (this.pendingEvents.length) {
      const next = this.pickBestEvent();
      if (!next) break;
      const now = nowMs();
      const waitMs = this.lastSpokenAt + this.globalCooldownMs - now;
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      const { event, key, category, mode } = next;
      const index = this.pendingEvents.indexOf(event);
      if (index >= 0) this.pendingEvents.splice(index, 1);
      const template = this.buildTemplateLine(category);
      if (!template) {
        event.resolve(null);
        continue;
      }
      const line = this.fillTemplate(template, event.context ?? {});
      if (!line) {
        event.resolve(null);
        continue;
      }
      const cooldownMs = Number.isFinite(category?.cooldownMs)
        ? category.cooldownMs
        : DEFAULT_CATEGORY_COOLDOWN_MS;
      this.categoryCooldowns.set(key, nowMs() + cooldownMs);
      this.applySuppression(key, category);
      const voiceId = mode?.voiceProfile ?? 'default';
      const ttsOptions = {
        voiceId,
        speed: event.context?.speed,
        pitch: event.context?.pitch,
        style: event.context?.style
      };
      const audio = await this.ttsService?.synthesize(line, ttsOptions);
      this.lastSpokenAt = nowMs();
      event.resolve({ text: line, audio, category: key, mode: mode?.id ?? event.gameMode });
    }
    this.processing = false;
  }
}
