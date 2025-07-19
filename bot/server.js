import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import bot from './bot.js';
import { sendInviteNotification, getInviteUrl } from './utils/notifications.js';
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
  const [roomId, telegramId] = ctx.match[1].split(':');
  await ctx.answerCbQuery('Invite rejected');
  try {
    await ctx.deleteMessage();
  } catch {}
  const invite = pendingInvites.get(roomId);
  if (invite) {
    invite.telegramIds = (invite.telegramIds || []).filter(
      (id) => String(id) !== telegramId,
    );
    pendingInvites.set(roomId, invite);
    const { fromTelegramId, telegramIds } = invite;
    try {
      await bot.telegram.sendMessage(
        String(fromTelegramId),
        `${telegramId} rejected your game invite`,
      );
    } catch {}
    for (const other of telegramIds || []) {
      if (String(other) === telegramId) continue;
      try {
        await bot.telegram.sendMessage(
          String(other),
          `${telegramId} rejected the group invite`,
        );
      } catch {}
    }
  }
});

// Middleware and routes
app.use(compression());
// Increase JSON body limit to handle large photo uploads
app.use(express.json({ limit: '10mb' }));
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
  // Track the user's current table by account id
  User.updateOne({ accountId: pid }, { currentTableId: tableId }).catch(() => {});
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
  // Clear the table tracking field
  if (pid) {
    User.updateOne({ accountId: pid }, { currentTableId: null }).catch(() => {});
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
    fromTelegramId,
    fromName,
    toAccount,
    toTelegramId,
    roomId,
    token,
    amount,
    type,
  } = req.body || {};
  if (!fromAccount || !toAccount || !roomId) {
    return res.status(400).json({ error: 'missing data' });
  }

  if (!toTelegramId) {
    let user = await User.findOne({ accountId: toAccount });
    if (user) {
      toTelegramId = user.telegramId;
      console.log(
        `Found Telegram ID ${toTelegramId} using account ID ${toAccount}`,
      );
    } else if (/^\d+$/.test(String(toAccount))) {
      user = await User.findOne({ telegramId: Number(toAccount) });
      if (user) {
        toTelegramId = user.telegramId;
        console.log(
          `Found Telegram ID ${toTelegramId} using Telegram ID ${toAccount}`,
        );
      } else {
        // Fallback to using the numeric ID directly when no user record exists
        toTelegramId = Number(toAccount);
      }
    }
  }

  let targets = userSockets.get(String(toAccount));
  if ((!targets || targets.size === 0) && toTelegramId) {
    targets = userSockets.get(String(toTelegramId));
  }
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
  } else {
    console.warn(
      `No socket found for account ID ${toAccount} or Telegram ID ${toTelegramId}`,
    );
  }

  pendingInvites.set(roomId, {
    fromId: fromAccount,
    fromTelegramId,
    toIds: [toAccount],
    telegramIds: [toTelegramId],
    token,
    amount,
    game: 'snake',
  });

  let url = getInviteUrl(roomId, token, amount, 'snake');
  if (toTelegramId) {
    try {
      url = await sendInviteNotification(
        bot,
        toTelegramId,
        fromTelegramId,
        fromName,
        type || '1v1',
        roomId,
        token,
        amount,
        'snake',
      );
    } catch (err) {
      console.error('Failed to send Telegram notification:', err.message);
    }
  } else {
    console.warn(
      `Could not find Telegram ID using account ID or Telegram ID ${toAccount}`,
    );
  }

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

  socket.on('rollDice', async () => {
    await gameManager.rollDice(socket);
  });

  socket.on('invite1v1', async (payload, cb) => {
    let {
      fromId,
      fromTelegramId,
      fromName,
      toId,
      toTelegramId,
      roomId,
      token,
      amount,
      game,
    } = payload || {};
    if (!fromId || !toId) return cb && cb({ success: false, error: 'invalid ids' });

    if (!toTelegramId) {
      let user = await User.findOne({ accountId: toId });
      if (!user) {
        user = await User.findOne({ telegramId: Number(toId) });
      }
      if (user) {
        toTelegramId = user.telegramId;
      } else if (/^\d+$/.test(String(toId))) {
        // Use the numeric ID directly when the user is unknown
        toTelegramId = Number(toId);
      }
    }

    let targets = userSockets.get(String(toId));
    if ((!targets || targets.size === 0) && toTelegramId) {
      targets = userSockets.get(String(toTelegramId));
    }
    if (targets && targets.size > 0) {
      for (const sid of targets) {
        io.to(sid).emit('gameInvite', { fromId, fromName, roomId, token, amount, game });
      }
    } else {
      console.warn(
        `No socket found for account ID ${toId} or Telegram ID ${toTelegramId}`,
      );
    }
    pendingInvites.set(roomId, {
      fromId,
      fromTelegramId,
      toIds: [toId],
      telegramIds: [toTelegramId],
      token,
      amount,
      game,
    });
    let url = getInviteUrl(roomId, token, amount, game);
    if (toTelegramId) {
      try {
        url = await sendInviteNotification(
          bot,
          toTelegramId,
          fromTelegramId,
          fromName,
          '1v1',
          roomId,
          token,
          amount,
          game,
        );
      } catch (err) {
        console.error('Failed to send Telegram notification:', err.message);
      }
    } else {
      console.warn(
        `Could not find Telegram ID for account ID or Telegram ID ${toId}`,
      );
    }
    cb && cb({ success: true, url });
  });

  socket.on(
    'inviteGroup',
    async (
      {
        fromId,
        fromTelegramId,
        fromName,
        toIds,
        telegramIds = [],
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
        fromTelegramId,
        toIds: [...toIds],
        telegramIds: [...telegramIds],
        token,
        amount,
        game: 'snake',
      });
      let url = getInviteUrl(roomId, token, amount, 'snake');
      for (let i = 0; i < toIds.length; i++) {
        const toId = toIds[i];
        let tgId = telegramIds[i];
        if (!tgId) {
          let user = await User.findOne({ accountId: toId });
          if (!user) {
            user = await User.findOne({ telegramId: Number(toId) });
          }
          if (user) {
            tgId = user.telegramId;
            telegramIds[i] = tgId;
          } else if (/^\d+$/.test(String(toId))) {
            // Fall back to the numeric ID directly when no record exists
            tgId = Number(toId);
            telegramIds[i] = tgId;
          }
        }
        let targets = userSockets.get(String(toId));
        if ((!targets || targets.size === 0) && tgId) {
          targets = userSockets.get(String(tgId));
        }
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
          console.warn(
            `No socket found for account ID ${toId} or Telegram ID ${tgId}`,
          );
        }
        if (tgId) {
          try {
            url = await sendInviteNotification(
              bot,
              tgId,
              fromTelegramId,
              fromName,
              'group',
              roomId,
              token,
              amount,
              'snake',
            );
          } catch (err) {
            console.error('Failed to send Telegram notification:', err.message);
          }
        } else {
          console.warn(
            `Could not find Telegram ID for account ID or Telegram ID ${toId}`,
          );
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
      // Clear the table tracking when the user disconnects
      User.updateOne({ accountId: pid }, { currentTableId: null }).catch(() => {})
    }
    for (const [id, set] of tableWatchers) {
      if (set.delete(socket.id)) {
        const count = set.size;
        if (count === 0) tableWatchers.delete(id);
        io.to(id).emit("watchCount", { roomId: id, count });
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
