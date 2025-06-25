import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema(
  {
    playerId: String,
    name: String,
    position: { type: Number, default: 0 },
    isActive: { type: Boolean, default: false },
    disconnected: { type: Boolean, default: false },
    sixStreak: { type: Number, default: 0 }
  },
  { _id: false }
);

const gameRoomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true },
  capacity: { type: Number, default: 4 },
  status: { type: String, default: 'waiting' },
  currentTurn: { type: Number, default: 0 },
  snakes: { type: Map, of: Number, default: {} },
  ladders: { type: Map, of: Number, default: {} },
  players: { type: [playerSchema], default: [] }
});

export default mongoose.model('GameRoom', gameRoomSchema);
