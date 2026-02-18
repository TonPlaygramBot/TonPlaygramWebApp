import { Router } from 'express';

const router = Router();

const SUPPORTED_GAME_COMMENTARY = Object.freeze([
  { id: 'air-hockey', name: 'Air Hockey', locales: ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'sq'] },
  { id: 'snake-ladder', name: 'Snake & Ladder', locales: ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'sq'] },
  { id: 'murlan-royale', name: 'Murlan Royale', locales: ['en', 'hi', 'ru', 'es', 'fr', 'ar', 'sq'] },
  { id: 'pool-royale', name: 'Pool Royale', locales: ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'sq'] },
  { id: 'snooker-royale', name: 'Snooker Royale', locales: ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'sq'] },
  { id: 'chess-battle', name: 'Chess Battle', locales: ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'sq'] },
  { id: 'ludo-battle-royale', name: 'Ludo Battle Royale', locales: ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'sq'] },
  { id: 'texas-holdem', name: "Texas Hold'em", locales: ['en', 'zh', 'hi', 'es', 'fr', 'ar', 'sq'] }
]);

router.get('/catalog', (_req, res) => {
  res.json({
    provider: process.env.PERSONAPLEX_PROVIDER_NAME || 'nvidia-personaplex',
    configured: Boolean(process.env.PERSONAPLEX_API_URL),
    games: SUPPORTED_GAME_COMMENTARY
  });
});

router.post('/speak', async (req, res) => {
  const endpoint = process.env.PERSONAPLEX_API_URL;
  if (!endpoint) {
    return res.status(503).json({
      error: 'PERSONAPLEX_API_URL is not configured. Set it to enable NVIDIA Personaplex voice synthesis.'
    });
  }

  const { text, language = 'en', voice, format = 'mp3', sampleRate = 24000 } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  const payload = {
    text,
    language,
    voice,
    format,
    sample_rate: sampleRate
  };

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.PERSONAPLEX_API_KEY
          ? { Authorization: `Bearer ${process.env.PERSONAPLEX_API_KEY}` }
          : {})
      },
      body: JSON.stringify(payload)
    });

    if (!upstream.ok) {
      const message = await upstream.text();
      return res.status(502).json({
        error: 'Voice provider request failed',
        detail: message.slice(0, 500)
      });
    }

    const audioBuffer = Buffer.from(await upstream.arrayBuffer());
    const mimeType = upstream.headers.get('content-type') || 'audio/mpeg';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(audioBuffer);
  } catch (error) {
    return res.status(502).json({
      error: 'Failed to reach voice provider',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
