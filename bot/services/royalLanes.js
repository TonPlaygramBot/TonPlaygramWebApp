import {
  createBowlingMatch,
  activePlayer,
  beginShot,
  startReplay,
  completeRoll,
  nextTurn,
  openTurn,
  publicBowlingMatch,
  RECONNECT_MS,
  MATCH_MS
} from '../../webapp/src/games/royallanes/shared/match.mjs';
import { createBowlingSimulationPool } from './bowlingSimulationPool.mjs';
export function attachRoyalLanes(
  io,
  {
    clock = Date.now,
    settleMatch,
    onMatchClosed = () => {},
    autoTick = true,
    simulate
  } = {}
) {
  const pool = simulate ? null : createBowlingSimulationPool();
  const solve = simulate || pool.simulate;
  const rooms = new Map(),
    memberships = new Map();
  let closed = false;
  const snapshot = (r) => ({
    tableId: r.id,
    stake: r.stake,
    serverNow: clock(),
    settlement: r.settlement,
    connected: Object.fromEntries(r.seats.map((p) => [p.id, p.connected])),
    ...publicBowlingMatch(r.match)
  });
  const emit = (r) =>
    io.to(`bowling:${r.id}`).emit('bowling:state', snapshot(r));
  async function settle(r) {
    if (r.settling || r.settlement?.status !== 'pending') return;
    r.settling = true;
    r.settlementAttempt = clock();
    try {
      r.settlement = await settleMatch(r.id, r.outcome);
      emit(r);
    } catch (e) {
      console.error('Bowling settlement pending:', r.id, e.message);
    } finally {
      r.settling = false;
    }
  }
  function finish(r, reason, winnerAccountId = '') {
    if (r.match.phase === 'finished') return;
    r.match.phase = 'finished';
    r.match.reason = reason;
    r.match.winnerAccountId = winnerAccountId;
    r.finishedAt = clock();
    r.outcome = { winnerAccountId, reason };
    r.settlement = { status: 'pending' };
    void settle(r);
    emit(r);
  }
  function roomAndSeat(s) {
    const r = rooms.get(memberships.get(s.id));
    return {
      r,
      p: r?.seats.find(
        (p) => p.id === String(s.data?.playerId || '') && p.socketId === s.id
      )
    };
  }
  async function submit(r, p, payload, timedOut = false) {
    const accepted = beginShot(r.match, p.id, payload);
    if (!accepted.ok) return accepted;
    r.calculatingAt = clock();
    p.lastRequest = { id: payload.requestId, turnId: payload.turnId };
    emit(r);
    try {
      const replay = await solve({
        shot: accepted.shot,
        standing: accepted.standing
      });
      if (
        closed ||
        rooms.get(r.id) !== r ||
        r.match.phase !== 'calculating' ||
        r.match.turnId !== accepted.turnId
      )
        return { ok: false, error: 'match_finished' };
      startReplay(r.match, replay, clock(), { timedOut });
      emit(r);
      return { ok: true, turnId: accepted.turnId };
    } catch (error) {
      if (!closed && r.match.phase !== 'finished')
        finish(r, 'simulation_failed_refund');
      return { ok: false, error: 'simulation_failed_refund' };
    }
  }
  const onConnection = (s) => {
    let joinAt = -Infinity,
      actionAt = -Infinity,
      syncAt = -Infinity;
    s.on('bowling:join', (data, ack) => {
      const cb = typeof ack === 'function' ? ack : () => {};
      if (clock() - joinAt < 300)
        return cb({ ok: false, error: 'rate_limited' });
      joinAt = clock();
      const r = rooms.get(String(data?.tableId || '')),
        id = String(s.data?.playerId || '');
      const p = r?.seats.find((p) => p.id === id);
      if (!p || p.forfeited)
        return cb({ ok: false, error: 'join_through_bowling_lobby' });
      const oldRoom = memberships.get(s.id);
      if (oldRoom && oldRoom !== r.id)
        return cb({ ok: false, error: 'account_already_in_active_match' });
      if (p.socketId && p.socketId !== s.id) {
        memberships.delete(p.socketId);
        const old = io.sockets.sockets.get(p.socketId);
        old?.leave(`bowling:${r.id}`);
        old?.emit('bowling:replaced', {
          error: 'This match is open on another device.'
        });
      }
      p.socketId = s.id;
      p.connected = true;
      p.disconnectedAt = 0;
      memberships.set(s.id, r.id);
      s.join(`bowling:${r.id}`);
      if (r.match.phase === 'waiting' && r.seats.every((p) => p.connected)) {
        r.match.phase = 'countdown';
        r.match.startsAt = clock() + 3000;
        r.startedAt = r.match.startsAt;
      }
      cb({ ok: true, playerId: p.id, state: snapshot(r) });
      emit(r);
    });
    s.on('bowling:roll', (data, ack) => {
      const cb = typeof ack === 'function' ? ack : () => {};
      const { r, p } = roomAndSeat(s);
      if (!p || !p.connected || p.forfeited)
        return cb({ ok: false, error: 'not_in_match' });
      if (
        typeof data?.requestId !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,64}$/.test(data.requestId)
      )
        return cb({ ok: false, error: 'invalid_request' });
      if (
        p.lastRequest?.id === data.requestId &&
        p.lastRequest.turnId === data.turnId
      )
        return cb({ ok: true, duplicate: true });
      if (clock() - actionAt < 250)
        return cb({ ok: false, error: 'rate_limited' });
      actionAt = clock();
      // All identity, turn, pinfall and score authority stay on the server.
      const preflight = beginShot({ ...r.match }, p.id, data);
      if (!preflight.ok) return cb(preflight);
      cb({ ok: true, accepted: true, turnId: r.match.turnId });
      void submit(r, p, data);
    });
    s.on('bowling:sync', (_, ack) => {
      const { r, p } = roomAndSeat(s);
      const cb = typeof ack === 'function' ? ack : () => {};
      if (!p) return cb({ ok: false, error: 'not_in_match' });
      if (clock() - syncAt < 500)
        return cb({ ok: false, error: 'rate_limited' });
      syncAt = clock();
      cb({ ok: true, state: snapshot(r) });
    });
    const suspend = () => {
      const { r, p } = roomAndSeat(s);
      if (!p || !p.connected) return;
      p.connected = false;
      p.disconnectedAt = clock();
      emit(r);
    };
    s.on('bowling:suspend', suspend);
    s.on('bowling:leave', (_, ack) => {
      const { r, p } = roomAndSeat(s);
      if (p && r.match.phase !== 'finished') {
        p.forfeited = true;
        p.connected = false;
        const other = r.seats.find((q) => q.id !== p.id);
        if (['waiting', 'countdown'].includes(r.match.phase))
          finish(r, 'start_cancelled_refund');
        else
          finish(
            r,
            'opponent_left',
            other?.connected && !other.forfeited ? other.id : ''
          );
      }
      if (typeof ack === 'function') ack({ ok: true });
    });
    s.on('disconnect', () => {
      suspend();
      memberships.delete(s.id);
    });
  };
  io.on('connection', onConnection);
  function tick() {
    const now = clock();
    for (const r of rooms.values()) {
      const m = r.match;
      if (m.phase === 'finished') {
        if (
          r.settlement?.status === 'pending' &&
          now - (r.settlementAttempt || 0) > 5000
        )
          void settle(r);
        if (
          r.settlement?.status !== 'pending' &&
          now - r.finishedAt > 120_000
        ) {
          rooms.delete(r.id);
          for (const p of r.seats) {
            memberships.delete(p.socketId);
            io.sockets.sockets.get(p.socketId)?.leave(`bowling:${r.id}`);
          }
          onMatchClosed(r.id);
        }
        continue;
      }
      if (m.phase === 'waiting' && now - r.createdAt > 90_000) {
        finish(r, 'loading_timeout_refund');
        continue;
      }
      if (m.phase === 'countdown' && now >= m.startsAt) {
        if (r.seats.every((p) => p.connected)) openTurn(m, now);
        else {
          finish(r, 'start_cancelled_refund');
          continue;
        }
        emit(r);
      }
      if (['waiting', 'countdown'].includes(m.phase)) continue;
      for (const p of r.seats)
        if (!p.connected && now - p.disconnectedAt >= RECONNECT_MS)
          p.forfeited = true;
      const active = r.seats.filter((p) => !p.forfeited);
      if (active.length < 2) {
        finish(
          r,
          active.length ? 'opponent_disconnected' : 'all_left_refund',
          active.length && active[0].connected ? active[0].id : ''
        );
        continue;
      }
      if (now - r.startedAt > MATCH_MS) {
        finish(r, 'match_timeout_refund');
        continue;
      }
      if (m.phase === 'calculating' && now - r.calculatingAt > 25_000) {
        finish(r, 'simulation_timeout_refund');
        continue;
      }
      if (m.phase === 'rolling' && now >= m.roll.endsAt) {
        completeRoll(m, now);
        if (activePlayer(m).misses >= 2) {
          const other = r.seats.find((p) => p.id !== activePlayer(m).id);
          finish(r, 'repeated_turn_timeout', other.id);
        } else emit(r);
      }
      if (m.phase === 'result' && now >= m.readyAt) {
        if (m.reason) finish(r, m.reason, m.winnerAccountId);
        else {
          nextTurn(m, now);
          emit(r);
        }
      }
      if (m.phase === 'aiming' && now >= m.turnDeadline) {
        const p = r.seats.find((p) => p.id === activePlayer(m).id);
        void submit(
          r,
          p,
          {
            turnId: m.turnId,
            requestId: `timeout-${m.turnId}`,
            shot: { aim: 1.2, hook: 0, power: 75 }
          },
          true
        );
      }
    }
  }
  const timer = autoTick ? setInterval(tick, 100) : null;
  timer?.unref?.();
  return {
    rooms,
    tick,
    createMatch(table) {
      if (!settleMatch) throw Error('bowling_stake_unavailable');
      if (rooms.has(table.id)) return;
      if (rooms.size >= 64) throw Error('bowling_lobby_full');
      if (table.maxPlayers !== 2 || table.players.length !== 2)
        throw Error('invalid_bowling_roster');
      const players = table.players.map((p) => ({
        id: String(p.tpcAccountNumber || p.id),
        name: p.name || 'Bowler'
      }));
      rooms.set(table.id, {
        id: table.id,
        stake: table.stake,
        match: createBowlingMatch(players),
        seats: players.map((p) => ({
          ...p,
          connected: false,
          forfeited: false,
          disconnectedAt: clock(),
          socketId: ''
        })),
        createdAt: clock(),
        startedAt: 0,
        settlement: null
      });
    },
    async close() {
      closed = true;
      if (timer) clearInterval(timer);
      io.off('connection', onConnection);
      rooms.clear();
      memberships.clear();
      await pool?.close();
    }
  };
}
