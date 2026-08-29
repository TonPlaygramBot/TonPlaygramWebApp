import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // Social identities can be Telegram ids (numbers) or account ids used by
  // browser/Google accounts (strings).
  from: { type: mongoose.Schema.Types.Mixed, required: true },
  to: { type: mongoose.Schema.Types.Mixed, required: true },
  text: { type: String, required: true },
  // Keep the complete upload descriptor as one value. Declaring this as Mixed
  // is intentional: attachment metadata is an object and must never be passed
  // through Mongoose's String caster when the descriptor evolves.
  attachment: { type: mongoose.Schema.Types.Mixed, default: undefined },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ from: 1, to: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema);
