import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  size: { type: Number, default: 0 },
  type: { type: String, default: 'application/octet-stream' },
  url: { type: String, required: true }
}, { _id: false });

const flamingoPostSchema = new mongoose.Schema({
  text: { type: String, default: '', maxlength: 1200 },
  author: { type: String, required: true, maxlength: 120 },
  source: { type: String, enum: ['community', 'telegram'], default: 'community' },
  // Community posts do not have an upstream id. Leaving this field absent is
  // important: the sparse unique index must only de-duplicate imported posts.
  sourceId: { type: String, default: undefined },
  ownerTokenHash: { type: String, default: undefined, select: false },
  attachment: { type: attachmentSchema, default: undefined },
  createdAt: { type: Date, default: Date.now }
});

flamingoPostSchema.index({ createdAt: -1 });
flamingoPostSchema.index(
  { source: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $type: 'string' } } }
);

export default mongoose.model('FlamingoPost', flamingoPostSchema);
