import mongoose from 'mongoose';

// Deliberately no TTL: deleting a receipt would let an old request charge again.
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  fromAccount: { type: String, required: true },
  toAccount: { type: String, required: true },
  giftId: { type: String, required: true },
  requestId: { type: String, required: true },
  receipt: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
export default mongoose.model('GiftDelivery', schema);
