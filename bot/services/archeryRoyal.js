import {
  createMatch,
  publicMatch,
  submitShot
} from '../../webapp/src/games/archeryroyal/shared/rules.mjs';

const RECONNECT_MS = 30_000;
const TURN_MS = 35_000;

export function attachArcheryRoyal(
  io,
  { clock = Date.now, settleMatch, onMatchClosed = () => {}, autoTick = true } = {}
) {
  const rooms = new Map();
  const memberships = new Map();
  let closed = false;

  const snapshot = (room) => ({
    tableId: room.id,
    stake: room.stake,
    serverNow: clock(),
    turnDeadline: room.turnDeadline,
    connected: Object.fromEntries(room.seats.map((seat) => [seat.id, seat.connected])),
    settlement: room.settlement,
    ...publicMatch(room.match)
  });
  const emit = (room) => io.to(`archery:${room.id}`).emit('archery:state', snapshot(room));

  async function settle(room) {
    if (room.settling || room.settlement?.status !== 'pending') return;
    room.settling = true;
    room.settlementAttempt = clock();
    try {
      room.settlement = await settleMatch(room.id, room.outcome);
      emit(room);
    } catch (error) {
      console.error('Archery settlement pending:', room.id, error.message);
    } finally {
      room.settling = false;
    }
  }

  function finish(room, reason, winnerAccountId = '') {
    if (room.match.phase === 'finished' && room.settlement) return;
    room.match.phase = 'finished';
    room.match.reason = reason;
    room.match.winnerId = winnerAccountId || 'draw';
    room.finishedAt = clock();
    room.outcome = { winnerAccountId, reason };
    room.settlement = { status: 'pending' };
    void settle(room);
    emit(room);
  }

  function roomAndSeat(socket) {
    const room = rooms.get(memberships.get(socket.id));
    return {
      room,
      seat: room?.seats.find(
        (candidate) => candidate.id === String(socket.data?.playerId || '') && candidate.socketId === socket.id
      )
    };
  }

  const onConnection = (socket) => {
    let actionAt = -Infinity;
    let joinAt = -Infinity;
    let syncAt = -Infinity;

    socket.on('archery:join', (data, ack) => {
      const callback = typeof ack === 'function' ? ack : () => {};
      if (clock() - joinAt < 300) return callback({ ok: false, error: 'rate_limited' });
      joinAt = clock();
      const room = rooms.get(String(data?.tableId || ''));
      const playerId = String(socket.data?.playerId || '');
      const seat = room?.seats.find((candidate) => candidate.id === playerId);
      if (!seat || seat.forfeited) return callback({ ok: false, error: 'join_through_archery_lobby' });
      const oldRoom = memberships.get(socket.id);
      if (oldRoom && oldRoom !== room.id) return callback({ ok: false, error: 'account_already_in_active_match' });
      if (seat.socketId && seat.socketId !== socket.id) {
        memberships.delete(seat.socketId);
        const oldSocket = io.sockets.sockets.get(seat.socketId);
        oldSocket?.leave(`archery:${room.id}`);
        oldSocket?.emit('archery:replaced', { error: 'match_open_elsewhere' });
      }
      seat.socketId = socket.id;
      seat.connected = true;
      seat.disconnectedAt = 0;
      if (room.seats.every((candidate) => candidate.connected || candidate.id === seat.id)) {
        room.turnDeadline = clock() + TURN_MS;
      }
      memberships.set(socket.id, room.id);
      socket.join(`archery:${room.id}`);
      callback({ ok: true, playerId, state: snapshot(room) });
      emit(room);
    });

    socket.on('archery:shot', (data, ack) => {
      const callback = typeof ack === 'function' ? ack : () => {};
      const { room, seat } = roomAndSeat(socket);
      if (!room || !seat || !seat.connected || seat.forfeited) return callback({ ok: false, error: 'not_in_match' });
      if (typeof data?.requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(data.requestId)) return callback({ ok: false, error: 'invalid_request' });
      if (seat.lastRequest?.id === data.requestId && seat.lastRequest.turnId === data.turnId) return callback({ ok: true, duplicate: true });
      if (clock() - actionAt < 250) return callback({ ok: false, error: 'rate_limited' });
      if (data.turnId !== room.match.turnId) return callback({ ok: false, error: 'stale_turn' });
      actionAt = clock();
      const accepted = submitShot(room.match, seat.id, data.shot);
      if (!accepted.ok) return callback(accepted);
      seat.lastRequest = { id: data.requestId, turnId: data.turnId };
      seat.misses = 0;
      room.turnDeadline = clock() + TURN_MS;
      callback({ ok: true, turnId: data.turnId, result: accepted.result });
      if (room.match.phase === 'finished') {
        const winner = room.match.winnerId === 'draw' ? '' : room.match.winnerId;
        finish(room, room.match.reason, winner);
      } else emit(room);
    });

    socket.on('archery:sync', (_, ack) => {
      const callback = typeof ack === 'function' ? ack : () => {};
      const { room, seat } = roomAndSeat(socket);
      if (!room || !seat) return callback({ ok: false, error: 'not_in_match' });
      if (clock() - syncAt < 500) return callback({ ok: false, error: 'rate_limited' });
      syncAt = clock();
      callback({ ok: true, state: snapshot(room) });
    });

    const suspend = () => {
      const { room, seat } = roomAndSeat(socket);
      if (!room || !seat || !seat.connected) return;
      seat.connected = false;
      seat.disconnectedAt = clock();
      emit(room);
    };
    socket.on('archery:suspend', suspend);
    socket.on('archery:leave', (_, ack) => {
      const { room, seat } = roomAndSeat(socket);
      if (room && seat && room.match.phase !== 'finished') {
        seat.forfeited = true;
        seat.connected = false;
        const opponent = room.seats.find((candidate) => candidate.id !== seat.id && !candidate.forfeited);
        finish(room, 'opponent_left', opponent?.id || '');
      }
      if (typeof ack === 'function') ack({ ok: true });
    });
    socket.on('disconnect', () => {
      suspend();
      memberships.delete(socket.id);
    });
  };

  io.on('connection', onConnection);

  function tick() {
    const now = clock();
    for (const room of rooms.values()) {
      if (room.match.phase === 'finished') {
        if (room.settlement?.status === 'pending' && now - (room.settlementAttempt || 0) > 5000) void settle(room);
        if (room.settlement?.status !== 'pending' && now - room.finishedAt > 120_000) {
          rooms.delete(room.id);
          onMatchClosed(room.id);
        }
        continue;
      }
      for (const seat of room.seats) {
        if (!seat.connected && now - seat.disconnectedAt >= RECONNECT_MS) seat.forfeited = true;
      }
      const active = room.seats.filter((seat) => !seat.forfeited);
      if (active.length < 2) {
        finish(room, active.length ? 'opponent_disconnected' : 'all_left_refund', active.length ? active[0].id : '');
        continue;
      }
      if (now >= room.turnDeadline) {
        const seat = room.seats.find((candidate) => candidate.id === room.match.currentPlayerId);
        seat.misses += 1;
        if (seat.misses >= 2) {
          const opponent = room.seats.find((candidate) => candidate.id !== seat.id);
          finish(room, 'repeated_turn_timeout', opponent.id);
        } else {
          submitShot(room.match, seat.id, { aimX: 1, aimY: -1, power: 0.35 });
          room.turnDeadline = now + TURN_MS;
          if (room.match.phase === 'finished') {
            const winner = room.match.winnerId === 'draw' ? '' : room.match.winnerId;
            finish(room, room.match.reason, winner);
          } else emit(room);
        }
      }
    }
  }

  const timer = autoTick ? setInterval(tick, 100) : null;
  timer?.unref?.();

  return {
    rooms,
    tick,
    createMatch(table) {
      if (!settleMatch) throw new Error('archery_stake_unavailable');
      if (rooms.has(table.id)) return;
      if (rooms.size >= 64) throw new Error('archery_lobby_full');
      if (table.maxPlayers !== 2 || table.players.length !== 2) throw new Error('invalid_archery_roster');
      const players = table.players.map((player) => ({
        id: String(player.tpcAccountNumber || player.id),
        name: player.name || 'Archer'
      }));
      rooms.set(table.id, {
        id: table.id,
        stake: table.stake,
        match: createMatch(players, Math.abs([...table.id].reduce((sum, char) => Math.imul(sum, 31) + char.charCodeAt(0), 17))),
        seats: players.map((player) => ({ ...player, connected: false, forfeited: false, misses: 0, disconnectedAt: clock(), socketId: '', lastRequest: null })),
        turnDeadline: clock() + TURN_MS,
        createdAt: clock(),
        finishedAt: 0,
        settlement: null
      });
    },
    async close() {
      closed = true;
      if (timer) clearInterval(timer);
      io.off('connection', onConnection);
      rooms.clear();
      memberships.clear();
    }
  };
}
