import mongoose from 'mongoose';

const walletPurchaseSchema = new mongoose.Schema({
  wallet: { type: String, required: true, unique: true },
  tpc: { type: Number, default: 0 },
  ton: { type: Number, default: 0 },
  last: { type: Date, default: Date.now }
});

walletPurchaseSchema.index({ wallet: 1 }, { unique: true });

export default mongoose.model('WalletPurchase', walletPurchaseSchema);

