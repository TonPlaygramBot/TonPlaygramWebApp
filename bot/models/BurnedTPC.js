import mongoose from 'mongoose';

const burnedTPCSchema = new mongoose.Schema({
  txHash: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  verified: { type: Boolean, default: false },
  recipient: { type: String, required: true },
  claimedByAccountId: { type: String, default: '' },
  claimedAt: { type: Date, default: null }
});

export default mongoose.model('BurnedTPC', burnedTPCSchema);
