import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', userSchema);
