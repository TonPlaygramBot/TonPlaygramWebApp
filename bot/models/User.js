import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const transactionSchema = new mongoose.Schema(
  {
    amount: Number,
    type: { type: String },
    token: { type: String, default: 'TPC' },
    status: { type: String, default: 'delivered' },
    date: { type: Date, default: Date.now },
    fromAccount: String,
    fromName: String,
    toAccount: String,
    toName: String,
    game: String,
    players: Number,
    detail: String,
    txHash: String
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({

  telegramId: { type: Number, unique: true },

  googleId: { type: String, unique: true },

  googleEmail: { type: String, default: '' },

  googleDob: { type: String, default: '' },

  walletAddress: { type: String, unique: true },

  accountId: { type: String, unique: true },

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

  friends: { type: [Number], default: [] },

  social: {

    twitter: String,

    telegram: String,

    discord: String

  },

  transactions: [transactionSchema],

  referralCode: { type: String, unique: true },

  referredBy: { type: String },

  bonusMiningRate: { type: Number, default: 0 },


  // Track which game table the user is currently seated at
  currentTableId: { type: String, default: null }

});

userSchema.pre('save', function(next) {
  if (!this.referralCode) {
    const base = this.telegramId || this.googleId || this.walletAddress || '';
    this.referralCode = String(base);
  }
  if (!this.accountId) {
    this.accountId = uuidv4();
  }
  next();
});

export default mongoose.model('User', userSchema);
