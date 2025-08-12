import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { RoomService } from './RoomService.js';
import { linkGuard, isValidSlug } from './linkGuard.js';
import * as snake from './games/snake.js';
import * as crazydice from './games/crazydice.js';

const games = {
  snake,
  crazydice
};

const roomService = new RoomService(games);

const app = express();
app.use(express.json());

// canonical routing guard
app.use('/games/:slug', linkGuard, (req, res) => res.send('OK'));

app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/readyz', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: process.env.SOCKET_PATH || '/realtime'
});

io.of(/^\/rt\/\w+$/).on('connection', (socket) => {
  const slug = socket.nsp.name.split('/').pop();
  if (!isValidSlug(slug)) {
    socket.disconnect(true);
    return;
  }

  socket.on('room:create', (opts, cb) => {
    try {
      const room = roomService.create(slug, opts);
      cb && cb({ success: true, roomId: room.id });
    } catch (err) {
      cb && cb({ success: false, error: err.message });
    }
  });

  socket.on('room:join', ({ roomId, playerId }, cb) => {
    const state = roomService.join(roomId, playerId);
    if (!state) return cb && cb({ success: false });
    socket.join(roomId);
    cb && cb({ success: true, state });
    socket.to(roomId).emit('room:state', state);
  });

  socket.on('room:ready', ({ roomId, playerId }) => {
    const state = roomService.ready(roomId, playerId);
    if (state) io.to(roomId).emit('room:state', state);
  });

  socket.on('room:leave', ({ roomId, playerId }) => {
    roomService.leave(roomId, playerId);
    socket.leave(roomId);
    const room = roomService.rooms.get(roomId);
    if (room) io.to(roomId).emit('room:state', roomService.snapshot(room));
  });

  socket.on('input', ({ roomId, playerId, data }) => {
    roomService.input(roomId, playerId, data);
    const room = roomService.rooms.get(roomId);
    if (room) io.to(roomId).emit('room:state', roomService.snapshot(room));
  });
});

const PORT = process.env.PORT || 8080;
if (import.meta.url === `file://${process.argv[1]}`) {
  httpServer.listen(PORT, () => {
    console.log(`Realtime server listening on ${PORT}`);
  });
}

export { app, httpServer };
