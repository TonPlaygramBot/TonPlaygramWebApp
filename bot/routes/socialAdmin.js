import { Router } from 'express';
import SocialPost from '../models/SocialPost.js';
import SocialAccount from '../models/SocialAccount.js';
import SocialAutomationRule from '../models/SocialAutomationRule.js';
import Task from '../models/Task.js';
import { SOCIAL_PLATFORMS, validateSocialContent } from '../services/socialProviders.js';
import { ensureDefaultRules } from '../services/socialAutomation.js';
import { queuePublication } from '../services/socialPublishing.js';

const router = Router();
router.use((req, res, next) => {
  const configuredId = process.env.DEV_ACCOUNT_ID;
  const ownerTelegramId = Number(process.env.OWNER_TELEGRAM_ID);
  const allowed = req.auth?.apiToken || (configuredId && req.auth?.accountId === configuredId) || (ownerTelegramId && req.auth?.telegramId === ownerTelegramId);
  if (!allowed) return res.status(403).json({ error: 'Developer access required' });
  next();
});

router.get('/overview', async (_req, res) => {
  await ensureDefaultRules();
  const [accounts, recent, scheduled, published, failed, tasks] = await Promise.all([SocialAccount.find().lean(), SocialPost.find().sort({ createdAt: -1 }).limit(5).lean(), SocialPost.countDocuments({ status: 'SCHEDULED' }), SocialPost.countDocuments({ status: 'PUBLISHED' }), SocialPost.countDocuments({ status: { $in: ['FAILED', 'PARTIALLY_FAILED'] } }), Task.countDocuments({ sourceType: 'SOCIAL_AUTOMATION' })]);
  res.json({ accounts, recent, stats: { scheduled, published, failed, tasks } });
});
router.get('/posts', async (_req, res) => res.json(await SocialPost.find().sort({ createdAt: -1 }).limit(100).lean()));
router.get('/posts/:id', async (req, res) => { const post = await SocialPost.findById(req.params.id).lean(); if (!post) return res.status(404).json({ error: 'Not found' }); const tasks = await Task.find({ socialPostId: post._id }).lean(); res.json({ ...post, tasks }); });
router.post('/validate', (req, res) => res.json(Object.fromEntries((req.body.platforms || []).map((platform) => [platform, validateSocialContent(platform, req.body)]))));
router.post('/posts', async (req, res) => {
  const platforms = [...new Set(req.body.platforms || [])].filter((item) => SOCIAL_PLATFORMS.includes(item));
  if (!platforms.length || !String(req.body.caption || '').trim()) return res.status(400).json({ error: 'Caption and at least one platform are required' });
  const validations = Object.fromEntries(platforms.map((platform) => [platform, validateSocialContent(platform, req.body)]));
  if (Object.values(validations).some((item) => !item.ready)) return res.status(422).json({ error: 'Provider validation failed', validations });
  const scheduledAt = req.body.scheduledAt ? new Date(req.body.scheduledAt) : null;
  const scheduled = scheduledAt && scheduledAt > new Date();
  const post = await SocialPost.create({ caption: req.body.caption.trim(), link: req.body.link, media: req.body.media || [], overrides: req.body.overrides || {}, createdBy: req.auth?.accountId || String(req.auth?.telegramId || 'api'), scheduledAt, status: scheduled ? 'SCHEDULED' : 'QUEUED', publications: platforms.map((platform) => ({ platform, caption: req.body.overrides?.[platform]?.caption || req.body.caption, status: scheduled ? 'SCHEDULED' : 'QUEUED' })) });
  if (!scheduled) post.publications.forEach((publication) => queuePublication(post._id, publication._id));
  res.status(202).json(post);
});
router.post('/posts/:postId/publications/:publicationId/retry', async (req, res) => { const post = await SocialPost.findById(req.params.postId); const publication = post?.publications.id(req.params.publicationId); if (!publication) return res.status(404).json({ error: 'Not found' }); if (publication.status !== 'FAILED') return res.status(409).json({ error: 'Only failed publications can be retried' }); publication.status = 'QUEUED'; await post.save(); queuePublication(post._id, publication._id); res.status(202).json(publication); });
router.get('/accounts', async (_req, res) => res.json(await SocialAccount.find().lean()));
router.get('/automations', async (_req, res) => { await ensureDefaultRules(); res.json(await SocialAutomationRule.find().sort({ createdAt: 1 }).lean()); });
router.post('/automations', async (req, res) => res.json(await SocialAutomationRule.create(req.body)));
router.patch('/automations/:id', async (req, res) => res.json(await SocialAutomationRule.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })));

export default router;
