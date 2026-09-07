import {
  createMatch,
  advance,
  setInput,
  neutralInput,
  reviewActive
} from '../../shared/tennis/engine.js';
import {
  reserveTennisStake,
  settleTennisStake,
  refundExpiredTennisStakes
} from './tennisStake.js';
import { updateTennisCareer } from './tennisCareer.js';

/** Uses the existing seat/ready/gameStart queue. Clients submit controls only. */
export function createTennisRoyal({
  io,
  tableMap,
  now = Date.now,
  reserve = reserveTennisStake,
  settle = settleTennisStake,
  career = updateTennisCareer,
  autoTick = true
}) {
  const rooms = new Map();
  const snapshot = (r, seat) => ({
    code: r.id,
    seat,
    state: r.state,
    joined: r.loaded.every(Boolean),
    peerSeen: r.seen[1 - seat],
    revision: r.revision,
    settlement: r.settlement,
    players: r.players
  });
  async function finish(r, winner, reason) {
    if (
      r.settling ||
      r.settlement?.status === 'finished' ||
      r.settlement?.status === 'refunded'
    )
      return;
    r.settling = true;
    try {
      const result = await settle(
        r.id,
        winner === null ? null : r.accounts[winner],
        reason
      );
      r.settlement = {
        status: result.status,
        winner: result.winner || null,
        reason
      };
    } catch (e) {
      r.settlement = {
        status: 'pending',
        error: 'Settlement is pending. Reconnecting to the account service.'
      };
      console.error('Tennis settlement', e.message);
    } finally {
      r.settling = false;
      r.revision++;
    }
  }
  function end(r, winner, reason) {
    if (!r.result) {
      if (r.state.phase === 'over' && r.state.winner !== null) {
        winner = r.state.winner;
        reason = 'completed';
      }
      r.state.review = null;
      r.state.closeCall = null;
      r.state.phase = 'over';
      r.state.winner = winner;
      r.state.message = reason;
      r.state.ball.vx = r.state.ball.vy = r.state.ball.vz = 0;
      r.result = { winner, reason };
      r.endedAt = now();
    }
    finish(r, r.result.winner, r.result.reason);
  }
  async function prepare(table) {
    const record = await reserve(table);
    const ids = record.accounts.map(String);
    if (
      tableMap.get(table.id) !== table ||
      table.players.length !== 2 ||
      table.ready.size !== 2 ||
      table.players.some(
        (p, i) => String(p.tpcAccountNumber || p.id) !== ids[i]
      )
    ) {
      await settle(table.id, null, 'lobby_cancelled');
      throw Error('lobby_cancelled');
    }
    const format = table.meta?.format || 'set',
      surface = table.meta?.surface || 'hard';
    const state = createMatch({
      ai: false,
      surface,
      gamesToWin: format === 'quick' ? 1 : format === 'full' ? 6 : 3,
      setsToWin: format === 'full' ? 2 : 1,
      seed: Math.floor(Math.random() * 2147483647)
    });
    rooms.set(table.id, {
      id: table.id,
      accounts: ids,
      players: table.players.map((p) => ({
        name: p.name || 'Player',
        avatar: p.avatar || ''
      })),
      state,
      loaded: [false, false],
      seen: [0, 0],
      sockets: [null, null],
      lastInput: [0, 0],
      createdAt: now(),
      updated: now(),
      revision: 0,
      settlement: null,
      result: null,
      settling: false
    });
    table.matchId = table.id;
  }
  function tick() {
    const time = now();
    for (const r of rooms.values()) {
      if (r.result) {
        if (
          r.settlement?.status === 'pending' &&
          time - (r.retryAt || 0) > 5000
        ) {
          r.retryAt = time;
          finish(r, r.result.winner, r.result.reason);
        }
        if (
          r.settlement?.status !== 'pending' &&
          !r.settling &&
          time - r.endedAt > 300000
        )
          rooms.delete(r.id);
        continue;
      }
      const live = r.loaded.map(
        (loaded, i) => loaded && time - r.seen[i] < 12000
      );
      const absent = r.loaded.map(
        (loaded, i) => time - (loaded ? r.seen[i] : r.createdAt) > 60000
      );
      if (time - r.createdAt > 2 * 60 * 60 * 1000) {
        end(r, null, 'Match expired · stakes refunded');
        continue;
      }
      if (absent[0] && absent[1]) {
        end(r, null, 'Both players disconnected · stakes refunded');
        continue;
      }
      if (absent[0] && live[1]) {
        end(r, 1, 'Opponent disconnected');
        continue;
      }
      if (absent[1] && live[0]) {
        end(r, 0, 'Opponent disconnected');
        continue;
      }
      if (live.every(Boolean)) {
        advance(r.state, Math.min(0.1, Math.max(0, (time - r.updated) / 1000)));
        r.revision++;
        if (r.state.phase === 'over' && !reviewActive(r.state)) {
          r.result = { winner: r.state.winner, reason: 'completed' };
          r.endedAt = time;
          finish(r, r.result.winner, 'completed');
        }
      }
      r.updated = time;
    }
  }
  function attach(socket) {
    const identify = (payload) => {
      const id = String(socket.data?.playerId || '');
      if (!id || String(payload?.accountId || '') !== id)
        throw Error('identity_mismatch');
      const bound = socket.data?.auth?.accountId;
      if (bound && String(bound) !== id) throw Error('identity_mismatch');
      return id;
    };
    const withRoom = (payload, join = false) => {
      const id = identify(payload),
        r = rooms.get(String(payload.tableId || ''));
      if (!r) throw Error('match_unavailable');
      const seat = r.accounts.indexOf(id);
      if (seat < 0) throw Error('seat_required');
      if (join) {
        r.sockets[seat] = socket.id;
        r.loaded[seat] = true;
        r.seen[seat] = now();
        socket.join(r.id);
      } else if (r.sockets[seat] !== socket.id) throw Error('rejoin_required');
      return { r, seat };
    };
    const handle = (name, fn) =>
      socket.on(name, async (payload = {}, ack) => {
        try {
          const data = await fn(payload);
          ack?.({ success: true, data });
        } catch (e) {
          ack?.({ success: false, error: e.message || 'tennis_unavailable' });
        }
      });
    handle('tennisJoin', (payload) => {
      const { r, seat } = withRoom(payload, true);
      return snapshot(r, seat);
    });
    handle('tennisInput', (payload) => {
      const { r, seat } = withRoom(payload);
      const time = now();
      if (time - r.lastInput[seat] < 35) return snapshot(r, seat);
      const input = payload.input;
      if (!input || !Number.isSafeInteger(input.swing) || input.swing < 0)
        throw Error('invalid_input');
      r.seen[seat] = time;
      r.lastInput[seat] = time;
      if (!r.result) setInput(r.state, seat, { ...neutralInput(), ...input });
      return snapshot(r, seat);
    });
    handle('tennisLeave', (payload) => {
      const { r, seat } = withRoom(payload);
      if (!r.result) end(r, 1 - seat, 'Opponent retired');
      socket.leave(r.id);
      return { ok: true };
    });
    handle('tennisCareer', async (payload) => {
      const id = identify(payload);
      const time = now();
      if (
        payload.action !== 'get' &&
        time - (socket.data.tennisCareerAt || 0) < 150
      )
        throw Error('Please wait a moment before saving again.');
      if (payload.action !== 'get') socket.data.tennisCareerAt = time;
      return career(id, payload.action, payload);
    });
    socket.on('disconnect', () => {
      for (const r of rooms.values())
        for (let seat = 0; seat < 2; seat++)
          if (r.sockets[seat] === socket.id) {
            r.seen[seat] = Math.min(r.seen[seat], now() - 12000);
          }
    });
  }
  const timer = autoTick ? setInterval(tick, 33) : null;
  timer?.unref();
  const refunds = autoTick
    ? setInterval(
        () =>
          refundExpiredTennisStakes().catch((e) =>
            console.error('Tennis expired stake recovery', e.message)
          ),
        60000
      )
    : null;
  refunds?.unref();
  return {
    prepare,
    attach,
    tick,
    rooms,
    close() {
      clearInterval(timer);
      clearInterval(refunds);
    }
  };
}
