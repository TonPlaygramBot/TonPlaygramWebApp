import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';
import { fetchTelegramInfo } from './telegram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coinPath = path.join(
  __dirname,
  '../../webapp/public/assets/icons/TPCcoin.png'
);

export function getInviteUrl(roomId, token, amount) {
  const baseUrl =
    process.env.WEBAPP_BASE_URL ||
    'https://tonplaygramwebapp.onrender.com';
  return `${baseUrl}/games/snake?table=${roomId}&token=${token}&amount=${amount}`;
}

async function renderTransferImage(name, amount, date, photoUrl) {
  const scale = 2;
  const width = 320 * scale;
  const height = 180 * scale;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#2d5c66';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4 * scale;
  ctx.strokeRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${18 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  // Removed explicit "TPC" label in the header
  ctx.fillText('Statement Details', width / 2, 32 * scale);

  const sign = amount > 0 ? '+' : '-';
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Do not render the token name, keep only the icon beside the amount
  const text = `You received ${sign}${formatted}`;
  ctx.font = `bold ${16 * scale}px sans-serif`;
  ctx.fillText(text, width / 2, 60 * scale);

  // Draw sender information near the bottom instead of under the amount
  ctx.font = `${14 * scale}px sans-serif`;
  ctx.textAlign = 'left';
  const fromText = name;
  const photoSize = photoUrl ? 48 * scale : 0; // profile photo 2x coin size
  const spacing = photoUrl ? 6 * scale : 0;
  const textWidth = ctx.measureText(fromText).width;
  const totalWidth = photoSize + spacing + textWidth;
  const startX = (width - totalWidth) / 2;
  if (photoUrl) {
    try {
      const avatar = await loadImage(photoUrl);
      ctx.drawImage(avatar, startX, height / 2, photoSize, photoSize);
    } catch {}
  }
  ctx.fillText(fromText, startX + photoSize + spacing, height / 2 + photoSize / 2);
  ctx.textAlign = 'center';

  ctx.font = `${12 * scale}px sans-serif`;
  ctx.fillText(date.toLocaleString(), width / 2, height - 20 * scale);

  try {
    const coin = await loadImage(coinPath);
    const tw = ctx.measureText(text).width;
    ctx.drawImage(coin, width / 2 + tw / 2 + 6 * scale, 54 * scale, 24 * scale, 24 * scale);
  } catch {}

  return canvas.toBuffer();
}

export async function sendTransferNotification(bot, toId, fromId, amount, note) {
  let info;
  try {
    info = await fetchTelegramInfo(fromId);
  } catch {
    info = null;
  }

  const name =
    (info?.firstName || '') + (info?.lastName ? ` ${info.lastName}` : '') ||
    String(fromId);

  const sign = amount > 0 ? '+' : '-';
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const image = await renderTransferImage(
    name,
    amount,
    new Date(),
    info?.photoUrl
  );
  await bot.telegram.sendPhoto(String(toId), { source: image });

  const profileIcon = '\u{1F464}';
  const noteText = note ? `\nNote: ${note}` : '';
  const caption = `You received ${sign}${formatted} TPC from ${name} ${profileIcon}${noteText}`;

  await bot.telegram.sendMessage(String(toId), caption);
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
  try {
    await bot.telegram.sendPhoto(String(toId), photo, {
      caption,
      reply_markup: replyMarkup,
    });
  } catch (err) {
    console.error('Failed to send invite photo:', err.message);
  }

  // Also send a plain text notification like TPC receipts
  await sendTPCNotification(bot, toId, caption, replyMarkup);

  return url;
}

export async function sendTPCNotification(bot, toId, caption, replyMarkup) {
  await bot.telegram.sendMessage(String(toId), caption, {
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}
