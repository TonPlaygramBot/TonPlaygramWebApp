import { randomInt } from 'node:crypto';
import {
  createGame,
  applyAction,
  activePlayer,
  publicGame,
  forfeitPlayer
} from '../../webapp/src/games/tabletop/shared/engine.mjs';
import { TABLETOP_IDS } from '../../webapp/src/games/tabletop/shared/catalog.mjs';
export const TABLETOP_TURN_MS = 60_000;
export const TABLETOP_RECONNECT_MS = 60_000;
export const TABLETOP_MATCH_MS = 30 * 60_000;
/** Shared authoritative transport; the existing Royal lobby remains the only admission path. */
export function attachTabletop(
  io,
  {
    settleMatch,
    clock = Date.now,
    autoTick = true,
    onMatchClosed = () => {}
  } = {}
) {
  const entropy = () =>
    Array.from({ length: 128 }, () => randomInt(0, 0x100000000));
  const rooms = new Map(),
    memberships = new Map();
  const snapshot = (r, id) => ({
    ...publicGame(r.game, id),
    tableId: r.id,
    status: r.status,
    stake: r.stake,
    settlement: r.settlement,
    serverNow: clock(),
    turnDeadline: r.deadline,
    connected: Object.fromEntries(r.seats.map((p) => [p.id, p.connected]))
  });
  function emit(r) {
    for (const p of r.seats)
      if (p.socketId)
        io.to(p.socketId).emit('tabletop:state', snapshot(r, p.id));
  }
  async function settle(r) {
    if (r.settling || r.settlement?.status !== 'pending') return;
    r.settling = true;
    r.settlementAttempt = clock();
    try {
      r.settlement = await settleMatch(r.game.gameId, r.id, r.outcome);
      emit(r);
    } catch (error) {
      console.error('Tabletop settlement pending:', r.id, error.message);
    } finally {
      r.settling = false;
    }
  }
  function finish(r, reason, winnerAccountId = '') {
    if (r.status === 'finished') return;
    r.status = 'finished';
    r.game.done = true;
    r.game.phase = 'finished';
    r.game.reason = reason;
    r.game.winnerAccountId = winnerAccountId;
    r.finishedAt = clock();
    r.outcome = { reason, winnerAccountId };
    r.settlement = { status: 'pending' };
    void settle(r);
    emit(r);
  }
  function current(s) {
    const r = rooms.get(memberships.get(s.id));
    return {
      r,
      p: r?.seats.find(
        (p) => p.id === String(s.data?.playerId || '') && p.socketId === s.id
      )
    };
  }
  function forfeit(r, id) {
    r.game = forfeitPlayer(r.game, id);
    r.deadline = clock() + TABLETOP_TURN_MS;
    if (r.game.done) finish(r, r.game.reason, r.game.winnerAccountId);
    else emit(r);
  }
  const onConnection = (s) => {
    let joinAt = -Infinity,
      actionAt = -Infinity,
      syncAt = -Infinity;
    const reply = (cb) => (typeof cb === 'function' ? cb : () => {});
    s.on('tabletop:join', (data, ack) => {
      const cb = reply(ack);
      if (clock() - joinAt < 300)
        return cb({ ok: false, error: 'rate_limited' });
      joinAt = clock();
      const r = rooms.get(String(data?.tableId || '')),
        id = String(s.data?.playerId || ''),
        p = r?.seats.find((p) => p.id === id);
      if (!p || r.game.gameId !== data?.gameId)
        return cb({ ok: false, error: 'join_through_tabletop_lobby' });
      if (memberships.has(s.id) && memberships.get(s.id) !== r.id)
        return cb({ ok: false, error: 'account_already_in_active_match' });
      if (p.socketId && p.socketId !== s.id) {
        memberships.delete(p.socketId);
        io.to(p.socketId).emit('tabletop:replaced', { tableId: r.id });
      }
      p.socketId = s.id;
      p.connected = true;
      p.disconnectedAt = 0;
      memberships.set(s.id, r.id);
      if (r.status === 'waiting' && r.seats.every((p) => p.connected)) {
        r.status = 'playing';
        r.startedAt = clock();
        r.deadline = clock() + TABLETOP_TURN_MS;
      }
      cb({ ok: true, playerId: id, state: snapshot(r, id) });
      emit(r);
    });
    s.on('tabletop:action', (data, ack) => {
      const cb = reply(ack),
        { r, p } = current(s);
      if (
        !p ||
        !p.connected ||
        r.status !== 'playing' ||
        r.game.players.find((q) => q.id === p.id)?.out
      )
        return cb({ ok: false, error: 'not_in_active_match' });
      if (clock() >= r.deadline)
        return cb({ ok: false, error: 'turn_expired' });
      if (
        typeof data?.requestId !== 'string' ||
        !/^[a-zA-Z0-9_-]{1,64}$/.test(data.requestId) ||
        typeof data?.actionId !== 'string' ||
        data.actionId.length > 80 ||
        !Number.isSafeInteger(data.revision)
      )
        return cb({ ok: false, error: 'invalid_request' });
      if (p.lastRequest === data.requestId)
        return cb({ ok: true, duplicate: true, state: snapshot(r, p.id) });
      if (clock() - actionAt < 120)
        return cb({ ok: false, error: 'rate_limited' });
      actionAt = clock();
      const actor = activePlayer(r.game).id,
        turn = r.game.turn,
        round = r.game.round;
      r.game.entropy = entropy();
      const result = applyAction(r.game, p.id, data.actionId, data.revision);
      if (!result.ok) return cb(result);
      r.game = result.state;
      p.lastRequest = data.requestId;
      if (
        actor !== activePlayer(r.game).id ||
        turn !== r.game.turn ||
        round !== r.game.round
      )
        r.deadline = clock() + TABLETOP_TURN_MS;
      if (r.game.done) finish(r, r.game.reason, r.game.winnerAccountId);
      else emit(r);
      cb({ ok: true, state: snapshot(r, p.id) });
    });
    s.on('tabletop:sync', (_, ack) => {
      const cb = reply(ack),
        { r, p } = current(s);
      if (!p) return cb({ ok: false, error: 'not_in_match' });
      if (clock() - syncAt < 500)
        return cb({ ok: false, error: 'rate_limited' });
      syncAt = clock();
      cb({ ok: true, state: snapshot(r, p.id) });
    });
    const suspend = () => {
      const { r, p } = current(s);
      if (!p || !p.connected) return;
      p.connected = false;
      p.disconnectedAt = clock();
      emit(r);
    };
    s.on('tabletop:suspend', suspend);
    s.on('tabletop:leave', (_, ack) => {
      const { r, p } = current(s);
      if (p && r.status !== 'finished') {
        p.connected = false;
        p.disconnectedAt = clock();
        if (r.status === 'waiting') finish(r, 'start_cancelled_refund');
        else forfeit(r, p.id);
      }
      reply(ack)({ ok: true });
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
      if (r.status === 'waiting' && now - r.createdAt >= 60_000)
        finish(r, 'loading_timeout_refund');
      if (r.status === 'playing') {
        if (now - r.startedAt >= TABLETOP_MATCH_MS)
          finish(r, 'time_limit_refund');
        else {
          const absent = r.seats.filter(
            (p) =>
              !p.connected &&
              now - p.disconnectedAt >= TABLETOP_RECONNECT_MS &&
              !r.game.players.find((q) => q.id === p.id)?.out
          );
          // Mark simultaneous departures together before determining any winner.
          if (absent.length === r.game.players.filter((p) => !p.out).length)
            finish(r, 'all_left_refund');
          else {
            for (const p of absent) {
              if (r.status === 'playing') forfeit(r, p.id);
            }
            if (r.status === 'playing' && now >= r.deadline)
              forfeit(r, activePlayer(r.game).id);
          }
        }
      }
      if (
        r.settlement?.status === 'pending' &&
        now - (r.settlementAttempt || 0) >= 5000
      )
        void settle(r);
      if (
        r.status === 'finished' &&
        r.settlement?.status !== 'pending' &&
        now - r.finishedAt >= 60_000
      ) {
        for (const p of r.seats) memberships.delete(p.socketId);
        rooms.delete(r.id);
        onMatchClosed(r.id);
      }
    }
  }
  const timer = autoTick ? setInterval(tick, 1000) : null;
  timer?.unref?.();
  return {
    rooms,
    tick,
    createMatch(table) {
      if (!settleMatch || !TABLETOP_IDS.includes(table.gameType))
        throw Error('tabletop_unavailable');
      if (rooms.has(table.id)) return;
      if (rooms.size >= 128) throw Error('tabletop_lobby_full');
      const roster = table.players.map((p) => ({
        id: String(p.tpcAccountNumber || p.id),
        name: p.name || 'Player'
      }));
      rooms.set(table.id, {
        id: table.id,
        game: createGame(
          table.gameType,
          roster,
          randomInt(1, 0xffffffff),
          entropy()
        ),
        seats: roster.map((p) => ({
          ...p,
          connected: false,
          disconnectedAt: clock(),
          socketId: null
        })),
        status: 'waiting',
        stake: table.stake,
        createdAt: clock(),
        deadline: 0,
        settlement: null
      });
    },
    close() {
      clearInterval(timer);
      io.off('connection', onConnection);
      rooms.clear();
      memberships.clear();
    }
  };
}
