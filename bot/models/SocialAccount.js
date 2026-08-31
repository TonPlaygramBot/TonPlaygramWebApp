import mongoose from 'mongoose';

const socialAccountSchema = new mongoose.Schema({
  platform: { type: String, required: true, index: true },
  ownerId: { type: String, required: true, default: 'legacy', index: true },
  accountName: { type: String, required: true },
  status: { type: String, enum: ['CONNECTED', 'RECONNECT_REQUIRED', 'DISCONNECTED'], default: 'CONNECTED' },
  encryptedCredentials: { type: String, select: false },
  tokenExpiresAt: Date,
  lastSuccessfulUse: Date
}, { timestamps: true });

socialAccountSchema.index({ platform: 1, ownerId: 1 }, { unique: true });

export default mongoose.model('SocialAccount', socialAccountSchema);
