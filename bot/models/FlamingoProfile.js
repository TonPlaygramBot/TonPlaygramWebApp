import mongoose from 'mongoose';

const flamingoProfileSchema = new mongoose.Schema({
  accountId: { type: String, required: true, unique: true, index: true },
  visible: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('FlamingoProfile', flamingoProfileSchema);
