import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema({
  matchId: { type: String, unique: true },
  gameId: String,
  roomId: String,
  players: { type: [String], default: [] },
  status: { type: String, default: 'pending' },
  winner: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('OrchMatch', matchSchema);
