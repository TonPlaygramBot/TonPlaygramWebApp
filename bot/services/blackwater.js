import {
  STEP,
  idleInput,
  sanitizeInput,
  makeMatch,
  stepMatch,
  publicMatch
} from '../../webapp/src/games/blackwater/shared/match.mjs';

/** The Royal lobby owns seats/stakes. This service owns all FPS simulation/results. */
export function attachBlackwater(
  io,
  {
    clock = Date.now,
    settleMatch,
    onMatchClosed = () => {},
    autoTick = true
  } = {}
) {
  const rooms = new Map(),
    memberships = new Map();
  let previous = clock(),
    accumulator = 0,
    snapshotTicks = 0;
  const snapshot = (r) => ({
    tableId: r.id,
    status: r.status,
    startsAt: r.startsAt,
    serverNow: clock(),
    stake: r.stake,
    settlement: r.settlement,
    ...publicMatch(r.match)
  });
  const emit = (r) =>
    io.to(`blackwater:${r.id}`).emit('blackwater:state', snapshot(r));
  async function settle(r) {
    if (r.settling || r.settlement?.status !== 'pending') return;
    r.settling = true;
    r.settlementAttempt = clock();
    try {
      r.settlement = await settleMatch(r.id, r.outcome);
      emit(r);
    } catch (error) {
      console.error('Blackwater settlement pending:', r.id, error.message);
    } finally {
      r.settling = false;
    }
  }
  function finish(r, reason, winnerAccountId = '') {
    if (r.status === 'finished') return;
    r.status = 'finished';
    r.finishedAt = clock();
    r.match.done = true;
    r.match.winnerAccountId = winnerAccountId;
    r.match.reason = reason;
    r.outcome = { winnerAccountId, reason };
    r.settlement = { status: 'pending' };
    void settle(r);
    emit(r);
  }
  const current = (s) => rooms.get(memberships.get(s.id));
  const player = (r, s) =>
    r?.match.players.find(
      (p) => p.id === String(s.data?.playerId || '') && p.socketId === s.id
    );
  const connection = (s) => {
    let inputWindow = 0,
      inputCount = 0,
      joinAt = -Infinity;
    s.on('blackwater:join', (data, ack) => {
      const cb = typeof ack === 'function' ? ack : () => {};
      if (clock() - joinAt < 300)
        return cb({ ok: false, error: 'Please wait a moment and retry.' });
      joinAt = clock();
      const r = rooms.get(String(data?.tableId || '')),
        id = String(s.data?.playerId || ''),
        p = r?.match.players.find((p) => p.id === id);
      if (!p || p.forfeited)
        return cb({
          ok: false,
          error: 'Join this operation through the BLACKWATER TPG lobby.'
        });
      if (p.socketId && p.socketId !== s.id) {
        memberships.delete(p.socketId);
        const old = io.sockets.sockets.get(p.socketId);
        old?.leave(`blackwater:${r.id}`);
        old?.emit('blackwater:replaced', {
          error: 'This match was opened on another device.'
        });
      }
      p.socketId = s.id;
      p.connected = true;
      p.disconnectedAt = 0;
      p.lastSeq = -1;
      p.input = idleInput();
      p.lastInput = clock();
      memberships.set(s.id, r.id);
      s.join(`blackwater:${r.id}`);
      if (r.status === 'waiting' && ['ar', 'smg'].includes(data?.weapon)) {
        p.weapon = data.weapon;
        p.ammo = p.weapon === 'ar' ? 30 : 36;
      }
      if (r.status === 'waiting' && r.match.players.every((p) => p.connected)) {
        r.status = 'countdown';
        r.startsAt = clock() + 3500;
      }
      cb({ ok: true, playerId: p.id, state: snapshot(r) });
      emit(r);
    });
    s.on('blackwater:input', (data) => {
      if (clock() - inputWindow > 1000) {
        inputWindow = clock();
        inputCount = 0;
      }
      if (++inputCount > 80) return;
      const r = current(s),
        p = player(r, s);
      if (!p || r.status !== 'playing' || p.forfeited) return;
      const input = sanitizeInput(data);
      if (!input || input.seq <= p.lastSeq) return;
      p.input = input;
      p.lastSeq = input.seq;
      p.lastInput = clock();
    });
    s.on('blackwater:sync', (_, ack) => {
      const r = current(s);
      if (r) s.emit('blackwater:state', snapshot(r));
      if (typeof ack === 'function') ack({ ok: !!r });
    });
    s.on('blackwater:leave', (_, ack) => {
      const r = current(s),
        p = player(r, s);
      if (p) {
        p.connected = false;
        p.forfeited = true;
        p.input = idleInput();
        p.disconnectedAt = clock() - 15001;
        memberships.delete(s.id);
        s.leave(`blackwater:${r.id}`);
        if (['waiting', 'countdown'].includes(r.status))
          finish(r, 'start_cancelled_refund');
      }
      if (typeof ack === 'function') ack({ ok: true });
    });
    s.on('blackwater:suspend', () => {
      const r = current(s),
        p = player(r, s);
      if (p) {
        p.connected = false;
        p.input = idleInput();
        p.disconnectedAt = clock();
        emit(r);
      }
    });
    s.on('disconnect', () => {
      const r = current(s),
        p = player(r, s);
      memberships.delete(s.id);
      if (!p) return;
      p.connected = false;
      p.input = idleInput();
      p.disconnectedAt = clock();
      emit(r);
    });
  };
  io.on('connection', connection);
  function tick() {
    const now = clock();
    accumulator += Math.min(0.2, Math.max(0, (now - previous) / 1000));
    previous = now;
    while (accumulator >= STEP) {
      for (const r of rooms.values()) {
        if (
          ['waiting', 'countdown'].includes(r.status) &&
          now - r.createdAt > 30000
        )
          finish(r, 'loading_timeout_refund');
        if (r.status === 'countdown' && now >= r.startsAt) {
          if (r.match.players.every((p) => p.connected)) r.status = 'playing';
          else finish(r, 'start_cancelled_refund');
        }
        if (r.status !== 'playing') continue;
        for (const p of r.match.players) {
          if (now - p.lastInput > 500)
            p.input = { ...idleInput(), yaw: p.yaw, pitch: p.pitch };
          if (!p.connected && now - p.disconnectedAt > 15000)
            p.forfeited = true;
        }
        const active = r.match.players.filter((p) => !p.forfeited);
        if (active.length <= 1) {
          finish(
            r,
            active.length ? 'opponents_left' : 'all_left_refund',
            active[0]?.id || ''
          );
          continue;
        }
        stepMatch(r.match, STEP);
        if (r.match.done) finish(r, r.match.reason, r.match.winnerAccountId);
      }
      accumulator -= STEP;
    }
    if (++snapshotTicks % 3 === 0)
      for (const r of rooms.values()) {
        if (
          r.settlement?.status === 'pending' &&
          now - (r.settlementAttempt || 0) > 5000
        )
          void settle(r);
        if (
          r.status === 'finished' &&
          r.settlement?.status !== 'pending' &&
          now - r.finishedAt > 60000
        ) {
          for (const p of r.match.players) {
            memberships.delete(p.socketId);
            io.sockets.sockets.get(p.socketId)?.leave(`blackwater:${r.id}`);
          }
          rooms.delete(r.id);
          onMatchClosed(r.id);
        } else if (r.status !== 'finished') emit(r);
      }
  }
  const timer = autoTick ? setInterval(tick, 1000 / 60) : null;
  timer?.unref?.();
  return {
    rooms,
    tick,
    createMatch(table) {
      if (!settleMatch) throw new Error('blackwater_stake_unavailable');
      if (rooms.has(table.id)) return;
      if (rooms.size >= 128) throw new Error('blackwater_lobby_full');
      rooms.set(table.id, {
        id: table.id,
        stake: table.stake,
        createdAt: clock(),
        startsAt: 0,
        status: 'waiting',
        settlement: null,
        match: makeMatch(
          table.players.map((p) => ({
            id: String(p.tpcAccountNumber || p.id),
            name: String(p.name || 'Operator').slice(0, 24)
          })),
          { rule: 'last-stand' }
        )
      });
    },
    close() {
      if (timer) clearInterval(timer);
      io.off('connection', connection);
      rooms.clear();
      memberships.clear();
    }
  };
}
