import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  size: { type: Number, default: 0 },
  type: { type: String, default: 'application/octet-stream' },
  url: { type: String, required: true },
  duration: { type: Number, default: 0 },
  premium: { type: Boolean, default: false },
  priceTpg: { type: Number, min: 0, max: 1000000, default: 0 }
}, { _id: false });

const pollSchema = new mongoose.Schema({
  question: { type: String, required: true, maxlength: 300 },
  options: [{ type: String, maxlength: 160 }],
  votes: [{ type: Number, min: 0, default: 0 }]
}, { _id: false });

const flamingoPostSchema = new mongoose.Schema({
  text: { type: String, default: '', maxlength: 8000 },
  title: { type: String, default: undefined, maxlength: 120 },
  poll: { type: pollSchema, default: undefined },
  author: { type: String, required: true, maxlength: 120 },
  authorAvatar: { type: String, default: '' },
  authorAccountId: { type: String, default: '' },
  source: { type: String, enum: ['community', 'telegram'], default: 'community' },
  // Community posts do not have an upstream id. Leaving this field absent is
  // important: the sparse unique index must only de-duplicate imported posts.
  sourceId: { type: String, default: undefined },
  ownerTokenHash: { type: String, default: undefined, select: false },
  attachment: { type: attachmentSchema, default: undefined },
  attachments: { type: [attachmentSchema], default: undefined },
  albumId: { type: String, default: undefined, select: false },
  createdAt: { type: Date, default: Date.now }
});

flamingoPostSchema.index({ createdAt: -1 });
flamingoPostSchema.index(
  { source: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $type: 'string' } } }
);

export default mongoose.model('FlamingoPost', flamingoPostSchema);
