import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  playerId: { type: String, unique: true },
  name: String,
  rating: { type: Number, default: 0 }
});

export default mongoose.model('OrchPlayer', playerSchema);
