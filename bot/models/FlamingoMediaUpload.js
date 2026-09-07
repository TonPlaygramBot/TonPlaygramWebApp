import mongoose from 'mongoose';

// Only small upload manifests live in MongoDB. Video/photo bytes go directly
// from the user's device into the private object-storage bucket.
const schema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    ownerTokenHash: { type: String, required: true, select: false },
    details: { type: mongoose.Schema.Types.Mixed, required: true },
    key: { type: String, required: true },
    bucket: { type: String, required: true },
    multipartId: { type: String, required: true },
    chunkBytes: { type: Number, required: true },
    parts: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    postId: { type: mongoose.Schema.Types.ObjectId, default: undefined },
    expiresAt: { type: Date, default: undefined }
  },
  { timestamps: true, minimize: false }
);
schema.index({ updatedAt: 1 });
// Expire completed receipts only. Pending manifests remain until their
// multipart data is explicitly aborted by maintenance.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('FlamingoMediaUpload', schema);
