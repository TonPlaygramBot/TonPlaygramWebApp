import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  isMining: { type: Boolean, default: false },
  lastMineAt: { type: Date },
  minedTPC: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  nickname: { type: String, default: '' },
  photo: { type: String, default: '' },
  bio: { type: String, default: '' },
  social: {
    twitter: { type: String, default: '' },
    telegram: { type: String, default: '' },
    discord: { type: String, default: '' },
    googleId: { type: String, default: '' }
  },
  transactions: [
    {
      amount: Number,
      type: String,
      date: { type: Date, default: Date.now }
    }
  ],
  referralCode: { type: String, unique: true },
  referredBy: { type: String }
});

userSchema.pre('save', function(next) {
  if (!this.referralCode) {
    this.referralCode = this.telegramId.toString();
  }
  next();
});

export default mongoose.model('User', userSchema);
