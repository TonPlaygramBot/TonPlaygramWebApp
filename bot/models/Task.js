import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true },
  taskId: { type: String, required: true },
  completedAt: { type: Date },
  verificationMethod: { type: String, default: 'self_attested' },
  verificationStatus: { type: String, enum: ['verified', 'attested'], default: 'attested' }
});

taskSchema.index({ telegramId: 1, taskId: 1 }, { unique: true });

export default mongoose.model('Task', taskSchema);
