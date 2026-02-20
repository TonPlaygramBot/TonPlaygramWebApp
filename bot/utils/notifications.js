import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';
import { fetchTelegramInfo } from './telegram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicPath = path.join(__dirname, '../../webapp/public');
const coinPath = path.join(publicPath, 'assets/icons/ezgif-54c96d8a9b9236.webp');
const logoPath = path.join(publicPath, 'assets/icons/generated/app-icon-512.png');
const fallbackAvatarPath = path.join(publicPath, 'assets/icons/profile.svg');

export function getInviteUrl(roomId, token, amount, game = 'snake') {
  const baseUrl =
    process.env.WEBAPP_BASE_URL ||
    'https://tonplaygramwebapp.onrender.com';
  return `${baseUrl}/games/${game}?table=${roomId}&token=${token}&amount=${amount}`;
}

function normalizeAssetPath(assetPath) {
  if (!assetPath || typeof assetPath !== 'string') return null;
  if (assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    return assetPath;
  }
  if (assetPath.startsWith('/')) {
    return path.join(publicPath, assetPath);
  }
  return path.join(publicPath, assetPath.replace(/^\.\//, ''));
}

const RECEIPT_IMAGE_RETRY_ATTEMPTS = 6;
const RECEIPT_IMAGE_RETRY_DELAY_MS = 180;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeLoadImage(assetPath, options = {}) {
  const resolved = normalizeAssetPath(assetPath);
  if (!resolved) return null;

  const attempts = Math.max(1, Number(options.attempts) || RECEIPT_IMAGE_RETRY_ATTEMPTS);
  const delayMs = Math.max(0, Number(options.delayMs) || RECEIPT_IMAGE_RETRY_DELAY_MS);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await loadImage(resolved);
    } catch {
      if (attempt < attempts && delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  return null;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawAvatar(ctx, image, x, y, size, borderColor = '#67e8f9') {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (image) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
}

function isTonPlaygramAccount(label = '') {
  if (!label) return false;
  const normalized = String(label).trim().toLowerCase();
  return normalized.includes('tonplaygram') || normalized === 'store' || normalized === 'treasury';
}

function getReceiptAvatarCandidates(photo, label) {
  const candidates = [];
  if (photo) candidates.push(photo);
  if (isTonPlaygramAccount(label)) candidates.push(logoPath);
  candidates.push(fallbackAvatarPath);
  return [...new Set(candidates.filter(Boolean))];
}

async function resolveReceiptAvatar(photo, label) {
  const candidates = getReceiptAvatarCandidates(photo, label);
  for (const candidate of candidates) {
    const avatar = await safeLoadImage(candidate);
    if (avatar) return avatar;
  }
  return null;
}

function resolveReceiptItemThumbnail(item = {}) {
  return (
    item?.itemThumbnail ||
    item?.thumbnail ||
    item?.icon ||
    item?.image ||
    item?.imageUrl ||
    null
  );
}

export async function generateReceiptImage({
  title,
  subtitle,
  amount,
  date = new Date(),
  fromName,
  toName,
  fromPhoto,
  toPhoto,
  itemThumbnail,
  itemLabel,
}) {
  const width = 900;
  const height = 1280;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#0f172a');
  gradient.addColorStop(1, '#1e293b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const cardX = 56;
  const cardY = 44;
  const cardW = width - cardX * 2;
  const cardH = height - cardY * 2;
  roundedRect(ctx, cardX, cardY, cardW, cardH, 40);
  ctx.fillStyle = '#0b1120';
  ctx.fill();
  ctx.strokeStyle = 'rgba(103,232,249,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();

  const logo = await safeLoadImage(logoPath, { attempts: 8, delayMs: 220 });
  if (logo) {
    roundedRect(ctx, width / 2 - 110, 84, 220, 110, 26);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fill();

    const logoSize = 92;
    ctx.drawImage(logo, width / 2 - logoSize / 2, 94, logoSize, logoSize);
  }

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 42px Sans';
  ctx.textAlign = 'center';
  ctx.fillText('TonPlaygram', width / 2, 220);

  ctx.fillStyle = '#a5f3fc';
  ctx.font = '600 38px Sans';
  ctx.fillText(title || 'Transaction Receipt', width / 2, 286);

  if (subtitle) {
    ctx.fillStyle = '#93c5fd';
    ctx.font = '500 28px Sans';
    ctx.fillText(subtitle, width / 2, 332);
  }

  const amountBoxX = 120;
  const amountBoxY = 376;
  const amountBoxW = width - 240;
  const amountBoxH = 146;
  roundedRect(ctx, amountBoxX, amountBoxY, amountBoxW, amountBoxH, 24);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
  ctx.fill();

  const coin = await safeLoadImage(coinPath, { attempts: 8, delayMs: 220 });
  if (coin) {
    ctx.drawImage(coin, amountBoxX + 32, amountBoxY + 31, 84, 84);
  }

  const sign = amount > 0 ? '+' : '';
  const formatted = Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 52px Sans';
  ctx.textAlign = 'left';
  ctx.fillText(`${sign}${formatted} TPC`, amountBoxX + 132, amountBoxY + 92);

  const fromAvatar = await resolveReceiptAvatar(fromPhoto, fromName);
  const toAvatar = await resolveReceiptAvatar(toPhoto, toName);

  const blockY = 590;
  const avatarSize = 120;
  drawAvatar(ctx, fromAvatar, 140, blockY, avatarSize, '#38bdf8');
  drawAvatar(ctx, toAvatar, width - 140 - avatarSize, blockY, avatarSize, '#818cf8');

  ctx.strokeStyle = 'rgba(148,163,184,0.7)';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(300, blockY + avatarSize / 2);
  ctx.lineTo(width - 300, blockY + avatarSize / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 28px Sans';
  ctx.textAlign = 'center';
  ctx.fillText(fromName || 'Sender', 200, blockY + avatarSize + 44);
  ctx.fillText(toName || 'Receiver', width - 200, blockY + avatarSize + 44);

  if (itemThumbnail) {
    const thumb = await safeLoadImage(itemThumbnail, { attempts: 8, delayMs: 220 });
    const itemBoxY = 820;
    roundedRect(ctx, 120, itemBoxY, width - 240, 250, 24);
    ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
    ctx.fill();

    if (thumb) {
      roundedRect(ctx, 156, itemBoxY + 34, 180, 180, 18);
      ctx.save();
      ctx.clip();
      ctx.drawImage(thumb, 156, itemBoxY + 34, 180, 180);
      ctx.restore();
    }

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.font = '700 30px Sans';
    ctx.fillText('NFT included', 374, itemBoxY + 98);
    ctx.font = '500 26px Sans';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(itemLabel || 'Store / NFT item', 374, itemBoxY + 150);
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 24px Sans';
  ctx.textAlign = 'center';
  ctx.fillText(`Issued: ${date.toLocaleString()}`, width / 2, height - 92);

  return canvas.toBuffer('image/png');
}

export async function sendTransferNotification(bot, toId, fromId, amount, note) {
  const [fromInfo, toInfo] = await Promise.all([
    fetchTelegramInfo(fromId).catch(() => null),
    fetchTelegramInfo(toId).catch(() => null)
  ]);

  const fromName =
    `${fromInfo?.firstName || ''}${fromInfo?.lastName ? ` ${fromInfo.lastName}` : ''}`.trim() ||
    String(fromId);
  const toName =
    `${toInfo?.firstName || ''}${toInfo?.lastName ? ` ${toInfo.lastName}` : ''}`.trim() ||
    'You';

  const image = await generateReceiptImage({
    title: 'TPC Transfer Received',
    subtitle: 'Statement details',
    amount,
    date: new Date(),
    fromName,
    toName,
    fromPhoto: fromInfo?.photoUrl,
    toPhoto: toInfo?.photoUrl,
  });

  await bot.telegram.sendPhoto(String(toId), { source: image });

  const noteText = note ? `\nNote: ${note}` : '';
  const caption = `🪙 You received ${amount.toFixed(2)} TPC from ${fromName}.${noteText}`;
  await bot.telegram.sendMessage(String(toId), caption);
}

export async function sendDepositNotification(bot, toId, amount) {
  const toInfo = await fetchTelegramInfo(toId).catch(() => null);
  const toName =
    `${toInfo?.firstName || ''}${toInfo?.lastName ? ` ${toInfo.lastName}` : ''}`.trim() ||
    'You';

  const image = await generateReceiptImage({
    title: 'Deposit Confirmed',
    subtitle: 'TPC credited successfully',
    amount,
    date: new Date(),
    fromName: 'TonPlaygram Treasury',
    toName,
    toPhoto: toInfo?.photoUrl,
  });

  await bot.telegram.sendPhoto(String(toId), { source: image });
  await bot.telegram.sendMessage(
    String(toId),
    `🪙 Your deposit of ${amount.toFixed(2)} TPC was credited.`
  );
}

export async function sendGiftNotification(bot, toId, gift, senderName, date, options = {}) {
  const toInfo = await fetchTelegramInfo(toId).catch(() => null);

  const image = await generateReceiptImage({
    title: 'NFT Gift Received',
    subtitle: 'Store/NFT statement',
    amount: 0,
    date,
    fromName: senderName,
    toName: `${toInfo?.firstName || ''}${toInfo?.lastName ? ` ${toInfo.lastName}` : ''}`.trim() || 'You',
    fromPhoto: options.senderPhoto,
    toPhoto: toInfo?.photoUrl,
    itemThumbnail: resolveReceiptItemThumbnail(gift),
    itemLabel: `${gift?.name || 'Gift'} • ${gift?.price || 0} TPC`,
  });

  await bot.telegram.sendPhoto(String(toId), { source: image });
  const caption = `🧧 You received ${gift.name} worth ${gift.price} TPC from ${senderName} on ${date.toLocaleString()}`;
  await bot.telegram.sendMessage(String(toId), caption);
}

export async function sendStorePurchaseNotification(bot, toId, payload) {
  const toInfo = await fetchTelegramInfo(toId).catch(() => null);
  const image = await generateReceiptImage({
    title: 'Store Purchase Completed',
    subtitle: 'NFT / item delivery receipt',
    amount: -Math.abs(payload.totalPrice || 0),
    date: payload.date || new Date(),
    fromName: `${toInfo?.firstName || ''}${toInfo?.lastName ? ` ${toInfo.lastName}` : ''}`.trim() || 'You',
    toName: 'TonPlaygram Store',
    fromPhoto: toInfo?.photoUrl,
    itemThumbnail: resolveReceiptItemThumbnail(payload),
    itemLabel: payload.itemLabel,
  });

  await bot.telegram.sendPhoto(String(toId), { source: image });
  await bot.telegram.sendMessage(
    String(toId),
    `🛍️ Store purchase completed: ${payload.itemLabel} for ${Number(payload.totalPrice || 0).toFixed(2)} TPC.`
  );
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
  game,
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

  const url = getInviteUrl(roomId, token, amount, game);
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

  await sendTPCNotification(bot, toId, caption, replyMarkup);

  return url;
}

export async function sendTPCNotification(bot, toId, caption, replyMarkup) {
  await bot.telegram.sendMessage(String(toId), caption, {
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

export async function writeReceiptPreview(filePath, payload) {
  const buffer = await generateReceiptImage(payload);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
  return filePath;
}
