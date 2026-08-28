import './loadEnv.js';
import { validateEnv } from './env.js';
import express from 'express';
import cors from 'cors';
import bot from './bot.js';
import { getInviteUrl, sendInviteNotification } from './utils/notifications.js';
import mongoose from 'mongoose';
import { proxyUrl, proxyAgent } from './utils/proxyAgent.js';
import http from 'http';
import { initSocket } from './socket.js';
import { LudoBattleGame } from './logic/ludoBattleGame.js';
import { GameRoomManager } from './gameEngine.js';
import miningRoutes from './routes/mining.js';
import tasksRoutes from './routes/tasks.js';
import watchRoutes from './routes/watch.js';
import referralRoutes from './routes/referral.js';
import walletRoutes from './routes/wallet.js';
import accountRoutes from './routes/account.js';
import profileRoutes from './routes/profile.js';
import twitterAuthRoutes from './routes/twitterAuth.js';
import airdropRoutes from './routes/airdrop.js';
import checkinRoutes from './routes/checkin.js';
import socialRoutes from './routes/social.js';
import socialAdminRoutes from './routes/socialAdmin.js';
import { queueDueSocialPosts } from './services/socialPublishing.js';
import { sendPushNotifications } from './services/pushNotificationService.js';
import broadcastRoutes from './routes/broadcast.js';
import storeRoutes from './routes/store.js';
import adsRoutes from './routes/ads.js';
import influencerRoutes from './routes/influencer.js';
import onlineRoutes from './routes/online.js';
import poolRoyaleRoutes from './routes/poolRoyale.js';
import snookerRoyaleRoutes from './routes/snookerRoyal.js';
import exchangeRoutes from './routes/exchange.js';
import pushRoutes from './routes/push.js';
import matchmakingRoutes from './routes/matchmaking.js';
import protestVideoRoutes from './routes/protestVideos.js';
import flamingoWallRoutes from './routes/flamingoWall.js';
import User from './models/User.js';
import GameResult from './models/GameResult.js';
import AdView from './models/AdView.js';
import Airdrop from './models/Airdrop.js';
import BurnedTPC from './models/BurnedTPC.js';
import FriendRequest from './models/FriendRequest.js';
import GameRoom from './models/GameRoom.js';
import InfluencerTask from './models/InfluencerTask.js';
import Message from './models/Message.js';
import Post from './models/Post.js';
import PostRecord from './models/PostRecord.js';
import Task from './models/Task.js';
import WatchRecord from './models/WatchRecord.js';
import ActiveConnection from './models/ActiveConnection.js';
import FlamingoPost from './models/FlamingoPost.js';
import ChessMatch from './models/ChessMatch.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { randomInt, randomUUID } from 'crypto';
import {
  createDominoTableNumber,
  hasConflictingPrimaryTpcIdentities,
  isDominoMatchCompatible,
  resolvePrimaryTpcAccountNumber,
  validateDominoStateSubmission
} from './utils/dominoRoyalOnline.js';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import authenticate, { optionalAuthenticate, verifyTelegramInitData } from './middleware/auth.js';
import {
  registerConnection,
  removeConnection,
  countOnline,
  listOnline
} from './services/connectionService.js';
import {
  GAME_ONLINE_POLICY,
  validateSeatTableRequest,
  normalizeOnlineGameType
} from './config/onlineGamePolicy.js';
import { createCheckersRealtimeStore } from './utils/checkersRealtimeState.js';
import { applyAuthoritativeMove, SIDES } from './utils/checkersAuthoritativeEngine.js';

validateEnv();

const CHESS_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1';
const CHESS_HOUSE_FEE_BPS = Math.max(0, Math.min(10_000, Number(process.env.CHESS_HOUSE_FEE_BPS) || 500));
const CHESS_HOUSE_ACCOUNT = String(process.env.CHESS_HOUSE_ACCOUNT || process.env.HOUSE_TPC_ACCOUNT || '').trim();
const chessGames = new Map();
const checkersRealtimeStore = createCheckersRealtimeStore();
const checkersMatchSessions = new Map();
const checkersSettlementLedger = new Map();
const AUTHENTIC_ACCOUNT_QUERY = {
  isBanned: { $ne: true },
  $or: [
    { telegramId: { $exists: true, $ne: null } },
    { googleId: { $exists: true, $nin: ['', null] } }
  ]
};
const UNAUTHENTIC_ACCOUNT_QUERY = {
  isBanned: { $ne: true },
  $and: [
    { $or: [{ telegramId: { $exists: false } }, { telegramId: null }] },
    { $or: [{ googleId: { $exists: false } }, { googleId: { $in: ['', null] } }] }
  ]
};

async function banUnauthenticatedAccounts() {
  const { modifiedCount = 0 } = await User.updateMany(
    UNAUTHENTIC_ACCOUNT_QUERY,
    { $set: { isBanned: true, currentTableId: null, isMining: false } }
  );
  return modifiedCount;
}

function logFatal(event, err) {
  const message = err?.stack || err?.message || String(err);
  console.error(`[${new Date().toISOString()}] Unhandled ${event}:`, message);
}

process.on('unhandledRejection', (reason) => logFatal('rejection', reason));
process.on('uncaughtException', (err) => {
  logFatal('exception', err);
});

const models = [
  AdView,
  Airdrop,
  BurnedTPC,
  FriendRequest,
  GameResult,
  GameRoom,
  InfluencerTask,
  Message,
  Post,
  PostRecord,
  Task,
  User,
  WatchRecord,
  ActiveConnection,
  FlamingoPost
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (proxyUrl) {
  console.log(`Using HTTPS proxy ${proxyUrl}`);
}

if (!process.env.MONGO_URI) {
  if (process.env.NODE_ENV === 'production') {
    console.error('MONGO_URI is required in production');
    process.exit(1);
  }
  process.env.MONGO_URI = 'memory';
  console.log('MONGO_URI not set, defaulting to in-memory MongoDB');
}

const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')

  .split(',')

  .map((o) => o.trim())

  .filter(Boolean);
const defaultDevOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
];
const effectiveAllowedOrigins = allowedOrigins.length
  ? allowedOrigins
  : process.env.NODE_ENV === 'production'
    ? []
    : defaultDevOrigins;

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  if (effectiveAllowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { hostname } = new URL(origin);
      return hostname === 'localhost' || hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }
  return false;
}

function resolveCorsOrigin(origin, callback) {
  if (isAllowedCorsOrigin(origin)) {
    return callback(null, true);
  }
  if (effectiveAllowedOrigins.length === 0) {
    return callback(null, false);
  }
  return callback(new Error('Not allowed by CORS'));
}

const rateLimitWindowMs =
  Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

// The web app loads several independent account widgets and game services. A
// 100-request/15-minute global allowance was low enough for normal mobile use
// to lock the user out of their own profile. Keep this as a broad abuse guard;
// sensitive write routes apply their own validation and throttling.
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX) || 1000;
const app = express();
const corsOptions = {
  origin: resolveCorsOrigin
};
app.use(cors(corsOptions));
const httpServer = http.createServer(app);
const io = initSocket(httpServer, {
  cors: {
    origin: resolveCorsOrigin,
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000
});
io.use((socket, next) => {
  const authHeader = socket.handshake.headers?.authorization || '';
  const token =
    socket.handshake.auth?.token || authHeader.replace(/^Bearer\s+/i, '');
  const initData =
    socket.handshake.auth?.initData ||
    socket.handshake.headers?.['x-telegram-init-data'];
  const accountId =
    socket.handshake.auth?.accountId ||
    socket.handshake.headers?.['x-tpc-account-id'];
  const googleId =
    socket.handshake.auth?.googleId ||
    socket.handshake.headers?.['x-google-id'];

  const resolvedAuth = {};
  if (initData) {
    const data = verifyTelegramInitData(initData);
    if (data) {
      resolvedAuth.telegramId = data.user ? Number(JSON.parse(data.user).id) : undefined;
    }
  }

  if (process.env.API_AUTH_TOKEN && token === process.env.API_AUTH_TOKEN) {
    socket.data.auth = { ...resolvedAuth, apiToken: true };
    return next();
  }

  if (accountId || googleId) {
    socket.data.auth = {
      ...resolvedAuth,
      accountId: accountId ? String(accountId) : undefined,
      googleId: googleId ? String(googleId) : undefined
    };
    return next();
  }

  if (Object.keys(resolvedAuth).length > 0) {
    socket.data.auth = resolvedAuth;
    return next();
  }

  return next(new Error('unauthorized'));
});
const gameManager = new GameRoomManager(io);

// Expose socket.io instance and userSockets map for routes
app.set('io', io);

bot.action(/^reject_invite:(.+)/, async (ctx) => {
  const actionToken = ctx.match[1];
  const roomId = inviteActionTokens.get(actionToken) || actionToken;
  await ctx.answerCbQuery('Invite rejected');
  try {
    await ctx.deleteMessage();
  } catch {}
  const invite = getPendingInvite(roomId);
  pendingInvites.delete(roomId);
  inviteActionTokens.delete(actionToken);
  if (invite) {
    const response = { roomId, game: invite.game, token: invite.token, amount: invite.amount };
    for (const sid of userSockets.get(String(invite.fromId)) || []) {
      io.to(sid).emit('gameInviteRejected', response);
    }
  }
});

// Middleware and routes
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:', 'wss:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      frameSrc: ["'self'", 'https:']
    }
  }
}));
app.use(compression());
app.use('/api/protest-videos', protestVideoRoutes);
app.use('/api/flamingo-wall', flamingoWallRoutes);
// Increase JSON body limit to handle large photo uploads
app.use(express.json({ limit: '10mb' }));
app.use(optionalAuthenticate);
const apiLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  limit: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please wait a moment and try again.'
    });
  },
  keyGenerator: (req) => {
    if (req.auth?.telegramId) return `telegram:${req.auth.telegramId}`;
    if (req.auth?.accountId) return `account:${req.auth.accountId}`;
    if (req.auth?.googleId) return `google:${req.auth.googleId}`;
    if (req.body?.telegramId) return `telegram:${req.body.telegramId}`;
    if (req.body?.accountId) return `account:${req.body.accountId}`;
    return req.ip;
  }
});
app.use('/api', apiLimiter);
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/watch', watchRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/influencer', influencerRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/push', pushRoutes);
if (process.env.ENABLE_TWITTER_OAUTH === 'true') {
  app.use('/api/twitter', twitterAuthRoutes);
}
app.use('/api/airdrop', airdropRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/admin/social', socialAdminRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/online', onlineRoutes);
app.use('/api/matchmaking', matchmakingRoutes);
app.use('/api/pool-royale', poolRoyaleRoutes);
app.use('/api/snooker-royale', snookerRoyaleRoutes);
app.use('/api/exchange', exchangeRoutes);

const socialScheduler = setInterval(() => queueDueSocialPosts().catch((error) => console.error('Social scheduler failed:', error.message)), 30_000);
socialScheduler.unref?.();


// Serve the built React app
const webappPath = path.join(__dirname, '../webapp/dist');
const versionFilePath = path.join(webappPath, 'version.json');
const sourceVersionPath = path.join(__dirname, '../webapp/public/version.json');

function loadWebappVersion() {
  const fallbackBuild = process.env.APP_BUILD || 'dev';
  const candidates = [versionFilePath, sourceVersionPath];
  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
        return {
          build: parsed.build || fallbackBuild,
          generatedAt: parsed.generatedAt || null
        };
      } catch (err) {
        console.warn(`Failed to read ${path.basename(filePath)}:`, err.message);
      }
    }
  }
  return { build: fallbackBuild, generatedAt: null };
}

function ensureWebappBuilt() {
  if (process.env.SKIP_WEBAPP_BUILD) {
    console.log('Skipping webapp build');
    return true;
  }
  if (
    existsSync(path.join(webappPath, 'index.html')) &&
    existsSync(path.join(webappPath, 'assets'))
  ) {
    return true;
  }
  try {
    console.log('Building webapp...');
    const webappDir = path.join(__dirname, '../webapp');
    execSync('npm install', { cwd: webappDir, stdio: 'inherit' });

    const apiBase = process.env.WEBAPP_API_BASE_URL || '';
    const displayBase = apiBase || '(same origin)';
    console.log(`Using API base URL ${displayBase} for webapp build`);

    execSync('npm run build', {
      cwd: webappDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_API_BASE_URL: apiBase
      }
    });

    return existsSync(path.join(webappPath, 'index.html'));
  } catch (err) {
    console.error('Failed to build webapp:', err.message);
    return false;
  }
}

ensureWebappBuilt();

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function setWebAssetCacheHeaders(res, filePath) {
  const relativePath = path.relative(webappPath, filePath).replace(/\\/g, '/');
  const lowerPath = relativePath.toLowerCase();

  const shouldNeverCache =
    lowerPath === 'index.html' ||
    lowerPath === 'service-worker.js' ||
    lowerPath === 'version.json' ||
    lowerPath === 'manifest.webmanifest' ||
    lowerPath === 'pwa/app-build.js' ||
    lowerPath.endsWith('.html');

  if (shouldNeverCache) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return;
  }

  res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR_SECONDS}, immutable`);
}

app.use(
  express.static(webappPath, {
    maxAge: 0,
    setHeaders: setWebAssetCacheHeaders
  })
);

function sendIndex(res) {
  if (ensureWebappBuilt()) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(webappPath, 'index.html'));
  } else {
    res.status(503).send('Webapp build not available');
  }
  if (process.env.SKIP_BOT_LAUNCH !== '1') launchBotWithDelay();
  else console.log('Skipping Telegram bot launch');
}

let botLaunchTriggered = false;
function launchBotWithDelay() {
  if (botLaunchTriggered) return;
  botLaunchTriggered = true;
  if (!process.env.BOT_TOKEN || process.env.BOT_TOKEN === 'dummy') {
    console.log('BOT_TOKEN not configured. Attempting to launch bot anyway');
  }
  setTimeout(async () => {
    try {
      // Ensure no lingering webhook is configured when using polling
      try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      } catch (err) {
        console.error('Failed to delete existing webhook:', err.message);
      }
      await bot.launch({ dropPendingUpdates: true });
    } catch (err) {
      console.error('Failed to launch Telegram bot:', err.message);
    }
  }, 5000);
}

if (process.env.SKIP_BOT_LAUNCH !== '1') launchBotWithDelay();
else console.log('Skipping Telegram bot launch');

app.get('/', (req, res) => {
  sendIndex(res);
});
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});
app.get('/api/version', (req, res) => {
  res.json(loadWebappVersion());
});

const tableSeats = new Map();
const tables = new Map();
const userSockets = new Map();
const pendingInvites = new Map();
const inviteActionTokens = new Map();
const GAME_INVITE_TTL_MS = Number(process.env.GAME_INVITE_TTL_MS) || 10 * 60 * 1000;

function serializeGameInvite(invite) {
  return {
    fromId: invite.fromId,
    fromTelegramId: invite.fromTelegramId,
    fromName: invite.fromName,
    roomId: invite.roomId,
    token: invite.token,
    amount: invite.amount,
    game: invite.game,
    group: invite.group,
    opponentNames: invite.opponentNames,
    capacity: invite.toIds.length + 1,
    expiresAt: invite.expiresAt
  };
}

function savePendingInvite(payload, toIds) {
  const roomId = String(payload.roomId || '').trim();
  const invite = {
    ...payload,
    roomId,
    toIds: toIds.map(String),
    acceptedIds: new Set(),
    createdAt: Date.now(),
    expiresAt: Date.now() + GAME_INVITE_TTL_MS
  };
  invite.telegramActionToken = randomUUID();
  pendingInvites.set(roomId, invite);
  inviteActionTokens.set(invite.telegramActionToken, roomId);
  return invite;
}

function getPendingInvite(roomId) {
  const invite = pendingInvites.get(String(roomId || ''));
  if (!invite) return null;
  if (invite.expiresAt <= Date.now()) {
    pendingInvites.delete(invite.roomId);
    inviteActionTokens.delete(invite.telegramActionToken);
    return null;
  }
  return invite;
}

function deliverPendingInvites(socket, playerId) {
  for (const invite of pendingInvites.values()) {
    if (invite.expiresAt <= Date.now()) {
      pendingInvites.delete(invite.roomId);
      inviteActionTokens.delete(invite.telegramActionToken);
      continue;
    }
    if (invite.toIds.includes(String(playerId)) && !invite.acceptedIds.has(String(playerId))) {
      socket.emit('gameInvite', serializeGameInvite(invite));
    }
  }
}

async function notifyInviteDevices(accountId, telegramId, invite) {
  const user = await User.findOne({
    $or: [
      ...(accountId ? [{ accountId: String(accountId) }] : []),
      ...(telegramId ? [{ telegramId: Number(telegramId) }] : [])
    ]
  }).select('pushTokens').lean();
  if (!user?.pushTokens?.length) return;
  const gameName = String(invite.game || 'snake').replace(/[-_]/g, ' ');
  await sendPushNotifications(user.pushTokens, {
    title: 'New game invite',
    body: `${invite.fromName || 'A TonPlaygram player'} invited you to ${gameName}. Accept or reject now.`
  }, { type: 'gameInvite', ...Object.fromEntries(Object.entries(invite).map(([key, value]) => [key, String(value ?? '')])) });
}

function respondToInvite(socket, payload = {}, accepted = false, cb) {
  const roomId = String(payload.roomId || '');
  const invite = getPendingInvite(roomId);
  if (!invite) return cb?.({ success: false, error: 'invite_not_found_or_expired' });
  const playerId = String(socket.data?.playerId || '');
  if (!invite.toIds.map(String).includes(playerId)) {
    return cb?.({ success: false, error: 'not_invited' });
  }
  const response = {
    roomId,
    game: invite.game,
    token: invite.token,
    amount: invite.amount,
    capacity: invite.toIds.length + 1,
    byId: playerId
  };
  if (!accepted) {
    pendingInvites.delete(roomId);
    inviteActionTokens.delete(invite.telegramActionToken);
    for (const sid of userSockets.get(String(invite.fromId)) || []) io.to(sid).emit('gameInviteRejected', response);
    return cb?.({ success: true });
  }
  invite.acceptedIds = new Set([...(invite.acceptedIds || []), playerId]);
  const allAccepted = invite.toIds.every((id) => invite.acceptedIds.has(String(id)));
  if (allAccepted) {
    pendingInvites.delete(roomId);
    inviteActionTokens.delete(invite.telegramActionToken);
    for (const sid of userSockets.get(String(invite.fromId)) || []) io.to(sid).emit('gameInviteAccepted', response);
  }
  // Returning the authoritative room details keeps every accepted player on
  // the exact hosted table instead of allowing a game lobby to rematch them.
  cb?.({ success: true, start: allAccepted, invite: response });
}

app.set('userSockets', userSockets);

async function getUserSocketIds({ accountId, telegramId } = {}) {
  const identities = new Set(
    [accountId, telegramId].filter((value) => value !== undefined && value !== null && value !== '').map(String)
  );

  if (telegramId) {
    const user = await User.findOne({ telegramId: Number(telegramId) }).select('accountId').lean();
    if (user?.accountId) identities.add(String(user.accountId));
  }

  const socketIds = new Set();
  for (const identity of identities) {
    for (const socketId of userSockets.get(identity) || []) socketIds.add(socketId);
  }
  return socketIds;
}

async function resolveInviteTelegramId(accountId, telegramId) {
  if (telegramId !== undefined && telegramId !== null && telegramId !== '') {
    return telegramId;
  }
  if (!accountId) return null;
  const user = await User.findOne({ accountId: String(accountId) }).select('telegramId').lean();
  return user?.telegramId ?? null;
}

const tableWatchers = new Map();
const liveChatRooms = new Map();
// Dynamic lobby tables grouped by game type and capacity
const lobbyTables = {};
const tableMap = new Map();
app.set('gameManager', gameManager);
app.set('tableMap', tableMap);
const poolStates = new Map();
const snookerStates = new Map();
const dominoRoyalStates = new Map();
const murlanRoyalStates = new Map();
const airHockeyStates = new Map();
const texasHoldemStates = new Map();
const ludoBattleStates = new Map();
const fourInRowStates = new Map();
const dominoRoyalTableNumbers = new Set();
const chessTableNumbers = new Set();

function createChessTableNumber() {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const number = `CBR-${String(randomInt(1_000_000)).padStart(6, '0')}`;
    if (!chessTableNumbers.has(number)) return number;
  }
  return `CBR-${Date.now().toString(36).toUpperCase()}`;
}
const lastActionBySocket = new Map();
const rollRateLimitMs = Number(process.env.SOCKET_ROLL_COOLDOWN_MS) || 800;
const seatTableRateLimitMs = Number(process.env.SEAT_TABLE_RATE_LIMIT_MS) || 500;
const dominoRoyalMatchTimeoutMs = Number(process.env.DOMINO_ROYAL_MATCH_TIMEOUT_MS) || 120000;
const lobbySeatTtlMs = Number(process.env.LOBBY_SEAT_TTL_MS) || 120_000;
const checkersMoveRateLimitMs =
  Number(process.env.CHECKERS_MOVE_RATE_LIMIT_MS) || 120;

const MATCH_META_KEYS = Array.from(
  new Set(
    Object.values(GAME_ONLINE_POLICY).flatMap((policy) => policy.allowMatchMeta)
  )
);

function normalizeTableSizeMeta(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'pro') return '9ft';
  if (normalized.includes('9') && normalized.includes('ft')) return '9ft';
  if (normalized.includes('8') && normalized.includes('ft')) return '8ft';
  if (normalized.includes('tournament')) return '9ft';
  return normalized;
}

function normalizeBallSetMeta(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'us' || normalized === 'usa') return 'american';
  if (normalized === 'english') return 'uk';
  return normalized;
}

function normalizeVariantMeta(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  const compact = normalized.replace(/[\s_-]+/g, '');
  if (normalized === 'us' || normalized === 'usa') return 'american';
  if (normalized === 'english') return 'uk';
  if (compact === 'eightball' || compact === '8ball') return '8ball';
  if (compact === 'nineball' || compact === '9ball') return '9ball';
  return normalized;
}

function normalizeMatchMetaValue(key, value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (key === 'tableSize') return normalizeTableSizeMeta(normalized);
  if (key === 'ballSet') return normalizeBallSetMeta(normalized);
  if (key === 'variant') return normalizeVariantMeta(normalized);
  return normalized;
}

function normalizeMatchMeta(rawMeta = {}) {
  const normalized = {};
  MATCH_META_KEYS.forEach((key) => {
    const value = rawMeta[key];
    if (typeof value === 'string' && value.trim()) {
      const normalizedValue = normalizeMatchMetaValue(key, value);
      if (normalizedValue) normalized[key] = normalizedValue;
    }
  });
  return normalized;
}

function isMatchMetaCompatible(existing = {}, requested = {}, gameType = '') {
  const normalizedGameType = String(gameType || '').trim().toLowerCase();

  if (normalizedGameType === 'chess') {
    // Chess Battle Royal quick matchmaking has one queue criterion: stake.
    // Color, client mode labels, token casing, and other lobby metadata are
    // seat/game preferences and must never split otherwise compatible users.
    // The numeric stake is compared by getAvailableTable.
    return true;
  }

  if (normalizedGameType === 'domino-royal') {
    return isDominoMatchCompatible(existing, requested);
  }

  if (normalizedGameType === 'poolroyale') {
    const existingVariant = existing?.variant || '';
    const requestedVariant = requested?.variant || '';
    // Pool Royale quick matchmaking now only partitions by stake + variant.
    // Stake is checked outside this helper (see getAvailableTable).
    // Keep missing variants as wildcards for backward compatibility.
    if (!existingVariant || !requestedVariant) return true;
    return existingVariant === requestedVariant;
  }

  const allKeys = new Set([
    ...Object.keys(existing || {}),
    ...Object.keys(requested || {})
  ]);
  for (const key of allKeys) {
    if (key === 'preferredSide') {
      // Side is a seat preference, not a matchmaking partition. Keep players
      // in the same queue even when they pick opposite colors.
      continue;
    }
    const existingValue = existing?.[key];
    const requestedValue = requested?.[key];
    // Treat missing keys as wildcards so players can still pair when one client
    // sends less detailed lobby metadata (for example missing tableSize).
    if (!existingValue || !requestedValue) continue;
    if (existingValue !== requestedValue) return false;
  }
  return true;
}

function isRateLimited(socket, key, cooldownMs) {
  const now = Date.now();
  const last = lastActionBySocket.get(socket.id)?.[key] || 0;
  if (now - last < cooldownMs) return true;
  const map = lastActionBySocket.get(socket.id) || {};
  map[key] = now;
  lastActionBySocket.set(socket.id, map);
  return false;
}

function resolveTpcIdentity(payload = {}) {
  return resolvePrimaryTpcAccountNumber(payload);
}

function hasConflictingIdentities(payload = {}) {
  return hasConflictingPrimaryTpcIdentities(payload);
}

function ensureRegistered(socket, tpcAccountNumber) {
  let registered = socket.data?.playerId;
  if (!registered && tpcAccountNumber) {
    registered = String(tpcAccountNumber);
    socket.data.playerId = registered;
    let set = userSockets.get(registered);
    if (!set) {
      set = new Set();
      userSockets.set(registered, set);
    }
    set.add(socket.id);
    registerConnection({ userId: registered, socketId: socket.id }).catch((err) => {
      console.error('registerConnection fallback failed', err);
    });
  }
  if (!registered) {
    socket.emit('errorMessage', 'register_required');
    return false;
  }
  if (tpcAccountNumber && String(tpcAccountNumber) !== String(registered)) {
    socket.emit('errorMessage', 'identity_mismatch');
    return false;
  }
  return true;
}

function isReservedHostedTableId(tableId, gameType, maxPlayers) {
  const raw = String(tableId || '').trim();
  if (!raw) return false;
  const [prefix, capStr, kind] = raw.split('-');
  if (kind !== 'host') return false;
  const normalizedPrefix = normalizeOnlineGameType(prefix);
  return (
    normalizedPrefix === normalizeOnlineGameType(gameType) &&
    Number(capStr) === Number(maxPlayers)
  );
}

function createLobbyTable({
  id = randomUUID(),
  gameType,
  stake = 0,
  maxPlayers = 4,
  meta = {}
}) {
  const key = `${gameType}-${maxPlayers}`;
  if (!lobbyTables[key]) lobbyTables[key] = [];
  const table = {
    id,
    tableNumber:
      gameType === 'domino-royal'
        ? createDominoTableNumber((number) => dominoRoyalTableNumbers.has(number))
        : gameType === 'chess'
          ? createChessTableNumber()
          : null,
    gameType,
    stake,
    maxPlayers,
    players: [],
    currentTurn: null,
    ready: new Set(),
    meta,
    matchTimeout: null,
    started: false,
    gameStartPayload: null
  };
  if (gameType === 'domino-royal' && table.tableNumber) {
    dominoRoyalTableNumbers.add(table.tableNumber);
  }
  if (gameType === 'chess' && table.tableNumber) chessTableNumbers.add(table.tableNumber);
  lobbyTables[key].push(table);
  tableMap.set(table.id, table);
  console.log(
    `Created new table: ${table.id} (${gameType}, cap ${maxPlayers}, stake: ${stake})`
  );
  return table;
}

function getAvailableTable(
  gameType,
  stake = 0,
  maxPlayers = 4,
  matchMeta = {},
  forcedTableId = null,
  accountId = ''
) {
  const normalizedMeta = normalizeMatchMeta(matchMeta);
  const key = `${gameType}-${maxPlayers}`;
  if (!lobbyTables[key]) lobbyTables[key] = [];
  if (forcedTableId) {
    const isHostedTable = isReservedHostedTableId(forcedTableId, gameType, maxPlayers);
    const existing = tableMap.get(forcedTableId);
    if (existing) {
      const normalizedStake = Number(stake) || 0;
      const alreadySeated = existing.players.some(
        (player) => String(player.id) === String(accountId)
      );
      const canJoinForced =
        existing.gameType === gameType &&
        Number(existing.stake || 0) === normalizedStake &&
        (!existing.started || alreadySeated) &&
        (alreadySeated || existing.players.length < existing.maxPlayers) &&
        isMatchMetaCompatible(existing.meta, normalizedMeta, gameType);
      if (canJoinForced) return existing;
      if (isHostedTable) return null;
    }

    if (isHostedTable) {
      return createLobbyTable({
        id: String(forcedTableId),
        gameType,
        stake,
        maxPlayers,
        meta: normalizedMeta
      });
    }
    if (gameType === 'poolroyale' || gameType === 'snake') {
      return createLobbyTable({
        id: String(forcedTableId),
        gameType,
        stake,
        maxPlayers,
        meta: normalizedMeta
      });
    }
    // Ignore stale/non-existent forced ids so quick matchmaking can still pair
    // users by game type + stake instead of trapping them in a private table.
  }
  const open = lobbyTables[key].find(
    (t) =>
      t.stake === stake &&
      t.players.length < t.maxPlayers &&
      !isReservedHostedTableId(t.id, gameType, maxPlayers) &&
      isMatchMetaCompatible(t.meta, normalizedMeta, gameType)
  );
  if (open) return open;
  return createLobbyTable({ gameType, stake, maxPlayers, meta: normalizedMeta });
}

function resolveSeatIdentityFromTableId(tableId, fallbackGameType, fallbackMaxPlayers) {
  const normalizedFallbackGameType = normalizeOnlineGameType(fallbackGameType);
  if (!tableId) {
    return {
      gameType: normalizedFallbackGameType,
      maxPlayers: fallbackMaxPlayers
    };
  }

  const [prefix, capStr] = String(tableId).split('-');
  const normalizedPrefix = normalizeOnlineGameType(prefix);
  const parsedCap = Number(capStr);

  // Some joins use invite/table ids that are opaque (UUID-like) and not in
  // "<game>-<capacity>-..." form. In those cases, keep the explicit payload
  // gameType/maxPlayers instead of inferring invalid values from the table id.
  if (
    !GAME_ONLINE_POLICY[normalizedPrefix] ||
    !Number.isFinite(parsedCap) ||
    parsedCap <= 0
  ) {
    return {
      gameType: normalizedFallbackGameType,
      maxPlayers: fallbackMaxPlayers
    };
  }

  return {
    gameType: normalizedPrefix,
    maxPlayers: parsedCap
  };
}

function cleanupSeats() {
  const now = Date.now();
  for (const [tableId, players] of tableSeats) {
    for (const [pid, info] of players) {
      if (now - info.ts > lobbySeatTtlMs) {
        // Keep the public table and its authoritative seat map in sync. Merely
        // deleting the seat-map entry leaves a ghost in table.players; the next
        // quick-match player can then be started against that disconnected
        // ghost instead of another person who is genuinely waiting.
        unseatTableSocket(pid, tableId, info.socketId);
      }
    }
  }
}


function createInitialChessBoard() {
  const rows = CHESS_START_FEN.split(' ')[0].split('/');
  return rows.map((row) => {
    const cells = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i += 1) cells.push(null);
      } else {
        cells.push({ t: ch.toUpperCase(), w: ch === ch.toUpperCase(), hasMoved: false });
      }
    }
    return cells;
  });
}

function cloneChessBoard(board) {
  return (Array.isArray(board) ? board : createInitialChessBoard()).map((row) =>
    (Array.isArray(row) ? row : []).map((piece) =>
      piece ? { t: piece.t, w: Boolean(piece.w), hasMoved: Boolean(piece.hasMoved) } : null
    )
  );
}

function normalizeChessBoard(board) {
  if (!Array.isArray(board) || board.length !== 8) return createInitialChessBoard();
  const normalized = board.map((row) => {
    if (!Array.isArray(row) || row.length !== 8) return null;
    return row.map((piece) => {
      if (!piece) return null;
      const type = String(piece.t || '').toUpperCase();
      if (!['P', 'N', 'B', 'R', 'Q', 'K'].includes(type)) return null;
      return { t: type, w: Boolean(piece.w), hasMoved: Boolean(piece.hasMoved) };
    });
  });
  return normalized.every(Boolean) ? normalized : createInitialChessBoard();
}

function chessBoardToFen(board, whiteToMove = true) {
  const rows = normalizeChessBoard(board).map((row) => {
    let fenRow = '';
    let empty = 0;
    row.forEach((piece) => {
      if (!piece) {
        empty += 1;
        return;
      }
      if (empty) {
        fenRow += String(empty);
        empty = 0;
      }
      fenRow += piece.w ? piece.t : piece.t.toLowerCase();
    });
    if (empty) fenRow += String(empty);
    return fenRow || '8';
  });
  return `${rows.join('/')} ${whiteToMove ? 'w' : 'b'} - - 0 1`;
}

function chessInBoard(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

const CHESS_KNIGHT_DELTAS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1]
];
const CHESS_SLIDE_DIRS = {
  B: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  R: [[-1, 0], [1, 0], [0, -1], [0, 1]],
  Q: [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]
};

function chessPseudoMoves(board, r, c) {
  const piece = board?.[r]?.[c];
  if (!piece) return [];
  const moves = [];
  const push = (rr, cc) => {
    if (!chessInBoard(rr, cc)) return;
    const target = board[rr][cc];
    if (!target || target.w !== piece.w) moves.push([rr, cc]);
  };
  if (piece.t === 'P') {
    const dir = piece.w ? -1 : 1;
    const start = piece.w ? 6 : 1;
    if (chessInBoard(r + dir, c) && !board[r + dir][c]) {
      moves.push([r + dir, c]);
      if (r === start && !board[r + dir * 2][c]) moves.push([r + dir * 2, c]);
    }
    [-1, 1].forEach((dc) => {
      const rr = r + dir;
      const cc = c + dc;
      if (chessInBoard(rr, cc) && board[rr][cc] && board[rr][cc].w !== piece.w) moves.push([rr, cc]);
    });
  } else if (piece.t === 'N') {
    CHESS_KNIGHT_DELTAS.forEach(([dr, dc]) => push(r + dr, c + dc));
  } else if (CHESS_SLIDE_DIRS[piece.t]) {
    CHESS_SLIDE_DIRS[piece.t].forEach(([dr, dc]) => {
      let rr = r + dr;
      let cc = c + dc;
      while (chessInBoard(rr, cc)) {
        if (board[rr][cc]) {
          if (board[rr][cc].w !== piece.w) moves.push([rr, cc]);
          break;
        }
        moves.push([rr, cc]);
        rr += dr;
        cc += dc;
      }
    });
  } else if (piece.t === 'K') {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr || dc) push(r + dr, c + dc);
      }
    }
  }
  return moves;
}

function findChessKing(board, white) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = board[r][c];
      if (piece?.t === 'K' && piece.w === white) return [r, c];
    }
  }
  return null;
}

function isChessSquareAttacked(board, r, c, byWhite) {
  for (let rr = 0; rr < 8; rr += 1) {
    for (let cc = 0; cc < 8; cc += 1) {
      const piece = board[rr][cc];
      if (!piece || piece.w !== byWhite) continue;
      if (chessPseudoMoves(board, rr, cc).some(([r2, c2]) => r2 === r && c2 === c)) return true;
    }
  }
  return false;
}

function isChessPlayerInCheck(board, white) {
  const king = findChessKing(board, white);
  return king ? isChessSquareAttacked(board, king[0], king[1], !white) : false;
}

function applyChessMoveOnBoard(board, fromR, fromC, toR, toC) {
  const next = cloneChessBoard(board);
  const piece = next[fromR][fromC];
  if (!piece) return next;
  const isCastling = piece.t === 'K' && Math.abs(toC - fromC) === 2;
  if (isCastling) {
    const rookFromC = toC > fromC ? 7 : 0;
    const rookToC = toC > fromC ? 5 : 3;
    const rook = next[fromR][rookFromC];
    next[fromR][rookToC] = rook;
    next[fromR][rookFromC] = null;
    if (rook) rook.hasMoved = true;
  }
  next[toR][toC] = piece;
  next[fromR][fromC] = null;
  piece.hasMoved = true;
  if (piece.t === 'P' && (toR === 0 || toR === 7)) piece.t = 'Q';
  return next;
}

function getChessCastlingTargets(board, r, c, white) {
  const piece = board?.[r]?.[c];
  if (!piece || piece.t !== 'K' || piece.w !== white || piece.hasMoved) return [];
  const homeRow = white ? 7 : 0;
  if (r !== homeRow || c !== 4 || isChessPlayerInCheck(board, white)) return [];
  const results = [];
  const checkSide = (rookCol, emptyCols, transitCols, destCol) => {
    const rook = board[homeRow][rookCol];
    if (!rook || rook.t !== 'R' || rook.w !== white || rook.hasMoved) return;
    if (emptyCols.some((col) => board[homeRow][col])) return;
    if (transitCols.some((col) => isChessSquareAttacked(board, homeRow, col, !white))) return;
    results.push([homeRow, destCol]);
  };
  checkSide(7, [5, 6], [5, 6], 6);
  checkSide(0, [1, 2, 3], [3, 2], 2);
  return results;
}

function getLegalChessMoves(board, r, c) {
  const piece = board?.[r]?.[c];
  if (!piece) return [];
  const pseudo = chessPseudoMoves(board, r, c);
  if (piece.t === 'K') pseudo.push(...getChessCastlingTargets(board, r, c, piece.w));
  return pseudo.filter(([toR, toC]) => !isChessPlayerInCheck(applyChessMoveOnBoard(board, r, c, toR, toC), piece.w));
}

function hasAnyLegalChessMove(board, white) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      if (board?.[r]?.[c]?.w === white && getLegalChessMoves(board, r, c).length > 0) return true;
    }
  }
  return false;
}

function validateAndApplyChessMove(state, playerId, move = {}) {
  if (state.winner) return { ok: false, error: 'game_finished' };
  const player = (state.players || []).find((p) => String(p.id) === String(playerId));
  // Never infer permission from the colour of the submitted piece. A socket
  // must own one of the two authoritative match seats before it may move.
  if (!player?.side) return { ok: false, error: 'seat_required' };
  const board = normalizeChessBoard(state.board);
  const lastMove = move.lastMove || {};
  const from = lastMove.from || {};
  const to = lastMove.to || {};
  const coords = [from.r, from.c, to.r, to.c].map((value) => Number(value));
  if (!coords.every(Number.isInteger)) return { ok: false, error: 'invalid_coordinates' };
  const [fromR, fromC, toR, toC] = coords;
  if (!chessInBoard(fromR, fromC) || !chessInBoard(toR, toC)) return { ok: false, error: 'invalid_coordinates' };
  const piece = board[fromR][fromC];
  if (!piece) return { ok: false, error: 'empty_source' };
  if (piece.w !== Boolean(state.turnWhite)) return { ok: false, error: 'wrong_turn_piece' };
  if (player.side !== (piece.w ? 'white' : 'black')) return { ok: false, error: 'wrong_player_turn' };
  const legal = getLegalChessMoves(board, fromR, fromC);
  if (!legal.some(([r, c]) => r === toR && c === toC)) return { ok: false, error: 'illegal_move' };
  const nextBoard = applyChessMoveOnBoard(board, fromR, fromC, toR, toC);
  const turnWhite = !state.turnWhite;
  const hasReply = hasAnyLegalChessMove(nextBoard, turnWhite);
  const inCheck = isChessPlayerInCheck(nextBoard, turnWhite);
  const winner = !hasReply && inCheck ? (turnWhite ? 'black' : 'white') : null;
  const draw = !hasReply && !inCheck ? 'stalemate' : null;
  return {
    ok: true,
    state: {
      board: nextBoard,
      fen: chessBoardToFen(nextBoard, turnWhite),
      turnWhite,
      lastMove: { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } },
      winner,
      draw,
      moveSeq: Number(state.moveSeq || 0) + 1
    }
  };
}

function getChessState(tableId) {
  if (!chessGames.has(tableId)) {
    const board = createInitialChessBoard();
    chessGames.set(tableId, {
      board,
      fen: chessBoardToFen(board, true),
      turnWhite: true,
      lastMove: null,
      moveSeq: 0,
      players: [],
      updatedAt: Date.now()
    });
  }
  return chessGames.get(tableId);
}

function updateChessState(tableId, nextState = {}) {
  const base = getChessState(tableId);
  const merged = {
    ...base,
    ...nextState,
    board: normalizeChessBoard(nextState.board || base.board),
    updatedAt: Date.now()
  };
  merged.fen = nextState.fen || chessBoardToFen(merged.board, merged.turnWhite);
  chessGames.set(tableId, merged);
  return merged;
}

function normalizeSidePreference(pref) {
  const normalized = String(pref || '').trim().toLowerCase();
  return normalized === 'white' || normalized === 'black' ? normalized : 'auto';
}

function assignCheckersSides(players = []) {
  if (!Array.isArray(players)) return [];
  if (players.length <= 1) {
    return players.map((p, idx) => ({
      ...p,
      side: idx === 0 ? 'light' : 'dark'
    }));
  }

  const [p1, p2] = players.map((p) => ({
    ...p,
    sidePreference: normalizeSidePreference(p.sidePreference)
  }));

  let lightPlayer = null;
  let darkPlayer = null;

  if (p1.sidePreference === 'white' && p2.sidePreference === 'black') {
    lightPlayer = p1;
    darkPlayer = p2;
  } else if (p1.sidePreference === 'black' && p2.sidePreference === 'white') {
    lightPlayer = p2;
    darkPlayer = p1;
  } else if (p1.sidePreference === 'white' && p2.sidePreference !== 'white') {
    lightPlayer = p1;
    darkPlayer = p2;
  } else if (p2.sidePreference === 'white' && p1.sidePreference !== 'white') {
    lightPlayer = p2;
    darkPlayer = p1;
  } else if (p1.sidePreference === 'black' && p2.sidePreference !== 'black') {
    darkPlayer = p1;
    lightPlayer = p2;
  } else if (p2.sidePreference === 'black' && p1.sidePreference !== 'black') {
    darkPlayer = p2;
    lightPlayer = p1;
  } else {
    const p1Light = Math.random() < 0.5;
    lightPlayer = p1Light ? p1 : p2;
    darkPlayer = p1Light ? p2 : p1;
  }

  return players.map((p) => ({
    ...p,
    side: p.id === lightPlayer.id ? 'light' : 'dark'
  }));
}

function assignChessSides(players = []) {
  if (!Array.isArray(players)) return [];
  if (players.length <= 1) {
    return players.map((p, idx) => ({
      ...p,
      side: idx === 0 ? 'white' : 'black'
    }));
  }

  // Competitive quick match never lets a client choose its colour. Apart from
  // being fair, assigning both seats in one authoritative operation guarantees
  // that two clients can never render themselves with the same pieces.
  const whitePlayer = players[Math.floor(Math.random() * players.length)];

  return players.map((p) => ({
    ...p,
    side: p.id === whitePlayer.id ? 'white' : 'black'
  }));
}

function ensureCheckersSession(tableId, table = null) {
  let session = checkersMatchSessions.get(tableId);
  if (!session) {
    session = {
      tableId,
      stake: Number(table?.stake || 0),
      token: table?.meta?.token || 'TPG',
      playersBySide: {
        light: table?.players?.find((p) => p.side === 'light')?.id || null,
        dark: table?.players?.find((p) => p.side === 'dark')?.id || null
      },
      processedMoveIds: new Set(),
      lastMoveAtByPlayer: new Map()
    };
    checkersMatchSessions.set(tableId, session);
  }
  return session;
}

async function settleCheckersMatch({
  tableId,
  winnerId,
  loserId,
  reason = 'match_end',
  stake = 0,
  token = 'TPG'
} = {}) {
  if (!winnerId || !loserId || !stake) {
    return {
      ok: true,
      status: 'skipped',
      reason: stake ? 'missing_players' : 'zero_stake'
    };
  }

  const round = 1;
  const settlementKey = `${tableId}:${round}`;
  if (checkersSettlementLedger.has(settlementKey)) {
    return {
      ok: true,
      status: 'duplicate',
      settlement: checkersSettlementLedger.get(settlementKey)
    };
  }

  const now = new Date();
  const payoutAmount = Number(stake) * 2;
  const detail = `checkers:${tableId}:${reason}`;
  const result = await User.bulkWrite([
    {
      updateOne: {
        filter: { accountId: String(winnerId), isBanned: { $ne: true } },
        update: {
          $inc: { balance: payoutAmount },
          $push: {
            transactions: {
              amount: payoutAmount,
              type: 'game_win',
              token,
              game: 'checkersbattle',
              players: 2,
              detail,
              date: now
            }
          }
        }
      }
    },
    {
      updateOne: {
        filter: { accountId: String(loserId), isBanned: { $ne: true } },
        update: {
          $push: {
            transactions: {
              amount: 0,
              type: 'game_loss',
              token,
              game: 'checkersbattle',
              players: 2,
              detail,
              date: now
            }
          }
        }
      }
    }
  ]);

  const settlement = {
    idempotencyKey: settlementKey,
    winnerId: String(winnerId),
    loserId: String(loserId),
    payoutAmount,
    token,
    reason,
    matched: result.matchedCount || 0,
    modified: result.modifiedCount || 0,
    settledAt: now.toISOString()
  };
  checkersSettlementLedger.set(settlementKey, settlement);
  return { ok: true, status: 'settled', settlement };
}

async function seatTableSocket(
  accountId,
  gameType,
  stake,
  maxPlayers,
  playerName,
  socket,
  playerAvatar,
  preferredSide,
  matchMeta = {},
  forcedTableId = null
) {
  if (!accountId) return null;
  console.log(
    `Seating player ${playerName || accountId} at ${gameType}-${maxPlayers} (stake ${stake})`
  );
  // Remove disconnected/expired seats before choosing an open table so a
  // quick-match request always searches the current queue state.
  cleanupSeats();
  const table = getAvailableTable(
    gameType,
    stake,
    maxPlayers,
    matchMeta,
    forcedTableId,
    accountId
  );
  if (!table) return null;
  const tableId = table.id;
  // Ensure this user is not seated at any other table
  for (const id of Array.from(tableSeats.keys())) {
    if (id !== tableId && tableSeats.get(id)?.has(String(accountId))) {
      unseatTableSocket(accountId, id);
    }
  }
  let map = tableSeats.get(tableId);
  if (!map) {
    map = new Map();
    tableSeats.set(tableId, map);
  }
  // Keep one authoritative roster entry per TPG account. Besides protecting
  // new joins, this repairs a table created by an older process/client that
  // managed to append the same account through two transports.
  const normalizedAccountId = String(accountId);
  table.players = table.players.filter((player, index, players) => {
    const playerId = String(player?.tpcAccountNumber || player?.id || '');
    return playerId !== normalizedAccountId ||
      players.findIndex((candidate) =>
        String(candidate?.tpcAccountNumber || candidate?.id || '') === normalizedAccountId
      ) === index;
  });
  if (!map.has(normalizedAccountId)) {
    map.set(normalizedAccountId, {
      id: accountId,
      tpcAccountNumber: String(accountId),
      name: playerName || String(accountId),
      avatar: playerAvatar || '',
      ts: Date.now(),
      socketId: socket?.id,
      sidePreference: normalizeSidePreference(preferredSide)
    });
    const existingPlayer = table.players.find(
      (player) =>
        String(player?.tpcAccountNumber || player?.id || '') ===
        normalizedAccountId
    );
    if (existingPlayer) {
      existingPlayer.socketId = socket?.id;
      existingPlayer.name = playerName || existingPlayer.name;
      existingPlayer.avatar = playerAvatar || existingPlayer.avatar;
      existingPlayer.sidePreference = normalizeSidePreference(
        preferredSide || existingPlayer.sidePreference
      );
    } else {
      table.players.push({
        id: accountId,
        tpcAccountNumber: String(accountId),
        name: playerName || String(accountId),
        avatar: playerAvatar || '',
        position: 0,
        socketId: socket?.id,
        sidePreference: normalizeSidePreference(preferredSide)
      });
      if (table.players.length === 1) table.currentTurn = accountId;
    }
  } else {
    const info = map.get(String(accountId));
    info.name = playerName || info.name;
    info.avatar = playerAvatar || info.avatar;
    info.ts = Date.now();
    info.socketId = socket?.id;
    info.sidePreference = normalizeSidePreference(preferredSide || info.sidePreference);
    const p = table.players.find((pl) => String(pl.id) === normalizedAccountId);
    if (p) {
      p.socketId = socket?.id;
      p.avatar = playerAvatar || p.avatar;
      p.sidePreference = normalizeSidePreference(preferredSide || p.sidePreference);
    }
  }
  console.log(`Player ${playerName || accountId} joined table ${tableId}`);
  socket?.join(tableId);
  if (table.gameType === 'domino-royal' && table.players.length === 1 && !table.matchTimeout) {
    table.matchTimeout = setTimeout(() => {
      table.matchTimeout = null;
      const currentTable = tableMap.get(table.id);
      if (!currentTable || currentTable.players.length >= currentTable.maxPlayers) return;
      io.to(table.id).emit('dominoRoyalMatchTimeout', {
        tableId: table.id,
        tableNumber: table.tableNumber,
        timeoutMs: dominoRoyalMatchTimeoutMs
      });
      for (const player of [...currentTable.players]) {
        unseatTableSocket(player.id, table.id, player.socketId);
      }
    }, dominoRoyalMatchTimeoutMs);
  }
  if (!table.started) table.ready.delete(normalizedAccountId);
  if (!table.meta) {
    table.meta = normalizeMatchMeta(matchMeta);
  }
  io.to(tableId).emit('lobbyUpdate', {
    tableId,
    tableNumber: table.tableNumber,
    players: table.players,
    currentTurn: table.currentTurn,
    ready: Array.from(table.ready),
    meta: table.meta
  });
  return table;
}


async function reserveChessStakeContract(table) {
  if (!table || table.gameType !== 'chess') return { ok: true };
  if (process.env.SKIP_CHESS_STAKE_RESERVATION === '1') {
    const matchId = table.matchId || `test-${randomUUID()}`;
    table.matchId = matchId;
    return { ok: true, matchId };
  }
  if (table.matchId) return { ok: true, matchId: table.matchId };
  const accounts = table.players.map((player) => String(player.tpcAccountNumber || player.id || '')).filter(Boolean);
  const stake = Number(table.stake || 0);
  if (accounts.length !== 2 || new Set(accounts).size !== 2 || !Number.isSafeInteger(stake) || stake <= 0) {
    return { ok: false, error: 'invalid_chess_stake_contract' };
  }
  const session = await mongoose.startSession();
  try {
    let matchId = '';
    await session.withTransaction(async () => {
      const activeMatches = await ChessMatch.find({
        status: { $in: ['reserved', 'playing'] },
        $or: [
          { player1TpcAccountId: { $in: accounts } },
          { player2TpcAccountId: { $in: accounts } }
        ]
      }).session(session);
      for (const active of activeMatches) {
        const activeTable = tableMap.get(String(active.roomId));
        const hasConnectedPlayer = activeTable?.players?.some((player) => {
          const liveSocket = io.sockets.sockets.get(String(player.socketId || ''));
          return liveSocket?.rooms?.has(String(active.roomId));
        });
        if (hasConnectedPlayer) {
          throw new Error('account_already_in_active_match');
        }

        // A server restart or a closed WebView can leave a persisted chess
        // contract marked "playing" even though its Socket.IO room no longer
        // has either phone. Such an orphan used to permanently reject every
        // later Quick Match for both accounts. Refund the locked stakes inside
        // this transaction before reserving the replacement match.
        const orphanAccounts = [
          active.player1TpcAccountId,
          active.player2TpcAccountId
        ].map(String);
        const releaseIds = [];
        for (const orphanAccount of orphanAccounts) {
          const transactionId = `chess:${active.internalMatchId}:orphan-refund:${orphanAccount}`;
          releaseIds.push(transactionId);
          await User.updateOne(
            {
              $or: [
                { tpcAccountNumber: orphanAccount },
                { accountId: orphanAccount }
              ],
              'transactions.transactionId': { $ne: transactionId }
            },
            {
              $inc: { balance: Number(active.stakePerPlayer || 0) },
              $set: { currentTableId: null },
              $push: {
                transactions: {
                  transactionId,
                  amount: Number(active.stakePerPlayer || 0),
                  type: 'stake_refund',
                  token: active.token || 'TPG',
                  status: 'delivered',
                  game: 'chessbattle',
                  players: 2,
                  detail: 'orphaned_match_recovery'
                }
              }
            },
            { session }
          );
        }
        active.status = 'refunded';
        active.result = 'orphaned_match_recovery';
        active.releaseTransactionIds = releaseIds;
        await active.save({ session });
      }
      const users = await User.find({
        $or: [
          { tpcAccountNumber: { $in: accounts } },
          { accountId: { $in: accounts } }
        ],
        balance: { $gte: stake },
        isBanned: { $ne: true }
      }).session(session);
      const byAccount = new Map(users.flatMap((user) => [String(user.tpcAccountNumber || ''), String(user.accountId || '')].filter(Boolean).map((id) => [id, user])));
      if (accounts.some((account) => !byAccount.has(account))) throw new Error('insufficient_balance_or_account_missing');
      matchId = randomUUID();
      const transactionIds = accounts.map((account) => `chess:${matchId}:reserve:${account}`);
      for (const [index, account] of accounts.entries()) {
        const user = byAccount.get(account);
        user.balance = Number(user.balance || 0) - stake;
        user.currentTableId = table.tableNumber || table.id;
        user.transactions.push({
          transactionId: transactionIds[index],
          amount: -stake,
          type: 'stake_reserve',
          token: 'TPG',
          status: 'reserved',
          game: 'chessbattle',
          players: 2,
          detail: matchId
        });
        await user.save({ session });
      }
      await ChessMatch.create([{
        tableNumber: table.tableNumber || table.id,
        internalMatchId: matchId,
        roomId: table.id,
        player1TpcAccountId: accounts[0],
        player2TpcAccountId: accounts[1],
        stakePerPlayer: stake,
        totalLockedStake: stake * 2,
        stakeTransactionIds: transactionIds,
        status: 'playing',
        startedAt: new Date()
      }], { session });
    });
    table.matchId = matchId;
    return { ok: true, matchId };
  } catch (error) {
    return { ok: false, error: error.message || 'stake_contract_failed' };
  } finally {
    await session.endSession();
  }
}

async function settleChessStakeContract(tableId, result = {}) {
  const winnerSide = result.winner === 'white' || result.winner === 'black' ? result.winner : null;
  const isDraw = result.draw || !winnerSide;
  const table = tableMap.get(tableId);
  const session = await mongoose.startSession();
  try {
    let settlement = null;
    await session.withTransaction(async () => {
      const match = await ChessMatch.findOne({ roomId: tableId }).session(session);
      if (!match) throw new Error('match_not_found');
      if (['finished', 'draw', 'refunded'].includes(match.status)) {
        settlement = { status: match.status, matchId: match.internalMatchId };
        return;
      }
      if (match.status !== 'playing') throw new Error('match_not_playing');
      const accounts = [match.player1TpcAccountId, match.player2TpcAccountId];
      if (isDraw) {
        for (const account of accounts) {
          const transactionId = `chess:${match.internalMatchId}:draw:${account}`;
          await User.updateOne({ $or: [{ tpcAccountNumber: account }, { accountId: account }], 'transactions.transactionId': { $ne: transactionId } }, {
            $inc: { balance: match.stakePerPlayer },
            $set: { currentTableId: null },
            $push: { transactions: { transactionId, amount: match.stakePerPlayer, type: 'stake_refund', token: 'TPG', status: 'delivered', game: 'chessbattle', players: 2, detail: 'draw' } }
          }, { session });
        }
        match.status = 'draw';
        match.result = String(result.draw || 'draw');
      } else {
        const players = Array.isArray(table?.players) ? table.players : [];
        const winnerPlayer = players.find((player) => player.side === winnerSide);
        const winnerAccount = String(winnerPlayer?.tpcAccountNumber || winnerPlayer?.id || (winnerSide === 'white' ? accounts[0] : accounts[1]));
        const gross = Number(match.totalLockedStake || match.stakePerPlayer * 2);
        const houseFee = Math.floor((gross * CHESS_HOUSE_FEE_BPS) / 10_000);
        const payout = gross - houseFee;
        const payoutTx = `chess:${match.internalMatchId}:payout:${winnerAccount}`;
        await User.updateOne({ $or: [{ tpcAccountNumber: winnerAccount }, { accountId: winnerAccount }], 'transactions.transactionId': { $ne: payoutTx } }, {
          $inc: { balance: payout },
          $set: { currentTableId: null },
          $push: { transactions: { transactionId: payoutTx, amount: payout, type: 'stake_payout', token: 'TPG', status: 'delivered', game: 'chessbattle', players: 2, detail: match.internalMatchId } }
        }, { session });
        const loserAccount = accounts.find((account) => account !== winnerAccount);
        if (loserAccount) await User.updateOne({ $or: [{ tpcAccountNumber: loserAccount }, { accountId: loserAccount }] }, { $set: { currentTableId: null } }, { session });
        if (houseFee > 0 && CHESS_HOUSE_ACCOUNT) {
          const feeTx = `chess:${match.internalMatchId}:house:${CHESS_HOUSE_ACCOUNT}`;
          await User.updateOne({ $or: [{ tpcAccountNumber: CHESS_HOUSE_ACCOUNT }, { accountId: CHESS_HOUSE_ACCOUNT }] }, {
            $inc: { balance: houseFee },
            $push: { transactions: { transactionId: feeTx, amount: houseFee, type: 'house_fee', token: 'TPG', status: 'delivered', game: 'chessbattle', players: 2, detail: match.internalMatchId } }
          }, { session });
        }
        match.status = 'finished';
        match.winnerTpcAccountId = winnerAccount;
        match.result = `${winnerSide}_checkmate`;
      }
      await match.save({ session });
      settlement = { status: match.status, matchId: match.internalMatchId, winner: match.winnerTpcAccountId || null };
    });
    return { ok: true, settlement };
  } catch (error) {
    return { ok: false, error: error.message || 'settlement_failed' };
  } finally {
    await session.endSession();
  }
}

function maybeStartGame(table) {
  if (table.started) return;
  if (
    table.players.length === table.maxPlayers &&
    table.ready &&
    table.ready.size === table.maxPlayers
  ) {
    if (table.startTimeout) return;
    table.startTimeout = setTimeout(async () => {
      table.startTimeout = null;
      if (
        tableMap.get(table.id) !== table ||
        table.players.length !== table.maxPlayers ||
        table.ready.size !== table.maxPlayers ||
        table.players.some((player) => !table.ready.has(String(player.id)))
      ) {
        return;
      }
      console.log(`Table ${table.id} confirmed by all players. Starting game.`);
      if (table.gameType === 'chess') {
        const reservation = await reserveChessStakeContract(table);
        if (!reservation.ok) {
          table.ready.clear();
          io.to(table.id).emit('errorMessage', reservation.error);
          io.to(table.id).emit('lobbyUpdate', {
            tableId: table.id,
            tableNumber: table.tableNumber,
            players: table.players,
            currentTurn: table.currentTurn,
            ready: [],
            meta: table.meta
          });
          return;
        }
      }
      if (table.matchTimeout) {
        clearTimeout(table.matchTimeout);
        table.matchTimeout = null;
      }
      if (table.gameType === 'poolroyale') {
        const randomStarter = table.players[Math.floor(Math.random() * table.players.length)];
        if (randomStarter) table.currentTurn = randomStarter.id;
      } else if (table.gameType === 'chess') {
        table.players = assignChessSides(table.players);
        const whitePlayer = table.players.find((p) => p.side === 'white');
        if (whitePlayer) table.currentTurn = whitePlayer.id;
        const board = createInitialChessBoard();
        const initial = updateChessState(table.id, {
          board,
          fen: chessBoardToFen(board, true),
          turnWhite: true,
          lastMove: null,
          moveSeq: 0,
          players: table.players
        });
        io.to(table.id).emit('chessState', { tableId: table.id, ...initial });
      } else if (table.gameType === 'checkers') {
        table.players = assignCheckersSides(table.players);
        const lightPlayer = table.players.find((p) => p.side === 'light');
        if (lightPlayer) table.currentTurn = lightPlayer.id;
        const initial = checkersRealtimeStore.setState(table.id, {
          turn: SIDES.LIGHT,
          lastMove: null,
          requiredFrom: null,
          winner: null,
          reason: null,
          moveSeq: 0
        });
        ensureCheckersSession(table.id, table);
        io.to(table.id).emit('checkersState', { tableId: table.id, ...initial });
      }
      const gameStartPayload = {
        tableId: table.id,
        tableNumber: table.tableNumber,
        players: table.players,
        currentTurn: table.currentTurn,
        stake: table.stake,
        meta: table.meta,
        matchId: table.matchId || null
      };
      // Persist the authoritative transition before broadcasting it. A phone
      // can reconnect or receive its seat acknowledgement just after the
      // broadcast; returning this snapshot lets that client enter the exact
      // same match instead of remaining forever on the lobby screen.
      table.started = true;
      table.gameStartPayload = gameStartPayload;
      // Older game clients subscribe to `gameStarted`, while current lobbies
      // subscribe to both names. Broadcasting the compatibility event as part
      // of the same authoritative transition prevents one phone remaining on
      // the search screen when accounts use different cached app versions.
      io.to(table.id).emit('gameStart', gameStartPayload);
      io.to(table.id).emit('gameStarted', gameStartPayload);
      tableSeats.delete(table.id);
      const key = `${table.gameType}-${table.maxPlayers}`;
      lobbyTables[key] = (lobbyTables[key] || []).filter(
        (t) => t.id !== table.id
      );
      if (table.gameType === 'poolroyale') {
        poolStates.set(table.id, { state: null, hud: null, layout: null, ts: Date.now(), revision: 0 });
      } else if (table.gameType === 'domino-royal') {
        dominoRoyalStates.set(table.id, { state: null, action: null, ts: Date.now() });
      } else if (table.gameType === 'murlanroyale') {
        murlanRoyalStates.set(table.id, { state: null, action: null, ts: Date.now(), revision: 0 });
      } else if (table.gameType === 'airhockey') {
        airHockeyStates.set(table.id, { state: null, inputs: {}, ts: Date.now(), revision: 0 });
      } else if (table.gameType === 'texasholdem') {
        texasHoldemStates.set(table.id, { state: null, action: null, ts: Date.now(), revision: 0 });
      }
    }, 1000);
  }
}

function unseatTableSocket(accountId, tableId, socketId) {
  if (!tableId) return;
  const map = tableSeats.get(tableId);
  const normalizedAccountId = accountId ? String(accountId) : '';
  // A mobile WebView can reconnect before Socket.IO finishes disconnecting the
  // previous transport. seatTableSocket transfers the authoritative seat to
  // the new socket. Do not let the late `disconnecting` event from the old
  // socket remove that restored seat (and strand only one player in the game).
  if (normalizedAccountId && socketId) {
    const currentSeat = map?.get(normalizedAccountId);
    if (currentSeat?.socketId && currentSeat.socketId !== socketId) return;
  }
  if (map) {
    if (normalizedAccountId) map.delete(normalizedAccountId);
    else if (socketId) {
      for (const [pid, info] of map) {
        if (info.socketId === socketId) map.delete(pid);
      }
    }
    if (map.size === 0) tableSeats.delete(tableId);
  }
  const table = tableMap.get(tableId);
  if (table) {
    if (table.startTimeout) {
      clearTimeout(table.startTimeout);
      table.startTimeout = null;
    }
    if (normalizedAccountId)
      table.players = table.players.filter(
        (p) => String(p.id) !== normalizedAccountId
      );
    else if (socketId)
      table.players = table.players.filter((p) => p.socketId !== socketId);
    if (table.ready) {
      if (accountId) table.ready.delete(String(accountId));
      if (socketId) {
        for (const [pid, info] of map || []) {
          if (info.socketId === socketId) table.ready.delete(pid);
        }
      }
    }
    if (table.players.length === 0) {
      if (table.gameType === 'checkers') {
        checkersRealtimeStore.clearState(tableId);
        checkersMatchSessions.delete(tableId);
      }
      if (table.gameType === 'domino-royal') {
        if (table.matchTimeout) {
          clearTimeout(table.matchTimeout);
          table.matchTimeout = null;
        }
        dominoRoyalStates.delete(tableId);
        if (table.tableNumber) dominoRoyalTableNumbers.delete(table.tableNumber);
      }
      if (table.gameType === 'ludobattleroyal') ludoBattleStates.delete(tableId);
      if (table.gameType === 'airhockey') airHockeyStates.delete(tableId);
      if (table.gameType === 'chess' && table.tableNumber) {
        chessTableNumbers.delete(table.tableNumber);
      }
      tableMap.delete(tableId);
      const key = `${table.gameType}-${table.maxPlayers}`;
      lobbyTables[key] = (lobbyTables[key] || []).filter(
        (t) => t.id !== tableId
      );
      table.currentTurn = null;
    } else if (table.currentTurn === accountId) {
      const nextIndex = 0;
      table.currentTurn = table.players[nextIndex].id;
    }
    io.to(tableId).emit('lobbyUpdate', {
      tableId,
      tableNumber: table.tableNumber,
      players: table.players,
      currentTurn: table.currentTurn,
      ready: Array.from(table.ready || []),
      meta: table.meta
    });
    if (accountId && table.currentTurn && table.currentTurn !== accountId) {
      io.to(tableId).emit('turnUpdate', { currentTurn: table.currentTurn });
    }
  }
  if (accountId) {
    User.updateOne({ accountId }, { currentTableId: null }).catch(() => {});
  }
}

app.get('/api/stats', async (req, res) => {
  try {
    await banUnauthenticatedAccounts();
    const authenticIds = await User.find(AUTHENTIC_ACCOUNT_QUERY, { _id: 1 }).lean();
    const authenticUserIds = authenticIds.map((entry) => entry._id);
    const [{ totalBalance = 0, totalMined = 0, nftCount = 0 } = {}] =
      await User.aggregate([
        { $match: { _id: { $in: authenticUserIds } } },
        {
          $project: {
            balance: 1,
            minedTPC: 1,
            nftCount: {
              $size: {
                $filter: {
                  input: { $ifNull: ['$gifts', []] },
                  as: 'g',
                  cond: { $ifNull: ['$$g.nftTokenId', false] }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalBalance: { $sum: '$balance' },
            totalMined: { $sum: '$minedTPC' },
            nftCount: { $sum: '$nftCount' }
          }
        }
      ]);
    const [accounts, telegramAccounts, googleAccounts, unauthenticatedAccounts, bannedAccounts] = await Promise.all([
      User.countDocuments(AUTHENTIC_ACCOUNT_QUERY),
      User.countDocuments({ ...AUTHENTIC_ACCOUNT_QUERY, telegramId: { $exists: true, $ne: null } }),
      User.countDocuments({ ...AUTHENTIC_ACCOUNT_QUERY, googleId: { $exists: true, $nin: ['', null] } }),
      User.countDocuments(UNAUTHENTIC_ACCOUNT_QUERY),
      User.countDocuments({ isBanned: true })
    ]);
    const active = await countOnline();
    const users = await User.find(
      { _id: { $in: authenticUserIds } },
      { transactions: 1, gifts: 1 }
    ).lean();
    let giftSends = 0;
    let bundlesSold = 0;
    let tonRaised = 0;
    let currentNfts = 0;
    let nftValue = 0;
    let appClaimed = 0;
    let externalClaimed = 0;
    let nftStoreItems = 0;
    for (const u of users) {
      const nftGifts = (u.gifts || []).filter((g) => g.nftTokenId);
      currentNfts += nftGifts.length;
      for (const g of nftGifts) {
        nftValue += g.price || 0;
      }
      for (const tx of u.transactions || []) {
        if (tx.type === 'gift') giftSends++;
        if (tx.type === 'store') {
          bundlesSold++;
        }
        if (tx.type === 'storefront') {
          nftStoreItems += Array.isArray(tx.items) ? tx.items.length : 0;
        }
        if (tx.type === 'claim') appClaimed += Math.abs(tx.amount || 0);
        if (tx.type === 'withdraw') externalClaimed += Math.abs(tx.amount || 0);
      }
    }

    const [transactionIntelligence = {}] = await User.aggregate([
      { $unwind: '$transactions' },
      {
        $group: {
          _id: null,
          transferCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$transactions.type', 'send'] },
                    { $gt: [{ $strLenCP: { $ifNull: ['$transactions.toAccount', ''] } }, 0] },
                    { $lt: ['$transactions.amount', 0] }
                  ]
                },
                1,
                0
              ]
            }
          },
          transferVolume: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$transactions.type', 'send'] },
                    { $gt: [{ $strLenCP: { $ifNull: ['$transactions.toAccount', ''] } }, 0] },
                    { $lt: ['$transactions.amount', 0] }
                  ]
                },
                { $abs: '$transactions.amount' },
                0
              ]
            }
          },
          gameTransactionsCount: {
            $sum: {
              $cond: [{ $ifNull: ['$transactions.game', false] }, 1, 0]
            }
          },
          gameTransactionsVolume: {
            $sum: {
              $cond: [
                { $ifNull: ['$transactions.game', false] },
                { $abs: '$transactions.amount' },
                0
              ]
            }
          },
          miningTransactionsCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$transactions.type', ['daily', 'spin', 'lucky', 'task']] },
                    { $gt: ['$transactions.amount', 0] }
                  ]
                },
                1,
                0
              ]
            }
          },
          miningTransactionsVolume: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$transactions.type', ['daily', 'spin', 'lucky', 'task']] },
                    { $gt: ['$transactions.amount', 0] }
                  ]
                },
                '$transactions.amount',
                0
              ]
            }
          }
        }
      }
    ]);

    const nftsBurned = giftSends - currentNfts;
    const totalNftItems = currentNfts + nftStoreItems;
    res.json({
      minted: totalBalance + totalMined,
      accounts,
      telegramAccounts,
      googleAccounts,
      unauthenticatedAccounts,
      bannedAccounts,
      activeUsers: active,
      nftsCreated: currentNfts,
      nftStoreItems,
      totalNftItems,
      nftsBurned,
      bundlesSold,
      matchesLive: tableMap.size,
      tonRaised,
      appClaimed: totalBalance,
      externalClaimed,
      nftValue,
      transferCount: transactionIntelligence.transferCount || 0,
      transferVolume: transactionIntelligence.transferVolume || 0,
      gameTransactionsCount: transactionIntelligence.gameTransactionsCount || 0,
      gameTransactionsVolume: transactionIntelligence.gameTransactionsVolume || 0,
      miningTransactionsCount: transactionIntelligence.miningTransactionsCount || 0,
      miningTransactionsVolume: transactionIntelligence.miningTransactionsVolume || 0,
      intelligenceGeneratedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to compute stats:', err.message);
    res.status(500).json({ error: 'failed to compute stats' });
  }
});

app.get('/api/stats/detailed', async (_req, res) => {
  try {
    await banUnauthenticatedAccounts();
    const [
      authenticAccounts,
      telegramAccounts,
      googleAccounts,
      unauthenticatedAccounts,
      bannedAccounts,
      suspiciousPreview
    ] = await Promise.all([
      User.countDocuments(AUTHENTIC_ACCOUNT_QUERY),
      User.countDocuments({ ...AUTHENTIC_ACCOUNT_QUERY, telegramId: { $exists: true, $ne: null } }),
      User.countDocuments({ ...AUTHENTIC_ACCOUNT_QUERY, googleId: { $exists: true, $nin: ['', null] } }),
      User.countDocuments(UNAUTHENTIC_ACCOUNT_QUERY),
      User.countDocuments({ isBanned: true }),
      User.find(
        UNAUTHENTIC_ACCOUNT_QUERY,
        {
          accountId: 1,
          walletAddress: 1,
          createdAt: 1,
          balance: 1,
          transactions: 1,
          gifts: 1,
          isMining: 1
        }
      )
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
    ]);

    res.json({
      summary: {
        authenticAccounts,
        telegramAccounts,
        googleAccounts,
        unauthenticatedAccounts,
        bannedAccounts
      },
      suspiciousPreview: suspiciousPreview.map((user) => ({
        accountId: user.accountId,
        createdAt: user.createdAt,
        walletAddress: user.walletAddress,
        balance: user.balance || 0,
        transactionCount: Array.isArray(user.transactions) ? user.transactions.length : 0,
        nftCount: Array.isArray(user.gifts) ? user.gifts.filter((g) => g?.nftTokenId).length : 0,
        isMining: Boolean(user.isMining)
      }))
    });
  } catch (err) {
    console.error('Failed to compute detailed stats:', err.message);
    res.status(500).json({ error: 'failed to compute detailed stats' });
  }
});

app.post('/api/admin/accounts/cleanup-fake', authenticate, async (req, res) => {
  if (!req.auth?.apiToken) return res.status(403).json({ error: 'forbidden' });
  const { mode = 'preview' } = req.body || {};
  const fakeFilter = {
    isBanned: { $ne: true },
    balance: { $lte: 0 },
    isMining: { $ne: true },
    $and: [
      { $or: [{ telegramId: { $exists: false } }, { telegramId: null }] },
      { $or: [{ googleId: { $exists: false } }, { googleId: { $in: ['', null] } }] }
    ],
    $expr: {
      $and: [
        { $eq: [{ $size: { $ifNull: ['$transactions', []] } }, 0] },
        { $eq: [{ $size: { $ifNull: ['$gifts', []] } }, 0] }
      ]
    }
  };

  try {
    const matched = await User.countDocuments(fakeFilter);
    if (mode !== 'execute') {
      return res.json({
        mode: 'preview',
        matched,
        message: 'Set mode=execute to ban and delete these fake guest accounts.'
      });
    }

    const fakeUsers = await User.find(fakeFilter, { _id: 1 }).lean();
    const ids = fakeUsers.map((entry) => entry._id);
    const [banResult, deleteResult] = await Promise.all([
      User.updateMany({ _id: { $in: ids } }, { $set: { isBanned: true } }),
      User.deleteMany({ _id: { $in: ids } })
    ]);
    res.json({
      mode: 'execute',
      matched,
      banned: banResult.modifiedCount || 0,
      deleted: deleteResult.deletedCount || 0
    });
  } catch (err) {
    console.error('Failed fake account cleanup:', err.message);
    res.status(500).json({ error: 'failed fake account cleanup' });
  }
});

app.post('/api/snake/table/seat', (req, res) => {
  const { tableId, name, avatar } = req.body || {};
  const pid = resolveTpcIdentity(req.body || {});
  if (!tableId || !pid) return res.status(400).json({ error: 'missing data' });
  const [gameType, capStr] = tableId.split('-');
  seatTableSocket(
    pid,
    gameType,
    0,
    Number(capStr) || 4,
    name,
    null,
    avatar,
    null,
    {},
    tableId
  );
  res.json({ success: true });
});

app.post('/api/snake/table/unseat', (req, res) => {
  const { tableId } = req.body || {};
  const pid = resolveTpcIdentity(req.body || {});
  unseatTableSocket(pid, tableId);
  res.json({ success: true });
});
app.get('/api/snake/lobbies', async (req, res) => {
  cleanupSeats();
  const capacities = [2, 3, 4];
  const lobbies = await Promise.all(
    capacities.map(async (cap) => {
      const id = `snake-${cap}`;
      const room = await gameManager.getRoom(id, cap);
      const roomCount = room.players.filter((p) => !p.disconnected).length;
      // Seats are stored in `tableSeats` under their actual table ids, which may
      // include additional stake or random components (e.g. `snake-2-100`).
      // Aggregate seats for all tables matching this game type and capacity.
      let lobbyCount = 0;
      for (const [tid, players] of tableSeats.entries()) {
        const t = tableMap.get(tid);
        if (t && t.gameType === 'snake' && t.maxPlayers === cap) {
          lobbyCount += players.size;
        }
      }
      const players = roomCount + lobbyCount;
      return { id, capacity: cap, players };
    })
  );
  res.json(lobbies);
});

app.get('/api/snake/lobby/:id', async (req, res) => {
  const { id } = req.params;
  const parts = id.split('-');
  const match = /(\d+)$/.exec(id);
  const gameType = parts[0] || 'snake';
  const cap = match ? Number(match[1]) : 4;

  const room = await gameManager.getRoom(id, cap);
  const roomPlayers = room.players
    .filter((p) => !p.disconnected)
    .map((p) => ({ id: p.playerId, name: p.name, avatar: p.avatar }));

  const seen = new Set();
  const lobbyPlayers = [];
  for (const [tid, players] of tableSeats.entries()) {
    const table = tableMap.get(tid);
    if (!table || table.gameType !== gameType || table.maxPlayers !== cap) continue;
    for (const info of players.values()) {
      if (seen.has(info.id)) continue;
      seen.add(info.id);
      lobbyPlayers.push({ id: info.id, name: info.name, avatar: info.avatar });
    }
  }

  res.json({ id, capacity: cap, players: [...lobbyPlayers, ...roomPlayers] });
});

app.get('/api/snake/board/:id', async (req, res) => {
  const { id } = req.params;
  const match = /-(\d+)$/.exec(id);
  const cap = match ? Number(match[1]) : 4;
  const room = await gameManager.getRoom(id, cap);
  // Persist the board so all players receive the same layout
  await gameManager.saveRoom(room).catch(() => {});
  res.json({
    snakes: room.snakes,
    ladders: room.ladders,
    diceCells: room.diceCells
  });
});
app.get('/api/watchers/count/:id', (req, res) => {
  const set = tableWatchers.get(req.params.id);
  res.json({ count: set ? set.size : 0 });
});

app.get('/api/checkers/lobbies', async (req, res) => {
  const capacities = [2];
  const lobbies = await Promise.all(
    capacities.map(async (cap) => {
      const id = `checkers-${cap}`;
      const room = await gameManager.getRoom(id, cap);
      const players = room.players.filter((p) => !p.disconnected).length;
      return { id, capacity: cap, players };
    })
  );
  res.json(lobbies);
});

app.get('/api/checkers/lobby/:id', async (req, res) => {
  const { id } = req.params;
  const match = /-(\d+)$/.exec(id);
  const cap = match ? Number(match[1]) : 2;
  const room = await gameManager.getRoom(id, cap);
  const players = room.players
    .filter((p) => !p.disconnected)
    .map((p) => ({ id: p.playerId, name: p.name }));
  res.json({ id, capacity: cap, players });
});

app.get('/api/checkers/board/:id', async (req, res) => {
  const { id } = req.params;
  const match = /-(\d+)$/.exec(id);
  const cap = match ? Number(match[1]) : 2;
  const room = await gameManager.getRoom(id, cap);
  res.json({ board: room.game.board });
});

app.post('/api/snake/invite', async (req, res) => {
  let { fromAccount, fromName, toAccount, roomId, token, amount, type } =
    req.body || {};
  if (!fromAccount || !toAccount || !roomId) {
    return res.status(400).json({ error: 'missing data' });
  }

  const invite = savePendingInvite({
    fromId: fromAccount,
    fromName,
    roomId,
    token,
    amount,
    game: 'snake'
  }, [toAccount]);
  const targets = userSockets.get(String(toAccount));
  if (targets && targets.size > 0) {
    for (const sid of targets) {
      io.to(sid).emit('gameInvite', serializeGameInvite(invite));
    }
  }

  const url = getInviteUrl(roomId, token, amount, 'snake');
  res.json({ success: true, url });
});

app.get('/api/snake/results', async (req, res) => {
  if (req.query.leaderboard) {
    const leaderboard = await GameResult.aggregate([
      { $group: { _id: '$winner', wins: { $sum: 1 } } },
      { $sort: { wins: -1 } },
      { $limit: 20 }
    ]);
    return res.json({ leaderboard });
  }
  const limit = Number(req.query.limit) || 20;
  const results = await GameResult.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  res.json({ results });
});
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).end();
  sendIndex(res);
});

// MongoDB Connection
const mongoUri = process.env.MONGO_URI;

if (mongoUri === 'memory') {
  import('mongodb-memory-server').then(async ({ MongoMemoryServer }) => {
    try {
      const mem = await MongoMemoryServer.create();
      await mongoose.connect(mem.getUri());
      console.log('Using in-memory MongoDB');
    } catch (err) {
      console.error('Failed to start in-memory MongoDB:', err.message);
      console.log('Continuing without database');
    }
  });
} else if (mongoUri) {
  const maxRetries = 5;
  const initialDelayMs = 5000;

  const connectWithRetry = async (attempt = 1) => {
    try {
      await mongoose.connect(mongoUri);
    } catch (err) {
      console.error(`MongoDB connection attempt ${attempt} failed:`, err);
      const delay = Math.min(initialDelayMs * attempt, 60_000);
      if (attempt < maxRetries) {
        console.log(`Retrying MongoDB connection in ${delay}ms...`);
      } else {
        console.error(
          'Exceeded MongoDB connection retries, continuing without DB connection while retrying in background.'
        );
      }
      setTimeout(() => connectWithRetry(attempt + 1), delay);
    }
  };

  connectWithRetry();
} else {
  console.log('No MongoDB URI configured, continuing without database');
}

mongoose.connection.once('open', async () => {
  console.log('Connected to MongoDB');
  for (const model of models) {
    try {
      await model.syncIndexes();
    } catch (err) {
      console.error(`Failed to sync ${model.modelName} indexes:`, err);
    }
  }
  gameManager
    .loadRooms()
    .catch((err) => console.error('Failed to load game rooms:', err));
});


function normalizeLiveChatRoomId(roomId) {
  const raw = String(roomId || '').trim();
  if (!raw) return '';
  return `livechat:${raw}`;
}

function ensureLiveChatRoom(roomId) {
  if (!liveChatRooms.has(roomId)) {
    liveChatRooms.set(roomId, new Map());
  }
  return liveChatRooms.get(roomId);
}

function removeSocketFromLiveChat(socket) {
  const joinedRooms = socket.data?.liveChatRooms;
  if (!joinedRooms || joinedRooms.size === 0) return;

  for (const roomId of joinedRooms) {
    const room = liveChatRooms.get(roomId);
    if (!room) continue;
    room.delete(socket.id);
    socket.leave(roomId);
    socket.to(roomId).emit('liveChat:peer-left', { roomId: roomId.replace(/^livechat:/, ''), socketId: socket.id });
    if (room.size === 0) {
      liveChatRooms.delete(roomId);
    }
  }

  joinedRooms.clear();
}

io.on('connection', (socket) => {
  const authAccountId = resolveTpcIdentity(socket.handshake?.auth || {});
  if (authAccountId) {
    let set = userSockets.get(String(authAccountId));
    if (!set) {
      set = new Set();
      userSockets.set(String(authAccountId), set);
    }
    set.add(socket.id);
    socket.data.playerId = String(authAccountId);
    registerConnection({ userId: String(authAccountId), socketId: socket.id }).catch((err) => {
      console.error('registerConnection auth failed', err);
    });
  }

  socket.on('register', async (payload = {}, cb) => {
    const resolvedPlayerId = resolveTpcIdentity(payload);
    if (!resolvedPlayerId) {
      cb && cb({ success: false, error: 'missing_player_id' });
      return;
    }
    if (hasConflictingIdentities(payload)) {
      cb && cb({ success: false, error: 'identity_mismatch' });
      return;
    }
    try {
      let set = userSockets.get(String(resolvedPlayerId));
      if (!set) {
        set = new Set();
        userSockets.set(String(resolvedPlayerId), set);
      }
      set.add(socket.id);
      socket.data.playerId = String(resolvedPlayerId);
      await registerConnection({ userId: String(resolvedPlayerId), socketId: socket.id });
      deliverPendingInvites(socket, resolvedPlayerId);
      cb && cb({ success: true });
    } catch (error) {
      console.error('register socket failed', error);
      cb && cb({ success: false, error: 'register_failed' });
    }
  });

  socket.on('createLobby', ({ roomId }, cb) => {
    const id = roomId || randomUUID();
    socket.join(id);
    cb && cb({ roomId: id });
  });

  socket.on('listPlayers', async (cb) => {
    const users = await listOnline();
    cb && cb(users);
  });

  socket.on(
    'seatTable',
    async (
      payload = {},
      cb
    ) => {
      const payloadMatchMeta =
        payload?.matchMeta && typeof payload.matchMeta === 'object'
          ? payload.matchMeta
          : {};
      const {
        gameType,
        stake,
        maxPlayers = 4,
        playerName,
        tableId,
        avatar,
        preferredSide,
        targetPoints,
        points,
        ready: readyOnJoin = false
      } = payload;
      const rawMatchMeta = {
        ...payload,
        ...payloadMatchMeta,
        targetPoints:
          payloadMatchMeta.targetPoints ?? targetPoints ?? points
      };
      // Older portrait clients predate the token field. Online tables have
      // always been TPG-only, so absence is safely canonicalized while an
      // explicitly different token still fails authoritative validation.
      if (!rawMatchMeta.token) rawMatchMeta.token = 'TPG';
      const resolvedPreferredSide =
        rawMatchMeta.preferredSide ?? preferredSide;
      const resolvedAccountId = resolveTpcIdentity(payload);
      if (hasConflictingIdentities(payload)) {
        return cb && cb({ success: false, error: 'identity_mismatch' });
      }
      if (!ensureRegistered(socket, resolvedAccountId)) {
        const error =
          resolvedAccountId &&
          socket.data?.playerId &&
          String(resolvedAccountId) !== String(socket.data.playerId)
            ? 'identity_mismatch'
            : 'register_required';
        return cb && cb({ success: false, error });
      }
      if (isRateLimited(socket, 'seatTable', seatTableRateLimitMs)) {
        return cb && cb({ success: false, error: 'rate_limited' });
      }
      const {
        gameType: resolvedGameType,
        maxPlayers: resolvedMaxPlayers
      } = resolveSeatIdentityFromTableId(tableId, gameType, maxPlayers);
      // Chess, Checkers, Pool, and Ludo quick-match historically shipped clients with decorative
      // mode/token labels. It is always a TPG online queue, so canonicalize
      // those non-partition fields instead of rejecting an otherwise valid
      // mobile client during the compatibility window.
      if (
        resolvedGameType === 'chess' ||
        resolvedGameType === 'checkers' ||
        resolvedGameType === 'poolroyale' ||
        resolvedGameType === 'ludobattleroyal'
      ) {
        rawMatchMeta.mode = 'online';
        rawMatchMeta.token = 'TPG';
      }
      const validation = validateSeatTableRequest({
        gameType: resolvedGameType,
        stake,
        maxPlayers: resolvedMaxPlayers,
        matchMeta: rawMatchMeta
      });
      if (!validation.ok) {
        return cb && cb({ success: false, error: validation.error });
      }

      const safeMeta = validation.safeMatchMeta;

      let table;
      if (tableId) {
        table = await seatTableSocket(
          resolvedAccountId,
          validation.normalizedGameType,
          validation.normalizedStake,
          validation.normalizedMaxPlayers,
          playerName,
          socket,
          avatar,
          resolvedPreferredSide,
          safeMeta,
          tableId
        );
      } else {
        table = await seatTableSocket(
          resolvedAccountId,
          validation.normalizedGameType,
          validation.normalizedStake,
          validation.normalizedMaxPlayers,
          playerName,
          socket,
          avatar,
          resolvedPreferredSide,
          safeMeta
        );
      }
      if (table) {
        // These quick matches have no separate ready-up screen. Marking the
        // authoritative seat ready here prevents a dropped confirmReady packet
        // from leaving every Ludo player seated at the same table but stuck in
        // the lobby forever.
        // Once a player owns a seat, that seat is ready. Keeping this
        // server-authoritative also lets older/mobile clients match when
        // confirmReady is delayed or lost while Telegram's WebView reconnects.
        const shouldReadySeat =
          !table.started &&
          (validation.normalizedGameType === 'chess' ||
            validation.normalizedGameType === 'checkers' ||
            validation.normalizedGameType === 'poolroyale' ||
            validation.normalizedGameType === 'ludobattleroyal' ||
            readyOnJoin);
        if (shouldReadySeat) {
          table.ready.add(String(resolvedAccountId));
          io.to(table.id).emit('lobbyUpdate', {
            tableId: table.id,
            tableNumber: table.tableNumber,
            players: table.players,
            currentTurn: table.currentTurn,
            ready: Array.from(table.ready),
            meta: table.meta
          });
        }
        cb && cb({
          success: true,
          tableId: table.id,
          tableNumber: table.tableNumber,
          players: table.players,
          currentTurn: table.currentTurn,
          ready: Array.from(table.ready),
          meta: table.meta,
          started: Boolean(table.started),
          gameStart: table.gameStartPayload
        });
        if (shouldReadySeat) maybeStartGame(table);
      } else if (cb) {
        cb({ success: false, error: 'table_join_failed' });
      }
    }
  );

  socket.on('leaveLobby', (payload = {}) => {
    const { tableId } = payload;
    const resolvedAccountId = resolveTpcIdentity(payload);
    if (hasConflictingIdentities(payload) || !ensureRegistered(socket, resolvedAccountId)) return;
    if (tableId) {
      unseatTableSocket(resolvedAccountId, tableId, socket.id);
    }
  });

  socket.on('confirmReady', (payload = {}) => {
    const { tableId } = payload;
    const resolvedAccountId = resolveTpcIdentity(payload);
    if (hasConflictingIdentities(payload)) {
      socket.emit('errorMessage', 'identity_mismatch');
      return;
    }
    const table = tableMap.get(tableId);
    if (!table) {
      socket.emit('errorMessage', 'table_not_found');
      return;
    }
    if (!ensureRegistered(socket, resolvedAccountId)) return;
    const seated = table.players.some((player) => String(player.id) === String(resolvedAccountId));
    if (!seated) {
      socket.emit('errorMessage', 'seat_required');
      return;
    }
    if (!table.ready) table.ready = new Set();
    table.ready.add(String(resolvedAccountId));
    io.to(tableId).emit('lobbyUpdate', {
      tableId,
      tableNumber: table.tableNumber,
      players: table.players,
      currentTurn: table.currentTurn,
      ready: Array.from(table.ready)
    });
    maybeStartGame(table);
  });

  socket.on('joinRoom', async (payload = {}) => {
    const { roomId, name, avatar } = payload;
    const pid = resolveTpcIdentity(payload);
    if (hasConflictingIdentities(payload)) {
      socket.emit('errorMessage', 'identity_mismatch');
      return;
    }
    const map = tableSeats.get(roomId);
    const cap = Number(roomId.split('-')[1]) || 4;
    if (!gameManager.rooms.has(roomId) && map && map.size < cap) {
      socket.emit('waitingForPlayers', { roomId, current: map.size, capacity: cap });
      return;
    }
    if (pid && !socket.data?.playerId) {
      socket.data.playerId = String(pid);
    }
    if (!ensureRegistered(socket, pid)) return;
    // When a player connects to the actual game room we should keep their
    // lobby seat so that lobby endpoints continue to reflect the occupied
    // seat. Previously this function removed the player's seat from
    // `tableSeats`, which caused the lobby to show zero players after a
    // socket joined the room. Tests expect the lobby count to remain until the
    // game starts or the player explicitly leaves, so we simply update the
    // stored socket id without deleting the seat.
    if (map) {
      const info = map.get(String(pid));
      if (info) info.socketId = socket.id;
    }
    if (pid) {
      await registerConnection({
        userId: String(pid),
        roomId,
        socketId: socket.id
      });
      // Track the user's current table when they actually join a room
      User.updateOne({ accountId: pid }, { currentTableId: roomId }).catch(
        () => {}
      );
    }
    const result = await gameManager.joinRoom(roomId, pid, name, socket, avatar);
    if (result.error) {
      socket.emit('error', result.error);
    } else if (result.board) {
      socket.emit('boardData', result.board);
    }
  });

  socket.on('joinChessRoom', async ({ tableId, accountId } = {}, cb) => {
    if (!tableId) {
      cb && cb({ success: false, error: 'invalid_payload' });
      return;
    }
    if (!accountId || !ensureRegistered(socket, accountId)) {
      cb && cb({ success: false, error: 'register_required' });
      return;
    }
    const state = getChessState(tableId);
    const table = tableMap.get(tableId);
    const seated = [...(state.players || []), ...(table?.players || [])].some(
      (player) => String(player.id) === String(accountId)
    );
    if (!seated) {
      cb && cb({ success: false, error: 'seat_required' });
      return;
    }
    socket.join(tableId);
    socket.emit('chessState', { tableId, ...state });
    await registerConnection({
      userId: String(accountId),
      roomId: tableId,
      socketId: socket.id
    });
    cb && cb({ success: true, state: { tableId, ...state } });
  });

  socket.on('joinCheckersRoom', async ({ tableId, accountId } = {}, cb) => {
    if (!tableId) {
      cb && cb({ success: false, error: 'invalid_payload' });
      return;
    }
    if (!accountId || !ensureRegistered(socket, accountId)) {
      cb && cb({ success: false, error: 'register_required' });
      return;
    }
    const table = tableMap.get(tableId);
    const seated = table?.gameType === 'checkers' && table.players.some(
      (player) => String(player.id) === String(accountId)
    );
    if (!seated) {
      cb && cb({ success: false, error: 'seat_required' });
      return;
    }
    const state = checkersRealtimeStore.getState(tableId);
    socket.join(tableId);
    const payload = { tableId, ...state };
    socket.emit('checkersState', payload);
    await registerConnection({
      userId: String(accountId),
      roomId: tableId,
      socketId: socket.id
    });
    cb && cb({ success: true, state: payload });
  });

  socket.on('checkersSyncRequest', ({ tableId }) => {
    if (!tableId) return;
    const table = tableMap.get(tableId);
    const playerId = String(socket.data?.playerId || '');
    if (
      table?.gameType !== 'checkers' ||
      !table.players.some((player) => String(player.id) === playerId)
    ) {
      socket.emit('checkersSyncError', { tableId, error: 'seat_required' });
      return;
    }
    const state = checkersRealtimeStore.getState(tableId);
    socket.emit('checkersState', { tableId, ...state });
  });

  socket.on('chessSyncRequest', ({ tableId }) => {
    if (!tableId) return;
    const state = getChessState(tableId);
    const playerId = String(socket.data?.playerId || '');
    if (!(state.players || []).some((player) => String(player.id) === playerId)) {
      socket.emit('chessSyncError', { tableId, error: 'seat_required' });
      return;
    }
    socket.emit('chessState', { tableId, ...state });
  });


  socket.on('joinDominoRoyalTable', async ({ tableId, accountId } = {}) => {
    if (!tableId) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    if (!ensureRegistered(socket, resolvedAccountId)) return;
    const table = tableMap.get(tableId);
    if (
      !table ||
      table.gameType !== 'domino-royal' ||
      !table.players.some((player) => String(player.id) === String(resolvedAccountId))
    ) {
      socket.emit('dominoRoyalSyncError', { tableId, error: 'seat_required' });
      return;
    }
    socket.join(tableId);
    if (resolvedAccountId) {
      await registerConnection({
        userId: String(resolvedAccountId),
        roomId: tableId,
        socketId: socket.id
      });
    }
    const cached = dominoRoyalStates.get(tableId);
    if (cached?.state) {
      socket.emit('dominoRoyalState', {
        tableId,
        state: cached.state,
        action: cached.action || null,
        updatedAt: cached.ts
      });
    }
  });

  socket.on('dominoRoyalSyncRequest', ({ tableId, accountId } = {}) => {
    if (!tableId) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    if (!ensureRegistered(socket, resolvedAccountId)) return;
    const table = tableMap.get(tableId);
    if (!table?.players.some((player) => String(player.id) === String(resolvedAccountId))) return;
    const cached = dominoRoyalStates.get(tableId);
    if (cached?.state) {
      socket.emit('dominoRoyalState', {
        tableId,
        state: cached.state,
        action: cached.action || null,
        updatedAt: cached.ts
      });
    }
  });

  socket.on('dominoRoyalState', ({ tableId, accountId, state, action } = {}, cb) => {
    if (!tableId || !state || typeof state !== 'object') return;
    if (!socket.rooms.has(tableId)) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId, tpcAccountNumber: action?.accountId });
    if (!ensureRegistered(socket, resolvedAccountId)) return;
    const table = tableMap.get(tableId);
    const cached = dominoRoyalStates.get(tableId);
    const validation = validateDominoStateSubmission({
      table,
      cached,
      accountId: resolvedAccountId,
      state,
      action
    });
    if (!validation.ok) {
      cb && cb({ success: false, error: validation.error });
      socket.emit('dominoRoyalSyncError', { tableId, error: validation.error });
      if (cached?.state) socket.emit('dominoRoyalState', { tableId, state: cached.state, action: cached.action, updatedAt: cached.ts });
      return;
    }
    const revision = Number(cached?.revision || 0) + 1;
    const authoritativeState = { ...state, seq: revision };
    const payload = {
      tableId,
      tableNumber: table.tableNumber,
      state: authoritativeState,
      action: { ...(action || {}), accountId: String(resolvedAccountId) },
      updatedAt: Date.now()
    };
    dominoRoyalStates.set(tableId, {
      state: authoritativeState,
      action: payload.action,
      ts: payload.updatedAt,
      revision
    });
    socket.to(tableId).emit('dominoRoyalState', payload);
    cb && cb({ success: true, revision });
  });


  const getLudoSession = (tableId, table) => {
    let game = ludoBattleStates.get(tableId);
    const playerIds = table?.players?.map((player) => String(player.id)) || [];
    if (!game || game.players.join('|') !== playerIds.join('|')) {
      game = new LudoBattleGame(playerIds);
      ludoBattleStates.set(tableId, game);
    }
    return game;
  };

  socket.on('joinLudoBattleTable', async ({ tableId, accountId } = {}, cb) => {
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !table ||
      table.gameType !== 'ludobattleroyal' ||
      !table.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      socket.emit('ludoBattleSyncError', { tableId, error: 'seat_required' });
      cb?.({ success: false, error: 'seat_required' });
      return;
    }
    socket.join(tableId);
    const game = getLudoSession(tableId, table);
    const state = game.snapshot();
    socket.emit('ludoBattleState', { tableId, state, action: { type: 'sync' } });
    await registerConnection({ userId: String(resolvedAccountId), roomId: tableId, socketId: socket.id });
    cb?.({ success: true, state });
  });

  socket.on('ludoBattleSyncRequest', ({ tableId, accountId } = {}) => {
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !table?.players.some(
      (player) => String(player.id) === String(resolvedAccountId))) return;
    const game = getLudoSession(tableId, table);
    socket.emit('ludoBattleState', { tableId, state: game.snapshot(), action: { type: 'sync' } });
  });

  socket.on('ludoBattleRoll', ({ tableId, accountId } = {}, cb) => {
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !socket.rooms.has(tableId) ||
      !table?.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      cb?.({ success: false, error: 'seat_required' });
      return;
    }
    if (isRateLimited(socket, 'ludoBattleRoll', rollRateLimitMs)) {
      cb?.({ success: false, error: 'roll_rate_limited' });
      return;
    }
    const game = getLudoSession(tableId, table);
    const result = game.roll(resolvedAccountId);
    if (!result.ok) {
      socket.emit('ludoBattleSyncError', { tableId, error: result.error, state: game.snapshot() });
      cb?.({ success: false, error: result.error });
      return;
    }
    const payload = { tableId, state: result.state, action: {
      type: 'roll', accountId: String(resolvedAccountId), roll: result.roll,
      movableTokens: result.movableTokens, revision: result.state.revision
    }};
    io.to(tableId).emit('ludoBattleState', payload);
    cb?.({ success: true, ...payload.action });
  });

  socket.on('ludoBattleMove', ({ tableId, accountId, token, revision } = {}, cb) => {
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !socket.rooms.has(tableId) ||
      !table?.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      cb?.({ success: false, error: 'seat_required' });
      return;
    }
    const game = getLudoSession(tableId, table);
    const result = game.move(resolvedAccountId, token, revision);
    if (!result.ok) {
      socket.emit('ludoBattleSyncError', { tableId, error: result.error, state: game.snapshot() });
      cb?.({ success: false, error: result.error });
      return;
    }
    const payload = { tableId, state: result.state, action: {
      type: 'move', accountId: String(resolvedAccountId), player: result.player,
      token: result.token, from: result.from, to: result.to, roll: result.roll,
      captures: result.captures, revision: result.state.revision
    }};
    io.to(tableId).emit('ludoBattleState', payload);
    cb?.({ success: true, revision: result.state.revision });
  });

  // Air Hockey uses the first matched player as the physics authority. The
  // second player sends only their mallet target; authoritative puck, score,
  // and both mallets are then broadcast as a compact realtime snapshot.
  socket.on('joinAirHockeyTable', async ({ tableId, accountId } = {}) => {
    if (!tableId) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !table || table.gameType !== 'airhockey' ||
      !table.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      socket.emit('airHockeySyncError', { tableId, error: 'seat_required' });
      return;
    }
    socket.join(tableId);
    await registerConnection({ userId: String(resolvedAccountId), roomId: tableId, socketId: socket.id });
    const seatIndex = table.players.findIndex((player) => String(player.id) === String(resolvedAccountId));
    socket.emit('airHockeyJoined', {
      tableId,
      seatIndex,
      hostAccountId: String(table.players[0]?.id || ''),
      players: table.players
    });
    const cached = airHockeyStates.get(tableId);
    if (cached?.state) socket.emit('airHockeyState', { tableId, state: cached.state, revision: cached.revision });
  });

  socket.on('airHockeyInput', ({ tableId, accountId, input } = {}) => {
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!socket.rooms.has(tableId) || !ensureRegistered(socket, resolvedAccountId) ||
      !table?.players.some((player) => String(player.id) === String(resolvedAccountId))) return;
    const seatIndex = table.players.findIndex((player) => String(player.id) === String(resolvedAccountId));
    if (seatIndex !== 1 || !Number.isFinite(input?.x) || !Number.isFinite(input?.z)) return;
    const payload = { x: Number(input.x), z: Number(input.z), seq: Number(input.seq) || 0 };
    const cached = airHockeyStates.get(tableId) || { state: null, inputs: {}, revision: 0 };
    cached.inputs[String(resolvedAccountId)] = payload;
    airHockeyStates.set(tableId, cached);
    socket.to(tableId).emit('airHockeyInput', { tableId, accountId: String(resolvedAccountId), input: payload });
  });

  socket.on('airHockeyState', ({ tableId, accountId, state } = {}) => {
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    const isHost = String(table?.players?.[0]?.id || '') === String(resolvedAccountId);
    if (!state || !isHost || !socket.rooms.has(tableId) || !ensureRegistered(socket, resolvedAccountId)) return;
    const cached = airHockeyStates.get(tableId) || { inputs: {}, revision: 0 };
    const revision = Number(cached.revision || 0) + 1;
    const payload = { tableId, state: { ...state, seq: revision }, revision, updatedAt: Date.now() };
    airHockeyStates.set(tableId, { ...cached, state: payload.state, revision, ts: payload.updatedAt });
    socket.to(tableId).emit('airHockeyState', payload);
  });

  socket.on('airHockeySyncRequest', ({ tableId, accountId } = {}) => {
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) ||
      !table?.players.some((player) => String(player.id) === String(resolvedAccountId))) return;
    const cached = airHockeyStates.get(tableId);
    if (cached?.state) socket.emit('airHockeyState', { tableId, state: cached.state, revision: cached.revision });
  });

  socket.on('joinMurlanRoyaleTable', async ({ tableId, accountId } = {}) => {
    if (!tableId) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    if (!ensureRegistered(socket, resolvedAccountId)) return;
    const table = tableMap.get(tableId);
    if (
      !table ||
      table.gameType !== 'murlanroyale' ||
      !table.players.some((player) => String(player.id) === String(resolvedAccountId))
    ) {
      socket.emit('murlanRoyaleSyncError', { tableId, error: 'seat_required' });
      return;
    }
    socket.join(tableId);
    if (resolvedAccountId) {
      await registerConnection({ userId: String(resolvedAccountId), roomId: tableId, socketId: socket.id });
    }
    const cached = murlanRoyalStates.get(tableId);
    if (cached?.state) {
      socket.emit('murlanRoyaleState', { tableId, state: cached.state, action: cached.action || null, updatedAt: cached.ts });
    }
  });

  socket.on('murlanRoyaleSyncRequest', ({ tableId, accountId } = {}) => {
    if (!tableId) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    if (!ensureRegistered(socket, resolvedAccountId)) return;
    const table = tableMap.get(tableId);
    if (!table?.players.some((player) => String(player.id) === String(resolvedAccountId))) return;
    const cached = murlanRoyalStates.get(tableId);
    if (cached?.state) {
      socket.emit('murlanRoyaleState', { tableId, state: cached.state, action: cached.action || null, updatedAt: cached.ts });
    }
  });

  socket.on('murlanRoyaleState', ({ tableId, accountId, state, action } = {}, cb) => {
    if (!tableId || !state || typeof state !== 'object') return;
    if (!socket.rooms.has(tableId)) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId, tpcAccountNumber: action?.accountId });
    if (!ensureRegistered(socket, resolvedAccountId)) return;
    const table = tableMap.get(tableId);
    if (
      !table ||
      table.gameType !== 'murlanroyale' ||
      !table.players.some((player) => String(player.id) === String(resolvedAccountId))
    ) {
      cb && cb({ success: false, error: 'seat_required' });
      socket.emit('murlanRoyaleSyncError', { tableId, error: 'seat_required' });
      return;
    }
    const cached = murlanRoyalStates.get(tableId);
    const revision = Number(cached?.revision || 0) + 1;
    const authoritativeState = { ...state, seq: revision };
    const payload = { tableId, tableNumber: table.tableNumber, state: authoritativeState, action: { ...(action || {}), accountId: String(resolvedAccountId) }, updatedAt: Date.now() };
    murlanRoyalStates.set(tableId, { state: authoritativeState, action: payload.action, ts: payload.updatedAt, revision });
    socket.to(tableId).emit('murlanRoyaleState', payload);
    cb && cb({ success: true, revision });
  });

  socket.on('joinTexasHoldemTable', async ({ tableId, accountId } = {}) => {
    if (!tableId) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !table || table.gameType !== 'texasholdem' ||
      !table.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      socket.emit('texasHoldemSyncError', { tableId, error: 'seat_required' });
      return;
    }
    socket.join(tableId);
    await registerConnection({ userId: String(resolvedAccountId), roomId: tableId, socketId: socket.id });
    const cached = texasHoldemStates.get(tableId);
    if (cached?.state) socket.emit('texasHoldemState', { tableId, ...cached });
  });

  socket.on('texasHoldemSyncRequest', ({ tableId, accountId } = {}) => {
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !table?.players.some((player) => String(player.id) === String(resolvedAccountId))) return;
    const cached = texasHoldemStates.get(tableId);
    if (cached?.state) socket.emit('texasHoldemState', { tableId, ...cached });
  });

  socket.on('texasHoldemState', ({ tableId, accountId, state, action } = {}, cb) => {
    if (!tableId || !state || !socket.rooms.has(tableId)) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !table || table.gameType !== 'texasholdem' ||
      !table.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      cb?.({ success: false, error: 'seat_required' });
      return;
    }
    const cached = texasHoldemStates.get(tableId);
    const revision = Number(cached?.revision || 0) + 1;
    const authoritativeState = { ...state, seq: revision };
    const payload = { tableId, state: authoritativeState, action: { ...(action || {}), accountId: String(resolvedAccountId) }, ts: Date.now(), revision };
    texasHoldemStates.set(tableId, payload);
    socket.to(tableId).emit('texasHoldemState', payload);
    cb?.({ success: true, revision });
  });

  socket.on('joinPoolTable', async ({ tableId, accountId } = {}, cb) => {
    if (!tableId) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !table || table.gameType !== 'poolroyale' ||
      !table.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      socket.emit('poolSyncError', { tableId, error: 'seat_required' });
      cb && cb({ success: false, error: 'seat_required' });
      return;
    }
    socket.join(tableId);
    if (resolvedAccountId) {
      await registerConnection({
        userId: String(resolvedAccountId),
        roomId: tableId,
        socketId: socket.id
      });
    }
    const cached = poolStates.get(tableId);
    if (cached?.state) {
      socket.emit('poolState', {
        tableId,
        state: cached.state,
        hud: cached.hud,
        layout: cached.layout,
        updatedAt: cached.ts,
        revision: cached.revision || 0
      });
    }
    cb && cb({ success: true, revision: cached?.revision || 0 });
  });

  socket.on('poolSyncRequest', ({ tableId, accountId } = {}) => {
    if (!tableId) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !socket.rooms.has(tableId) ||
      !table?.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      socket.emit('poolSyncError', { tableId, error: 'seat_required' });
      return;
    }
    const cached = poolStates.get(tableId);
    if (cached?.state) {
      socket.emit('poolState', {
        tableId,
        state: cached.state,
        hud: cached.hud,
        layout: cached.layout,
        updatedAt: cached.ts,
        revision: cached.revision || 0
      });
    }
  });

  socket.on('poolFrame', ({ tableId, layout, hud, playerId, frameTs, accountId } = {}) => {
    if (!tableId || !Array.isArray(layout)) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId: accountId || playerId || socket.data?.playerId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !socket.rooms.has(tableId) ||
      !table?.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      socket.emit('poolSyncError', { tableId, error: 'seat_required' });
      return;
    }
    const ts = Number.isFinite(frameTs) ? frameTs : Date.now();
    const cached = poolStates.get(tableId) || {};
    const revision = Number(cached.revision || 0) + 1;
    const payload = {
      tableId,
      layout,
      hud: hud || cached.hud || null,
      updatedAt: ts,
      playerId: String(resolvedAccountId),
      revision
    };
    poolStates.set(tableId, {
      state: cached.state || null,
      hud: payload.hud,
      layout,
      ts,
      revision
    });
    socket.to(tableId).emit('poolFrame', payload);
  });

  socket.on('poolShot', ({ tableId, state, hud, layout, accountId } = {}, cb) => {
    if (!tableId || !state) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId: accountId || socket.data?.playerId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !socket.rooms.has(tableId) ||
      !table?.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      socket.emit('poolSyncError', { tableId, error: 'seat_required' });
      cb && cb({ success: false, error: 'seat_required' });
      return;
    }
    const cached = poolStates.get(tableId) || {};
    const revision = Number(cached.revision || 0) + 1;
    const authoritativeState = { ...state, seq: revision };
    const payload = {
      tableId,
      state: authoritativeState,
      hud: hud || null,
      layout: layout || null,
      updatedAt: Date.now(),
      revision
    };
    poolStates.set(tableId, {
      state: authoritativeState,
      hud: hud || null,
      layout: layout || null,
      ts: payload.updatedAt,
      revision
    });
    socket.to(tableId).emit('poolState', payload);
    cb && cb({ success: true, revision });
  });

  socket.on('joinSnookerTable', async ({ tableId, accountId } = {}, cb) => {
    if (!tableId) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !table || table.gameType !== 'snookerroyale' ||
      !table.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      socket.emit('snookerSyncError', { tableId, error: 'seat_required' });
      cb && cb({ success: false, error: 'seat_required' });
      return;
    }
    socket.join(tableId);
    if (resolvedAccountId) {
      await registerConnection({
        userId: String(resolvedAccountId),
        roomId: tableId,
        socketId: socket.id
      });
    }
    const cached = snookerStates.get(tableId);
    if (cached?.state) {
      socket.emit('snookerState', {
        tableId,
        state: cached.state,
        hud: cached.hud,
        layout: cached.layout,
        updatedAt: cached.ts,
        revision: cached.revision || 0
      });
    }
    cb && cb({ success: true, revision: cached?.revision || 0 });
  });

  socket.on('snookerSyncRequest', ({ tableId, accountId } = {}) => {
    if (!tableId) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !socket.rooms.has(tableId) ||
      !table?.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      socket.emit('snookerSyncError', { tableId, error: 'seat_required' });
      return;
    }
    const cached = snookerStates.get(tableId);
    if (cached?.state) {
      socket.emit('snookerState', {
        tableId,
        state: cached.state,
        hud: cached.hud,
        layout: cached.layout,
        updatedAt: cached.ts,
        revision: cached.revision || 0
      });
    }
  });

  socket.on('snookerFrame', ({ tableId, layout, hud, playerId, frameTs, accountId } = {}) => {
    if (!tableId || !Array.isArray(layout)) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId: accountId || playerId || socket.data?.playerId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !socket.rooms.has(tableId) ||
      !table?.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      socket.emit('snookerSyncError', { tableId, error: 'seat_required' });
      return;
    }
    const ts = Number.isFinite(frameTs) ? frameTs : Date.now();
    const cached = snookerStates.get(tableId) || {};
    const revision = Number(cached.revision || 0) + 1;
    const payload = {
      tableId,
      layout,
      hud: hud || cached.hud || null,
      updatedAt: ts,
      playerId: String(resolvedAccountId),
      revision
    };
    snookerStates.set(tableId, {
      state: cached.state || null,
      hud: payload.hud,
      layout,
      ts,
      revision
    });
    socket.to(tableId).emit('snookerFrame', payload);
  });

  socket.on('snookerShot', ({ tableId, state, hud, layout, accountId } = {}, cb) => {
    if (!tableId || !state) return;
    const resolvedAccountId = resolveTpcIdentity({ accountId: accountId || socket.data?.playerId });
    const table = tableMap.get(tableId);
    if (!ensureRegistered(socket, resolvedAccountId) || !socket.rooms.has(tableId) ||
      !table?.players.some((player) => String(player.id) === String(resolvedAccountId))) {
      socket.emit('snookerSyncError', { tableId, error: 'seat_required' });
      cb && cb({ success: false, error: 'seat_required' });
      return;
    }
    const cached = snookerStates.get(tableId) || {};
    const revision = Number(cached.revision || 0) + 1;
    const authoritativeState = { ...state, seq: revision };
    const payload = {
      tableId,
      state: authoritativeState,
      hud: hud || null,
      layout: layout || null,
      updatedAt: Date.now(),
      revision
    };
    snookerStates.set(tableId, {
      state: authoritativeState,
      hud: hud || null,
      layout: layout || null,
      ts: payload.updatedAt,
      revision
    });
    socket.to(tableId).emit('snookerState', payload);
    cb && cb({ success: true, revision });
  });

  socket.on('chessMove', ({ tableId, move }, cb) => {
    if (!tableId || !move) {
      cb && cb({ success: false, error: 'invalid_payload' });
      return;
    }
    const playerId = String(socket.data?.playerId || '');
    if (!playerId) {
      cb && cb({ success: false, error: 'register_required' });
      return;
    }
    const current = getChessState(tableId);
    const result = validateAndApplyChessMove(current, playerId, move);
    if (!result.ok) {
      socket.emit('chessMoveRejected', {
        tableId,
        error: result.error,
        state: { tableId, ...current }
      });
      cb && cb({ success: false, error: result.error, state: { tableId, ...current } });
      return;
    }
    const next = updateChessState(tableId, result.state);
    const payload = { tableId, ...next };
    socket.to(tableId).emit('chessMove', payload);
    cb && cb({ success: true, state: payload });
    if (next.winner || next.draw) {
      settleChessStakeContract(tableId, { winner: next.winner, draw: next.draw }).then((settlement) => {
        io.to(tableId).emit('chessSettlement', { tableId, ...settlement });
      }).catch((error) => {
        io.to(tableId).emit('chessSettlement', { tableId, ok: false, error: error.message || 'settlement_failed' });
      });
    }
  });

  socket.on('checkersMove', async ({ tableId, move }) => {
    if (!tableId || !move) return;

    const playerId = String(socket.data?.playerId || '');
    if (!playerId) {
      socket.emit('checkersMoveRejected', {
        tableId,
        error: 'register_required'
      });
      return;
    }

    const table = tableMap.get(tableId);
    if (!table || table.gameType !== 'checkers') {
      socket.emit('checkersMoveRejected', { tableId, error: 'table_not_found' });
      return;
    }

    const session = ensureCheckersSession(tableId, table);
    const now = Date.now();
    const lastActionAt = session.lastMoveAtByPlayer.get(playerId) || 0;
    if (now - lastActionAt < checkersMoveRateLimitMs) {
      socket.emit('checkersMoveRejected', {
        tableId,
        error: 'move_rate_limited'
      });
      return;
    }
    session.lastMoveAtByPlayer.set(playerId, now);

    const clientMoveId =
      typeof move.clientMoveId === 'string' ? move.clientMoveId.slice(0, 120) : '';
    if (clientMoveId && session.processedMoveIds.has(clientMoveId)) {
      socket.emit('checkersMoveRejected', {
        tableId,
        error: 'duplicate_move'
      });
      return;
    }

    const state = checkersRealtimeStore.getState(tableId);
    const activeSide = state.turn === SIDES.DARK ? SIDES.DARK : SIDES.LIGHT;
    const sideForPlayer =
      String(session.playersBySide.light) === playerId
        ? SIDES.LIGHT
        : String(session.playersBySide.dark) === playerId
          ? SIDES.DARK
          : null;
    if (!sideForPlayer) {
      socket.emit('checkersMoveRejected', {
        tableId,
        error: 'seat_required'
      });
      return;
    }
    if (sideForPlayer !== activeSide) {
      socket.emit('checkersMoveRejected', {
        tableId,
        error: 'not_your_turn'
      });
      return;
    }

    const authoritative = applyAuthoritativeMove(state, move);
    if (!authoritative.ok) {
      socket.emit('checkersMoveRejected', {
        tableId,
        clientMoveId: clientMoveId || null,
        error: authoritative.error
      });
      return;
    }

    if (clientMoveId) {
      session.processedMoveIds.add(clientMoveId);
      if (session.processedMoveIds.size > 500) {
        session.processedMoveIds = new Set(
          Array.from(session.processedMoveIds).slice(-200)
        );
      }
    }

    const nextMoveSeq = Number(state.moveSeq || 0) + 1;
    const nextState = checkersRealtimeStore.setState(tableId, {
      board: authoritative.board,
      turn: authoritative.turn,
      lastMove: authoritative.lastMove,
      requiredFrom: authoritative.requiredFrom,
      winner: authoritative.winner,
      reason: authoritative.reason,
      moveSeq: nextMoveSeq
    });

    table.currentTurn =
      nextState.turn === SIDES.LIGHT
        ? session.playersBySide.light
        : session.playersBySide.dark;

    socket.emit('checkersMoveAccepted', {
      tableId,
      clientMoveId: clientMoveId || null,
      moveSeq: nextMoveSeq,
      chainCapture: Boolean(authoritative.chainCapture)
    });

    io.to(tableId).emit('checkersState', { tableId, ...nextState });

    if (!authoritative.winner) return;

    const winnerSide = authoritative.winner;
    const loserSide = winnerSide === SIDES.LIGHT ? SIDES.DARK : SIDES.LIGHT;
    const winnerId = session.playersBySide[winnerSide];
    const loserId = session.playersBySide[loserSide];
    const matchEndPayload = {
      tableId,
      winnerSide,
      winnerId: winnerId ? String(winnerId) : null,
      loserId: loserId ? String(loserId) : null,
      reason: authoritative.reason || 'match_end'
    };
    io.to(tableId).emit('matchEnded', matchEndPayload);

    try {
      const settlementResult = await settleCheckersMatch({
        tableId,
        winnerId,
        loserId,
        reason: matchEndPayload.reason,
        stake: Number(session.stake || table.stake || 0),
        token: session.token || table.meta?.token || 'TPG'
      });
      io.to(tableId).emit('settlementConfirmed', {
        tableId,
        idempotencyKey: settlementResult.settlement?.idempotencyKey || `${tableId}:1`,
        winnerId: winnerId ? String(winnerId) : null,
        loserId: loserId ? String(loserId) : null,
        payoutAmount: settlementResult.settlement?.payoutAmount || 0,
        token: settlementResult.settlement?.token || session.token || 'TPG',
        status: settlementResult.status || 'skipped'
      });
    } catch (error) {
      console.error('checkers settlement failed', error);
      io.to(tableId).emit('settlementConfirmed', {
        tableId,
        idempotencyKey: `${tableId}:1`,
        winnerId: winnerId ? String(winnerId) : null,
        loserId: loserId ? String(loserId) : null,
        payoutAmount: 0,
        token: session.token || 'TPG',
        status: 'failed'
      });
    }
  });
  socket.on('watchRoom', async ({ roomId }) => {
    if (!roomId) return;
    let set = tableWatchers.get(roomId);
    if (!set) {
      set = new Set();
      tableWatchers.set(roomId, set);
    }
    set.add(socket.id);
    socket.join(roomId);
    try {
      const room = await gameManager.getRoom(roomId);
      const board =
        room.gameType === 'snake'
          ? { snakes: room.snakes, ladders: room.ladders, diceCells: room.diceCells }
          : room.gameType === 'checkers'
          ? { board: room.game.board }
          : null;
      if (board) socket.emit('boardData', board);
    } catch {}
    io.to(roomId).emit('watchCount', { roomId, count: set.size });
  });

  socket.on('leaveWatch', ({ roomId }) => {
    if (!roomId) return;
    const set = tableWatchers.get(roomId);
    socket.leave(roomId);
    if (set) {
      set.delete(socket.id);
      const count = set.size;
      if (count === 0) tableWatchers.delete(roomId);
      io.to(roomId).emit('watchCount', { roomId, count });
    }
  });


  socket.on('liveChat:join', ({ roomId, participant } = {}) => {
    const normalizedRoomId = normalizeLiveChatRoomId(roomId);
    if (!normalizedRoomId) return;

    const room = ensureLiveChatRoom(normalizedRoomId);
    const safeParticipant = {
      displayName: String(participant?.displayName || 'Player').slice(0, 60),
      mediaState: {
        microphone: participant?.mediaState?.microphone !== false,
        camera: participant?.mediaState?.camera !== false
      }
    };

    const participants = Array.from(room.entries()).map(([socketId, details]) => ({
      socketId,
      displayName: details.displayName,
      mediaState: details.mediaState
    }));

    room.set(socket.id, safeParticipant);
    socket.join(normalizedRoomId);
    if (!socket.data.liveChatRooms) socket.data.liveChatRooms = new Set();
    socket.data.liveChatRooms.add(normalizedRoomId);

    socket.emit('liveChat:participants', {
      roomId: String(roomId),
      participants
    });

    socket.to(normalizedRoomId).emit('liveChat:peer-joined', {
      roomId: String(roomId),
      socketId: socket.id,
      participant: safeParticipant
    });
  });

  socket.on('liveChat:leave', ({ roomId } = {}) => {
    const normalizedRoomId = normalizeLiveChatRoomId(roomId);
    if (!normalizedRoomId) return;
    const room = liveChatRooms.get(normalizedRoomId);
    if (!room) return;

    room.delete(socket.id);
    socket.leave(normalizedRoomId);
    if (socket.data.liveChatRooms) {
      socket.data.liveChatRooms.delete(normalizedRoomId);
    }

    socket.to(normalizedRoomId).emit('liveChat:peer-left', {
      roomId: String(roomId),
      socketId: socket.id
    });

    if (room.size === 0) {
      liveChatRooms.delete(normalizedRoomId);
    }
  });

  socket.on('liveChat:media_state', ({ roomId, mediaState } = {}) => {
    const normalizedRoomId = normalizeLiveChatRoomId(roomId);
    if (!normalizedRoomId) return;
    const room = liveChatRooms.get(normalizedRoomId);
    if (!room || !room.has(socket.id)) return;

    const existing = room.get(socket.id) || {};
    const nextMediaState = {
      microphone: mediaState?.microphone !== false,
      camera: mediaState?.camera !== false
    };
    room.set(socket.id, {
      ...existing,
      mediaState: nextMediaState
    });

    socket.to(normalizedRoomId).emit('liveChat:media_state', {
      roomId: String(roomId),
      socketId: socket.id,
      mediaState: nextMediaState
    });
  });

  socket.on('liveChat:signal', ({ roomId, targetSocketId, data } = {}) => {
    const normalizedRoomId = normalizeLiveChatRoomId(roomId);
    if (!normalizedRoomId || !targetSocketId || !data) return;
    const room = liveChatRooms.get(normalizedRoomId);
    if (!room || !room.has(socket.id) || !room.has(targetSocketId)) return;

    io.to(targetSocketId).emit('liveChat:signal', {
      roomId: String(roomId),
      fromSocketId: socket.id,
      participant: room.get(socket.id),
      data
    });
  });

  socket.on('friendCall:invite', async (payload = {}, cb) => {
    const requestedFromAccountId = resolveTpcIdentity({
      accountId: payload.fromAccountId,
      tpcAccountNumber: payload.fromAccountId
    });
    const fromAccountId = String(socket.data?.playerId || requestedFromAccountId || '');
    const toAccountId = String(payload.toAccountId || '');
    const fromTelegramId = Number(payload.fromTelegramId);
    const toTelegramId = Number(payload.toTelegramId);
    const type = payload.type === 'video' ? 'video' : 'voice';
    if (!fromAccountId || !toAccountId || !fromTelegramId || !toTelegramId) {
      return cb?.({ success: false, error: 'Invalid call details' });
    }
    try {
      const caller = await User.findOne({ telegramId: fromTelegramId, accountId: fromAccountId }).select('accountId nickname firstName lastName photo');
      if (!caller) return cb?.({ success: false, error: 'Caller account not found' });
      const target = await User.findOne({ telegramId: toTelegramId, accountId: toAccountId }).select('_id accountId nickname firstName lastName photo');
      if (!target) return cb?.({ success: false, error: 'User not found' });
      if (!socket.data?.playerId) {
        socket.data.playerId = fromAccountId;
        let callerSockets = userSockets.get(fromAccountId);
        if (!callerSockets) {
          callerSockets = new Set();
          userSockets.set(fromAccountId, callerSockets);
        }
        callerSockets.add(socket.id);
      }
      const targets = await getUserSocketIds({ accountId: toAccountId, telegramId: toTelegramId });
      if (!targets?.size) return cb?.({ success: false, error: 'User is offline' });
      const call = {
        roomId: `friend-call-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        fromAccountId,
        toAccountId,
        fromTelegramId,
        toTelegramId,
        fromName: String(payload.fromName || caller.nickname || caller.firstName || 'TonPlaygram player').slice(0, 60),
        toName: String(target.nickname || target.firstName || 'TonPlaygram player').slice(0, 60),
        fromPhoto: caller.photo || '',
        toPhoto: target.photo || '',
        type
      };
      for (const sid of targets) io.to(sid).emit('friendCall:incoming', call);
      cb?.({ success: true, call });
    } catch (error) {
      console.error('friend call invite failed', error);
      cb?.({ success: false, error: 'Unable to start call' });
    }
  });

  socket.on('friendCall:accept', async ({ roomId, fromAccountId, fromTelegramId } = {}) => {
    const targets = await getUserSocketIds({ accountId: fromAccountId, telegramId: fromTelegramId });
    for (const sid of targets || []) io.to(sid).emit('friendCall:accepted', { roomId });
  });

  socket.on('friendCall:reject', async ({ roomId, fromAccountId, fromTelegramId } = {}) => {
    const targets = await getUserSocketIds({ accountId: fromAccountId, telegramId: fromTelegramId });
    for (const sid of targets || []) io.to(sid).emit('friendCall:ended', { roomId, reason: 'declined' });
  });

  socket.on('friendCall:end', async ({ roomId, fromAccountId, toAccountId, fromTelegramId, toTelegramId } = {}) => {
    const peerId = String(socket.data?.playerId) === String(fromAccountId) ? toAccountId : fromAccountId;
    const peerTelegramId = String(peerId) === String(toAccountId) ? toTelegramId : fromTelegramId;
    const targets = await getUserSocketIds({ accountId: peerId, telegramId: peerTelegramId });
    for (const sid of targets || []) io.to(sid).emit('friendCall:ended', { roomId });
  });

  socket.on('rollDice', async (payload = {}) => {
    const { accountId, tableId } = payload;
    if (accountId && tableId && tableMap.has(tableId)) {
      if (!ensureRegistered(socket, accountId)) return;
      if (isRateLimited(socket, 'rollDice', rollRateLimitMs)) {
        return socket.emit('errorMessage', 'roll_rate_limited');
      }
      const table = tableMap.get(tableId);
      if (table.currentTurn !== accountId) {
        return socket.emit('errorMessage', 'Not your turn');
      }
      const player = table.players.find((p) => p.id === accountId);
      if (!player) return;
      const dice = Math.floor(Math.random() * 6) + 1;
      player.position += dice;
      const extraTurn = dice === 6;
      io.to(tableId).emit('diceRolled', {
        playerId: accountId,
        value: dice,
        accountId,
        dice,
        newPosition: player.position,
        extraTurn
      });

      if (!extraTurn) {
        const idx = table.players.findIndex((p) => p.id === accountId);
        const nextIndex = (idx + 1) % table.players.length;
        table.currentTurn = table.players[nextIndex].id;
      }
      io.to(tableId).emit('turnUpdate', { currentTurn: table.currentTurn });
      return;
    }

    const room = gameManager.findRoomBySocket(socket.id);
    if (!room) return;
    if (isRateLimited(socket, 'rollDice', rollRateLimitMs)) {
      return socket.emit('errorMessage', 'roll_rate_limited');
    }
    const current = room.players[room.currentTurn];
    if (!current || current.socketId !== socket.id) {
      return socket.emit('errorMessage', 'Not your turn');
    }
    await gameManager.rollDice(socket);
  });

  socket.on('invite1v1', async (payload, cb) => {
    let { fromId, fromName, toId, toTelegramId, roomId, token, amount, game } = payload || {};
    if (!fromId || !toId)
      return cb && cb({ success: false, error: 'invalid ids' });

    if (!ensureRegistered(socket, fromId)) return cb?.({ success: false, error: 'identity_mismatch' });
    if (!roomId || !game) return cb?.({ success: false, error: 'missing_room_or_game' });
    toTelegramId = await resolveInviteTelegramId(toId, toTelegramId);
    const invite = savePendingInvite({ fromId, fromTelegramId: payload?.fromTelegramId, fromName, roomId, token, amount, game }, [toId]);
    const targets = await getUserSocketIds({ accountId: toId, telegramId: toTelegramId });
    if (targets.size > 0) {
      for (const sid of targets) {
        io.to(sid).emit('gameInvite', serializeGameInvite(invite));
      }
    }
    notifyInviteDevices(toId, toTelegramId, { fromId, fromName, roomId, token, amount, game }).catch((error) =>
      console.error('Failed to send game invite push:', error.message)
    );
    let url = getInviteUrl(roomId, token, amount, game);
    if (toTelegramId) {
      try {
        url = await sendInviteNotification(
          bot,
          toTelegramId,
          payload?.fromTelegramId || fromId,
          fromName,
          '1v1',
          roomId,
          token,
          amount,
          game,
          invite.telegramActionToken
        );
      } catch (error) {
        console.error('Failed to send 1v1 invite notification:', error.message);
      }
    }
    cb && cb({ success: true, url });
  });

  socket.on(
    'inviteGroup',
    async (
      { fromId, fromTelegramId, fromName, toIds, telegramIds = [], opponentNames = [], roomId, token, amount, game = 'snake' },
      cb
    ) => {
      if (!fromId || !Array.isArray(toIds) || toIds.length === 0) {
        return cb && cb({ success: false, error: 'invalid ids' });
      }
      if (!ensureRegistered(socket, fromId)) return cb?.({ success: false, error: 'identity_mismatch' });
      if (!roomId || !game) return cb?.({ success: false, error: 'missing_room_or_game' });
      const invite = savePendingInvite({
        fromId, fromTelegramId, fromName, roomId, token, amount, game,
        group: [...toIds], opponentNames
      }, toIds);
      let url = getInviteUrl(roomId, token, amount, game);
      for (let i = 0; i < toIds.length; i++) {
        const toId = toIds[i];
        const toTelegramId = await resolveInviteTelegramId(toId, telegramIds[i]);
        const targets = await getUserSocketIds({ accountId: toId, telegramId: toTelegramId });
        notifyInviteDevices(toId, toTelegramId, { fromId, fromName, roomId, token, amount, game }).catch((error) =>
          console.error('Failed to send group invite push:', error.message)
        );
        if (toTelegramId) {
          try {
            url = await sendInviteNotification(
              bot,
              toTelegramId,
              fromTelegramId || fromId,
              fromName,
              'group',
              roomId,
              token,
              amount,
              game,
              invite.telegramActionToken
            );
          } catch (error) {
            console.error('Failed to send group invite notification:', error.message);
          }
        }
        if (targets.size > 0) {
          for (const sid of targets) {
            io.to(sid).emit('gameInvite', serializeGameInvite(invite));
          }
        } else {
          console.warn(`No socket found for account ID ${toId}`);
        }
      }
      cb && cb({ success: true, url });
      setTimeout(async () => {
        try {
          const room = await gameManager.getRoom(roomId);
          if (room.status === 'waiting' && room.players.length >= 2) {
            room.startGame();
            await gameManager.saveRoom(room);
          }
        } catch (err) {
          console.error('Failed to auto-start group game:', err.message);
        }
      }, 45000);
    }
  );

  socket.on('gameInvite:accept', (payload, cb) => respondToInvite(socket, payload, true, cb));
  socket.on('gameInvite:reject', (payload, cb) => respondToInvite(socket, payload, false, cb));

  const clearSocketLobbySeats = () => {
    const pid = socket.data.playerId;
    for (const [roomId, seats] of tableSeats.entries()) {
      const seated = Array.from(seats.values()).some(
        (seat) => seat?.socketId === socket.id
      );
      if (seated) {
        unseatTableSocket(pid, roomId, socket.id);
      }
    }
  };

  const emitFourInRowState = (tableId) => {
    const state = fourInRowStates.get(tableId);
    if (state) io.to(tableId).emit('fourInRowState', state);
  };

  socket.on('joinFourInRow', ({ tableId, accountId } = {}, cb) => {
    const table = tableMap.get(String(tableId || ''));
    const playerId = String(accountId || socket.data.playerId || '');
    if (
      !table ||
      table.gameType !== 'fourinrow' ||
      !table.players.some((player) => String(player.id) === playerId)
    ) {
      return cb?.({ success: false, error: 'not_a_table_player' });
    }
    socket.join(table.id);
    if (!fourInRowStates.has(table.id)) {
      const [cols = 7, rows = 6] = String(table.meta?.boardSize || '7x6')
        .split('x')
        .map(Number);
      fourInRowStates.set(table.id, {
        tableId: table.id,
        board: Array.from({ length: rows }, () => Array(cols).fill(null)),
        players: table.players.map((player) => String(player.id)),
        turn: String(table.players[0]?.id || ''),
        winner: null,
        revision: 0
      });
    }
    socket.emit('fourInRowState', fourInRowStates.get(table.id));
    return cb?.({ success: true });
  });

  socket.on('fourInRowSyncRequest', ({ tableId } = {}) => {
    const state = fourInRowStates.get(String(tableId || ''));
    if (state) socket.emit('fourInRowState', state);
  });

  socket.on('fourInRowMove', ({ tableId, accountId, column } = {}, cb) => {
    const id = String(tableId || '');
    const playerId = String(accountId || socket.data.playerId || '');
    const state = fourInRowStates.get(id);
    if (!state || state.winner || state.turn !== playerId) {
      return cb?.({ success: false, error: 'not_your_turn' });
    }
    const col = Number(column);
    if (!Number.isInteger(col) || col < 0 || col >= state.board[0].length) {
      return cb?.({ success: false, error: 'invalid_column' });
    }
    let row = -1;
    for (let index = state.board.length - 1; index >= 0; index -= 1) {
      if (state.board[index][col] == null) { row = index; break; }
    }
    if (row < 0) return cb?.({ success: false, error: 'column_full' });
    const token = state.players.indexOf(playerId);
    if (token < 0) return cb?.({ success: false, error: 'not_a_table_player' });
    state.board[row][col] = token;
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    const won = directions.some(([dr, dc]) => {
      let count = 1;
      for (const sign of [-1, 1]) {
        for (let step = 1; step < 4; step += 1) {
          const r = row + dr * step * sign;
          const c = col + dc * step * sign;
          if (state.board[r]?.[c] !== token) break;
          count += 1;
        }
      }
      return count >= 4;
    });
    state.revision += 1;
    state.winner = won ? playerId : state.board.every((cells) => cells.every((cell) => cell != null)) ? 'draw' : null;
    if (!state.winner) state.turn = state.players[(token + 1) % state.players.length];
    emitFourInRowState(id);
    return cb?.({ success: true, revision: state.revision });
  });

  socket.on('disconnecting', () => {
    removeSocketFromLiveChat(socket);
    clearSocketLobbySeats();
  });

  socket.on('disconnect', async () => {
    await gameManager.handleDisconnect(socket);
    lastActionBySocket.delete(socket.id);
    const pid = socket.data.playerId;
    if (pid) {
      const set = userSockets.get(String(pid));
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) userSockets.delete(String(pid));
      }
      await removeConnection(socket.id);
      User.updateOne({ accountId: pid }, { currentTableId: null }).catch(
        () => {}
      );
    }
    clearSocketLobbySeats();
    for (const [id, set] of tableWatchers) {
      if (set.delete(socket.id)) {
        const count = set.size;
        if (count === 0) tableWatchers.delete(id);
        io.to(id).emit('watchCount', { roomId: id, count });
      }
    }
  });
});

// Start the server
httpServer.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  if (!process.env.BOT_TOKEN || process.env.BOT_TOKEN === 'dummy') {
    console.log('BOT_TOKEN not configured. Bot may fail to connect.');
  }
});

if (process.env.BOT_TOKEN && process.env.BOT_TOKEN !== 'dummy') {
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
