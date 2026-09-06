import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    accountId: { type: String, unique: true, required: true },
    career: { type: mongoose.Schema.Types.Mixed, required: true },
    active: String,
    lastMatch: String,
    revision: { type: Number, default: 0 }
  },
  { timestamps: true }
);
export default mongoose.model('TennisCareer', schema);
