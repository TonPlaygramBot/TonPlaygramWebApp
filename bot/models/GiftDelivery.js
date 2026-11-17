import mongoose from 'mongoose';

// Deliberately no TTL: deleting a receipt would let an old request charge again.
const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  fromAccount: { type: String, required: true },
  toAccount: { type: String, required: true },
  giftId: { type: String, required: true },
  requestId: { type: String, required: true },
  receipt: { type: mongoose.Schema.Types.Mixed, required: true },
  notification: {
    state: { type: String, enum: ['pending', 'attempting', 'sent', 'uncertain'] },
    telegramId: String, giftName: String, price: Number, senderName: String,
    claimedAt: Date, sentAt: Date, messageId: String
  },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
schema.index({ 'notification.state': 1, createdAt: 1 });
export default mongoose.model('GiftDelivery', schema);
