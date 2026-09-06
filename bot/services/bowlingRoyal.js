import { BowlingMatch, validThrow } from '../../shared/bowling/engine.js';
import {
  reserveBowlingStake,
  settleBowlingStake,
  refundExpiredBowlingStakes
} from './bowlingStake.js';

export function createBowlingRoyal({
  io,
  tableMap,
  now = Date.now,
  reserve = reserveBowlingStake,
  settle = settleBowlingStake,
  autoTick = true,
  onRelease = () => {},
  telemetry = () => {}
}) {
  const rooms = new Map(),
    preparing = new Map();
  const snapshot = (r, seat) => ({
    tableId: r.id,
    seat,
    state: r.match.state,
    revision: r.revision,
    joined: r.loaded.every(Boolean),
    connected: r.seen.map((t, i) => r.loaded[i] && now() - t < 12000),
    turnRemaining: Math.max(0, 45 - r.match.state.phaseTime),
    settlement: r.settlement,
    stake: r.stake
  });
  async function finish(r) {
    if (r.settling || ['finished', 'refunded'].includes(r.settlement?.status))
      return;
    r.settling = true;
    try {
      const result = await settle(
        r.id,
        r.result.winner === null ? null : r.accounts[r.result.winner],
        r.result.reason
      );
      r.settlement = {
        status: result.status,
        winner: result.winner || null,
        amount: result.status === 'refunded' ? r.stake : r.stake * 2,
        reason: r.result.reason
      };
      r.revision++;
      onRelease(r.id);
      telemetry({
        game: 'bowlingroyal',
        tableId: r.id,
        event: result.status === 'refunded' ? 'refunded' : 'completed'
      });
    } catch (error) {
      r.settlement = {
        status: 'pending',
        reason:
          'Your result is saved. The account service is retrying settlement.'
      };
      console.error('Bowling settlement pending:', error.message);
    } finally {
      r.settling = false;
    }
  }
  function end(r, winner, reason) {
    if (!r.result) {
      r.match.end(winner, reason);
      r.result = { winner, reason };
      r.endedAt = now();
      r.revision++;
    }
    void finish(r);
  }
  async function prepare(table) {
    if (rooms.has(table.id)) throw Error('match_already_started');
    if (preparing.has(table.id)) return preparing.get(table.id);
    const operation = (async () => {
      const record = await reserve(table);
      const accounts = record.accounts.map(String);
      if (
        tableMap.get(table.id) !== table ||
        table.players.length !== 2 ||
        table.ready.size !== 2 ||
        table.players.some(
          (p, i) =>
            String(p.tpcAccountNumber || p.id) !== accounts[i] ||
            !table.ready.has(accounts[i]) ||
            (io.sockets?.sockets &&
              !io.sockets.sockets.get(p.socketId)?.connected)
        )
      ) {
        await settle(table.id, null, 'lobby_cancelled');
        throw Error('lobby_cancelled');
      }
      rooms.set(table.id, {
        id: table.id,
        accounts,
        stake: record.stake,
        match: new BowlingMatch({
          ai: false,
          names: table.players.map((p) =>
            String(p.name || 'Player').slice(0, 40)
          )
        }),
        loaded: [false, false],
        seen: [0, 0],
        sockets: [null, null],
        lastTurns: [0, 0],
        lastInputs: ['', ''],
        createdAt: now(),
        updated: now(),
        revision: 0,
        settlement: null,
        result: null,
        settling: false
      });
      table.matchId = table.id;
      telemetry({ game: 'bowlingroyal', tableId: table.id, event: 'started' });
    })();
    preparing.set(table.id, operation);
    try {
      await operation;
    } finally {
      preparing.delete(table.id);
    }
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
          void finish(r);
        }
        if (
          ['finished', 'refunded'].includes(r.settlement?.status) &&
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
      if (time - r.createdAt > 110 * 60000) {
        end(r, null, 'Match expired · stakes refunded');
        continue;
      }
      if (!r.loaded.every(Boolean) && time - r.createdAt > 60000) {
        end(r, null, 'Opponent did not load · stakes refunded');
        continue;
      }
      if (absent.every(Boolean)) {
        end(r, null, 'Both players disconnected · stakes refunded');
        continue;
      }
      if (r.loaded.every(Boolean))
        for (let seat = 0; seat < 2; seat++)
          if (absent[seat] && live[1 - seat])
            end(r, 1 - seat, 'Opponent disconnected');
      if (!r.result && live.every(Boolean)) {
        r.match.advance(Math.min(0.1, Math.max(0, (time - r.updated) / 1000)));
        r.revision++;
        const s = r.match.state;
        if (s.phase === 'over')
          end(
            r,
            s.winner,
            s.winner === null ? 'Tie · stakes refunded' : 'Match complete'
          );
        else if (s.phase === 'ready' && s.phaseTime >= 45)
          end(r, 1 - s.active, 'Opponent ran out of time');
      }
      r.updated = time;
    }
  }
  function attach(socket) {
    function room(payload, join = false) {
      const account = String(socket.data?.playerId || '');
      if (
        !account ||
        payload.accountId !== account ||
        (socket.data?.auth?.accountId &&
          String(socket.data.auth.accountId) !== account)
      )
        throw Error('identity_mismatch');
      const r = rooms.get(String(payload.tableId || ''));
      if (!r) throw Error('match_unavailable');
      const seat = r.accounts.indexOf(account);
      if (seat < 0) throw Error('seat_required');
      if (join) {
        r.sockets[seat] = socket.id;
        r.loaded[seat] = true;
        socket.join(r.id);
      } else if (r.sockets[seat] !== socket.id) throw Error('rejoin_required');
      r.seen[seat] = now();
      return { r, seat };
    }
    function handle(event, fn) {
      socket.on(event, async (payload = {}, ack) => {
        if (typeof ack !== 'function') return;
        const time = now(),
          traffic = socket.data.bowlingTraffic;
        if (!traffic || time - traffic.since >= 1000)
          socket.data.bowlingTraffic = { since: time, count: 1 };
        else if (++traffic.count > 40) {
          ack({ success: false, error: 'rate_limited' });
          return;
        }
        try {
          ack({ success: true, data: await fn(payload) });
        } catch (error) {
          ack({
            success: false,
            error: error.message || 'bowling_unavailable'
          });
        }
      });
    }
    handle('bowlingJoin', (payload) => {
      const { r, seat } = room(payload, true);
      return snapshot(r, seat);
    });
    handle('bowlingSync', (payload) => {
      const { r, seat } = room(payload);
      return snapshot(r, seat);
    });
    handle('bowlingThrow', (payload) => {
      const { r, seat } = room(payload);
      if (!Number.isSafeInteger(payload.turn) || !validThrow(payload.input))
        throw Error('invalid_throw');
      const digest = JSON.stringify([
        payload.input.power,
        payload.input.releaseX,
        payload.input.targetX,
        payload.input.hook
      ]);
      if (r.lastTurns[seat] === payload.turn) {
        if (r.lastInputs[seat] !== digest)
          throw Error('throw_already_committed');
        return snapshot(r, seat);
      }
      if (!r.loaded.every(Boolean) || r.seen.some((t) => now() - t >= 12000))
        throw Error('waiting_for_opponent');
      r.match.throwBall(seat, payload.turn, payload.input);
      r.lastTurns[seat] = payload.turn;
      r.lastInputs[seat] = digest;
      r.revision++;
      return snapshot(r, seat);
    });
    handle('bowlingLeave', (payload) => {
      const { r, seat } = room(payload);
      end(
        r,
        r.loaded.every(Boolean) ? 1 - seat : null,
        r.loaded.every(Boolean)
          ? 'Opponent retired'
          : 'Match cancelled · stakes refunded'
      );
      socket.leave(r.id);
      return snapshot(r, seat);
    });
    socket.on('disconnect', () => {
      for (const r of rooms.values())
        for (let seat = 0; seat < 2; seat++)
          if (r.sockets[seat] === socket.id)
            r.seen[seat] = Math.min(r.seen[seat], now() - 12000);
    });
  }
  const timer = autoTick ? setInterval(tick, 33) : null;
  timer?.unref();
  const recovery = autoTick
    ? setInterval(
        () =>
          refundExpiredBowlingStakes().catch((e) =>
            console.error('Bowling stake recovery:', e.message)
          ),
        60000
      )
    : null;
  recovery?.unref();
  return {
    prepare,
    tick,
    attach,
    rooms,
    activeTableFor(account) {
      return (
        [...rooms.values()].find(
          (r) =>
            r.accounts.includes(String(account)) &&
            !['finished', 'refunded'].includes(r.settlement?.status)
        )?.id || ''
      );
    },
    close() {
      clearInterval(timer);
      clearInterval(recovery);
    }
  };
}
