import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    followerAccountId: { type: String, required: true },
    authorAccountId: { type: String, required: true },
    notify: { type: Boolean, default: false },
    notifySince: { type: Date, default: Date.now }
  },
  { timestamps: true }
);
schema.index({ followerAccountId: 1, authorAccountId: 1 }, { unique: true });
schema.index({ authorAccountId: 1 });
export default mongoose.model('WallFollow', schema);
