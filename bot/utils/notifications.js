import path from 'path';
import { fileURLToPath } from 'url';
import { fetchTelegramInfo } from './telegram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coinPath = path.join(__dirname, '../../webapp/public/icons/TPCcoin.png');

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

export async function sendInviteNotification(bot, toId, fromId, name, type) {
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
  if (info?.photoUrl) {
    await bot.telegram.sendPhoto(String(toId), { url: info.photoUrl }, { caption });
  } else {
    await bot.telegram.sendMessage(String(toId), caption);
  }
}
