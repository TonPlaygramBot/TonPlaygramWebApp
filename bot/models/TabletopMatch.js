import mongoose from 'mongoose';
import { TABLETOP_IDS } from '../../webapp/src/games/tabletop/shared/catalog.mjs';
// Separate collections keep the proven Royal transactional ledger scoped by game.
export const tabletopMatchModels = Object.fromEntries(
  TABLETOP_IDS.map((gameId) => {
    const schema = new mongoose.Schema({
      tableId: { type: String, required: true, unique: true },
      accounts: { type: [String], required: true },
      stake: { type: Number, required: true },
      token: { type: String, default: 'TPG', enum: ['TPG'] },
      status: {
        type: String,
        enum: ['playing', 'paid', 'refunded'],
        default: 'playing'
      },
      winnerAccountId: String,
      amount: Number,
      reason: String,
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, required: true },
      settledAt: Date
    });
    schema.index({ status: 1, expiresAt: 1 });
    schema.index({ accounts: 1, status: 1 });
    return [gameId, mongoose.model(`Tabletop_${gameId}`, schema)];
  })
);
