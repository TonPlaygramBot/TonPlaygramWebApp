import express from 'express';
import OpenAI from 'openai';
import { findRelevantChunks, getIndexStats } from '../utils/codeIndex.js';
import { withProxy } from '../utils/proxyAgent.js';

const router = express.Router();

const devAccounts = [
  process.env.DEV_ACCOUNT_ID || process.env.VITE_DEV_ACCOUNT_ID,
  process.env.DEV_ACCOUNT_ID_1 || process.env.VITE_DEV_ACCOUNT_ID_1,
  process.env.DEV_ACCOUNT_ID_2 || process.env.VITE_DEV_ACCOUNT_ID_2
]
  .filter(Boolean)
  .map(String);

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      fetch: (url, options) => fetch(url, withProxy(options))
    })
  : null;

function isAuthorized(accountId) {
  if (!devAccounts.length) return true;
  if (!accountId) return false;
  return devAccounts.includes(String(accountId));
}

router.get('/stats', (req, res) => {
  const { accountId } = req.query || {};
  if (!isAuthorized(accountId)) {
    return res.status(403).json({ error: 'unauthorized' });
  }
  try {
    const stats = getIndexStats();
    return res.json({
      ready: Boolean(openaiClient),
      ...stats
    });
  } catch (err) {
    console.error('dev assistant stats failed', err);
    return res.status(500).json({ error: 'failed to load index stats' });
  }
});

router.post('/ask', async (req, res) => {
  const { question, accountId } = req.body || {};
  if (!isAuthorized(accountId)) {
    return res.status(403).json({ error: 'unauthorized' });
  }
  if (!question || typeof question !== 'string' || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }
  if (!openaiClient) {
    return res.status(503).json({ error: 'assistant not configured' });
  }

  const trimmedQuestion = question.trim().slice(0, 2000);
  let contextChunks = [];
  try {
    contextChunks = findRelevantChunks(trimmedQuestion, {
      maxChunks: 12,
      maxChars: 11_000
    });
  } catch (err) {
    console.error('dev assistant indexing failed', err);
    return res.status(500).json({ error: 'code index unavailable' });
  }

  const contextText = contextChunks
    .map((chunk) => `File: ${chunk.path}\n${chunk.content}`)
    .join('\n---\n');

  const systemPrompt = `You are TonPlaygram's private developer assistant. You have read access to the full monorepo and must answer with precise, actionable steps. Reference file paths and key identifiers when suggesting changes. Keep answers concise and focused on implementation details. If information is missing in the provided context, state what else is needed instead of inventing details.`;

  try {
    const completion = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Project context:\n${contextText || 'No context available.'}\n\nQuestion: ${trimmedQuestion}`
        }
      ],
      max_tokens: 900,
      temperature: 0.2
    });

    const answer = completion.choices?.[0]?.message?.content?.trim();
    return res.json({
      answer: answer || 'No answer produced.',
      sources: contextChunks.map(({ path, score }) => ({ path, score })),
      index: getIndexStats()
    });
  } catch (err) {
    console.error('dev assistant failed', err);
    return res.status(500).json({ error: 'assistant failed to respond' });
  }
});

export default router;
