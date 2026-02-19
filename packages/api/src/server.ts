import express from 'express';
import crypto from 'crypto';
import multer from 'multer';
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
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
app.use(express.json());

const kbPath = process.env.PUBLIC_INDEX_PATH ?? 'packages/ingestion-public/public-index.json';
let articles = loadKnowledgeIndex(kbPath);
const voicePromptStore = new Map<string, { voicePromptId: string; label: string; locale: string; createdAt: string }>();

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

function normalizeSynthesisPayload(synthesis: Awaited<ReturnType<typeof requestPersonaplexSynthesis>>) {
  if (synthesis.mode === 'local-fallback') {
    return {
      provider: synthesis.provider,
      mode: synthesis.mode,
      reason: synthesis.reason,
      message: synthesis.message,
      audioUrl: '',
      audioBase64: synthesis.payload?.audioBase64 || '',
      mimeType: synthesis.payload?.mimeType || 'audio/wav'
    };
  }

  const payload = (synthesis.response || {}) as Record<string, unknown>;
  const audioUrl =
    (typeof payload.audioUrl === 'string' && payload.audioUrl) ||
    (typeof payload.audio_url === 'string' && payload.audio_url) ||
    '';
  const audioBase64 =
    (typeof payload.audioBase64 === 'string' && payload.audioBase64) ||
    (typeof payload.audio_base64 === 'string' && payload.audio_base64) ||
    (typeof payload.audioContent === 'string' && payload.audioContent) ||
    (typeof payload.audio_content === 'string' && payload.audio_content) ||
    '';
  const mimeType =
    (typeof payload.mimeType === 'string' && payload.mimeType) ||
    (typeof payload.mime_type === 'string' && payload.mime_type) ||
    'audio/mpeg';

  return {
    provider: synthesis.provider,
    mode: synthesis.mode,
    audioUrl,
    audioBase64,
    mimeType,
    raw: synthesis.response
  };
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

app.get('/v1/health', (_req, res) => {
  res.json({ status: 'ok' });
});

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
  const reply = answerUserQuestion(question, articles);

  const promptHash = crypto.createHash('sha256').update(question).digest('hex').slice(0, 12);
  console.info('user-chat-meta', {
    intent: reply.intent,
    articleIds: reply.metadata.usedArticleIds,
    confidence: reply.metadata.confidence,
    promptHash
  });

  res.json(reply);
});

app.post('/v1/support/text', requireBasicUserAuth, async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const latestMessage = String(messages[messages.length - 1]?.content || 'General account support');
  const locale = String(req.body?.voicePromptId || req.body?.locale || 'en-US');
  const voice = findVoiceProfile(undefined, locale);
  const text = buildSupportSpeech(latestMessage, voice);

  try {
    const synthesis = await requestPersonaplexSynthesis({
      text,
      locale: voice.locale,
      voiceId: voice.id,
      metadata: { channel: 'customer_support', mode: 'text' }
    });
    const normalized = normalizeSynthesisPayload(synthesis);
    res.json({ text, audioUrl: normalized.audioUrl, audioBase64: normalized.audioBase64, mimeType: normalized.mimeType });
  } catch (error) {
    res.status(502).json({ error: (error as Error).message, text });
  }
});

app.post('/v1/support/voice', requireBasicUserAuth, upload.single('audio'), async (req, res) => {
  const locale = String(req.body?.voicePromptId || req.body?.locale || 'en-US');
  const voice = findVoiceProfile(undefined, locale);
  const sizeKb = Math.round((req.file?.size || 0) / 1024);
  const ticketContext = `Voice request (${sizeKb}KB audio) from session ${String(req.body?.sessionId || 'unknown')}`;
  const text = buildSupportSpeech(ticketContext, voice);

  try {
    const synthesis = await requestPersonaplexSynthesis({
      text,
      locale: voice.locale,
      voiceId: voice.id,
      metadata: { channel: 'customer_support', mode: 'voice' }
    });
    const normalized = normalizeSynthesisPayload(synthesis);
    res.json({ text, audioUrl: normalized.audioUrl, audioBase64: normalized.audioBase64, mimeType: normalized.mimeType });
  } catch (error) {
    res.status(502).json({ error: (error as Error).message, text });
  }
});

app.post('/v1/commentary/event', requireBasicUserAuth, async (req, res) => {
  const eventType = String(req.body?.eventType || 'player_turn');
  const eventPayload = (req.body?.eventPayload || {}) as Record<string, unknown>;
  const requestedGame = String(eventPayload.gameKey || req.body?.game || 'snake_and_ladder');
  const game = isGameKey(requestedGame) ? requestedGame : 'snake_and_ladder';
  const locale = String(req.body?.voicePromptId || req.body?.locale || 'en-US');
  const voice = findVoiceProfile(undefined, locale);
  const playerName = String(eventPayload.playerName || eventPayload.speaker || 'Player');
  const score = typeof eventPayload.score === 'string' ? eventPayload.score : undefined;
  const directText = typeof eventPayload.text === 'string' ? eventPayload.text : '';
  const text = directText || buildCommentaryText(game, eventType as Parameters<typeof buildCommentaryText>[1], playerName, score);

  try {
    const synthesis = await requestPersonaplexSynthesis({
      text,
      locale: voice.locale,
      voiceId: voice.id,
      metadata: { channel: 'commentary', game, eventType }
    });
    const normalized = normalizeSynthesisPayload(synthesis);
    res.json({ text, audioUrl: normalized.audioUrl, audioBase64: normalized.audioBase64, mimeType: normalized.mimeType });
  } catch (error) {
    res.status(502).json({ error: (error as Error).message, text });
  }
});

app.post('/v1/voices', requireBasicUserAuth, upload.single('voice'), (req, res) => {
  const voicePromptId = `vp_${crypto.randomUUID().slice(0, 12)}`;
  const label = String(req.body?.label || `Voice ${voicePromptId.slice(-4)}`);
  const locale = String(req.body?.locale || 'en-US');
  const item = { voicePromptId, label, locale, createdAt: new Date().toISOString() };
  voicePromptStore.set(voicePromptId, item);
  res.status(201).json(item);
});

app.get('/v1/voices', requireBasicUserAuth, (_req, res) => {
  const voices = Array.from(voicePromptStore.values());
  if (!voices.length) {
    res.json({ voices: VOICE_PROFILES.map((voice) => ({ voicePromptId: voice.locale, label: voice.language, locale: voice.locale })) });
    return;
  }
  res.json({ voices });
});

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 4040);
  app.listen(port, () => {
    console.log(`Platform Help API running at http://localhost:${port}`);
  });
}

export default app;
