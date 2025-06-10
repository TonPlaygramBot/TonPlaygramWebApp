import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  isMining: { type: Boolean, default: false },
  lastMineAt: { type: Date },
  minedTPC: { type: Number, default: 0 },
  balance: { type: Number, default: 0 }
});

export default mongoose.model('User', userSchema);
