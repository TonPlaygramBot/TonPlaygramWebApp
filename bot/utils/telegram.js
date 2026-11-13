import { withProxy } from './proxyAgent.js';

export async function fetchTelegramInfo(telegramId) {
  const base = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
  try {
    const infoResp = await fetch(
      `${base}/getChat?chat_id=${telegramId}`,
      withProxy()
    );
    const infoData = await infoResp.json();
    let photoUrl = '';

    // Prefer chat photo info returned from getChat if available
    if (infoData.ok && infoData.result?.photo) {
      const fileId = infoData.result.photo.big_file_id || infoData.result.photo.small_file_id;
      if (fileId) {
        const fileResp = await fetch(
          `${base}/getFile?file_id=${fileId}`,
          withProxy()
        );
        const fileData = await fileResp.json();
        if (fileData.ok) {
          photoUrl = `${base.replace('/bot', '/file/bot')}/${fileData.result.file_path}`;
        }
      }
    }

    // Fallback to getUserProfilePhotos if chat photo not available
    if (!photoUrl) {
      const photosResp = await fetch(
        `${base}/getUserProfilePhotos?user_id=${telegramId}&limit=1`,
        withProxy()
      );
      const photosData = await photosResp.json();
      if (photosData.ok && photosData.result.total_count > 0) {
        const fileId = photosData.result.photos[0][0].file_id;
        const fileResp = await fetch(
          `${base}/getFile?file_id=${fileId}`,
          withProxy()
        );
        const fileData = await fileResp.json();
        if (fileData.ok) {
          photoUrl = `${base.replace('/bot', '/file/bot')}/${fileData.result.file_path}`;
        }
      }
    }

    return {
      firstName: infoData.result?.first_name || '',
      lastName: infoData.result?.last_name || '',
      photoUrl,
    };
  } catch (err) {
    console.error('fetchTelegramInfo failed', err);
    return null;
  }
}
