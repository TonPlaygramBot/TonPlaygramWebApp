import mongoose from 'mongoose';
const schema = new mongoose.Schema({ _id: String, value: { type: Number, default: 0 } });
export default mongoose.model('Sequence', schema);
