import { Router } from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import authenticate from '../middleware/auth.js';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', '.cache', 'tts');

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

router.post('/speak', authenticate, async (req, res) => {
  try {
    const { text, voice = 'alloy', speed = 1.0 } = req.body || {};

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text required' });
    }

    // Keep it bounded to control latency/cost.
    const normalized = text.trim().slice(0, 800);
    const normalizedSpeed = Math.max(0.8, Math.min(1.2, Number(speed) || 1.0));

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(501).json({ error: 'server tts not configured' });
    }

    ensureCacheDir();
    const cacheKey = sha256(`${voice}|${normalizedSpeed}|${normalized}`);
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.opus`);

    if (existsSync(cachePath)) {
      const buf = readFileSync(cachePath);
      res.setHeader('Content-Type', 'audio/ogg; codecs=opus');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(buf);
    }

    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey });

    // NOTE: Uses OpenAI TTS. Cached on disk by hash to reduce repeat costs.
    const response = await client.audio.speech.create({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice,
      input: normalized,
      format: 'opus',
      speed: normalizedSpeed
    });

    const arrayBuffer = await response.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    writeFileSync(cachePath, buf);

    res.setHeader('Content-Type', 'audio/ogg; codecs=opus');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(buf);
  } catch (err) {
    console.error('[tts] failed:', err);
    return res.status(500).json({ error: 'tts failed' });
  }
});

export default router;
