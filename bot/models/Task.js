import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  telegramId: { type: Number },
  taskId: { type: String, required: true },
  completedAt: { type: Date },
  verificationMethod: { type: String, default: 'self_attested' },
  verificationStatus: { type: String, enum: ['verified', 'attested'], default: 'attested' },
  title: String,
  description: String,
  status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'], default: 'OPEN' },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  dueAt: Date,
  assignee: String,
  sourceType: String,
  socialPostId: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialPost' },
  socialPublicationId: mongoose.Schema.Types.ObjectId,
  automationRuleId: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialAutomationRule' },
  idempotencyKey: { type: String, sparse: true, unique: true }
});

taskSchema.index({ telegramId: 1, taskId: 1 }, { unique: true });

export default mongoose.model('Task', taskSchema);
