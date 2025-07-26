import mongoose from 'mongoose';
import { INITIAL_PRICE } from '../config.js';

// Keep a single document that tracks presale progress. Using a fixed _id
// prevents multiple documents from being created on each server start and
// ensures the stats persist across deployments.
const presaleStateSchema = new mongoose.Schema({
  _id: { type: String, default: 'singleton' },
  currentRound: { type: Number, default: 1 },
  tokensSold: { type: Number, default: 0 },
  tonRaised: { type: Number, default: 0 },
  currentPrice: { type: Number, default: INITIAL_PRICE }
});

export default mongoose.model('PresaleState', presaleStateSchema);
