import mongoose from 'mongoose';

const airdropVideoClaimSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, index: true },
  videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'AirdropVideo', required: true },
  reward: { type: Number, required: true }
}, { timestamps: true });

airdropVideoClaimSchema.index({ telegramId: 1, videoId: 1 }, { unique: true });

export default mongoose.model('AirdropVideoClaim', airdropVideoClaimSchema);
