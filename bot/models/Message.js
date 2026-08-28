import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // Social identities can be Telegram ids (numbers) or account ids used by
  // browser/Google accounts (strings).
  from: { type: mongoose.Schema.Types.Mixed, required: true },
  to: { type: mongoose.Schema.Types.Mixed, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ from: 1, to: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema);
