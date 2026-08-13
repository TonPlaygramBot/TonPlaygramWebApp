import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true },
  trigger: { type: String, required: true },
  platform: { type: String, default: 'any' },
  titleTemplate: { type: String, required: true },
  descriptionTemplate: { type: String, default: '' },
  dueAmount: { type: Number, default: 0 },
  dueUnit: { type: String, enum: ['minutes', 'hours', 'days'], default: 'hours' },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  assignee: { type: String, default: 'Admin' },
  enabled: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('SocialAutomationRule', schema);
