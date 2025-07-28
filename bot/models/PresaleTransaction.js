import mongoose from 'mongoose';

const presaleTransactionSchema = new mongoose.Schema({
  txHash: { type: String, required: true, unique: true },
  wallet: { type: String, required: true },
  ton: { type: Number, required: true },
  tpc: { type: Number, required: true },
  timestamp: { type: Date, required: true },
  processed: { type: Boolean, default: false },
  accountId: { type: String, default: null }
});

presaleTransactionSchema.index({ txHash: 1 }, { unique: true });

export default mongoose.model('PresaleTransaction', presaleTransactionSchema);
