import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  STEP,
  makeTrack,
  createRacer,
  stepRace,
  standings
} from '../../webapp/src/games/kartroyale/simulation.mjs';
// Zero-stake races use the existing authenticated Socket.IO connection.
// Inputs are untrusted. Physics, lap gates, race clock and results are server owned.
export function attachKartRoyale(io, { clock = Date.now } = {}) {
  const rooms = new Map(),
    memberships = new Map();
  let previous = clock(),
    accumulator = 0,
    snapshots = 0;
  const snapshot = (r) => ({
    code: r.code,
    hostId: r.hostId,
    trackId: r.track.id,
    status: r.status,
    public: r.public,
    serverNow: clock(),
    players: r.players.map(({ token, socketId, ...p }) => p),
    startsAt: r.startsAt,
    elapsed: r.elapsed,
    racers: r.racers,
    results: r.status === 'finished' ? standings(r.racers) : []
  });
  const emit = (r) => io.to(`kart:${r.code}`).emit('kart:state', snapshot(r));
  const current = (s) => rooms.get(memberships.get(s.id));
  const player = (r, s) => r?.players.find((p) => p.socketId === s.id);
  const leave = (s) => {
    const r = current(s);
    if (!r) return;
    const p = player(r, s);
    memberships.delete(s.id);
    s.leave(`kart:${r.code}`);
    if (p) {
      r.players = r.players.filter((v) => v.id !== p.id);
      const racer = r.racers.find((v) => v.id === p.id);
      if (racer) racer.disconnected = true;
    }
    if (!r.players.length) {
      rooms.delete(r.code);
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
    s.join(`kart:${r.code}`);
    cb({
      ok: true,
      code: r.code,
      playerId: p.id,
      token: p.token,
      state: snapshot(r)
    });
    emit(r);
  };
  const add = (r, s, name, cb) => {
    const p = {
      id: randomBytes(8).toString('hex'),
      token: randomBytes(24).toString('hex'),
      name: String(name || 'Racer')
        .replace(/[<>\x00-\x1f]/g, '')
        .slice(0, 18),
      ready: false,
      connected: true,
      disconnectedAt: 0
    };
    r.players.push(p);
    if (!r.hostId) r.hostId = p.id;
    bind(r, s, p, cb);
  };
  const onConnection = (s) => {
    let lobbyAt = 0,
      inputAt = 0,
      inputs = 0;
    const eventTimes = new Map();
    const limited = (cb) => {
      if (clock() - lobbyAt < 600) {
        cb({ ok: false, error: 'Please wait a moment and retry.' });
        return true;
      }
      lobbyAt = clock();
      return false;
    };
    const listen = (event, fn) =>
      s.on(`kart:${event}`, (payload, ack) => {
        const cb = typeof ack === 'function' ? ack : () => {};
        if (event !== 'input') {
          if (clock() - (eventTimes.get(event) || 0) < 60)
            return cb({ ok: false, error: 'Please try again in a moment.' });
          eventTimes.set(event, clock());
        }
        fn(
          payload && typeof payload === 'object' && !Array.isArray(payload)
            ? payload
            : {},
          cb
        );
      });
    const create = (d, cb) => {
      if (limited(cb)) return;
      if (rooms.size >= 128)
        return cb({
          ok: false,
          error: 'The lobby is busy. Try again shortly.'
        });
      leave(s);
      let code;
      do {
        code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
      } while (rooms.has(code));
      const r = {
        code,
        hostId: '',
        public: d.public === true,
        track: makeTrack(d.trackId),
        players: [],
        racers: [],
        status: 'waiting',
        startsAt: 0,
        elapsed: 0,
        createdAt: clock()
      };
      rooms.set(code, r);
      add(r, s, d.name, cb);
    };
    listen('create', create);
    listen('quick', (d, cb) => {
      const r = [...rooms.values()].find(
        (r) =>
          r.public &&
          r.status === 'waiting' &&
          r.players.length < 6 &&
          r.players.every((p) => p.connected) &&
          current(s) !== r
      );
      if (!r) return create({ ...d, public: true }, cb);
      if (limited(cb)) return;
      leave(s);
      add(r, s, d.name, cb);
    });
    listen('join', (d, cb) => {
      if (limited(cb)) return;
      const r = rooms.get(String(d.code || '').toUpperCase());
      if (!r)
        return cb({
          ok: false,
          error: 'Room not found. Check the six-character code.'
        });
      if (r.status !== 'waiting')
        return cb({ ok: false, error: 'That race has already started.' });
      if (r.players.length >= 6)
        return cb({ ok: false, error: 'This room is full.' });
      if (current(s) === r)
        return cb({ ok: false, error: 'You are already in this room.' });
      leave(s);
      add(r, s, d.name, cb);
    });
    listen('resume', (d, cb) => {
      if (limited(cb)) return;
      const r = rooms.get(String(d.code || '').toUpperCase()),
        p = r?.players.find((p) => p.id === d.playerId),
        token = String(d.token || '');
      if (
        !p ||
        !/^[a-f0-9]{48}$/.test(token) ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(p.token))
      )
        return cb({
          ok: false,
          error: 'Your race session expired. Join a new room.'
        });
      if (p.socketId !== s.id) {
        io.sockets.sockets.get(p.socketId)?.leave(`kart:${r.code}`);
        memberships.delete(p.socketId);
      }
      if (current(s) !== r) leave(s);
      const racer = r.racers.find((v) => v.id === p.id);
      if (racer && !racer.finished) racer.disconnected = false;
      bind(r, s, p, cb);
    });
    listen('ready', (d, cb) => {
      const r = current(s),
        p = player(r, s);
      if (!p || r.status !== 'waiting')
        return cb({ ok: false, error: 'Join a waiting room first.' });
      p.ready = d.ready === true;
      emit(r);
      cb({ ok: true });
    });
    listen('start', (_, cb) => {
      const r = current(s),
        p = player(r, s);
      if (!p || p.id !== r.hostId || r.status !== 'waiting')
        return cb({ ok: false, error: 'Only the host can start this race.' });
      if (
        r.players.length < 2 ||
        r.players.some((p) => !p.ready || !p.connected)
      )
        return cb({
          ok: false,
          error: 'At least two connected players must be ready.'
        });
      r.racers = r.players.map((p, i) => createRacer(r.track, p.id, p.name, i));
      while (r.racers.length < 6) {
        const i = r.racers.length;
        r.racers.push(
          createRacer(
            r.track,
            `ai-${i}`,
            ['Aero', 'Nova', 'Rift', 'Jett', 'Onyx', 'Flux'][i],
            i,
            true
          )
        );
      }
      r.status = 'countdown';
      r.startsAt = clock() + 3500;
      r.elapsed = 0;
      emit(r);
      cb({ ok: true });
    });
    listen('input', (d) => {
      if (clock() - inputAt > 1000) {
        inputAt = clock();
        inputs = 0;
      }
      if (++inputs > 80) return;
      const room = current(s),
        p = player(room, s);
      if (!p || !['racing', 'countdown'].includes(room.status)) return;
      const r = room.racers.find((r) => r.id === p.id);
      if (!r) return;
      r.input = {
        steer: Number.isFinite(d.steer)
          ? Math.max(-1, Math.min(1, d.steer))
          : 0,
        brake: d.brake === true,
        drift: d.drift === true,
        boost: d.boost === true
      };
      r.lastInput = clock();
    });
    listen('sync', (_, cb) => {
      const r = current(s);
      if (!r) return cb({ ok: false, error: 'You are no longer in a room.' });
      s.emit('kart:state', snapshot(r));
      cb({ ok: true });
    });
    listen('rematch', (_, cb) => {
      const r = current(s),
        p = player(r, s);
      if (!p || r.hostId !== p.id || r.status !== 'finished')
        return cb({
          ok: false,
          error: 'Wait for the host to set up the rematch.'
        });
      r.status = 'waiting';
      r.racers = [];
      r.elapsed = 0;
      r.players.forEach((p) => (p.ready = false));
      emit(r);
      cb({ ok: true });
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
      p.disconnectedAt = clock();
      p.ready = false;
      const racer = r.racers.find((v) => v.id === p.id);
      if (racer) {
        racer.disconnected = true;
        racer.input = { steer: 0, brake: true, drift: false, boost: false };
      }
      emit(r);
    });
  };
  io.on('connection', onConnection);
  const timer = setInterval(() => {
    const now = clock();
    accumulator += Math.min(0.2, (now - previous) / 1000);
    previous = now;
    while (accumulator >= STEP) {
      for (const room of rooms.values()) {
        if (room.status === 'countdown' && now >= room.startsAt)
          room.status = 'racing';
        if (room.status !== 'racing') continue;
        room.elapsed += STEP;
        for (const r of room.racers)
          if (!r.ai && now - r.lastInput > 900)
            r.input = { steer: 0, brake: true, drift: false, boost: false };
        stepRace(room.racers, room.track, STEP, room.elapsed, 'street');
        const allDone = room.racers
          .filter((r) => !r.ai)
          .every(
            (r) =>
              r.finished ||
              (r.disconnected &&
                (!room.players.some((p) => p.id === r.id) ||
                  now - room.players.find((p) => p.id === r.id).disconnectedAt >
                    15000))
          );
        if (allDone || room.elapsed > 240) {
          room.status = 'finished';
          emit(room);
        }
      }
      accumulator -= STEP;
    }
    if (++snapshots % 3 === 0)
      for (const r of rooms.values()) {
        if (['waiting', 'finished'].includes(r.status)) {
          const before = r.players.length;
          r.players = r.players.filter(
            (p) => p.connected || now - p.disconnectedAt <= 15000
          );
          if (!r.players.some((p) => p.id === r.hostId))
            r.hostId = r.players[0]?.id || '';
          if (before !== r.players.length) emit(r);
        }
        if (
          now - r.createdAt > 900000 ||
          r.players.every((p) => !p.connected && now - p.disconnectedAt > 60000)
        ) {
          io.to(`kart:${r.code}`).emit('kart:closed', {
            error: 'This room expired. Create or join another room.'
          });
          for (const p of r.players) {
            memberships.delete(p.socketId);
            io.sockets.sockets.get(p.socketId)?.leave(`kart:${r.code}`);
          }
          rooms.delete(r.code);
          continue;
        }
        if (['racing', 'countdown'].includes(r.status)) emit(r);
      }
  }, 1000 / 60);
  timer.unref?.();
  return {
    rooms,
    close() {
      clearInterval(timer);
      io.off('connection', onConnection);
      rooms.clear();
      memberships.clear();
    }
  };
}
