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
import User from './models/User.js';
import GameResult from "./models/GameResult.js";
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import compression from 'compression';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
app.use(cors());
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
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

const onlineUsers = new Map();
const tableSeats = new Map();
const userSockets = new Map();

function cleanupSeats() {
  const now = Date.now();
  for (const [tableId, players] of tableSeats) {
    for (const [pid, info] of players) {
      if (now - info.ts > 60_000) players.delete(pid);
    }
    if (players.size === 0) tableSeats.delete(tableId);
  }
}

app.post('/api/online/ping', (req, res) => {
  const { playerId, telegramId } = req.body || {};
  const id = playerId || telegramId;
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

app.post('/api/snake/table/seat', (req, res) => {
  const { tableId, playerId, telegramId, name } = req.body || {};
  const pid = playerId || telegramId;
  if (!tableId || !pid) return res.status(400).json({ error: 'missing data' });
  cleanupSeats();
  let map = tableSeats.get(tableId);
  if (!map) {
    map = new Map();
    tableSeats.set(tableId, map);
  }
  map.set(String(pid), { id: pid, name: name || String(pid), ts: Date.now() });
  res.json({ success: true });
});

app.post('/api/snake/table/unseat', (req, res) => {
  const { tableId, playerId, telegramId } = req.body || {};
  const pid = playerId || telegramId;
  const map = tableSeats.get(tableId);
  if (map && pid) {
    map.delete(String(pid));
    if (map.size === 0) tableSeats.delete(tableId);
  }
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

mongoose.connection.once('open', () => {
  gameManager.loadRooms().catch((err) =>
    console.error('Failed to load game rooms:', err)
  );
});

io.on('connection', (socket) => {
  socket.on('register', ({ playerId, telegramId }) => {
    const id = playerId || telegramId;
    if (!id) return;
    let set = userSockets.get(String(id));
    if (!set) {
      set = new Set();
      userSockets.set(String(id), set);
    }
    set.add(socket.id);
    socket.data.telegramId = telegramId || null;
    socket.data.playerId = String(id);
    // Mark this user as online immediately
    onlineUsers.set(String(id), Date.now());
  });

  socket.on('joinRoom', async ({ roomId, playerId, name }) => {
    const map = tableSeats.get(roomId);
    if (map) {
      map.delete(String(playerId));
      if (map.size === 0) tableSeats.delete(roomId);
    }
    if (playerId) {
      onlineUsers.set(String(playerId), Date.now());
    }
    const result = await gameManager.joinRoom(roomId, playerId, name, socket);
    if (result.error) socket.emit('error', result.error);
  });

  socket.on('rollDice', async () => {
    await gameManager.rollDice(socket);
  });

  socket.on('invite1v1', ({ fromId, fromName, toId, roomId, token, amount }, cb) => {
    if (!fromId || !toId) return cb && cb({ success: false, error: 'invalid ids' });
    const ts = onlineUsers.get(String(toId));
    if (!ts || Date.now() - ts > 60_000) {
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
