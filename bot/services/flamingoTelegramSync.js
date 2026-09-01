import path from 'path';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import FlamingoPost from '../models/FlamingoPost.js';
import { saveFlamingoMediaToDatabase } from '../utils/flamingoStorage.js';

// Use the same persistent location as the HTTP wall. Previously Telegram
// imports always wrote below the process working directory, so their database
// rows survived a deployment while their video bytes did not.
const uploadDirectory = path.resolve(process.env.FLAMINGO_UPLOAD_DIR || 'data/flamingo-uploads');

export function registerFlamingoTelegramSync(bot) {
  bot.on('channel_post', async (ctx, next) => {
    const post = ctx.channelPost;
    const expected = String(process.env.FLAMINGO_TELEGRAM_CHANNEL_ID || '').trim();
    if (!expected || !post || String(post.chat.id) !== expected) return next();
    try {
      const media = post.document || post.video || post.photo?.at(-1);
      let attachment;
      if (media?.file_id) {
        await mkdir(uploadDirectory, { recursive: true });
        const file = await ctx.telegram.getFile(media.file_id);
        const extension = path.extname(file.file_path || '') || (post.video ? '.mp4' : post.photo ? '.jpg' : '');
        const storedName = `telegram-${post.chat.id}-${post.message_id}${extension}`;
        const response = await fetch(`https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`);
        if (!response.ok || !response.body) throw new Error(`Telegram download failed: ${response.status}`);
        const diskPath = path.join(uploadDirectory, storedName);
        await pipeline(Readable.fromWeb(response.body), createWriteStream(diskPath));
        // Keep a durable database copy as well as the fast disk copy. This is
        // the same storage contract used by uploads made inside the web app.
        await saveFlamingoMediaToDatabase(diskPath, storedName, {
          contentType: media.mime_type || (post.video ? 'video/mp4' : post.photo ? 'image/jpeg' : 'application/octet-stream'),
          originalName: media.file_name || storedName,
          size: media.file_size || 0,
          telegramFileId: media.file_id
        });
        attachment = {
          name: media.file_name || storedName,
          size: media.file_size || 0,
          type: media.mime_type || (post.video ? 'video/mp4' : post.photo ? 'image/jpeg' : 'application/octet-stream'),
          url: `/api/flamingo-wall/files/${storedName}`
        };
      }
      await FlamingoPost.findOneAndUpdate(
        { source: 'telegram', sourceId: String(post.message_id) },
        { text: post.text || post.caption || '', author: post.author_signature || post.chat.title || 'TonPlayGram Community Wall • Telegram', source: 'telegram', sourceId: String(post.message_id), attachment, createdAt: new Date(post.date * 1000) },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      console.error('Flamingo Telegram sync failed:', err.message);
    }
    return next();
  });
}
