import mongoose from 'mongoose';

const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, unique: true },
  playerId: String,
  gameId: String,
  roomId: String,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('OrchTicket', ticketSchema);
