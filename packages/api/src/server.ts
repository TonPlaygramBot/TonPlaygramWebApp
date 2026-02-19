import express from 'express';
import crypto from 'crypto';
import { answerUserQuestion } from '../../agent-core/src/agent.js';
import { loadKnowledgeIndex } from '../../agent-core/src/knowledgeBase.js';
import { evaluateUserPrompt } from '../../agent-core/src/safety.js';
import {
  VOICE_PROFILES,
  buildCommentaryText,
  buildSupportSpeech,
  findVoiceProfile,
  isGameKey,
  requestPersonaplexSynthesis
} from './voiceCommentary.js';

const app = express();
app.use(express.json());

const kbPath = process.env.PUBLIC_INDEX_PATH ?? 'packages/ingestion-public/public-index.json';
let articles = loadKnowledgeIndex(kbPath);

const rateMap = new Map<string, { count: number; start: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > 60_000) {
    rateMap.set(ip, { count: 1, start: now });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count += 1;
  return true;
}

function refreshKnowledgeIndex(): void {
  articles = loadKnowledgeIndex(kbPath);
}

setInterval(() => {
  refreshKnowledgeIndex();
}, 60_000).unref();

function requireBasicUserAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const header = req.headers.authorization || '';
  const expected = process.env.USER_CHAT_BASIC_AUTH;
  if (!expected) return next();
  if (header !== `Basic ${expected}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

function hashIdentity(ip: string, userAgent: string): string {
  return crypto.createHash('sha256').update(`${ip}|${userAgent}`).digest('hex').slice(0, 16);
}

function recordSuspiciousMetadata(question: string, ip: string, userAgent: string): void {
  const safety = evaluateUserPrompt(question);
  if (safety.allowed) return;

  const fingerprint = hashIdentity(ip, userAgent);
  const promptHash = crypto.createHash('sha256').update(question).digest('hex').slice(0, 12);
  console.warn('suspicious-help-request', {
    fingerprint,
    promptHash,
    reason: 'sensitive_or_abuse_pattern',
    at: new Date().toISOString()
  });

  if (process.env.SUSPICIOUS_ALERT_WEBHOOK_URL) {
    fetch(process.env.SUSPICIOUS_ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint, promptHash, reason: 'sensitive_or_abuse_pattern' })
    }).catch(() => {});
  }
}

app.get('/v1/help-articles', (_req, res) => {
  const deduped = Array.from(new Map(articles.map((a) => [a.slug, a])).values()).map((a) => ({
    title: a.title,
    slug: a.slug,
    url: a.url,
    locale: a.locale,
    version: a.version
  }));
  res.json({ items: deduped });
});

app.post('/v1/user-chat', requireBasicUserAuth, (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(ip)) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  const question = String(req.body?.message || '');
  recordSuspiciousMetadata(question, ip, String(req.headers['user-agent'] || 'unknown'));
  const preferredLocale = String(req.body?.locale || '').trim() || undefined;
  const reply = answerUserQuestion(question, articles, { preferredLocale });

  const promptHash = crypto.createHash('sha256').update(question).digest('hex').slice(0, 12);
  console.info('user-chat-meta', {
    intent: reply.intent,
    articleIds: reply.metadata.usedArticleIds,
    confidence: reply.metadata.confidence,
    promptHash
  });

  res.json(reply);
});

app.post('/v1/feedback', requireBasicUserAuth, (req, res) => {
  const payload = {
    helpful: Boolean(req.body?.helpful),
    articleSlug: String(req.body?.articleSlug || ''),
    category: String(req.body?.category || 'general')
  };

  res.status(202).json({ accepted: true, payload });
});

app.get('/v1/voice/catalog', (_req, res) => {
  const languages = Array.from(new Set(VOICE_PROFILES.map((voice) => voice.language))).sort();
  res.json({ provider: 'nvidia-personaplex', languages, voices: VOICE_PROFILES });
});


app.get('/v1/help/languages', (_req, res) => {
  const items = VOICE_PROFILES.map((voice) => ({
    locale: voice.locale,
    language: voice.language,
    voiceId: voice.id,
    flag: localeToFlagEmoji(voice.locale)
  }));

  const deduped = Array.from(new Map(items.map((item) => [item.locale, item])).values());
  res.json({ items: deduped });
});

app.post('/v1/voice/commentary', requireBasicUserAuth, async (req, res) => {
  const game = String(req.body?.game || '');
  if (!isGameKey(game)) {
    res.status(400).json({ error: 'Unsupported game key', supportedGames: [
      'pool_royale', 'snooker_royal', 'snake_multiplayer', 'texas_holdem', 'domino_royal',
      'chess_battle_royal', 'air_hockey', 'goal_rush', 'ludo_battle_royal', 'table_tennis_royal',
      'murlan_royale', 'dice_duel', 'snake_and_ladder'
    ] });
    return;
  }

  const eventType = String(req.body?.eventType || 'player_turn') as Parameters<typeof buildCommentaryText>[1];
  const playerName = String(req.body?.playerName || 'Player');
  const score = typeof req.body?.score === 'string' ? req.body.score : undefined;
  const voice = findVoiceProfile(req.body?.voiceId, req.body?.locale);
  const text = buildCommentaryText(game, eventType, playerName, score);

  try {
    const synthesis = await requestPersonaplexSynthesis({
      text,
      locale: voice.locale,
      voiceId: voice.id,
      metadata: { game, eventType }
    });
    res.json({ text, voice, synthesis });
  } catch (error) {
    res.status(502).json({ error: (error as Error).message, text, voice });
  }
});

app.post('/v1/voice/support', requireBasicUserAuth, async (req, res) => {
  const voice = findVoiceProfile(req.body?.voiceId, req.body?.locale);
  const ticketContext = String(req.body?.ticketContext || 'General account support');
  const text = buildSupportSpeech(ticketContext, voice);

  try {
    const synthesis = await requestPersonaplexSynthesis({
      text,
      locale: voice.locale,
      voiceId: voice.id,
      metadata: { channel: 'customer_support' }
    });
    res.json({ text, voice, synthesis });
  } catch (error) {
    res.status(502).json({ error: (error as Error).message, text, voice });
  }
});

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 4040);
  app.listen(port, () => {
    console.log(`Platform Help API running at http://localhost:${port}`);
  });
}

export default app;


function localeToFlagEmoji(locale: string): string {
  const country = locale.split('-')[1]?.toUpperCase();
  if (!country || country.length !== 2) return '🌐';
  const chars = [...country].map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...chars);
}
