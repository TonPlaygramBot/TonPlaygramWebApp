export async function fetchTelegramInfo(telegramId) {
  const base = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
  const infoResp = await fetch(`${base}/getChat?chat_id=${telegramId}`);
  const infoData = await infoResp.json();

  let photoUrl = '';
  const photosResp = await fetch(
    `${base}/getUserProfilePhotos?user_id=${telegramId}&limit=1`
  );
  const photosData = await photosResp.json();
  if (photosData.ok && photosData.result.total_count > 0) {
    const fileId = photosData.result.photos[0][0].file_id;
    const fileResp = await fetch(`${base}/getFile?file_id=${fileId}`);
    const fileData = await fileResp.json();
    if (fileData.ok) {
      photoUrl = `${base.replace('/bot', '/file/bot')}/${fileData.result.file_path}`;
    }
  }

  return {
    firstName: infoData.result?.first_name || '',
    lastName: infoData.result?.last_name || '',
    photoUrl
  };
}
