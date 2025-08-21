import mongoose from 'mongoose';

const cardSchema = new mongoose.Schema({ rank: String, suit: String }, { _id: false });

const playerSchema = new mongoose.Schema(
  {
    playerId: String,
    name: String,
    chips: Number,
    bet: Number,
    totalBet: Number,
    folded: Boolean,
    disconnected: { type: Boolean, default: false }
  },
  { _id: false }
);

const texasHoldemRoomSchema = new mongoose.Schema({
  roomId: { type: String, unique: true },
  capacity: { type: Number, default: 6 },
  status: { type: String, default: 'waiting' },
  dealer: { type: Number, default: 0 },
  currentPlayer: { type: Number, default: 0 },
  blinds: {
    small: { type: Number, default: 5 },
    big: { type: Number, default: 10 }
  },
  pot: { type: Number, default: 0 },
  deck: { type: [cardSchema], default: [] },
  community: { type: [cardSchema], default: [] },
  players: { type: [playerSchema], default: [] }
});

export default mongoose.model('TexasHoldemRoom', texasHoldemRoomSchema);
