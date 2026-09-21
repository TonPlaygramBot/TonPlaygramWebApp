import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    // Browser endpoint hashes and Telegram account ids have disjoint prefixes.
    _id: String,
    accountId: { type: String, required: true },
    channel: { type: String, enum: ['telegram', 'browser'], required: true },
    enabled: { type: Boolean, default: false },
    telegramId: Number,
    subscription: { endpoint: String, keys: { p256dh: String, auth: String } },
    // A durable cursor also covers posts imported from Telegram. Edits and upload
    // retries do not send the same publication again; new opt-ins skip old posts.
    since: { type: Date, required: true },
    lastPostId: mongoose.Schema.Types.ObjectId,
    nextCheckAt: { type: Date, default: Date.now },
    lockedUntil: { type: Date, default: () => new Date(0) },
    failureCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);
schema.index({ enabled: 1, nextCheckAt: 1, lockedUntil: 1 });
schema.index({ accountId: 1, channel: 1 });
export default mongoose.model('WallSubscription', schema);
