import express from 'express';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';
import authenticate from '../middleware/auth.js';
import User from '../models/User.js';
import WallFollow from '../models/WallFollow.js';
import {
  resolveWallUser,
  wallDisplayName,
  publicWallAvatar
} from '../utils/wallIdentity.js';

const router = express.Router();
router.use(
  authenticate,
  rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false
  })
);
router.use(async (req, res, next) => {
  try {
    req.wallUser = await resolveWallUser(req);
    if (!req.wallUser?.accountId)
      return res
        .status(401)
        .json({ error: 'Sign in to follow people or edit your profile.' });
    res.setHeader('Cache-Control', 'no-store');
    next();
  } catch {
    res.status(503).json({ error: 'Your profile is temporarily unavailable.' });
  }
});
export async function prepareWallAvatar(photo) {
  if (
    typeof photo !== 'string' ||
    photo.length > 2_800_000 ||
    !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)
  )
    throw new Error('Choose a JPG, PNG or WebP photo up to 2 MB.');
  const buffer = Buffer.from(photo.split(',')[1], 'base64');
  if (buffer.length > 2 * 1024 ** 2)
    throw new Error('Choose a photo up to 2 MB.');
  const resized = await sharp(buffer, { limitInputPixels: 20_000_000 })
    .rotate()
    .resize(256, 256, { fit: 'cover' })
    .webp({ quality: 82 })
    .toBuffer();
  return `data:image/webp;base64,${resized.toString('base64')}`;
}
function socialIdentity(user) {
  return user?.telegramId ?? user?.accountId;
}
async function syncWallFriendship(follower, author, following) {
  const followerId = socialIdentity(follower);
  const authorId = socialIdentity(author);
  if (following) {
    await Promise.all([
      User.updateOne({ accountId: follower.accountId }, { $addToSet: { friends: authorId } }),
      User.updateOne({ accountId: author.accountId }, { $addToSet: { friends: followerId } })
    ]);
    return;
  }
  const reverseFollow = await WallFollow.exists({
    followerAccountId: author.accountId,
    authorAccountId: follower.accountId
  });
  if (!reverseFollow) await Promise.all([
    User.updateOne({ accountId: follower.accountId }, { $pull: { friends: authorId } }),
    User.updateOne({ accountId: author.accountId }, { $pull: { friends: followerId } })
  ]);
}
router.patch('/profile', express.json({ limit: '3mb' }), async (req, res) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (
      [...name].length < 2 ||
      [...name].length > 40 ||
      /[\u0000-\u001f\u007f]/.test(name)
    )
      return res
        .status(400)
        .json({ error: 'Use a profile name between 2 and 40 characters.' });
    const update = { nickname: name };
    if (req.body.photo !== undefined) {
      try {
        update.photo = await prepareWallAvatar(req.body.photo);
      } catch {
        return res
          .status(400)
          .json({ error: 'Choose a valid JPG, PNG or WebP photo up to 2 MB.' });
      }
      update.photoCustom = true;
    }
    const user = await User.findOneAndUpdate(
      { accountId: req.wallUser.accountId },
      { $set: update },
      { new: true }
    );
    res.json({
      accountId: user.accountId,
      author: wallDisplayName(user),
      authorAvatar: publicWallAvatar(user.photo, user.accountId)
    });
  } catch {
    res
      .status(503)
      .json({ error: 'Your profile could not be saved. Please retry.' });
  }
});
router.get('/following', async (req, res) => {
  try {
    const following = await WallFollow.find({
      followerAccountId: req.wallUser.accountId
    })
      .select('authorAccountId notify')
      .lean();
    res.json({ accountId: req.wallUser.accountId, following });
  } catch {
    res.status(503).json({ error: 'Following could not be loaded.' });
  }
});
router.put(
  '/following/:accountId',
  express.json({ limit: '1kb' }),
  async (req, res) => {
    try {
      const authorAccountId = String(req.params.accountId || '').trim();
      const { following, notify = false } = req.body || {};
      if (
        !authorAccountId ||
        authorAccountId.length > 120 ||
        typeof following !== 'boolean' ||
        typeof notify !== 'boolean'
      )
        return res.status(400).json({ error: 'Choose a follow option.' });
      if (authorAccountId === req.wallUser.accountId)
        return res.status(400).json({ error: 'This is your own profile.' });
      const author = await User.findOne({ accountId: authorAccountId })
        .select('accountId telegramId')
        .lean();
      if (!author)
        return res
          .status(404)
          .json({ error: 'This profile is no longer available.' });
      const key = {
        followerAccountId: req.wallUser.accountId,
        authorAccountId
      };
      if (!following) await WallFollow.deleteOne(key);
      else {
        const old = await WallFollow.findOne(key).lean();
        await WallFollow.updateOne(
          key,
          {
            $set: {
              notify,
              ...(notify && !old?.notify ? { notifySince: new Date() } : {})
            },
            $setOnInsert: key
          },
          { upsert: true }
        );
      }
      await syncWallFriendship(req.wallUser, author, following);
      res.json({ authorAccountId, following, notify: following && notify, friends: following });
    } catch {
      res.status(503).json({
        error: 'Your follow choice could not be saved. Please retry.'
      });
    }
  }
);
export default router;
