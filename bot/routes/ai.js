import { Router } from 'express';
import OpenAI from 'openai';
import { withProxy } from '../utils/proxyAgent.js';

const router = Router();

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      fetch: (url, options) => fetch(url, withProxy(options)),
    })
  : null;

const SYSTEM_PROMPT = `You are TonPlaygram AI Service Desk. Answer concisely, avoid speculation, and use bullet points when listing steps. Keep responses aligned with TonPlaygram features such as mining, games, wallet, and referrals. Never expose secrets or internal tokens. Use the latest context from the user to stay accurate.`;

router.post('/chat', async (req, res) => {
  const { message, history = [], telegramId, context } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }
  if (!client) {
    return res
      .status(503)
      .json({ error: 'AI agent is not configured. Please try again later.' });
  }

  const safeHistory = Array.isArray(history)
    ? history
        .filter(
          (entry) =>
            entry &&
            typeof entry.content === 'string' &&
            ['user', 'assistant'].includes(entry.role)
        )
        .slice(-10)
        .map((entry) => ({
          role: entry.role,
          content: entry.content.slice(0, 2000)
        }))
    : [];

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...safeHistory,
    { role: 'user', content: message.slice(0, 2000) }
  ];

  if (telegramId) {
    messages.splice(1, 0, {
      role: 'system',
      content: `The requester Telegram ID is ${telegramId}.`
    });
  }
  if (context) {
    messages.splice(1, 0, {
      role: 'system',
      content: `Additional TonPlaygram context: ${String(context).slice(0, 2000)}`
    });
  }

  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.3,
      max_tokens: 400
    });
    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(502).json({ error: 'AI agent returned no reply' });
    }
    res.json({ reply });
  } catch (err) {
    console.error('AI chat failed:', err.message);
    res.status(500).json({ error: 'Failed to contact AI agent' });
  }
});

export default router;
