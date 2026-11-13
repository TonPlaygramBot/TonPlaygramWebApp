import mongoose from 'mongoose';

// One immutable receipt per sender/idempotency key. The _id uniqueness is
// enforced by MongoDB even before secondary indexes have been provisioned.
const walletTransferSchema = new mongoose.Schema({
  _id: { type: String },
  operationId: { type: String, required: true, immutable: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  amount: { type: Number, required: true, immutable: true },
  note: { type: String, default: '', immutable: true },
  senderBalance: { type: Number, required: true, immutable: true },
  receiverBalance: { type: Number, required: true, immutable: true },
  senderTransaction: { type: mongoose.Schema.Types.Mixed, required: true, immutable: true },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });

export default mongoose.model('WalletTransfer', walletTransferSchema);
