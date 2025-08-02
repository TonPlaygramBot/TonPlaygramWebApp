import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mistakenRecipient = '5317811b-c1ae-4033-bac9-ccbd693881ac';
const devWallet = '5ffe7c43-c0ae-48f6-ab8c-9e065ca95466';
const amount = 255000;

const walletSchema = new mongoose.Schema({
  walletId: { type: String, required: true, unique: true },
  balance: { type: Number, required: true, default: 0 }
});

const transactionSchema = new mongoose.Schema({
  from: String,
  to: String,
  amount: Number,
  type: String,
  reason: String,
  timestamp: Date
});

const Wallet = mongoose.model('Wallet', walletSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

async function reverseMistakenTPC() {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const recipient = await Wallet.findOne({ walletId: mistakenRecipient }).session(session);
    if (!recipient) {
      throw new Error('Refund failed: wallet not found');
    }

    const amountToReverse = Math.min(recipient.balance, amount);
    if (amountToReverse <= 0) {
      throw new Error('Refund failed: no funds available');
    }

    recipient.balance -= amountToReverse;
    await recipient.save({ session });

    await Wallet.findOneAndUpdate(
      { walletId: devWallet },
      { $inc: { balance: amountToReverse } },
      { upsert: true, session }
    );

    await Transaction.create([
      {
        from: mistakenRecipient,
        to: devWallet,
        amount: amountToReverse,
        type: 'REVERSAL',
        reason: 'Mistaken TPC transfer refund',
        timestamp: new Date()
      }
    ], { session });

    if (amountToReverse < amount) {
      console.warn(`Partial reversal: only refunded ${amountToReverse} TPC`);
    }

    await session.commitTransaction();
    console.log('Reversal completed successfully');
  } catch (err) {
    await session.abortTransaction();
    console.error('Reversal failed:', err.message);
  } finally {
    session.endSession();
  }
}

const uri = process.env.MONGODB_URI;
if (!uri || uri === 'memory') {
  console.error('MONGODB_URI must be set to a MongoDB instance');
  process.exit(1);
}

await mongoose.connect(uri);
await reverseMistakenTPC();
await mongoose.disconnect();

