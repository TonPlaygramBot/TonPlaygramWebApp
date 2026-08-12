import mongoose from 'mongoose';

const chessMatchSchema = new mongoose.Schema({
  tableNumber: { type: String, required: true, unique: true },
  internalMatchId: { type: String, required: true, unique: true },
  roomId: { type: String, required: true, unique: true },
  player1TpcAccountId: { type: String, required: true },
  player2TpcAccountId: { type: String, required: true },
  stakePerPlayer: { type: Number, required: true },
  totalLockedStake: { type: Number, required: true },
  token: { type: String, default: 'TPG' },
  status: { type: String, enum: ['reserved', 'playing', 'cancelled', 'finished', 'draw', 'refunded'], default: 'reserved' },
  createdAt: { type: Date, default: Date.now },
  startedAt: Date,
  winnerTpcAccountId: String,
  result: String,
  stakeTransactionIds: { type: [String], required: true },
  releaseTransactionIds: { type: [String], default: [] }
});

chessMatchSchema.index({ player1TpcAccountId: 1, status: 1 });
chessMatchSchema.index({ player2TpcAccountId: 1, status: 1 });
export default mongoose.model('ChessMatch', chessMatchSchema);
