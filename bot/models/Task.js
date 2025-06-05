import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true },
  taskId: { type: String, required: true },
  completedAt: { type: Date }
});

taskSchema.index({ telegramId: 1, taskId: 1 }, { unique: true });

export default mongoose.model('Task', taskSchema);
