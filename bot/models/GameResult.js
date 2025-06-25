import mongoose from 'mongoose';

const gameResultSchema = new mongoose.Schema({
  winner: { type: String, required: true },
  participants: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('GameResult', gameResultSchema);
