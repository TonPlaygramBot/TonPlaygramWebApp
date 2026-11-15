import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import { rm } from 'node:fs/promises';
import User from '../models/User.js';
import Message from '../models/Message.js';
import SocialIdentityKey from '../models/SocialIdentityKey.js';
import {
  activeMessageFilter, areMutualFriends, conversationFilter, identityAliases,
  isParticipant, serializeMessage, socialError, validateEnvelope, validateKeyBundle
} from '../services/secureMessages.js';
import { stableStringify } from '../../shared/secureMessagingProtocol.js';

const uploadDirectory = path.resolve('data/social-message-uploads');
const filePrefix = '/api/social/message-files/';
const MAX_MESSAGE_PAGE_BYTES = 6 * 1024 * 1024;
const asyncRoute = (handler) => async (req, res) => {
  try { await handler(req, res); } catch (error) {
    if (res.headersSent) return;
    res.status(error.status || 500).json({
      code: error.code && typeof error.code === 'string' ? error.code : 'social_request_failed',
      error: error.status ? error.message : 'Could not complete this request. Please try again.'
    });
  }
};

function identity(value) {
  if (!['string', 'number'].includes(typeof value) || !String(value).trim() || String(value).length > 128) {
    throw socialError(400, 'invalid_identity');
  }
  return String(value);
}

function assertSelf(req, supplied) {
  if (supplied != null && !identityAliases(req.socialUser).some((id) => String(id) === identity(supplied))) {
    throw socialError(403, 'forbidden');
  }
}

function objectId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) throw socialError(400, 'invalid_message_id');
  return new mongoose.Types.ObjectId(value);
}

function attachmentName(message) {
  let attachment = message.attachment;
  if (typeof attachment === 'string') {
    try { attachment = JSON.parse(attachment); } catch { return null; }
  }
  const url = attachment?.url;
  if (typeof url !== 'string' || !url.startsWith(filePrefix)) return null;
  const name = url.slice(filePrefix.length);
  return /^[A-Za-z0-9._-]{1,220}$/.test(name) && path.basename(name) === name ? name : null;
}

// Dependency injection keeps authorization and database filtering testable
// without starting the bot, Telegram webhook or multiplayer server.
export function createSocialMessagesRouter({ users = User, messages = Message, keys = SocialIdentityKey } = {}) {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  // The application's compatibility limiter accepts older identity headers.
  // Private writes additionally use only the account verified by socialAuth.
  const privateWriteLimit = (limit, windowMs) => rateLimit({
    windowMs, limit, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => String(req.socialUser.accountId),
    handler: (_req, res) => res.status(429).json({ code: 'social_rate_limited', error: 'Please wait a moment before trying again.' })
  });
  router.use('/send-message', privateWriteLimit(60, 60000));
  router.use('/keys', privateWriteLimit(120, 60000));

  async function findUser(raw) {
    const value = identity(raw);
    const numeric = /^\d+$/.test(value) ? Number(value) : NaN;
    return users.findOne({ $or: [{ accountId: value },
      ...(Number.isSafeInteger(numeric) ? [{ telegramId: numeric }] : [])] }).lean();
  }

  function emit(req, accounts, event, payload) {
    req.app.get('emitSocialEvent')?.([...new Set(accounts.filter(Boolean).map(String))], event, payload);
  }

  router.put('/keys', asyncRoute(async (req, res) => {
    const accountId = req.socialUser.accountId;
    const bundle = await validateKeyBundle(req.body?.bundle);
    const existing = await keys.findOne({ accountId }).lean();
    if (existing?.bundle.fingerprint === bundle.fingerprint) return res.json({ accountId, bundle: existing.bundle });
    if (existing) {
      if (req.body.expectedFingerprint !== existing.bundle.fingerprint) {
        throw socialError(409, 'key_reset_required', 'This account already has an encryption key. Explicitly reset it to use this device.');
      }
      const updated = await keys.findOneAndUpdate({ accountId, 'bundle.fingerprint': req.body.expectedFingerprint },
        { $set: { bundle, updatedAt: new Date() } }, { new: true }).lean();
      if (!updated) throw socialError(409, 'key_changed');
      return res.json({ accountId, bundle: updated.bundle });
    }
    try { await keys.create({ accountId, bundle }); } catch (error) {
      if (error.code === 11000) {
        const winner = await keys.findOne({ accountId }).lean();
        if (winner?.bundle.fingerprint === bundle.fingerprint) return res.json({ accountId, bundle: winner.bundle });
        throw socialError(409, 'key_changed');
      }
      throw error;
    }
    res.status(201).json({ accountId, bundle });
  }));

  router.post('/keys/lookup', asyncRoute(async (req, res) => {
    const peer = await findUser(req.body?.peerId);
    if (!peer || peer.isBanned) throw socialError(404, 'player_not_found');
    if (peer.accountId !== req.socialUser.accountId && !areMutualFriends(req.socialUser, peer)) {
      throw socialError(403, 'friends_required', 'Only friends can open a private conversation.');
    }
    const record = await keys.findOne({ accountId: peer.accountId }).lean();
    res.json({ accountId: peer.accountId, bundle: record?.bundle || null });
  }));

  router.post('/send-message', asyncRoute(async (req, res) => {
    const envelope = req.body?.envelope;
    if (!envelope || req.body.text != null || req.body.attachment != null) {
      throw socialError(426, 'encryption_required', 'Update the app to send encrypted messages.');
    }
    if (envelope.from !== req.socialUser.accountId) throw socialError(403, 'forbidden');
    const peer = await findUser(envelope.to);
    if (!peer || peer.isBanned) throw socialError(404, 'player_not_found');
    if (!areMutualFriends(req.socialUser, peer)) throw socialError(403, 'friends_required');
    // A retry must never change a previous ciphertext or resurrect deleted data.
    if (typeof envelope.messageId !== 'string') throw socialError(400, 'invalid_envelope');
    const prior = await messages.findOne({ from: req.socialUser.accountId, clientMessageId: envelope.messageId }).lean();
    if (prior) {
      if (prior.deletedAt || prior.deletedFor?.includes(req.socialUser.accountId) ||
          prior.expiresAt && prior.expiresAt <= new Date()) throw socialError(410, 'message_deleted');
      if (stableStringify(prior.envelope) !== stableStringify(envelope)) throw socialError(409, 'message_id_conflict');
      return res.json(serializeMessage(prior));
    }
    const [senderKey, recipientKey] = await Promise.all([
      keys.findOne({ accountId: req.socialUser.accountId }).lean(),
      keys.findOne({ accountId: peer.accountId }).lean()
    ]);
    const lifetime = await validateEnvelope(envelope, {
      sender: req.socialUser.accountId, recipient: peer.accountId,
      senderBundle: senderKey?.bundle, recipientBundle: recipientKey?.bundle
    });
    let message;
    try {
      message = await messages.create({ from: req.socialUser.accountId, to: peer.accountId,
        clientMessageId: envelope.messageId, envelope, ...lifetime });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const duplicate = await messages.findOne({ from: req.socialUser.accountId, clientMessageId: envelope.messageId }).lean();
      if (!duplicate || duplicate.deletedAt || duplicate.deletedFor?.includes(req.socialUser.accountId) ||
          duplicate.expiresAt && duplicate.expiresAt <= new Date()) throw socialError(410, 'message_deleted');
      if (stableStringify(duplicate.envelope) !== stableStringify(envelope)) throw socialError(409, 'message_id_conflict');
      return res.json(serializeMessage(duplicate));
    }
    const output = serializeMessage(message);
    emit(req, [req.socialUser.accountId, peer.accountId], 'privateMessage', output);
    // No plaintext previews, ciphertext or attachment names leave via Telegram,
    // push payloads, analytics or server logs.
    res.status(201).json(output);
  }));

  router.post('/send-message-attachment', (_req, res) => {
    res.status(426).json({ code: 'encryption_required', error: 'Update the app to send encrypted attachments.' });
  });

  router.post('/messages', asyncRoute(async (req, res) => {
    assertSelf(req, req.body?.telegramId);
    res.setHeader('Access-Control-Expose-Headers', 'X-Social-Has-More, X-Social-Next-Cursor');
    res.setHeader('X-Social-Has-More', 'false');
    res.setHeader('X-Social-Next-Cursor', '');
    const peer = await findUser(req.body?.withId);
    if (!peer) return res.json([]);
    const filters = [conversationFilter(req.socialUser, peer), activeMessageFilter(req.socialUser.accountId)];
    if (req.body.before) filters.push({ _id: { $lt: objectId(req.body.before) } });
    const limit = req.body.limit == null ? 10 : Number(req.body.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw socialError(400, 'invalid_limit');
    // Encrypted attachments live inside envelopes. A count-only limit could
    // otherwise return hundreds of megabytes to a phone or allocate it on the
    // server before limiting the response. Fetch one row at a time and cap the
    // serialized page; the first omitted row remains available at the cursor.
    const cursor = messages.find({ $and: filters }).sort({ _id: -1 }).limit(limit + 1).cursor({ batchSize: 1 });
    const rows = [];
    let byteLength = 2; // JSON array brackets.
    let hasMore = false;
    try {
      for await (const row of cursor) {
        const output = serializeMessage(row);
        const size = Buffer.byteLength(JSON.stringify(output)) + (rows.length ? 1 : 0);
        if (rows.length >= limit || byteLength + size > MAX_MESSAGE_PAGE_BYTES) {
          // A validated envelope is <4MiB. A larger legacy/corrupt record must
          // fail visibly rather than cause an endless empty next page.
          if (!rows.length) throw socialError(413, 'message_too_large', 'An older message is too large to load safely.');
          hasMore = true;
          break;
        }
        byteLength += size;
        rows.push(output);
      }
    } finally {
      await cursor.close();
    }
    res.setHeader('X-Social-Has-More', String(hasMore));
    res.setHeader('X-Social-Next-Cursor', rows.length ? String(rows[rows.length - 1]._id) : '');
    res.json(rows.reverse());
  }));

  router.post('/messages/:id/delete', asyncRoute(async (req, res) => {
    const scope = req.body?.scope;
    if (!['me', 'everyone'].includes(scope)) throw socialError(400, 'invalid_delete_scope');
    const filter = { $and: [{ _id: objectId(req.params.id) }, activeMessageFilter(req.socialUser.accountId),
      { $or: [{ from: { $in: identityAliases(req.socialUser) } }, { to: { $in: identityAliases(req.socialUser) } }] }] };
    const current = await messages.findOne(filter).lean();
    if (!current || !isParticipant(current, req.socialUser)) throw socialError(404, 'message_not_found');
    if (scope === 'everyone' && !identityAliases(req.socialUser).some((id) => String(id) === String(current.from))) {
      throw socialError(403, 'sender_only', 'You can delete only your own messages for everyone.');
    }
    if (scope === 'me') {
      await messages.updateOne(filter, { $addToSet: { deletedFor: req.socialUser.accountId } });
    } else {
      // Retain a short content-free replay tombstone. The ciphertext, text and
      // attachment descriptor are erased immediately; Mongo TTL removes the ID.
      // A concurrent "delete for me" on another device must not turn this
      // already-authorized destruction into a successful-looking no-op.
      await messages.updateOne({ _id: current._id, from: { $in: identityAliases(req.socialUser) } },
        { $unset: { envelope: '', text: '', attachment: '' },
        $set: { deletedAt: new Date(), expiresAt: new Date(Date.now() + 24 * 3600 * 1000) } });
      const filename = attachmentName(current);
      if (filename) await rm(path.join(uploadDirectory, filename), { force: true });
    }
    const peerIdentity = identityAliases(req.socialUser).some((id) => String(id) === String(current.from)) ? current.to : current.from;
    const peer = scope === 'everyone' ? await findUser(peerIdentity) : null;
    emit(req, [req.socialUser.accountId, peer?.accountId], 'privateMessage:deleted',
      { id: String(current._id), from: current.from, to: current.to, scope });
    res.json({ success: true, id: String(current._id), scope });
  }));

  router.post('/conversation/clear', asyncRoute(async (req, res) => {
    if (req.body?.scope && req.body.scope !== 'me') throw socialError(400, 'invalid_delete_scope');
    const peer = await findUser(req.body?.withId);
    if (!peer) throw socialError(404, 'player_not_found');
    const cutoffAt = new Date();
    await messages.updateMany({ $and: [conversationFilter(req.socialUser, peer),
      { createdAt: { $lte: cutoffAt } }, activeMessageFilter(req.socialUser.accountId)] },
    { $addToSet: { deletedFor: req.socialUser.accountId } });
    const cleared = { withId: peer.accountId, cutoffAt: cutoffAt.toISOString() };
    emit(req, [req.socialUser.accountId], 'privateMessage:cleared', cleared);
    res.json({ success: true, ...cleared });
  }));

  router.get('/message-files/:name', asyncRoute(async (req, res) => {
    const name = req.params.name;
    if (!/^[A-Za-z0-9._-]{1,220}$/.test(name) || path.basename(name) !== name) throw socialError(404, 'file_not_found');
    const url = `${filePrefix}${name}`;
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rows = await messages.find({ $and: [activeMessageFilter(req.socialUser.accountId),
      { $or: [{ from: { $in: identityAliases(req.socialUser) } }, { to: { $in: identityAliases(req.socialUser) } }] },
      { $or: [{ 'attachment.url': url }, { attachment: { $regex: escaped } }] }] }).limit(5).lean();
    if (!rows.some((row) => isParticipant(row, req.socialUser) && attachmentName(row) === name)) throw socialError(404, 'file_not_found');
    res.setHeader('Content-Disposition', 'attachment');
    res.sendFile(path.join(uploadDirectory, name), (error) => {
      if (error && !res.headersSent) res.status(404).end();
    });
  }));

  router.post('/unread-count', asyncRoute(async (req, res) => {
    assertSelf(req, req.body?.telegramId);
    const self = await findUser(req.socialUser.accountId);
    const count = await messages.countDocuments({ $and: [
      activeMessageFilter(req.socialUser.accountId), { to: { $in: identityAliases(req.socialUser) },
        createdAt: { $gt: self?.inboxReadAt || new Date(0) } }
    ] });
    res.json({ count });
  }));

  router.post('/mark-read', asyncRoute(async (req, res) => {
    assertSelf(req, req.body?.telegramId);
    await users.updateOne({ accountId: req.socialUser.accountId }, { $set: { inboxReadAt: new Date() } });
    res.json({ success: true });
  }));
  return router;
}

export default createSocialMessagesRouter();
