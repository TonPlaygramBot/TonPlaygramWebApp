import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  owner: { type: Number, required: true },
  author: { type: Number, required: true },
  text: { type: String, default: '' },
  photo: { type: String, default: '' },
  photoAlt: { type: String, default: '' },
  tags: { type: [String], default: [] },
  likes: { type: [Number], default: [] },
  reactions: {
    type: Map,
    of: [Number],
    default: () => ({})
  },
  comments: {
    type: [
      {
        author: Number,
        text: String,
        createdAt: { type: Date, default: Date.now }
      }
    ],
    default: []
  },
  sharedPost: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  pinned: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

postSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.model('Post', postSchema);
