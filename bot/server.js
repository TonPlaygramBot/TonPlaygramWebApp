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
import twitterAuthRoutes from './routes/twitterAuth.js';
import airdropRoutes from './routes/airdrop.js';
import checkinRoutes from './routes/checkin.js';
import socialRoutes from './routes/social.js';
import broadcastRoutes from './routes/broadcast.js';
import storeRoutes, { BUNDLES } from './routes/store.js';
import adsRoutes from './routes/ads.js';
import influencerRoutes from './routes/influencer.js';
import User from './models/User.js';
import GameResult from "./models/GameResult.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (proxyUrl) {
  console.log(`Using HTTPS proxy ${proxyUrl}`);
}

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'memory';
  console.log('MONGODB_URI not set, defaulting to in-memory MongoDB');
}


const PORT = process.env.PORT || 3000;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')

  .split(',')

  .map((o) => o.trim())

  .filter(Boolean);

const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;

const rateLimitMax = Number(process.env.RATE_LIMIT_MAX) || 100;
const app = express();
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : '*' }));
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: allowedOrigins.length ? allowedOrigins : '*' },
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
  legacyHeaders: false,
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

    const manifestBuild = process.env.TONCONNECT_MANIFEST_URL || '';
    execSync('npm run build', {
      cwd: webappDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_API_BASE_URL: apiBase,
        VITE_TONCONNECT_MANIFEST: manifestBuild
      }
    });

    return existsSync(path.join(webappPath, 'index.html'));
  } catch (err) {
    console.error('Failed to build webapp:', err.message);
    return false;
  }
}

ensureWebappBuilt();


app.use(
  express.static(webappPath, { maxAge: '1y', immutable: true })
);

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
const userSockets = new Map();
const pendingInvites = new Map();

app.set('userSockets', userSockets);

const tableWatchers = new Map();
// Track active 1v1 tables with avatar assignments and current turn
const tables = {};
const BUNDLE_TON_MAP = Object.fromEntries(
  Object.values(BUNDLES).map((b) => [b.label, b.ton])
);

function cleanupSeats() {
  const now = Date.now();
  for (const [tableId, players] of tableSeats) {
    for (const [pid, info] of players) {
      if (now - info.ts > 60_000) players.delete(pid);
    }
    if (players.size === 0) tableSeats.delete(tableId);
  }
}

async function updateLobby(tableId) {
  const match = /-(\d+)$/.exec(tableId);
  const cap = match ? Number(match[1]) : 4;
  const room = await gameManager.getRoom(tableId, cap);
  const roomPlayers = room.players
    .filter((p) => !p.disconnected)
    .map((p) => ({ id: p.playerId, name: p.name }));
  const lobbyPlayers = Array.from(tableSeats.get(tableId)?.values() || []).map(
    (p) => ({ id: p.id, name: p.name, avatar: p.avatar })
  );
  const currentTurn = tables[tableId]?.currentTurn || room.currentTurn;
  io.emit('lobbyUpdate', {
    tableId,
    players: [...lobbyPlayers, ...roomPlayers],
    currentTurn,
  });
}

function seatTableSocket(accountId, tableId, playerName, socket) {
  if (!tableId || !accountId) return;
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
    const assignedAvatar = map.size === 0 ? 'avatar1.png' : 'avatar2.png';
    map.set(String(accountId), {
      id: accountId,
      name: playerName || String(accountId),
      avatar: assignedAvatar,
      ts: Date.now(),
      socketId: socket?.id,
    });
  } else {
    const info = map.get(String(accountId));
    info.name = playerName || info.name;
    info.ts = Date.now();
    info.socketId = socket?.id;
  }

  if (!tables[tableId]) {
    tables[tableId] = { id: tableId, players: [], currentTurn: null };
  }
  const table = tables[tableId];
  if (!table.players.find((p) => p.id === accountId)) {
    const assignedAvatar = table.players.length === 0 ? 'avatar1.png' : 'avatar2.png';
    table.players.push({
      id: accountId,
      name: playerName || String(accountId),
      avatar: assignedAvatar,
      socketId: socket?.id,
    });
  } else {
    const p = table.players.find((pl) => pl.id === accountId);
    if (p) p.socketId = socket?.id;
  }
  if (!table.currentTurn) {
    table.currentTurn = table.players[0].id;
  }
  User.updateOne({ accountId }, { currentTableId: tableId }).catch(() => {});
  socket?.join(tableId);
  updateLobby(tableId).catch(() => {});
}

function unseatTableSocket(accountId, tableId, socketId) {
  if (!tableId) return;
  const map = tableSeats.get(tableId);
  if (map) {
    if (accountId) map.delete(String(accountId));
    else if (socketId) {
      for (const [pid, info] of map) {
        if (info.socketId === socketId) {
          map.delete(pid);
        }
      }
    }
    if (map.size === 0) tableSeats.delete(tableId);
  }
  const table = tables[tableId];
  if (table) {
    let removedId = null;
    if (accountId) {
      removedId = accountId;
      table.players = table.players.filter((p) => p.id !== accountId);
    } else if (socketId) {
      const pl = table.players.find((p) => p.socketId === socketId);
      removedId = pl?.id;
      table.players = table.players.filter((p) => p.socketId !== socketId);
    }
    if (table.players.length === 0) {
      delete tables[tableId];
    } else if (removedId && table.currentTurn === removedId) {
      table.currentTurn = table.players[0].id;
    }
  }
  if (accountId) {
    User.updateOne({ accountId }, { currentTableId: null }).catch(() => {});
  }
  updateLobby(tableId).catch(() => {});
}

app.post('/api/online/ping', (req, res) => {
  const { playerId } = req.body || {};
  if (playerId) {
    onlineUsers.set(String(playerId), Date.now());
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
    const [{
      totalBalance = 0,
      totalMined = 0,
      nftCount = 0,
    } = {}] = await User.aggregate([
      {
        $project: {
          balance: 1,
          minedTPC: 1,
          nftCount: {
            $size: {
              $filter: {
                input: { $ifNull: ['$gifts', []] },
                as: 'g',
                cond: { $ifNull: ['$$g.nftTokenId', false] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$balance' },
          totalMined: { $sum: '$minedTPC' },
          nftCount: { $sum: '$nftCount' },
        },
      },
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
      nftValue,
    });
  } catch (err) {
    console.error('Failed to compute stats:', err.message);
    res.status(500).json({ error: 'failed to compute stats' });
  }
});

app.post('/api/snake/table/seat', (req, res) => {
  const { tableId, playerId, name } = req.body || {};
  const pid = playerId;
  if (!tableId || !pid) return res.status(400).json({ error: 'missing data' });
  seatTableSocket(pid, tableId, name);
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
    .map((p) => ({ id: p.playerId, name: p.name }));
  const lobbyPlayers = Array.from(tableSeats.get(id)?.values() || []).map((p) => ({ id: p.id, name: p.name }));
  res.json({ id, capacity: cap, players: [...lobbyPlayers, ...roomPlayers] });
});

app.get('/api/snake/board/:id', async (req, res) => {
  const { id } = req.params;
  const match = /-(\d+)$/.exec(id);
  const cap = match ? Number(match[1]) : 4;
  const room = await gameManager.getRoom(id, cap);
  res.json({ snakes: room.snakes, ladders: room.ladders });
});
app.get("/api/watchers/count/:id", (req, res) => {
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
  let {
    fromAccount,
    fromName,
    toAccount,
    roomId,
    token,
    amount,
    type,
  } = req.body || {};
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
        game: 'snake',
      });
    }
  }

  pendingInvites.set(roomId, {
    fromId: fromAccount,
    toIds: [toAccount],
    token,
    amount,
    game: 'snake',
  });

  const url = getInviteUrl(roomId, token, amount, 'snake');
  res.json({ success: true, url });
});

app.get('/api/snake/results', async (req, res) => {
  if (req.query.leaderboard) {
    const leaderboard = await GameResult.aggregate([
      { $group: { _id: '$winner', wins: { $sum: 1 } } },
      { $sort: { wins: -1 } },
      { $limit: 20 },
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
const mongoUri = process.env.MONGODB_URI;

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
  mongoose
    .connect(mongoUri)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));
} else {
  console.log('No MongoDB URI configured, continuing without database');
}

mongoose.connection.once('open', async () => {
  try {
    await User.syncIndexes();
  } catch (err) {
    console.error('Failed to sync User indexes:', err);
  }
  gameManager.loadRooms().catch((err) =>
    console.error('Failed to load game rooms:', err)
  );
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

  socket.on('seatTable', ({ accountId, tableId, playerName }) => {
    seatTableSocket(accountId, tableId, playerName, socket);
  });

  socket.on('joinRoom', async ({ roomId, playerId, name }) => {
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
    const result = await gameManager.joinRoom(roomId, playerId, name, socket);
    if (result.error) socket.emit('error', result.error);
  });
  socket.on("watchRoom", ({ roomId }) => {
    if (!roomId) return;
    let set = tableWatchers.get(roomId);
    if (!set) { set = new Set(); tableWatchers.set(roomId, set); }
    set.add(socket.id);
    socket.join(roomId);
    io.to(roomId).emit("watchCount", { roomId, count: set.size });
  });

  socket.on("leaveWatch", ({ roomId }) => {
    if (!roomId) return;
    const set = tableWatchers.get(roomId);
    socket.leave(roomId);
    if (set) {
      set.delete(socket.id);
      const count = set.size;
      if (count === 0) tableWatchers.delete(roomId);
      io.to(roomId).emit("watchCount", { roomId, count });
    }
  });

  socket.on('rollDice', async (payload = {}) => {
    const { accountId, tableId } = payload;
    const table = tableId && tables[tableId];
    if (table) {
      if (table.currentTurn !== accountId) {
        return socket.emit('errorMessage', 'Not your turn');
      }
      const dice = Math.floor(Math.random() * 6) + 1;
      io.to(tableId).emit('diceRolled', { accountId, dice });
      const idx = table.players.findIndex((p) => p.id === accountId);
      const next = (idx + 1) % table.players.length;
      table.currentTurn = table.players[next].id;
      io.to(tableId).emit('lobbyUpdate', {
        tableId,
        players: table.players,
        currentTurn: table.currentTurn,
      });
    } else {
      await gameManager.rollDice(socket);
    }
  });

  socket.on('invite1v1', async (payload, cb) => {
    let {
      fromId,
      fromName,
      toId,
      roomId,
      token,
      amount,
      game,
    } = payload || {};
    if (!fromId || !toId) return cb && cb({ success: false, error: 'invalid ids' });

    const targets = userSockets.get(String(toId));
    if (targets && targets.size > 0) {
      for (const sid of targets) {
        io.to(sid).emit('gameInvite', { fromId, fromName, roomId, token, amount, game });
      }
    }
    pendingInvites.set(roomId, {
      fromId,
      toIds: [toId],
      token,
      amount,
      game,
    });
    const url = getInviteUrl(roomId, token, amount, game);
    cb && cb({ success: true, url });
  });

  socket.on(
    'inviteGroup',
    async (
      {
        fromId,
        fromName,
        toIds,
        opponentNames = [],
        roomId,
        token,
        amount,
      },
      cb,
    ) => {
      if (!fromId || !Array.isArray(toIds) || toIds.length === 0) {
        return cb && cb({ success: false, error: 'invalid ids' });
      }
      pendingInvites.set(roomId, {
        fromId,
        toIds: [...toIds],
        token,
        amount,
        game: 'snake',
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
              game: 'snake',
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
    },
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
      User.updateOne({ accountId: pid }, { currentTableId: null }).catch(() => {});
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
