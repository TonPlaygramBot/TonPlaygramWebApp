import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    amount: Number,
    type: { type: String },
    status: { type: String, default: 'delivered' },
    date: { type: Date, default: Date.now }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({

  telegramId: { type: Number, required: true, unique: true },

  createdAt: { type: Date, default: Date.now },

  isMining: { type: Boolean, default: false },
  lastMineAt: { type: Date, default: null },

  isWatched: { type: Boolean, default: false },

  minedTPC: { type: Number, default: 0 },

  dailyStreak: { type: Number, default: 0 },
  lastCheckIn: { type: Date, default: null },

  balance: { type: Number, default: 0 },

  nickname: { type: String, default: '' },

  firstName: { type: String, default: '' },

  lastName: { type: String, default: '' },

  photo: { type: String, default: '' },

  bio: { type: String, default: '' },

  social: {

    twitter: String,

    telegram: String,

    discord: String

  },

  transactions: [transactionSchema],

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
