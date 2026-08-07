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
  sourceId: { type: String, default: '' },
  attachment: { type: attachmentSchema, default: undefined },
  createdAt: { type: Date, default: Date.now }
});

flamingoPostSchema.index({ createdAt: -1 });
flamingoPostSchema.index({ source: 1, sourceId: 1 }, { unique: true, sparse: true });

export default mongoose.model('FlamingoPost', flamingoPostSchema);
