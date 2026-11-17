import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import SocialReport from '../models/SocialReport.js';

const reasons = new Set(['harassment', 'spam', 'unsafe_content', 'impersonation', 'other']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const route = handler => async (req, res) => {
  try { await handler(req, res); } catch { res.status(503).json({ error: 'Reports are temporarily unavailable. Please try again.' }); }
};

// Mount only behind socialAuthenticate. Never trust compatibility identity headers.
export function createSocialReportsRouter({ users = User, reports = SocialReport, env = process.env } = {}) {
  const router = Router();
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!req.auth?.socialVerified || !req.socialUser?.accountId || req.socialUser.isBanned) {
      return res.status(401).json({ error: 'reauthentication_required' });
    }
    next();
  });
  router.post('/reports', rateLimit({ windowMs: 3600000, limit: 10, standardHeaders: true, legacyHeaders: false,
    keyGenerator: req => String(req.socialUser.accountId) }), route(async (req, res) => {
    const { targetAccountId, reason, requestId } = req.body || {};
    if (typeof targetAccountId !== 'string' || !targetAccountId || targetAccountId.length > 128 ||
        typeof reason !== 'string' || !reasons.has(reason) || typeof requestId !== 'string' || !uuid.test(requestId)) {
      return res.status(400).json({ error: 'invalid_report' });
    }
    const reporter = String(req.socialUser.accountId);
    if (targetAccountId === reporter) return res.status(400).json({ error: 'cannot_report_self' });
    const prior = await reports.findOne({ reporter, requestId }).lean();
    const respond = record => {
      if (record.target !== targetAccountId || record.reason !== reason) return res.status(409).json({ error: 'report_id_conflict' });
      return res.status(202).json({ reportId: String(record._id), status: 'received' });
    };
    if (prior) return respond(prior);
    // Canonical account IDs only, no Telegram/account namespace fallback.
    const peer = await users.findOne({ accountId: targetAccountId }).select('accountId').lean();
    if (!peer) return res.status(404).json({ error: 'player_not_found' });
    try {
      const saved = await reports.create({ reporter, target: targetAccountId, requestId, reason });
      return respond(saved);
    } catch (error) {
      if (error.code !== 11000) throw error;
      const winner = await reports.findOne({ reporter, requestId }).lean();
      if (!winner) throw error;
      return respond(winner);
    }
  }));
  // Explicit server-only allowlist, matched AFTER signed social authentication.
  const isModerator = req => String(env.SOCIAL_MODERATOR_ACCOUNT_IDS || '').split(',').map(value => value.trim()).filter(Boolean).includes(String(req.socialUser.accountId));
  router.get('/reports', route(async (req, res) => {
    if (!isModerator(req)) return res.status(403).json({ error: 'forbidden' });
    const rows = await reports.find({ status: 'pending' }).sort({ createdAt: 1, _id: 1 }).limit(100).lean();
    res.json(rows.map(row => ({ reportId: String(row._id), reporter: row.reporter, target: row.target,
      reason: row.reason, status: row.status, createdAt: row.createdAt })));
  }));
  router.patch('/reports/:reportId/reviewed', route(async (req, res) => {
    if (!isModerator(req)) return res.status(403).json({ error: 'forbidden' });
    if (!/^[a-f0-9]{24}$/i.test(req.params.reportId || '')) return res.status(400).json({ error: 'invalid_report_id' });
    const updated = await reports.findOneAndUpdate({ _id: req.params.reportId, status: 'pending' },
      { $set: { status: 'reviewed', reviewedAt: new Date(), reviewedBy: String(req.socialUser.accountId) } }, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'pending_report_not_found' });
    res.json({ reportId: String(updated._id), status: 'reviewed' });
  }));
  return router;
}
export default createSocialReportsRouter();
