import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  STEP,
  RACE_LIMIT,
  makeTrack,
  normalizeCraft,
  createRacer,
  stepRace,
  standings,
  sanitizeInput,
  neutralInput
} from '../../webapp/src/games/jetski/simulation.mjs';

/** Free online races use the app's authenticated Socket.IO connection. No wallet mutations. */
export function attachJetskiRoyal(
  io,
  { clock = Date.now, automatic = true } = {}
) {
  const rooms = new Map(),
    memberships = new Map();
  let previous = clock(),
    accumulator = 0,
    broadcastAt = 0;
  const current = (s) => rooms.get(memberships.get(s.id));
  const player = (r, s) => r?.players.find((p) => p.socketId === s.id);
  const snapshot = (r) => ({
    code: r.code,
    hostId: r.hostId,
    trackId: r.track.id,
    status: r.status,
    public: r.public,
    serverNow: clock(),
    startsAt: r.startsAt,
    elapsed: r.elapsed,
    players: r.players.map(({ token, socketId, ...p }) => p),
    racers: r.racers.map(({ input, lastInput, ...v }) => v),
    results:
      r.status === 'finished'
        ? standings(r.racers).map(({ input, lastInput, ...v }) => v)
        : []
  });
  const emit = (r) =>
    io.to(`jetski:${r.code}`).emit('jetski:state', snapshot(r));
  const removeRoom = (r) => {
    io.to(`jetski:${r.code}`).emit('jetski:closed', {
      error: 'This room has expired. Join a new race.'
    });
    for (const p of r.players) {
      memberships.delete(p.socketId);
      io.sockets.sockets.get(p.socketId)?.leave(`jetski:${r.code}`);
    }
    rooms.delete(r.code);
  };
  const leave = (s) => {
    const r = current(s);
    if (!r) return;
    const p = player(r, s);
    memberships.delete(s.id);
    s.leave(`jetski:${r.code}`);
    if (p) {
      const racer = r.racers.find((v) => v.id === p.id);
      if (racer) {
        racer.disconnected = true;
        racer.input = neutralInput();
      }
      r.players = r.players.filter((v) => v.id !== p.id);
    }
    if (!r.players.length) {
      removeRoom(r);
      return;
    }
    if (!r.players.some((p) => p.id === r.hostId)) r.hostId = r.players[0].id;
    emit(r);
  };
  const bind = (r, s, p, cb) => {
    p.socketId = s.id;
    p.connected = true;
    p.disconnectedAt = 0;
    memberships.set(s.id, r.code);
    s.join(`jetski:${r.code}`);
    cb({
      ok: true,
      code: r.code,
      playerId: p.id,
      token: p.token,
      state: snapshot(r)
    });
    emit(r);
  };
  const add = (r, s, data, cb) => {
    const p = {
      id: randomBytes(8).toString('hex'),
      token: randomBytes(24).toString('hex'),
      name: String(data.name || 'Rider')
        .replace(/[<>\x00-\x1f]/g, '')
        .slice(0, 18),
      craftId: normalizeCraft(data.craftId),
      ready: false,
      connected: true,
      disconnectedAt: 0
    };
    r.players.push(p);
    if (!r.hostId) r.hostId = p.id;
    bind(r, s, p, cb);
  };
  const onConnection = (s) => {
    let lobbyAt = -Infinity,
      inputAt = 0,
      inputCount = 0;
    const events = new Map();
    const listen = (event, fn) =>
      s.on(`jetski:${event}`, (payload, ack) => {
        const cb = typeof ack === 'function' ? ack : () => {};
        if (event !== 'input') {
          if (clock() - (events.get(event) ?? -Infinity) < 100)
            return cb({ ok: false, error: 'Please wait a moment.' });
          events.set(event, clock());
        }
        fn(
          payload && typeof payload === 'object' && !Array.isArray(payload)
            ? payload
            : {},
          cb
        );
      });
    const limited = (cb) => {
      if (clock() - lobbyAt < 650) {
        cb({
          ok: false,
          error: 'Please wait a moment before joining another room.'
        });
        return true;
      }
      lobbyAt = clock();
      return false;
    };
    const create = (d, cb) => {
      if (rooms.size >= 128)
        return cb({
          ok: false,
          error: 'The race server is full. Please retry shortly.'
        });
      leave(s);
      let code;
      do {
        code = randomBytes(3).toString('hex').toUpperCase();
      } while (rooms.has(code));
      const r = {
        code,
        hostId: '',
        track: makeTrack(d.trackId),
        public: d.public === true,
        players: [],
        racers: [],
        status: 'waiting',
        elapsed: 0,
        startsAt: 0,
        createdAt: clock()
      };
      rooms.set(code, r);
      add(r, s, d, cb);
    };
    listen('create', (d, cb) => {
      if (!limited(cb)) create(d, cb);
    });
    listen('quick', (d, cb) => {
      if (limited(cb)) return;
      const trackId = makeTrack(d.trackId).id;
      const r = [...rooms.values()].find(
        (v) =>
          v.public &&
          v.status === 'waiting' &&
          v.track.id === trackId &&
          v.players.length < 6 &&
          v.players.every((p) => p.connected) &&
          v !== current(s)
      );
      if (!r) return create({ ...d, public: true }, cb);
      leave(s);
      add(r, s, d, cb);
    });
    listen('join', (d, cb) => {
      if (limited(cb)) return;
      const r = rooms.get(String(d.code || '').toUpperCase());
      if (!r)
        return cb({
          ok: false,
          error: 'Room not found. Check the six-character code.'
        });
      if (r.status !== 'waiting' || r.players.length >= 6)
        return cb({
          ok: false,
          error: 'This room is full or the race has started.'
        });
      if (current(s) === r)
        return cb({ ok: false, error: 'You are already in this room.' });
      leave(s);
      add(r, s, d, cb);
    });
    listen('resume', (d, cb) => {
      if (limited(cb)) return;
      const r = rooms.get(String(d.code || '').toUpperCase()),
        p = r?.players.find((p) => p.id === d.playerId);
      const token = String(d.token || '');
      if (
        !p ||
        !/^[a-f0-9]{48}$/.test(token) ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(p.token))
      )
        return cb({
          ok: false,
          error: 'Your race session expired. Return to the lobby.'
        });
      if (p.socketId !== s.id) {
        io.sockets.sockets.get(p.socketId)?.leave(`jetski:${r.code}`);
        memberships.delete(p.socketId);
      }
      if (current(s) !== r) leave(s);
      const racer = r.racers.find((v) => v.id === p.id);
      if (racer) racer.disconnected = false;
      bind(r, s, p, cb);
    });
    listen('ready', (d, cb) => {
      const r = current(s),
        p = player(r, s);
      if (!p || r.status !== 'waiting')
        return cb({ ok: false, error: 'Join a waiting room first.' });
      p.ready = d.ready === true;
      cb({ ok: true });
      emit(r);
    });
    listen('start', (_, cb) => {
      const r = current(s),
        p = player(r, s);
      if (!p || p.id !== r.hostId || r.status !== 'waiting')
        return cb({
          ok: false,
          error: 'Only the host can start a waiting race.'
        });
      if (
        r.players.length < 2 ||
        r.players.some((p) => !p.ready || !p.connected)
      )
        return cb({
          ok: false,
          error: 'At least two connected riders must be ready.'
        });
      r.racers = r.players.map((v, i) =>
        createRacer(r.track, v.id, v.name, i, false, v.craftId)
      );
      while (r.racers.length < 6) {
        const i = r.racers.length;
        r.racers.push(
          createRacer(
            r.track,
            `ai-${i}`,
            ['Aria', 'Luan', 'Nora', 'Drin', 'Bora', 'Ilir'][i],
            i,
            true
          )
        );
      }
      r.status = 'countdown';
      r.startsAt = clock() + 5000;
      r.elapsed = 0;
      cb({ ok: true });
      emit(r);
    });
    listen('input', (d) => {
      if (clock() - inputAt >= 1000) {
        inputAt = clock();
        inputCount = 0;
      }
      if (++inputCount > 75) return;
      const r = current(s),
        p = player(r, s);
      if (!p || !['countdown', 'racing'].includes(r.status)) return;
      const racer = r.racers.find((v) => v.id === p.id);
      if (racer) {
        racer.input = sanitizeInput(d);
        racer.lastInput = clock();
      }
    });
    listen('sync', (_, cb) => {
      const r = current(s);
      if (!r) return cb({ ok: false, error: 'Join a room first.' });
      cb({ ok: true, state: snapshot(r) });
    });
    listen('rematch', (_, cb) => {
      const r = current(s),
        p = player(r, s);
      if (!p || r.hostId !== p.id || r.status !== 'finished')
        return cb({
          ok: false,
          error: 'The host can prepare a rematch after the race.'
        });
      r.status = 'waiting';
      r.racers = [];
      r.elapsed = 0;
      r.startsAt = 0;
      r.finishedAt = 0;
      r.createdAt = clock();
      r.players.forEach((p) => {
        p.ready = false;
      });
      cb({ ok: true });
      emit(r);
    });
    listen('leave', (_, cb) => {
      leave(s);
      cb({ ok: true });
    });
    s.on('disconnect', () => {
      const r = current(s),
        p = player(r, s);
      memberships.delete(s.id);
      if (!p) return;
      p.connected = false;
      p.ready = false;
      p.disconnectedAt = clock();
      const racer = r.racers.find((v) => v.id === p.id);
      if (racer) {
        racer.disconnected = true;
        racer.input = neutralInput();
      }
      emit(r);
    });
  };
  io.on('connection', onConnection);
  function tick() {
    const now = clock();
    accumulator += Math.max(0, Math.min(0.2, (now - previous) / 1000));
    previous = now;
    while (accumulator >= STEP) {
      for (const r of rooms.values()) {
        if (r.status === 'countdown' && now >= r.startsAt) r.status = 'racing';
        if (r.status !== 'racing') continue;
        r.elapsed += STEP;
        for (const v of r.racers)
          if (!v.ai && now - v.lastInput > 750)
            v.input = { ...neutralInput(), brake: true };
        stepRace(r.racers, r.track, STEP, r.elapsed, 'club');
        const done = r.racers
          .filter((v) => !v.ai)
          .every(
            (v) =>
              v.finished ||
              (v.disconnected &&
                (!r.players.some((p) => p.id === v.id) ||
                  now - r.players.find((p) => p.id === v.id).disconnectedAt >
                    20000))
          );
        if (done || r.elapsed >= RACE_LIMIT) {
          r.status = 'finished';
          r.finishedAt = now;
          emit(r);
        }
      }
      accumulator -= STEP;
    }
    if (now - broadcastAt < 50) return;
    broadcastAt = now;
    for (const r of rooms.values()) {
      if (['waiting', 'finished'].includes(r.status)) {
        const count = r.players.length,
          oldHost = r.hostId;
        r.players = r.players.filter(
          (p) => p.connected || now - p.disconnectedAt < 20000
        );
        if (!r.players.some((p) => p.id === r.hostId && p.connected))
          r.hostId = r.players.find((p) => p.connected)?.id || '';
        if (count !== r.players.length || oldHost !== r.hostId) emit(r);
      }
      if (
        !r.players.length ||
        r.players.every(
          (p) => !p.connected && now - p.disconnectedAt > 60000
        ) ||
        now - (r.finishedAt || r.startsAt || r.createdAt) > 900000
      ) {
        removeRoom(r);
        continue;
      }
      if (r.status === 'racing' || r.status === 'countdown') emit(r);
    }
  }
  const timer = automatic ? setInterval(tick, 1000 / 60) : null;
  timer?.unref?.();
  return {
    rooms,
    tick,
    close() {
      if (timer) clearInterval(timer);
      io.off('connection', onConnection);
      for (const r of rooms.values()) removeRoom(r);
    }
  };
}
