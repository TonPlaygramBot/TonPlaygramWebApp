import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';
import { fetchTelegramInfo } from './telegram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coinPath = path.join(__dirname, '../../webapp/public/icons/TPCcoin.png');

export function getInviteUrl(roomId, token, amount) {
  const baseUrl =
    process.env.WEBAPP_BASE_URL ||
    'https://tonplaygramwebapp.onrender.com';
  return `${baseUrl}/games/snake?table=${roomId}&token=${token}&amount=${amount}`;
}

async function renderTransferImage(name, amount, date, photoUrl) {
  const width = 320;
  const height = 180;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#2d5c66';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TPC Statement Details', width / 2, 32);

  const sign = amount > 0 ? '+' : '-';
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const text = `You received ${sign}${formatted} TPC`;
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(text, width / 2, 60);

  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  const fromText = `from ${name}`;
  const photoSize = photoUrl ? 32 : 0;
  const spacing = photoUrl ? 6 : 0;
  const textWidth = ctx.measureText(fromText).width;
  const totalWidth = photoSize + spacing + textWidth;
  const startX = (width - totalWidth) / 2;
  if (photoUrl) {
    try {
      const avatar = await loadImage(photoUrl);
      ctx.drawImage(avatar, startX, 78, photoSize, photoSize);
    } catch {}
  }
  ctx.fillText(fromText, startX + photoSize + spacing, 100);
  ctx.textAlign = 'center';

  ctx.font = '12px sans-serif';
  ctx.fillText(date.toLocaleString(), width / 2, height - 20);

  try {
    const coin = await loadImage(coinPath);
    const tw = ctx.measureText(text).width;
    ctx.drawImage(coin, width / 2 + tw / 2 + 6, 54, 24, 24);
  } catch {}

  return canvas.toBuffer();
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

  const sign = amount > 0 ? '+' : '-';
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const coinIcon = '\u{1FA99}';
  const profileIcon = '\u{1F464}';

  const lines = [
    'TPC Statement Details',
    `You received ${sign}${formatted} TPC ${coinIcon}`,
    `From: ${name} ${profileIcon}`,
    new Date().toLocaleString(),
  ];

  const caption = lines.join('\n');
  const photo = info?.photoUrl ? { url: info.photoUrl } : { source: coinPath };
  await bot.telegram.sendPhoto(String(toId), photo, { caption });
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

export async function sendTPCNotification(bot, toId, caption) {
  await bot.telegram.sendMessage(String(toId), caption);
}
