import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import bot from './bot.js';
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
import airdropRoutes from './routes/airdrop.js';
import checkinRoutes from './routes/checkin.js';
import socialRoutes from './routes/social.js';
import broadcastRoutes from './routes/broadcast.js';
import buyRoutes from './routes/buy.js';
import { BUNDLES } from './routes/store.js';
import User from './models/User.js';
import GameResult from "./models/GameResult.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import compression from 'compression';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

function readJson(file, def) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return def;
  }
}
dotenv.config({ path: path.join(__dirname, '.env') });

if (proxyUrl) {
  console.log(`Using HTTPS proxy ${proxyUrl}`);
}

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'memory';
  console.log('MONGODB_URI not set, defaulting to in-memory MongoDB');
}

const PORT = process.env.PORT || 3000;
const app = express();

let allowedOrigins = '*';
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins = process.env.ALLOWED_ORIGINS
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (allowedOrigins.length === 0) allowedOrigins = '*';
}

app.use(cors({ origin: allowedOrigins }));
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: allowedOrigins } });
const gameManager = new GameRoomManager(io);

// Middleware and routes
app.use(compression());
// Increase JSON body limit to handle large photo uploads
app.use(express.json({ limit: '10mb' }));
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/watch', watchRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/airdrop', airdropRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/buy', buyRoutes);

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
}

app.get('/', (req, res) => {
  sendIndex(res);
});
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

const ONLINE_TIMEOUT_MS = 30_000;
const SEAT_TIMEOUT_MS = 30_000;

const onlineUsers = new Map();
const tableSeats = new Map();
const userSockets = new Map();
const watchSockets = new Map();
const BUNDLE_TON_MAP = Object.fromEntries(
  Object.values(BUNDLES).map((b) => [b.label, b.ton])
);
setInterval(cleanupSeats, SEAT_TIMEOUT_MS);

function cleanupSeats() {
  const now = Date.now();
  for (const [tableId, players] of tableSeats) {
    for (const [pid, info] of players) {
      if (now - info.ts > SEAT_TIMEOUT_MS) {
        players.delete(pid);
        if (info.id) {
          User.updateOne({ accountId: info.id }, { currentTableId: null }).catch(
            () => {}
          );
        }
      }
    }
    if (players.size === 0) tableSeats.delete(tableId);
  }
}

app.post('/api/online/ping', (req, res) => {
  const { accountId } = req.body || {};
  if (accountId) {
    onlineUsers.set(String(accountId), Date.now());
  }
  const now = Date.now();
  for (const [id, ts] of onlineUsers) {
    if (now - ts > ONLINE_TIMEOUT_MS) onlineUsers.delete(id);
  }
  res.json({ success: true });
});

app.get('/api/online/count', (req, res) => {
  const now = Date.now();
  for (const [id, ts] of onlineUsers) {
    if (now - ts > ONLINE_TIMEOUT_MS) onlineUsers.delete(id);
  }
  res.json({ count: onlineUsers.size });
});

app.get('/api/online/list', (req, res) => {
  const now = Date.now();
  for (const [id, ts] of onlineUsers) {
    if (now - ts > ONLINE_TIMEOUT_MS) onlineUsers.delete(id);
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
    let tpcSold = 0;
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
          if (tx.amount) {
            tpcSold += Math.abs(tx.amount);
          }
        }
        if (tx.type === 'claim') appClaimed += Math.abs(tx.amount || 0);
        if (tx.type === 'withdraw') externalClaimed += Math.abs(tx.amount || 0);
      }
    }
    const purchasesPath = path.join(dataDir, 'walletPurchases.json');
    const walletPurchases = readJson(purchasesPath, {});
    for (const info of Object.values(walletPurchases)) {
      if (info && info.tpc) tpcSold += info.tpc;
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
      tpcSold,
      appClaimed: totalBalance,
      externalClaimed,
      nftValue
    });
  } catch (err) {
    console.error('Failed to compute stats:', err.message);
    res.status(500).json({ error: 'failed to compute stats' });
  }
});

app.post('/api/snake/table/seat', async (req, res) => {
  const { tableId, accountId, name, confirmed } = req.body || {};
  const pid = accountId;
  if (!tableId || !pid) return res.status(400).json({ error: 'missing data' });
  cleanupSeats();

  let user;
  try {
    user = await User.findOne({ accountId: pid });
  } catch {}

  const tgid = user?.telegramId;
  const key = String(tgid || pid);

  if (user && user.currentTableId && user.currentTableId !== tableId) {
    const old = tableSeats.get(user.currentTableId);
    if (old) {
      old.delete(String(tgid || pid));
      if (old.size === 0) tableSeats.delete(user.currentTableId);
    }
  }

  let map = tableSeats.get(tableId);
  if (!map) {
    map = new Map();
    tableSeats.set(tableId, map);
  }

  const info = map.get(key) || {
    id: pid,
    telegramId: tgid,
    name: name || String(pid)
  };

  info.name = name || info.name;
  info.telegramId = tgid;
  info.id = pid;
  info.ts = Date.now();
  if (typeof confirmed === 'boolean') info.confirmed = confirmed;
  map.set(key, info);

  if (user) {
    user.currentTableId = tableId;
    await user.save().catch(() => {});
  }

  res.json({ success: true });
});

app.post('/api/snake/table/unseat', async (req, res) => {
  const { tableId, accountId } = req.body || {};
  const pid = accountId;
  let user;
  try {
    user = await User.findOne({ accountId: pid });
  } catch {}

  const key = String(user?.telegramId || pid);
  const map = tableSeats.get(tableId);
  if (map && pid) {
    map.delete(key);
    if (map.size === 0) tableSeats.delete(tableId);
  }
  if (user) {
    user.currentTableId = null;
    await user.save().catch(() => {});
  }
  res.json({ success: true });
});
app.get('/api/snake/lobbies', async (req, res) => {
  cleanupSeats();
  const capacities = [2, 3, 4];
  const lobbies = capacities.map((cap) => {
    let players = 0;
    for (const [tid, map] of tableSeats) {
      const parts = String(tid).split('-');
      if (Number(parts[1]) === cap) players += map.size;
    }
    for (const room of gameManager.rooms.values()) {
      const parts = String(room.id).split('-');
      if (Number(parts[1]) === cap)
        players += room.players.filter((p) => !p.disconnected).length;
    }
    return { id: `snake-${cap}`, capacity: cap, players };
  });
  res.json(lobbies);
});

app.get('/api/snake/lobby/:id', async (req, res) => {
  const { id } = req.params;
  const parts = id.split('-');
  const cap = Number(parts[1]) || 4;
  const room = await gameManager.getRoom(id, cap);
  const roomPlayers = room.players
    .filter((p) => !p.disconnected)
    .map((p) => ({ id: p.playerId, telegramId: p.telegramId, name: p.name }));
  const lobbyPlayers = Array.from(tableSeats.get(id)?.values() || []).map((p) => ({ id: p.id, telegramId: p.telegramId, name: p.name, confirmed: !!p.confirmed }));
  const combined = [...lobbyPlayers, ...roomPlayers];
  const unique = [];
  const seen = new Set();
  for (const pl of combined) {
    const key = pl.telegramId || pl.id;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(pl);
    }
  }
  res.json({ id, capacity: cap, players: unique });
});

app.get('/api/snake/board/:id', async (req, res) => {
  const { id } = req.params;
  const parts = id.split('-');
  const cap = Number(parts[1]) || 4;
  const room = await gameManager.getRoom(id, cap);
  res.json({ snakes: room.snakes, ladders: room.ladders });
});

app.get('/api/snake/results', async (req, res) => {
  const { leaderboard, tableId } = req.query;
  if (leaderboard) {
    const match = tableId ? { tableId } : {};
    const leaderboardData = await GameResult.aggregate([
      { $match: match },
      { $group: { _id: '$winner', wins: { $sum: 1 } } },
      { $sort: { wins: -1 } },
      { $limit: 20 },
    ]);
    return res.json({ leaderboard: leaderboardData });
  }
  const limit = Number(req.query.limit) || 20;
  const query = tableId ? { tableId } : {};
  const results = await GameResult.find(query)
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

mongoose.connection.once('open', () => {
  gameManager.loadRooms().catch((err) =>
    console.error('Failed to load game rooms:', err)
  );
});

io.on('connection', (socket) => {
  socket.on('register', ({ accountId }) => {
    const id = accountId;
    if (!id) return;
    let set = userSockets.get(String(id));
    if (!set) {
      set = new Set();
      userSockets.set(String(id), set);
    }
    set.add(socket.id);
    socket.data.playerId = String(id);
    // Mark this user as online immediately
    onlineUsers.set(String(id), Date.now());
  });

  socket.on('joinRoom', async ({ roomId, accountId, name }) => {
    const map = tableSeats.get(roomId);
    const lobbyCount = map ? map.size : 0;
    const confirmedCount = map
      ? Array.from(map.values()).filter((p) => p.confirmed).length
      : 0;
    const parts = roomId.split('-');
    const cap = Number(parts[1]) || 4;
    const room = await gameManager.getRoom(roomId, cap);
    const joined = room.players.filter((p) => !p.disconnected).length;

    if (
      map &&
      (confirmedCount + joined < room.capacity || confirmedCount < lobbyCount)
    ) {
      socket.emit('error', 'table not full');
      return;
    }

    if (map) {
      map.delete(String(accountId));
      if (map.size === 0) tableSeats.delete(roomId);
    }
    if (accountId) {
      onlineUsers.set(String(accountId), Date.now());
    }
    const result = await gameManager.joinRoom(roomId, accountId, name, socket);
    if (result.error) socket.emit('error', result.error);
  });

  socket.on('watchRoom', async ({ roomId }) => {
    if (!roomId) return;
    let set = watchSockets.get(roomId);
    if (!set) {
      set = new Set();
      watchSockets.set(roomId, set);
    }
    set.add(socket.id);
    socket.join(roomId);
    const parts = roomId.split('-');
    const cap = Number(parts[1]) || 4;
    const room = await gameManager.getRoom(roomId, cap);
    const players = room.players.map((p) => ({
      playerId: p.playerId,
      telegramId: p.telegramId,
      name: p.name,
      position: p.position,
    }));
    socket.emit('watchState', {
      board: { snakes: room.snakes, ladders: room.ladders },
      players,
      currentTurn: room.players[room.currentTurn]?.playerId || null,
    });
  });

  socket.on('leaveWatch', ({ roomId }) => {
    if (!roomId) return;
    const set = watchSockets.get(roomId);
    if (set) {
      set.delete(socket.id);
      if (set.size === 0) watchSockets.delete(roomId);
    }
    socket.leave(roomId);
  });

  socket.on('rollDice', async () => {
    await gameManager.rollDice(socket);
  });

  socket.on('invite1v1', ({ fromId, fromName, toId, roomId, token, amount }, cb) => {
    if (!fromId || !toId) return cb && cb({ success: false, error: 'invalid ids' });
    const ts = onlineUsers.get(String(toId));
    if (!ts || Date.now() - ts > ONLINE_TIMEOUT_MS) {
      return cb && cb({ success: false, error: 'User offline' });
    }
    const targets = userSockets.get(String(toId));
    if (!targets || targets.size === 0) {
      return cb && cb({ success: false, error: 'User offline' });
    }
    for (const sid of targets) {
      io.to(sid).emit('gameInvite', { fromId, fromName, roomId, token, amount });
    }
    cb && cb({ success: true });
  });

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
    }
    for (const [rid, set] of watchSockets) {
      if (set.delete(socket.id) && set.size === 0) {
        watchSockets.delete(rid);
      }
    }
  });
});

// Start the server
httpServer.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.SKIP_BOT_LAUNCH || !process.env.BOT_TOKEN) {
    console.log('Skipping Telegram bot launch');
    return;
  }

  try {
    await bot.launch();
  } catch (err) {
    console.error('Failed to launch Telegram bot:', err.message);
  }
});

if (!process.env.SKIP_BOT_LAUNCH && process.env.BOT_TOKEN) {
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
