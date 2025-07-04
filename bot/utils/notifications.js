import path from 'path';
import { fileURLToPath } from 'url';
import { fetchTelegramInfo } from './telegram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coinPath = path.join(__dirname, '../../webapp/public/icons/TPCcoin.png');

export function getInviteUrl(roomId, token, amount) {
  const baseUrl =
    process.env.WEBAPP_BASE_URL ||
    'https://tonplaygramwebapp.onrender.com';
  return `${baseUrl}/games/snake?table=${roomId}&token=${token}&amount=${amount}`;
}

export async function sendTransferNotification(bot, toId, fromId, amount) {
  let info;
  try {
    info = await fetchTelegramInfo(fromId);
  } catch {
    info = null;
  }
  const name =
    (info?.firstName || '') + (info?.lastName ? ` ${info.lastName}` : '') ||
    String(fromId);
  const caption = `\u{1FA99} You received ${amount} TPC from ${name}`;
  const photo = info?.photoUrl
    ? { url: info.photoUrl }
    : { source: coinPath };
  await bot.telegram.sendPhoto(String(toId), photo, {
    caption,
  });
}

export async function sendInviteNotification(
  bot,
  toId,
  fromId,
  name,
  type,
  roomId,
  token,
  amount,
) {
  let info;
  try {
    info = await fetchTelegramInfo(fromId);
  } catch {
    info = null;
  }
  const display =
    name ||
    (info?.firstName || '') + (info?.lastName ? ` ${info.lastName}` : '') ||
    String(fromId);
  const caption = `${display} invited you to a ${type} game`;

  const url = getInviteUrl(roomId, token, amount);
  const replyMarkup = {
    inline_keyboard: [
      [{ text: 'Open Game', url }],
      [
        {
          text: 'Reject',
          callback_data: `reject_invite:${roomId}:${toId}`,
        },
      ],
    ],
  };

  const photo = info?.photoUrl ? { url: info.photoUrl } : { source: coinPath };
  await bot.telegram.sendPhoto(String(toId), photo, {
    caption,
    reply_markup: replyMarkup,
  });

  return url;
}
