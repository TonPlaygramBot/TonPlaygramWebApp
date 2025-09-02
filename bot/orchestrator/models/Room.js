import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true },
  gameId: String,
  players: { type: [String], default: [] },
  status: { type: String, default: 'waiting' }
});

export default mongoose.model('OrchRoom', roomSchema);
