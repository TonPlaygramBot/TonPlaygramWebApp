import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import bot from './bot.js';
import mongoose from 'mongoose';
import miningRoutes from './routes/mining.js';
import tasksRoutes from './routes/tasks.js';
import watchRoutes from './routes/watch.js';
import referralRoutes from './routes/referral.js';
import walletRoutes from './routes/wallet.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 3000;
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: '*' }
});

const games = new Map();

// Middleware and routes
app.use(express.json());
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/watch', watchRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/wallet', walletRoutes);

// Serve the built React app
const webappPath = path.join(__dirname, '../webapp/dist');

if (
    !existsSync(path.join(webappPath, 'index.html')) ||
    !existsSync(path.join(webappPath, 'assets'))
) {
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
      env: { ...process.env, VITE_API_BASE_URL: apiBase }
    });
  } catch (err) {
    console.error('Failed to build webapp:', err.message);
  }
}

app.use(express.static(webappPath));
app.get('/', (req, res) => {
  res.sendFile(path.join(webappPath, 'index.html'));
});
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).end();
  res.sendFile(path.join(webappPath, 'index.html'));
});

io.on('connection', (socket) => {
  socket.on('join-game', ({ roomId, name }) => {
    if (!games.has(roomId)) {
      games.set(roomId, { players: [], positions: {}, turn: 0 });
    }
    const game = games.get(roomId);
    if (game.players.length >= 4) return socket.emit('error', 'Room full');
    socket.join(roomId);
    game.players.push({ id: socket.id, name });
    game.positions[socket.id] = 0;
    io.to(roomId).emit('game-state', game);
  });

  socket.on('roll-dice', ({ roomId }) => {
    const game = games.get(roomId);
    if (!game) return;
    if (game.players[game.turn].id !== socket.id) return;
    const roll = Math.ceil(Math.random() * 6);
    game.positions[socket.id] += roll;
    if (game.positions[socket.id] >= 100) {
      io.to(roomId).emit('game-over', { winner: socket.id });
      games.delete(roomId);
      return;
    }
    game.turn = (game.turn + 1) % game.players.length;
    io.to(roomId).emit('game-state', game);
  });

  socket.on('disconnect', () => {
    for (const [roomId, game] of games) {
      const index = game.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        game.players.splice(index, 1);
        delete game.positions[socket.id];
        if (game.players.length === 0) {
          games.delete(roomId);
        } else {
          game.turn = game.turn % game.players.length;
          io.to(roomId).emit('game-state', game);
        }
        break;
      }
    }
  });
});

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI;

if (mongoUri) {
  mongoose
      .connect(mongoUri)
      .then(() => console.log('Connected to MongoDB'))
      .catch((err) => console.error('MongoDB connection error:', err));
} else {
  console.log('No MongoDB URI configured, continuing without database');
}

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
