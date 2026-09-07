import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  tableId: { type: String, required: true, unique: true },
  accounts: { type: [String], required: true },
  stake: { type: Number, required: true },
  token: { type: String, default: 'TPG', enum: ['TPG'] },
  status: { type: String, enum: ['playing', 'paid', 'refunded'], default: 'playing' },
  winnerAccountId: String,
  amount: Number,
  reason: String,
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  settledAt: Date
});

schema.index({ status: 1, expiresAt: 1 });
schema.index({ accounts: 1, status: 1 });

export default mongoose.model('ArcheryMatch', schema);
