import mongoose from 'mongoose';

const adViewSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true },
  viewedAt: { type: Date, default: Date.now }
});

adViewSchema.index({ telegramId: 1, viewedAt: 1 });

export default mongoose.model('AdView', adViewSchema);
