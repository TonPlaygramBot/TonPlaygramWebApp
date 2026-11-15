import mongoose from 'mongoose';

const socialIdentityKeySchema = new mongoose.Schema({
  accountId: { type: String, required: true, unique: true },
  bundle: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('SocialIdentityKey', socialIdentityKeySchema);
