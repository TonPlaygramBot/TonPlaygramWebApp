import mongoose from 'mongoose';

const publicationSchema = new mongoose.Schema({
  platform: { type: String, required: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialAccount' },
  status: { type: String, enum: ['DRAFT', 'SCHEDULED', 'QUEUED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'], required: true },
  caption: String,
  externalId: String,
  publicationUrl: String,
  errorType: { type: String, enum: ['RETRYABLE_ERROR', 'PERMANENT_ERROR', 'AUTH_ERROR', 'VALIDATION_ERROR'] },
  errorMessage: String,
  attempts: { type: Number, default: 0 },
  publishedAt: Date
}, { timestamps: true });

const socialPostSchema = new mongoose.Schema({
  caption: { type: String, required: true },
  link: String,
  media: [{ url: String, mimeType: String, thumbnailUrl: String }],
  overrides: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: String, required: true },
  scheduledAt: Date,
  status: { type: String, enum: ['DRAFT', 'SCHEDULED', 'QUEUED', 'PUBLISHING', 'PUBLISHED', 'PARTIALLY_FAILED', 'FAILED', 'CANCELLED'], default: 'DRAFT' },
  publications: [publicationSchema]
}, { timestamps: true });

export default mongoose.model('SocialPost', socialPostSchema);
