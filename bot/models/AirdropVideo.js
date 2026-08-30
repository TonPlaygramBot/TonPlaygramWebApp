import mongoose from 'mongoose';

const airdropVideoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  videoUrl: { type: String, required: true, trim: true },
  thumbnailUrl: { type: String, default: '', trim: true },
  platform: { type: String, default: 'tiktok', trim: true },
  reward: { type: Number, default: 2500, min: 1 },
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('AirdropVideo', airdropVideoSchema);
