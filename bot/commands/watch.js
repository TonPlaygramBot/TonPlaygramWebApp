import { VIDEOS } from '../utils/watchData.js';
import WatchRecord from '../models/WatchRecord.js';

export default function registerWatch(bot) {
    bot.command('watch', async (ctx) => {
        const telegramId = ctx.from.id;
        const records = await WatchRecord.find({ telegramId });
        let msg = 'Watch videos to earn TPC:\n';
        for (const v of VIDEOS) {
            const done = records.some(r => r.videoId === v.id);
            msg += `- ${v.title} (${v.reward} TPC) - `;
            msg += done ? '✅' : `[Watch](${v.url})`;
            msg += '\n';
        }
        ctx.replyWithMarkdown(msg);
    });
}

