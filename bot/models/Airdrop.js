import mongoose from 'mongoose';

const airdropSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true },
  amount: { type: Number, required: true },
  reason: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

airdropSchema.index({ telegramId: 1, createdAt: -1 });

export default mongoose.model('Airdrop', airdropSchema);
