import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import bot from './bot.js';
import { getInviteUrl } from './utils/notifications.js';
import mongoose from 'mongoose';
import { proxyUrl, proxyAgent } from './utils/proxyAgent.js';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { GameRoomManager } from './gameEngine.js';
import miningRoutes from './routes/mining.js';
import tasksRoutes from './routes/tasks.js';
import watchRoutes from './routes/watch.js';
import referralRoutes from './routes/referral.js';
import walletRoutes from './routes/wallet.js';
import accountRoutes from './routes/account.js';
import profileRoutes from './routes/profile.js';
import gameRoutes from './routes/game.js';
import twitterAuthRoutes from './routes/twitterAuth.js';
import airdropRoutes from './routes/airdrop.js';
import checkinRoutes from './routes/checkin.js';
import socialRoutes from './routes/social.js';
import broadcastRoutes from './routes/broadcast.js';
import storeRoutes, { BUNDLES } from './routes/store.js';
import adsRoutes from './routes/ads.js';
import influencerRoutes from './routes/influencer.js';
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
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

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
  WatchRecord
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (proxyUrl) {
  console.log(`Using HTTPS proxy ${proxyUrl}`);
}

if (!process.env.MONGO_URI) {
  process.env.MONGO_URI = 'memory';
  console.log('MONGO_URI not set, defaulting to in-memory MongoDB');
}

const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')

  .split(',')

  .map((o) => o.trim())

  .filter(Boolean);

const rateLimitWindowMs =
  Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

const rateLimitMax = Number(process.env.RATE_LIMIT_MAX) || 100;
const app = express();
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : '*' }));
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: allowedOrigins.length ? allowedOrigins : '*' }
});
const gameManager = new GameRoomManager(io);

// Expose socket.io instance and userSockets map for routes
app.set('io', io);

bot.action(/^reject_invite:(.+)/, async (ctx) => {
  const [roomId] = ctx.match[1].split(':');
  await ctx.answerCbQuery('Invite rejected');
  try {
    await ctx.deleteMessage();
  } catch {}
  pendingInvites.delete(roomId);
});

// Middleware and routes
app.use(compression());
// Increase JSON body limit to handle large photo uploads
app.use(express.json({ limit: '10mb' }));
const apiLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  limit: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false
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
app.use('/api/game', gameRoutes);
app.use('/api/profile', profileRoutes);
if (process.env.ENABLE_TWITTER_OAUTH === 'true') {
  app.use('/api/twitter', twitterAuthRoutes);
}
app.use('/api/airdrop', airdropRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/store', storeRoutes);

// Serve the built React app
const webappPath = path.join(__dirname, '../webapp/dist');

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

app.use(express.static(webappPath, { maxAge: '1y', immutable: true }));

function sendIndex(res) {
  if (ensureWebappBuilt()) {
    res.sendFile(path.join(webappPath, 'index.html'));
  } else {
    res.status(503).send('Webapp build not available');
  }
  launchBotWithDelay();
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

launchBotWithDelay();

app.get('/', (req, res) => {
  sendIndex(res);
});
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

const onlineUsers = new Map();
const tableSeats = new Map();
const tables = new Map();
const userSockets = new Map();
const pendingInvites = new Map();

app.set('userSockets', userSockets);

const tableWatchers = new Map();
// Dynamic lobby tables grouped by game type and capacity
const lobbyTables = {};
const tableMap = new Map();
const BUNDLE_TON_MAP = Object.fromEntries(
  Object.values(BUNDLES).map((b) => [b.label, b.ton])
);

function getAvailableTable(gameType, stake = 0, maxPlayers = 4) {
  const key = `${gameType}-${maxPlayers}`;
  if (!lobbyTables[key]) lobbyTables[key] = [];
  const open = lobbyTables[key].find(
    (t) => t.stake === stake && t.players.length < t.maxPlayers
  );
  if (open) return open;
  const table = {
    id: randomUUID(),
    gameType,
    stake,
    maxPlayers,
    players: [],
    currentTurn: null,
    ready: new Set()
  };
  lobbyTables[key].push(table);
  tableMap.set(table.id, table);
  console.log(
    `Created new table: ${table.id} (${gameType}, cap ${maxPlayers}, stake: ${stake})`
  );
  return table;
}

function cleanupSeats() {
  const now = Date.now();
  for (const [tableId, players] of tableSeats) {
    for (const [pid, info] of players) {
      if (now - info.ts > 60_000) players.delete(pid);
    }
    if (players.size === 0) tableSeats.delete(tableId);
  }
}

async function seatTableSocket(
  accountId,
  gameType,
  stake,
  maxPlayers,
  playerName,
  socket,
  playerAvatar
) {
  if (!accountId) return null;
  console.log(
    `Seating player ${playerName || accountId} at ${gameType}-${maxPlayers} (stake ${stake})`
  );
  const table = getAvailableTable(gameType, stake, maxPlayers);
  const tableId = table.id;
  cleanupSeats();
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
  if (!map.has(String(accountId))) {
    map.set(String(accountId), {
      id: accountId,
      name: playerName || String(accountId),
      avatar: playerAvatar || '',
      ts: Date.now(),
      socketId: socket?.id
    });
    table.players.push({
      id: accountId,
      name: playerName || String(accountId),
      avatar: playerAvatar || '',
      position: 0,
      socketId: socket?.id
    });
    if (table.players.length === 1) {
      table.currentTurn = accountId;
    }
  } else {
    const info = map.get(String(accountId));
    info.name = playerName || info.name;
    info.avatar = playerAvatar || info.avatar;
    info.ts = Date.now();
    info.socketId = socket?.id;
    const p = table.players.find((pl) => pl.id === accountId);
    if (p) {
      p.socketId = socket?.id;
      p.avatar = playerAvatar || p.avatar;
    }
  }
  console.log(`Player ${playerName || accountId} joined table ${tableId}`);
  socket?.join(tableId);
  table.ready.delete(String(accountId));
  io.to(tableId).emit('lobbyUpdate', {
    tableId,
    players: table.players,
    currentTurn: table.currentTurn,
    ready: Array.from(table.ready)
  });
  return table;
}

function maybeStartGame(table) {
  if (
    table.players.length === table.maxPlayers &&
    table.ready &&
    table.ready.size === table.maxPlayers
  ) {
    if (table.startTimeout) return;
    table.startTimeout = setTimeout(() => {
      console.log(`Table ${table.id} confirmed by all players. Starting game.`);
      io.to(table.id).emit('gameStart', {
        tableId: table.id,
        players: table.players,
        currentTurn: table.currentTurn,
        stake: table.stake
      });
      tableSeats.delete(table.id);
      const key = `${table.gameType}-${table.maxPlayers}`;
      lobbyTables[key] = (lobbyTables[key] || []).filter(
        (t) => t.id !== table.id
      );
      table.startTimeout = null;
    }, 1000);
  }
}

function unseatTableSocket(accountId, tableId, socketId) {
  if (!tableId) return;
  const map = tableSeats.get(tableId);
  if (map) {
    if (accountId) map.delete(String(accountId));
    else if (socketId) {
      for (const [pid, info] of map) {
        if (info.socketId === socketId) map.delete(pid);
      }
    }
    if (map.size === 0) tableSeats.delete(tableId);
  }
  const table = tableMap.get(tableId);
  if (table) {
    if (accountId)
      table.players = table.players.filter((p) => p.id !== accountId);
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
      players: table.players,
      currentTurn: table.currentTurn,
      ready: Array.from(table.ready || [])
    });
    if (accountId && table.currentTurn && table.currentTurn !== accountId) {
      io.to(tableId).emit('turnUpdate', { currentTurn: table.currentTurn });
    }
  }
  if (accountId) {
    User.updateOne({ accountId }, { currentTableId: null }).catch(() => {});
  }
}

app.post('/api/online/ping', (req, res) => {
  const { accountId, playerId } = req.body || {};
  const id = accountId ?? playerId;
  if (id) {
    onlineUsers.set(String(id), Date.now());
  }
  const now = Date.now();
  for (const [id, ts] of onlineUsers) {
    if (now - ts > 60_000) onlineUsers.delete(id);
  }
  res.json({ success: true });
});

app.get('/api/online/count', (req, res) => {
  const now = Date.now();
  for (const [id, ts] of onlineUsers) {
    if (now - ts > 60_000) onlineUsers.delete(id);
  }
  res.json({ count: onlineUsers.size });
});

app.get('/api/online/list', (req, res) => {
  const now = Date.now();
  for (const [id, ts] of onlineUsers) {
    if (now - ts > 60_000) onlineUsers.delete(id);
  }
  res.json({ users: Array.from(onlineUsers.keys()) });
});

app.get('/api/stats', async (req, res) => {
  try {
    const [{ totalBalance = 0, totalMined = 0, nftCount = 0 } = {}] =
      await User.aggregate([
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
    const accounts = await User.countDocuments();
    const active = onlineUsers.size;
    const users = await User.find({}, { transactions: 1, gifts: 1 }).lean();
    let giftSends = 0;
    let bundlesSold = 0;
    let tonRaised = 0;
    let currentNfts = 0;
    let nftValue = 0;
    let appClaimed = 0;
    let externalClaimed = 0;
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
          if (tx.detail && BUNDLE_TON_MAP[tx.detail]) {
            tonRaised += BUNDLE_TON_MAP[tx.detail];
          }
        }
        if (tx.type === 'claim') appClaimed += Math.abs(tx.amount || 0);
        if (tx.type === 'withdraw') externalClaimed += Math.abs(tx.amount || 0);
      }
    }
    const nftsBurned = giftSends - currentNfts;
    res.json({
      minted: totalBalance + totalMined,
      accounts,
      activeUsers: active,
      nftsCreated: currentNfts,
      nftsBurned,
      bundlesSold,
      tonRaised,
      appClaimed: totalBalance,
      externalClaimed,
      nftValue
    });
  } catch (err) {
    console.error('Failed to compute stats:', err.message);
    res.status(500).json({ error: 'failed to compute stats' });
  }
});

app.post('/api/snake/table/seat', (req, res) => {
  const { tableId, playerId, name, avatar } = req.body || {};
  const pid = playerId;
  if (!tableId || !pid) return res.status(400).json({ error: 'missing data' });
  const [gameType, capStr] = tableId.split('-');
  seatTableSocket(pid, gameType, 0, Number(capStr) || 4, name, null, avatar);
  res.json({ success: true });
});

app.post('/api/snake/table/unseat', (req, res) => {
  const { tableId, playerId } = req.body || {};
  const pid = playerId;
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
      const lobbyCount = tableSeats.get(id)?.size || 0;
      const players = roomCount + lobbyCount;
      return { id, capacity: cap, players };
    })
  );
  res.json(lobbies);
});

app.get('/api/snake/lobby/:id', async (req, res) => {
  const { id } = req.params;
  const match = /-(\d+)$/.exec(id);
  const cap = match ? Number(match[1]) : 4;
  const room = await gameManager.getRoom(id, cap);
  const roomPlayers = room.players
    .filter((p) => !p.disconnected)
    .map((p) => ({ id: p.playerId, name: p.name, avatar: p.avatar }));
  const lobbyPlayers = Array.from(tableSeats.get(id)?.values() || []).map(
    (p) => ({ id: p.id, name: p.name, avatar: p.avatar })
  );
  res.json({ id, capacity: cap, players: [...lobbyPlayers, ...roomPlayers] });
});

app.get('/api/snake/board/:id', async (req, res) => {
  const { id } = req.params;
  const match = /-(\d+)$/.exec(id);
  const cap = match ? Number(match[1]) : 4;
  const room = await gameManager.getRoom(id, cap);
  // Persist the board so all players receive the same layout
  await gameManager.saveRoom(room).catch(() => {});
  res.json({ snakes: room.snakes, ladders: room.ladders });
});
app.get('/api/watchers/count/:id', (req, res) => {
  const set = tableWatchers.get(req.params.id);
  res.json({ count: set ? set.size : 0 });
});

app.get('/api/ludo/lobbies', async (req, res) => {
  const capacities = [2, 3, 4];
  const lobbies = await Promise.all(
    capacities.map(async (cap) => {
      const id = `ludo-${cap}`;
      const room = await gameManager.getRoom(id, cap);
      const players = room.players.filter((p) => !p.disconnected).length;
      return { id, capacity: cap, players };
    })
  );
  res.json(lobbies);
});

app.get('/api/ludo/lobby/:id', async (req, res) => {
  const { id } = req.params;
  const match = /-(\d+)$/.exec(id);
  const cap = match ? Number(match[1]) : 4;
  const room = await gameManager.getRoom(id, cap);
  const players = room.players
    .filter((p) => !p.disconnected)
    .map((p) => ({ id: p.playerId, name: p.name }));
  res.json({ id, capacity: cap, players });
});

app.post('/api/snake/invite', async (req, res) => {
  let { fromAccount, fromName, toAccount, roomId, token, amount, type } =
    req.body || {};
  if (!fromAccount || !toAccount || !roomId) {
    return res.status(400).json({ error: 'missing data' });
  }

  const targets = userSockets.get(String(toAccount));
  if (targets && targets.size > 0) {
    for (const sid of targets) {
      io.to(sid).emit('gameInvite', {
        fromId: fromAccount,
        fromName,
        roomId,
        token,
        amount,
        game: 'snake'
      });
    }
  }

  pendingInvites.set(roomId, {
    fromId: fromAccount,
    toIds: [toAccount],
    token,
    amount,
    game: 'snake'
  });

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
      if (attempt < maxRetries) {
        const delay = initialDelayMs * attempt;
        console.log(`Retrying MongoDB connection in ${delay}ms...`);
        setTimeout(() => connectWithRetry(attempt + 1), delay);
      } else {
        console.error('Exceeded MongoDB connection retries, exiting.');
        process.exit(1);
      }
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

io.on('connection', (socket) => {
  socket.on('register', ({ playerId }) => {
    if (!playerId) return;
    let set = userSockets.get(String(playerId));
    if (!set) {
      set = new Set();
      userSockets.set(String(playerId), set);
    }
    set.add(socket.id);
    socket.data.playerId = String(playerId);
    // Mark this user as online immediately
    onlineUsers.set(String(playerId), Date.now());
  });

  socket.on(
    'seatTable',
    async (
      {
        accountId,
        gameType,
        stake,
        maxPlayers = 4,
        playerName,
        tableId,
        avatar
      },
      cb
    ) => {
      let table;
      if (tableId) {
        const [gt, capStr] = tableId.split('-');
        table = await seatTableSocket(
          accountId,
          gt,
          stake,
          Number(capStr) || 4,
          playerName,
          socket,
          avatar
        );
      } else {
        table = await seatTableSocket(
          accountId,
          gameType,
          stake,
          maxPlayers,
          playerName,
          socket,
          avatar
        );
      }
      if (table && cb) {
        cb({
          success: true,
          tableId: table.id,
          players: table.players,
          currentTurn: table.currentTurn,
          ready: Array.from(table.ready)
        });
      } else if (cb) {
        cb({ success: false, error: 'table_join_failed' });
      }
    }
  );

  socket.on('leaveLobby', ({ accountId, tableId }) => {
    if (tableId) {
      unseatTableSocket(accountId, tableId, socket.id);
    }
  });

  socket.on('confirmReady', ({ accountId, tableId }) => {
    const table = tableMap.get(tableId);
    if (!table) {
      socket.emit('errorMessage', 'table_not_found');
      return;
    }
    if (!table.ready) table.ready = new Set();
    table.ready.add(String(accountId));
    io.to(tableId).emit('lobbyUpdate', {
      tableId,
      players: table.players,
      currentTurn: table.currentTurn,
      ready: Array.from(table.ready)
    });
    maybeStartGame(table);
  });

  socket.on('joinRoom', async ({ roomId, playerId, name, avatar }) => {
    const map = tableSeats.get(roomId);
    if (map) {
      map.delete(String(playerId));
      if (map.size === 0) tableSeats.delete(roomId);
    }
    if (playerId) {
      onlineUsers.set(String(playerId), Date.now());
      // Track the user's current table when they actually join a room
      User.updateOne({ accountId: playerId }, { currentTableId: roomId }).catch(
        () => {}
      );
    }
    const result = await gameManager.joinRoom(roomId, playerId, name, socket, avatar);
    if (result.error) {
      socket.emit('error', result.error);
    } else if (result.board) {
      socket.emit('boardData', result.board);
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
      socket.emit('boardData', { snakes: room.snakes, ladders: room.ladders });
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

  socket.on('rollDice', async (payload = {}) => {
    const { accountId, tableId } = payload;
    if (accountId && tableId && tableMap.has(tableId)) {
      const table = tableMap.get(tableId);
      if (table.currentTurn !== accountId) {
        return socket.emit('errorMessage', 'Not your turn');
      }
      const player = table.players.find((p) => p.id === accountId);
      if (!player) return;
      const dice = Math.floor(Math.random() * 6) + 1;
      player.position += dice;
      io.to(tableId).emit('diceRolled', {
        accountId,
        dice,
        newPosition: player.position
      });
      const idx = table.players.findIndex((p) => p.id === accountId);
      const nextIndex = (idx + 1) % table.players.length;
      table.currentTurn = table.players[nextIndex].id;
      io.to(tableId).emit('turnUpdate', { currentTurn: table.currentTurn });
      return;
    }

    const room = gameManager.findRoomBySocket(socket.id);
    if (!room) return;
    const current = room.players[room.currentTurn];
    if (!current || current.socketId !== socket.id) {
      return socket.emit('errorMessage', 'Not your turn');
    }
    await gameManager.rollDice(socket);
  });

  socket.on('invite1v1', async (payload, cb) => {
    let { fromId, fromName, toId, roomId, token, amount, game } = payload || {};
    if (!fromId || !toId)
      return cb && cb({ success: false, error: 'invalid ids' });

    const targets = userSockets.get(String(toId));
    if (targets && targets.size > 0) {
      for (const sid of targets) {
        io.to(sid).emit('gameInvite', {
          fromId,
          fromName,
          roomId,
          token,
          amount,
          game
        });
      }
    }
    pendingInvites.set(roomId, {
      fromId,
      toIds: [toId],
      token,
      amount,
      game
    });
    const url = getInviteUrl(roomId, token, amount, game);
    cb && cb({ success: true, url });
  });

  socket.on(
    'inviteGroup',
    async (
      { fromId, fromName, toIds, opponentNames = [], roomId, token, amount },
      cb
    ) => {
      if (!fromId || !Array.isArray(toIds) || toIds.length === 0) {
        return cb && cb({ success: false, error: 'invalid ids' });
      }
      pendingInvites.set(roomId, {
        fromId,
        toIds: [...toIds],
        token,
        amount,
        game: 'snake'
      });
      let url = getInviteUrl(roomId, token, amount, 'snake');
      for (let i = 0; i < toIds.length; i++) {
        const toId = toIds[i];
        const targets = userSockets.get(String(toId));
        if (targets && targets.size > 0) {
          for (const sid of targets) {
            io.to(sid).emit('gameInvite', {
              fromId,
              fromName,
              roomId,
              token,
              amount,
              group: toIds,
              opponentNames,
              game: 'snake'
            });
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

  socket.on('disconnect', async () => {
    await gameManager.handleDisconnect(socket);
    const pid = socket.data.playerId;
    if (pid) {
      const set = userSockets.get(String(pid));
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) userSockets.delete(String(pid));
      }
      onlineUsers.delete(String(pid));
      User.updateOne({ accountId: pid }, { currentTableId: null }).catch(
        () => {}
      );
    }
    for (const roomId of socket.rooms) {
      if (tableSeats.has(roomId)) {
        unseatTableSocket(pid, roomId, socket.id);
      }
    }
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
