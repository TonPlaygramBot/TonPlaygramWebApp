import mongoose from 'mongoose';

const activeConnectionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  roomId: { type: String, default: null },
  socketId: { type: String, default: null },
  status: { type: String, default: 'online' },
  updatedAt: { type: Date, default: Date.now }
});

activeConnectionSchema.index({ userId: 1, roomId: 1 }, { unique: true });

export default mongoose.model('ActiveConnection', activeConnectionSchema);
