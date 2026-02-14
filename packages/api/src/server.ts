import express from 'express';
import crypto from 'crypto';
import { answerUserQuestion } from '../../agent-core/src/agent.js';
import { loadKnowledgeIndex } from '../../agent-core/src/knowledgeBase.js';

const app = express();
app.use(express.json());

const kbPath = process.env.PUBLIC_INDEX_PATH ?? 'packages/ingestion-public/public-index.json';
const articles = loadKnowledgeIndex(kbPath);

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

app.post('/v1/feedback', requireBasicUserAuth, (req, res) => {
  const payload = {
    helpful: Boolean(req.body?.helpful),
    articleSlug: String(req.body?.articleSlug || ''),
    category: String(req.body?.category || 'general')
  };

  res.status(202).json({ accepted: true, payload });
});

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT || 4040);
  app.listen(port, () => {
    console.log(`Platform Help API running at http://localhost:${port}`);
  });
}

export default app;
