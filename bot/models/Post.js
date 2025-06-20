import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  owner: { type: Number, required: true },
  author: { type: Number, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

postSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.model('Post', postSchema);
