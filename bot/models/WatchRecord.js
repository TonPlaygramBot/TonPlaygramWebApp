import mongoose from 'mongoose';

const watchSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true },
    videoId: { type: String, required: true },
    watchedAt: { type: Date, default: Date.now }
});

watchSchema.index({ telegramId: 1, videoId: 1 }, { unique: true });

export default mongoose.model('WatchRecord', watchSchema);

