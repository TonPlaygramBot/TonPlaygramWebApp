import mongoose from 'mongoose';
import { INITIAL_PRICE } from '../config.js';

const presaleStateSchema = new mongoose.Schema({
  currentRound: { type: Number, default: 1 },
  tokensSold: { type: Number, default: 0 },
  currentPrice: { type: Number, default: INITIAL_PRICE }
});

export default mongoose.model('PresaleState', presaleStateSchema);
