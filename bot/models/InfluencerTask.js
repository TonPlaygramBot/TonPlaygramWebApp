import mongoose from 'mongoose';

const influencerTaskSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  videoUrl: { type: String, required: true },
  platform: { type: String, enum: ['tiktok', 'youtube', 'instagram'], required: true },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending' },
  views: { type: Number, default: 0 },
  rewardTPC: { type: Number, default: 0 },
  verified: { type: Boolean, default: false }
});

export default mongoose.model('InfluencerTask', influencerTaskSchema);
