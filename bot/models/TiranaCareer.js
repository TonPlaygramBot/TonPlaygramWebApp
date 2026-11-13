import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    accountId: { type: String, required: true, unique: true },
    career: { type: mongoose.Schema.Types.Mixed, required: true },
    revision: { type: Number, default: 0 }
  },
  { timestamps: true }
);
export default mongoose.model('TiranaCareer', schema);
