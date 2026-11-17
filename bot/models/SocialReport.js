import mongoose from 'mongoose';

const socialReportSchema = new mongoose.Schema({
  reporter: { type: String, required: true },
  target: { type: String, required: true },
  requestId: { type: String, required: true },
  reason: { type: String, enum: ['harassment', 'spam', 'unsafe_content', 'impersonation', 'other'], required: true },
  status: { type: String, enum: ['pending', 'reviewed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: String
});
// Lost responses and repeated taps must not create duplicate reports.
socialReportSchema.index({ reporter: 1, requestId: 1 }, { unique: true });
export default mongoose.model('SocialReport', socialReportSchema);
