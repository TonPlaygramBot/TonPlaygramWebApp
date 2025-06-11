import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({

  telegramId: { type: Number, required: true, unique: true },

  createdAt: { type: Date, default: Date.now },

  isMining: { type: Boolean, default: false },

  isWatched: { type: Boolean, default: false },

  minedTPC: { type: Number, default: 0 },
 8e3t3h-codex/create-accounts-automatically-from-telegram-id

   0klz2t-codex/create-accounts-automatically-from-telegram-id
 main
  balance: { type: Number, default: 0 },
  nickname: { type: String, default: '' },
  photo: { type: String, default: '' },
  bio: { type: String, default: '' },
  social: {
 8e3t3h-codex/create-accounts-automatically-from-telegram-id
    twitter: { type: String, default: '' },
    telegram: { type: String, default: '' },
    discord: { type: String, default: '' },
    googleId: { type: String, default: '' }
    
    twitter: String,
    telegram: String,
    discord: String,
    googleId: String
 main
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
  8e3t3h-codex/create-accounts-automatically-from-telegram-id



  balance: { type: Number, default: 0 },

  nickname: { type: String, default: '' },

  photo: { type: String, default: '' },

  bio: { type: String, default: '' },

  social: {

    twitter: String,

    telegram: String,

    discord: String,

    googleId: String

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

  main

});

export default mongoose.model('User', userSchema);