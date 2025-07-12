import mongoose from 'mongoose';

const postRecordSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true },
  tweetId: { type: String, required: true },
  postedAt: { type: Date, default: Date.now }
});

postRecordSchema.index({ telegramId: 1, postedAt: 1 });

export default mongoose.model('PostRecord', postRecordSchema);
