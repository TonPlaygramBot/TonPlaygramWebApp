import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  from: { type: Number, required: true },
  to: { type: Number, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ from: 1, to: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema);
