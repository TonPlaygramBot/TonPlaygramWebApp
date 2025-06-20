import mongoose from 'mongoose';

const friendRequestSchema = new mongoose.Schema({
  from: { type: Number, required: true },
  to: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
});

friendRequestSchema.index({ from: 1, to: 1 }, { unique: true });

export default mongoose.model('FriendRequest', friendRequestSchema);
