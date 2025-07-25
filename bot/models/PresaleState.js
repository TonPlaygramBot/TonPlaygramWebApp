import mongoose from 'mongoose';

const presaleStateSchema = new mongoose.Schema({
  currentRound: { type: Number, default: 1 },
  tokensSold: { type: Number, default: 0 },
  currentPrice: { type: Number, default: 0.000004 }
});

export default mongoose.model('PresaleState', presaleStateSchema);
