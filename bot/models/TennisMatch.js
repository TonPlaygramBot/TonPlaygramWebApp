import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    tableId: { type: String, required: true, unique: true },
    accounts: { type: [String], required: true },
    stake: { type: Number, required: true },
    token: { type: String, enum: ['TPG'], default: 'TPG' },
    status: {
      type: String,
      enum: ['playing', 'finished', 'refunded'],
      default: 'playing'
    },
    winner: String,
    reason: String,
    expiresAt: { type: Date, required: true },
    settledAt: Date
  },
  { timestamps: true }
);
schema.index({ accounts: 1, status: 1 });
schema.index({ status: 1, expiresAt: 1 });
export default mongoose.model('TennisMatch', schema);
