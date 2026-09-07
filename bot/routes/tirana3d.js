import express from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { verifyTelegramInitData } from '../middleware/auth.js';
import {
  googleTileConfig,
  makeTileLimiter,
  proxyGoogleTile
} from '../../webapp/src/games/tiranastreets/shared/googleTiles.mjs';

const router = express.Router();
const allow = makeTileLimiter();
// A self-declared account ID is insufficient to spend the server's Maps quota.
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (!googleTileConfig(process.env).enabled) {
    return res
      .status(req.path === '/config' ? 200 : 503)
      .json(
        req.path === '/config'
          ? googleTileConfig(process.env)
          : { error: 'not_configured' }
      );
  }
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const telegram =
    process.env.BOT_TOKEN &&
    verifyTelegramInitData(req.get('x-telegram-init-data'));
  const age = telegram
    ? Date.now() / 1000 - Number(telegram.auth_date)
    : Infinity;
  let userId;
  try {
    userId = telegram?.user && JSON.parse(telegram.user).id;
  } catch {
    /* Invalid signed payload. */
  }
  const verified = userId && Number.isFinite(age) && age >= -60 && age <= 86400;
  const service =
    process.env.API_AUTH_TOKEN && token === process.env.API_AUTH_TOKEN;
  if (!verified && !service)
    return res
      .status(401)
      .json({ enabled: false, error: 'sign_in', reason: 'sign_in' });
  if (!allow(service ? 'service' : String(userId)))
    return res
      .status(429)
      .set('Retry-After', '60')
      .json({ error: 'rate_limited' });
  next();
});
router.get('/config', (_req, res) => res.json(googleTileConfig(process.env)));
router.get('/tiles/*', async (req, res) => {
  const abort = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) abort.abort();
  };
  res.on('close', onClose);
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const request = new Request(new URL(req.originalUrl, origin), {
      headers: req.get('if-none-match')
        ? { 'If-None-Match': req.get('if-none-match') }
        : {},
      signal: abort.signal
    });
    const response = await proxyGoogleTile(request, {
      apiKey: process.env.GOOGLE_MAPS_TILE_API_KEY,
      path: req.path.slice('/tiles'.length),
      proxyOrigin: origin
    });
    res.status(response.status);
    for (const [key, value] of response.headers) res.set(key, value);
    if (response.body) await pipeline(Readable.fromWeb(response.body), res);
    else res.end();
  } catch {
    if (!res.headersSent) res.status(502).json({ error: 'tiles_unavailable' });
    else res.end();
  } finally {
    res.off('close', onClose);
  }
});
export default router;
