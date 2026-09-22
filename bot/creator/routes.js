import express from 'express';
import { creatorReturnPath } from '../../shared/socialApp.js';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { verifyTelegramInitData } from '../middleware/auth.js';
import { Connection, Media, Post } from './models.js';
import { catalog, available, PROVIDERS } from './catalog.js';
import { session, requireSession, csrf, issueSession, setCookie, problem, safeConnection, publicOrigin } from './security.js';
import { beginOAuth, finishOAuth } from './oauth.js';
import { googleSignInStatus, beginGoogleSignIn, finishGoogleSignIn } from './googleSignIn.js';
import { reserveMedia, appendMedia, CHUNK, publicMedia, mediaPath, verifyMediaLink, removeMedia } from './media.js';
import { validateContent, creatorInfo } from './publishers.js';
import { createLive, stopLive, currentLive, liveSummary, liveEnabled } from './live.js';
const router = express.Router();
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const id = value => { if (!/^[a-f0-9]{24}$/.test(String(value))) throw problem(400, 'Invalid item.'); return value; };
const database = (_req, _res, next) => mongoose.connection.readyState === 1 ? next() : next(problem(503, 'Studio is temporarily unavailable. Please try again shortly.'));
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); next(); });
router.get('/catalog', (_req, res) => {
  const google = googleSignInStatus();
  const redirectLogin = available('google');
  res.json({ platforms: catalog(), googleLogin: redirectLogin || google.available, googleLoginMethod: redirectLogin ? 'oauth' : 'identity', googleLoginReason: redirectLogin ? null : google.reason, liveEnabled: liveEnabled(), maxUploadBytes: 250 * 1024 ** 2 });
});
router.get('/session', (req, res) => { const user = session(req); res.json(user ? { signedIn: true, name: user.name, method: user.owner.split(':')[0] } : { signedIn: false }); });
router.get('/oauth/:platform/callback', database, wrap(async (req, res) => {
  req.creator = session(req);
  let result = 'connected';
  try { await finishOAuth(req, res, req.params.platform); }
  catch { result = req.query.error ? 'cancelled' : 'failed'; }
  res.redirect(303, `${publicOrigin()}${creatorReturnPath(res.locals.creatorReturnTo)}?connection=${result}`);
}));
router.get('/media-file/:id', database, wrap(async (req, res) => {
  if (!verifyMediaLink(req.params.id, req.query.expires, req.query.signature)) throw problem(403, 'This media link has expired.');
  const media = await Media.findOne({ _id: id(req.params.id), ready: true });
  if (!media) throw problem(404, 'Media not found.');
  res.type(media.mime); res.set('Content-Disposition', 'inline');
  res.sendFile(mediaPath(media), error => { if (error && !res.headersSent) res.status(404).end(); });
}));
router.use(csrf);
router.use(rateLimit({ windowMs: 60000, limit: 150, standardHeaders: true, legacyHeaders: false, message: { error: 'Please wait a moment before trying again.' } }));
router.post('/session/telegram', database, wrap(async (req, res) => {
  if (!process.env.BOT_TOKEN) throw problem(401, 'Open TonPlayGram from Telegram or use Google to sign in.');
  const raw = req.body?.initData;
  if (typeof raw !== 'string' || raw.length > 20000) throw problem(401, 'Open TonPlayGram from Telegram again.');
  const verified = verifyTelegramInitData(raw);
  const age = verified ? Date.now() / 1000 - Number(verified.auth_date) : Infinity;
  if (!verified || !Number.isFinite(age) || age < -30 || age > 3600) throw problem(401, 'Your Telegram sign-in expired. Reopen TonPlayGram from Telegram.');
  let user; try { user = JSON.parse(verified.user); } catch { throw problem(401, 'Please sign in again.'); }
  if (!Number.isSafeInteger(user?.id) || user.id <= 0) throw problem(401, 'Please sign in again.');
  issueSession(res, `telegram:${user.id}`, user.first_name); res.json({ signedIn: true, name: user.first_name });
}));
router.post('/session/logout', (req, res) => { setCookie(res, 'tpg_creator', '', 0); res.json({ ok: true }); });
router.post('/login/google', database, wrap(async (req, res) => res.json({ url: await beginOAuth(req, res, 'google') })));
router.post('/login/google/identity', database, wrap(async (req, res) => res.json(await beginGoogleSignIn(req, res))));
router.post('/session/google', database, wrap(async (req, res) => res.json(await finishGoogleSignIn(req, res))));
// Guests can authorize a platform directly. The verified callback creates the
// Studio session; existing signed-in users link into their current workspace.
router.post('/accounts/:platform/connect', database, wrap(async (req, res) => {
  if (!Object.hasOwn(PROVIDERS, req.params.platform)) throw problem(400, 'Unsupported platform.');
  req.creator = session(req);
  if (req.creator && currentLive(req.creator.owner)) throw problem(409, 'End your broadcast before connecting another account.');
  res.json({ url: await beginOAuth(req, res, req.params.platform) });
}));
router.use(requireSession, database);
router.get('/accounts', wrap(async (req, res) => res.json({ accounts: (await Connection.find({ owner: req.creator.owner, platform: { $in: Object.keys(PROVIDERS) }, status: { $ne: 'disconnected' } }).sort({ createdAt: 1 })).map(safeConnection) })));
router.delete('/accounts/:id', wrap(async (req, res) => {
  const key = id(req.params.id), owner = req.creator.owner;
  if (currentLive(owner)) throw problem(409, 'End your broadcast before disconnecting accounts.');
  const busy = await Post.exists({ owner, deliveries: { $elemMatch: { connectionId: key, status: { $in: ['sending', 'processing'] } } } });
  if (busy) throw problem(409, 'Wait for this account’s current publication to finish before disconnecting.');
  await Post.updateMany({ owner }, { $set: { 'deliveries.$[d].status': 'cancelled', 'deliveries.$[d].message': 'Account disconnected.' } }, { arrayFilters: [{ 'd.connectionId': key, 'd.status': 'queued' }] });
  await Connection.updateOne({ _id: key, owner }, { $set: { status: 'disconnected' }, $unset: { credentials: 1, expiresAt: 1 } });
  res.json({ ok: true });
}));
router.get('/accounts/:id/tiktok-options', wrap(async (req, res) => {
  const c = await Connection.findOne({ _id: id(req.params.id), owner: req.creator.owner, platform: 'tiktok' }).select('+credentials');
  if (!c) throw problem(404, 'Account not found.');
  res.json(await creatorInfo(c));
}));
router.get('/media', wrap(async (req, res) => res.json({ media: (await Media.find({ owner: req.creator.owner }).sort({ createdAt: -1 }).limit(50)).map(publicMedia) })));
router.post('/media', wrap(async (req, res) => res.status(201).json(publicMedia(await reserveMedia(req.creator.owner, req.body)))));
router.get('/media/:id', wrap(async (req, res) => {
  const m = await Media.findOne({ _id: id(req.params.id), owner: req.creator.owner }); if (!m) throw problem(404, 'Upload not found.'); res.json(publicMedia(m));
}));
router.put('/media/:id', express.raw({ type: 'application/octet-stream', limit: CHUNK }), wrap(async (req, res) => {
  const m = await Media.findOne({ _id: id(req.params.id), owner: req.creator.owner }); if (!m) throw problem(404, 'Upload not found.');
  res.json(publicMedia(await appendMedia(m, Number(req.get('x-upload-offset')), req.body)));
}));
router.delete('/media/:id', wrap(async (req, res) => {
  const m = await Media.findOne({ _id: id(req.params.id), owner: req.creator.owner }); if (!m) throw problem(404, 'Upload not found.');
  if (await Post.exists({ owner: req.creator.owner, mediaId: String(m._id), status: { $in: ['draft', 'queued', 'scheduled'] } })) throw problem(409, 'This media is used by a draft or pending post. Delete that post first.');
  await removeMedia(m); res.json({ ok: true });
}));
function cleanPost(input) {
  if (!input || typeof input.caption !== 'string' || input.caption.length > 63206 || typeof input.title !== 'string' || input.title.length > 100 || !Array.isArray(input.targets) || input.targets.length > 12 || input.targets.some(x => !/^[a-f0-9]{24}$/.test(x))) throw problem(400, 'Check your title, caption and selected accounts.');
  const overrides = {};
  for (const [key, value] of Object.entries(input.overrides || {})) {
    if (!PROVIDERS[key] || typeof value !== 'string' || value.length > 63206) throw problem(400, 'Check your platform captions.');
    if (value.length) overrides[key] = value;
  }
  const s = input.settings || {}, t = s.tiktok || {};
  const settings = { youtubePrivacy: s.youtubePrivacy, madeForKids: s.madeForKids, tiktok: { privacy: String(t.privacy || '').slice(0, 40), consent: t.consent === true, comments: t.comments === true, duet: t.duet === true, stitch: t.stitch === true, disclosure: t.disclosure === true, ownBrand: t.ownBrand === true, branded: t.branded === true, aiGenerated: t.aiGenerated === true } };
  return { caption: input.caption, title: input.title, targets: [...new Set(input.targets)], mediaId: input.mediaId ? id(input.mediaId) : '', overrides, settings };
}
router.get('/posts', wrap(async (req, res) => res.json({ posts: await Post.find({ owner: req.creator.owner }).select('-owner -requestId').sort({ createdAt: -1 }).limit(100).lean() })));
router.post('/posts', wrap(async (req, res) => {
  const owner = req.creator.owner, body = cleanPost(req.body);
  const requestId = String(req.body.requestId || '');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) throw problem(400, 'Please save the post again.');
  if (body.mediaId && !await Media.exists({ _id: body.mediaId, owner, ready: true })) throw problem(400, 'Finish uploading the media first.');
  if (await Connection.countDocuments({ _id: { $in: body.targets }, owner }) !== body.targets.length) throw problem(400, 'Selected account not found.');
  const existing = await Post.findOne({ owner, requestId }); if (existing) return res.json(existing);
  try { res.status(201).json(await Post.create({ ...body, owner, requestId })); }
  catch (error) { if (error.code === 11000) return res.json(await Post.findOne({ owner, requestId })); throw error; }
}));
router.patch('/posts/:id', wrap(async (req, res) => {
  const owner = req.creator.owner, body = cleanPost(req.body);
  if (body.mediaId && !await Media.exists({ _id: body.mediaId, owner, ready: true })) throw problem(400, 'Finish uploading the media first.');
  if (await Connection.countDocuments({ _id: { $in: body.targets }, owner }) !== body.targets.length) throw problem(400, 'Selected account not found.');
  const post = await Post.findOneAndUpdate({ _id: id(req.params.id), owner, status: 'draft' }, { $set: body }, { new: true });
  if (!post) throw problem(409, 'Only drafts can be edited.'); res.json(post);
}));
router.post('/posts/:id/submit', wrap(async (req, res) => {
  const owner = req.creator.owner, key = id(req.params.id);
  const post = await Post.findOne({ _id: key, owner }); if (!post) throw problem(404, 'Post not found.');
  if (post.status !== 'draft') return res.json(post); // Idempotent submit after a lost response.
  if (!post.targets.length) throw problem(400, 'Choose at least one connected account.');
  const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : new Date();
  if (!Number.isFinite(+scheduledAt) || +scheduledAt < Date.now() - 60000 || +scheduledAt > Date.now() + 30 * 86400000) throw problem(400, 'Choose a time within the next 30 days.');
  const media = post.mediaId ? await Media.findOne({ _id: post.mediaId, owner, ready: true }) : null;
  if (post.mediaId && !media) throw problem(400, 'This media is no longer available.');
  const accounts = await Connection.find({ _id: { $in: post.targets }, owner }).select('+credentials');
  if (accounts.length !== post.targets.length) throw problem(400, 'A selected account is no longer connected.');
  const deliveries = [];
  for (const account of accounts) {
    if (!available(account.platform)) throw problem(503, `${PROVIDERS[account.platform].name} publishing is being prepared.`);
    if (account.platform === 'tiktok' && req.body.scheduledAt) throw problem(400, 'Publish TikTok now so you can approve its latest audience settings. Schedule your other platforms separately.');
    validateContent(post, account, media, account.platform === 'tiktok' ? await creatorInfo(account) : null);
    deliveries.push({ connectionId: String(account._id), platform: account.platform, name: account.name, status: 'queued', nextAt: scheduledAt });
  }
  const result = await Post.findOneAndUpdate({ _id: key, owner, status: 'draft', updatedAt: post.updatedAt }, { $set: { status: req.body.scheduledAt ? 'scheduled' : 'queued', scheduledAt, deliveries } }, { new: true });
  if (!result) throw problem(409, 'This draft changed while being checked. Review it and try again.'); res.json(result);
}));
router.post('/posts/:id/cancel', wrap(async (req, res) => {
  const post = await Post.findOneAndUpdate({ _id: id(req.params.id), owner: req.creator.owner, status: { $in: ['queued', 'scheduled'] }, deliveries: { $not: { $elemMatch: { status: { $in: ['sending', 'processing', 'published'] } } } } }, { $set: { status: 'draft', deliveries: [], scheduledAt: null } }, { new: true });
  if (!post) throw problem(409, 'This post has started publishing and cannot be recalled.'); res.json(post);
}));
router.post('/posts/:id/retry/:deliveryId', wrap(async (req, res) => {
  if (req.body.checkedPlatform !== true) throw problem(400, 'First check that this post is not already on the platform.');
  const post = await Post.findOneAndUpdate({ _id: id(req.params.id), owner: req.creator.owner, deliveries: { $elemMatch: { _id: id(req.params.deliveryId), status: { $in: ['failed', 'attention'] } } } }, { $set: { status: 'queued', scheduledAt: new Date(), 'deliveries.$.status': 'queued', 'deliveries.$.nextAt': new Date(), 'deliveries.$.externalId': '', 'deliveries.$.stage': '', 'deliveries.$.message': '' } }, { new: true });
  if (!post) throw problem(409, 'This publication cannot be retried.'); res.json(post);
}));
router.delete('/posts/:id', wrap(async (req, res) => {
  const result = await Post.deleteOne({ _id: id(req.params.id), owner: req.creator.owner, status: 'draft' });
  if (!result.deletedCount) throw problem(409, 'Only drafts can be deleted.'); res.json({ ok: true });
}));
router.get('/live', wrap(async (req, res) => { const current = currentLive(req.creator.owner); res.json({ live: current ? liveSummary(current) : null }); }));
router.post('/live', wrap(async (req, res) => res.status(201).json(await createLive(req.creator.owner, req.body))));
router.post('/live/:id/stop', wrap(async (req, res) => { await stopLive(req.creator.owner, id(req.params.id)); res.json({ ok: true }); }));
router.use((error, _req, res, _next) => {
  if (res.headersSent) return;
  res.status(error.status && error.status >= 400 && error.status < 600 ? error.status : 500).json({ error: error.publicMessage || (error.type === 'entity.too.large' ? 'This upload part is too large.' : 'Studio could not complete this request. Please try again.') });
});
export default router;
