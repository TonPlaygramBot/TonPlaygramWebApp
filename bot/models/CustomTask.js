import mongoose from 'mongoose';

const customTaskSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['tiktok', 'x', 'telegram', 'discord', 'youtube', 'facebook', 'instagram'],
    required: true
  },
  reward: { type: Number, required: true },
  link: { type: String, required: true },
  description: { type: String },
  section: {
    type: String,
    enum: ['tasks', 'mining'],
    default: 'tasks'
  },
  videoProvider: {
    type: String,
    enum: ['youtube', 'tiktok', null],
    default: null
  },
  videoDurationSec: { type: Number, default: 0 }
});

export default mongoose.model('CustomTask', customTaskSchema);
