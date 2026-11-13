import { withProxy } from './proxyAgent.js';

export async function fetchTelegramInfo(telegramId) {
  if (!Number.isSafeInteger(Number(telegramId)) || Number(telegramId) <= 0 || !process.env.BOT_TOKEN) return null;
  const base = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
  try {
    const infoResp = await fetch(
      `${base}/getChat?chat_id=${Number(telegramId)}`,
      withProxy({ signal: AbortSignal.timeout(5000) })
    );
    if (!infoResp.ok) return null;
    const infoData = await infoResp.json();
    if (!infoData.ok) return null;
    return {
      firstName: infoData.result?.first_name || '',
      lastName: infoData.result?.last_name || '',
      // getFile download links contain BOT_TOKEN and must never be returned or
      // persisted as public profile photos. Use Telegram's signed init-data
      // photo_url, a verified provider avatar, or a user upload instead.
      photoUrl: ''
    };
  } catch {
    // Fetch errors can include the requested URL, which contains the bot token.
    console.error('fetchTelegramInfo failed');
    return null;
  }
}
