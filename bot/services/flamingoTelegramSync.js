import path from 'path';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import FlamingoPost from '../models/FlamingoPost.js';
import { flamingoDatabaseStorageEnabled, saveFlamingoMediaToDatabase } from '../utils/flamingoStorage.js';
import { assertFlamingoDurability, flamingoUploadDirectory } from '../utils/flamingoDurability.js';
import { objectStorageEnabled, flamingoObjectStorage } from '../utils/flamingoObjectStorage.js';

// Use the same persistent location as the HTTP wall. Previously Telegram
// imports always wrote below the process working directory, so their database
// rows survived a deployment while their video bytes did not.
const uploadDirectory = flamingoUploadDirectory();

export function registerFlamingoTelegramSync(bot) {
  bot.on('channel_post', async (ctx, next) => {
    const post = ctx.channelPost;
    const expected = String(process.env.FLAMINGO_TELEGRAM_CHANNEL_ID || '').trim();
    if (!expected || !post || String(post.chat.id) !== expected) return next();
    try {
      const media = post.document || post.video || post.photo?.at(-1);
      let attachment;
      if (media?.file_id) {
        if (!objectStorageEnabled()) {
          await assertFlamingoDurability(uploadDirectory);
          await mkdir(uploadDirectory, { recursive: true });
        }
        const file = await ctx.telegram.getFile(media.file_id);
        const extension = path.extname(file.file_path || '') || (post.video ? '.mp4' : post.photo ? '.jpg' : '');
        const storedName = `telegram-${post.chat.id}-${post.message_id}${extension}`;
        const response = await fetch(`https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`);
        if (!response.ok || !response.body) throw new Error(`Telegram download failed: ${response.status}`);
        const contentType = media.mime_type || (post.video ? 'video/mp4' : post.photo ? 'image/jpeg' : 'application/octet-stream');
        let object;
        if (objectStorageEnabled()) {
          const store = flamingoObjectStorage();
          const key = `wall/telegram/${storedName}`;
          await store.put(key, Readable.fromWeb(response.body), contentType, media.file_size || undefined);
          const confirmed = await store.head(key);
          if (!confirmed || (media.file_size && confirmed.ContentLength !== media.file_size)) throw new Error('Telegram media upload was not confirmed.');
          object = { objectKey: key, objectBucket: store.bucket };
        } else {
          const diskPath = path.join(uploadDirectory, storedName);
          await pipeline(Readable.fromWeb(response.body), createWriteStream(diskPath));
          if (flamingoDatabaseStorageEnabled()) {
            await saveFlamingoMediaToDatabase(diskPath, storedName, {
              contentType,
              originalName: media.file_name || storedName,
              size: media.file_size || 0,
              telegramFileId: media.file_id
            });
          }
        }
        attachment = {
          name: media.file_name || storedName,
          size: media.file_size || 0,
          type: media.mime_type || (post.video ? 'video/mp4' : post.photo ? 'image/jpeg' : 'application/octet-stream'),
          url: `/api/flamingo-wall/files/${storedName}`,
          ...object
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
