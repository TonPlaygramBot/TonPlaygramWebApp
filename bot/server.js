import dotenv from 'dotenv';
import express from 'express';
import bot from './bot.js';
import mongoose from 'mongoose';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { GameRoomManager } from './gameEngine.js';
import miningRoutes from './routes/mining.js';
import tasksRoutes from './routes/tasks.js';
import watchRoutes from './routes/watch.js';
import referralRoutes from './routes/referral.js';
import walletRoutes from './routes/wallet.js';
import profileRoutes from './routes/profile.js';
import airdropRoutes from './routes/airdrop.js';
import checkinRoutes from './routes/checkin.js';
import User from './models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import compression from 'compression';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'memory';
  console.log('MONGODB_URI not set, defaulting to in-memory MongoDB');
}

const PORT = process.env.PORT || 3000;
const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
const gameManager = new GameRoomManager(io);

// Middleware and routes
app.use(compression());
app.use(express.json());
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/watch', watchRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/airdrop', airdropRoutes);
app.use('/api/checkin', checkinRoutes);

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
// Expose TonConnect manifest dynamically so the base URL always matches the
// current request host. The manifest path is taken from the
// TONCONNECT_MANIFEST_URL environment variable if provided, otherwise the
// default `/tonconnect-manifest.json` is used. This avoids 404s when the
// Express server handles requests before the static middleware.
const manifestUrl = process.env.TONCONNECT_MANIFEST_URL || '/tonconnect-manifest.json';
const manifestPath = new URL(manifestUrl, 'http://placeholder').pathname;
console.log("TONCONNECT_MANIFEST_URL", manifestUrl);
console.log("manifestpath", manifestPath);

app.get(manifestUrl, (req, res) => {
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const baseUrl = `${proto}://${req.get('host')}`;
  console.log("proto: ", proto);
  console.log("baseUrl: ", baseUrl);
  res.json({
    name: 'TonPlaygram',
    description: 'Play games with TPC staking via Tonkeeper',
    url: baseUrl,
    icons: [`${baseUrl}/icons/tpc.svg`]
  });
});

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
app.get('/api/snake/lobbies', (req, res) => {
  const capacities = [2, 3, 4];
  const lobbies = capacities.map((cap) => {
    const id = `snake-${cap}`;
    const room = gameManager.getRoom(id, cap);
    const players = room.players.filter((p) => !p.disconnected).length;
    return { id, capacity: cap, players };
  });
  res.json(lobbies);
});

app.get('/api/snake/lobby/:id', (req, res) => {
  const { id } = req.params;
  const match = /-(\d+)$/.exec(id);
  const cap = match ? Number(match[1]) : 4;
  const room = gameManager.getRoom(id, cap);
  const players = room.players
    .filter((p) => !p.disconnected)
    .map((p) => ({ id: p.playerId, name: p.name }));
  res.json({ id, capacity: cap, players });
});
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).end();
  sendIndex(res);
});

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI;

if (mongoUri === 'memory') {
  import('mongodb-memory-server').then(async ({ MongoMemoryServer }) => {
    const mem = await MongoMemoryServer.create();
    mongoose
      .connect(mem.getUri())
      .then(() => console.log('Using in-memory MongoDB'))
      .catch((err) => console.error('MongoDB connection error:', err));
  });
} else if (mongoUri) {
  mongoose
    .connect(mongoUri)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));
} else {
  console.log('No MongoDB URI configured, continuing without database');
}

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ roomId, playerId, name }) => {
    const result = gameManager.joinRoom(roomId, playerId, name, socket);
    if (result.error) socket.emit('error', result.error);
  });
  socket.on('rollDice', () => gameManager.rollDice(socket));
  socket.on('disconnect', () => gameManager.handleDisconnect(socket));
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
