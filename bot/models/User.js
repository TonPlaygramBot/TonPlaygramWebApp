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
    category: String,
    txHash: String,
    giftId: String
  },
  { _id: false }
);

const giftSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuidv4 },
    gift: String,
    price: Number,
    tier: Number,
    fromAccount: String,
    fromName: String,
date: { type: Date, default: Date.now },

nftTokenId: String
  },
  { _id: false }
);

const userSchema = new mongoose.Schema({

  // Allow multiple users without a Telegram account. The sparse unique index
  // defined below ensures that only defined telegramId values must be unique,
  // while documents without one can coexist without triggering duplicate key
  // errors.
  telegramId: { type: Number },

  // Allow multiple users without a Google account. By omitting the field when
  // it isn't provided (default: undefined), the sparse unique index below will
  // ignore these documents instead of treating `null` values as duplicates.
  googleId: { type: String, default: undefined },

  googleEmail: { type: String, default: '' },

  username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },

  passwordHash: { type: String },

  walletAddress: { type: String, unique: true, sparse: true },
  walletPublicKey: { type: String },


  accountId: { type: String, unique: true },

  createdAt: { type: Date, default: Date.now },

  isMining: { type: Boolean, default: false },
  lastMineAt: { type: Date, default: null },

  isWatched: { type: Boolean, default: false },

  // Whether the account is banned from using the platform
  isBanned: { type: Boolean, default: false },

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

  gifts: { type: [giftSchema], default: [] },

  referralCode: { type: String, unique: true },

  referredBy: { type: String },

  bonusMiningRate: { type: Number, default: 0 },

  // Temporary mining bonus from store bundles
  storeMiningRate: { type: Number, default: 0 },
  storeMiningExpiresAt: { type: Date, default: null },

  // Timestamp of the last time the user opened their inbox
  inboxReadAt: { type: Date, default: Date.now },

  // Track which game table the user is currently seated at
  currentTableId: { type: String, default: null },

  // Persist Pool Royale unlocks server-side for cross-device sync
  poolRoyalInventory: { type: Object, default: undefined }

});

// Index commonly queried fields
userSchema.index({ nickname: 1 });
// Enforce uniqueness of telegramId only when the field exists
userSchema.index({ telegramId: 1 }, { unique: true, sparse: true });
// Enforce uniqueness of googleId only when the field exists
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
// Ensure walletAddress remains unique when present
userSchema.index({ walletAddress: 1 }, { unique: true, sparse: true });

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
