import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // Social identities can be Telegram ids (numbers) or account ids used by
  // browser/Google accounts (strings).
  from: { type: mongoose.Schema.Types.Mixed, required: true },
  to: { type: mongoose.Schema.Types.Mixed, required: true },
  // Legacy content is readable by its participants, but new HTTP writes only
  // accept a verified encrypted envelope. Never put a decrypted preview here.
  text: { type: String, required() { return !this.envelope && !this.deletedAt; } },
  envelope: { type: mongoose.Schema.Types.Mixed, default: undefined },
  clientMessageId: { type: String, default: undefined },
  expiresAt: { type: Date, default: undefined },
  deletedAt: { type: Date, default: undefined },
  deletedFor: { type: [String], default: [] },
  // Keep the complete upload descriptor as one value. Declaring this as Mixed
  // is intentional: attachment metadata is an object and must never be passed
  // through Mongoose's String caster when the descriptor evolves.
  attachment: { type: mongoose.Schema.Types.Mixed, default: undefined },
  createdAt: { type: Date, default: Date.now }
});

messageSchema.index({ from: 1, to: 1, createdAt: 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
messageSchema.index({ from: 1, clientMessageId: 1 }, {
  unique: true,
  partialFilterExpression: { clientMessageId: { $type: 'string' } }
});

export default mongoose.model('Message', messageSchema);
