import { createHash, randomBytes } from 'node:crypto';
import { MISSIONS } from '../../webapp/src/games/tiranastreets/shared/engine.mjs';
import {
  makeRoom,
  applyRoom,
  advanceRoom,
  roomSnapshot,
  ROOM_TTL
} from '../../webapp/src/games/tiranastreets/shared/rooms.mjs';
import { createTiranaCareerStore } from './tiranaCareer.js';

/** Free city rooms use the app's registered account and authenticated socket. */
export function createTiranaStreets({
  now = Date.now,
  career = createTiranaCareerStore(),
  autoTick = true
} = {}) {
  const rooms = new Map(),
    memberships = new Map(),
    profiles = new Map(),
    accounts = new Map(),
    queues = new Map(),
    saving = new Map();
  const publicId = (id) =>
    createHash('sha256').update(String(id)).digest('hex').slice(0, 24);
  const serialize = (id, fn) => {
    const next = (queues.get(id) || Promise.resolve()).catch(() => {}).then(fn);
    queues.set(id, next);
    next
      .finally(() => {
        if (queues.get(id) === next) queues.delete(id);
      })
      .catch(() => {});
    return next;
  };
  async function save(room) {
    if (room.mode !== 'career' || !room.state) return;
    const player = Object.values(room.state.players)[0],
      accountId = player && accounts.get(player.id);
    if (!player?.finished || player.failed || !accountId) return;
    if (room.saved) return profiles.get(accountId);
    if (saving.has(room.id)) return saving.get(room.id);
    const promise = career
      .complete(accountId, room.state, player.id)
      .then((c) => {
        profiles.set(accountId, c);
        room.saved = true;
        return c;
      })
      .finally(() => saving.delete(room.id));
    saving.set(room.id, promise);
    return promise;
  }
  function tick() {
    const time = now();
    for (const room of rooms.values()) {
      advanceRoom(room, time);
      if (
        !room.saved &&
        room.phase === 'finished' &&
        room.mode === 'career' &&
        time - (room.saveAttempt || 0) > 3000
      ) {
        room.saveAttempt = time;
        void save(room).catch((e) =>
          console.error('Tirana career save:', e.message)
        );
      }
      if (time - room.createdAt > ROOM_TTL || room.phase === 'closed') {
        rooms.delete(room.id);
        for (const [id, code] of memberships)
          if (code === room.id) memberships.delete(id);
      }
    }
  }
  async function request(socket, payload = {}) {
    const accountId = String(socket.data?.playerId || ''),
      bound = socket.data?.auth?.accountId;
    if (
      !accountId ||
      String(payload.accountId || '') !== accountId ||
      (bound && String(bound) !== accountId)
    )
      throw Error('Sign in to the TPG account registered on this connection.');
    if (JSON.stringify(payload).length > 4096)
      throw Error('Request is too large.');
    const time = now();
    if (time - (socket.data.tiranaWindow || 0) > 1000) {
      socket.data.tiranaWindow = time;
      socket.data.tiranaCount = 0;
    }
    socket.data.tiranaCount = (socket.data.tiranaCount || 0) + 1;
    if (socket.data.tiranaCount > 24)
      throw Error('Controls are syncing. Please wait a moment.');
    return serialize(accountId, async () => {
      const id = publicId(accountId),
        member = { id, name: String(payload.name || 'Driver').slice(0, 18) },
        action = payload.action;
      accounts.set(id, accountId);
      if (!profiles.has(accountId))
        profiles.set(accountId, await career.load(accountId));
      let current = memberships.get(accountId);
      if (current && (!rooms.has(current) || !rooms.get(current).members[id])) {
        memberships.delete(accountId);
        current = null;
      }
      const c = profiles.get(accountId);
      if (action === 'profile')
        return { career: c, playerId: id, activeRoom: current || null };
      if (action === 'list')
        return {
          rooms: [...rooms.values()]
            .filter(
              (r) =>
                r.phase === 'waiting' &&
                r.mode !== 'career' &&
                Object.keys(r.members).length < 4
            )
            .slice(0, 12)
            .map((r) => ({
              id: r.id,
              mode: r.mode,
              missionId: r.missionId,
              players: Object.keys(r.members).length
            }))
        };
      if (action === 'create') {
        if (current)
          throw Error(
            'Resume or leave your current session before starting another.'
          );
        const index = MISSIONS.findIndex((m) => m.id === payload.missionId);
        if (index < 0) throw Error('Choose a mission.');
        if (payload.mode === 'career' && index > c.completed.length)
          throw Error('Complete the earlier chapter first.');
        if (rooms.size >= 300)
          throw Error('The city is busy. Please try again shortly.');
        let code;
        do {
          code = Array.from(
            randomBytes(6),
            (v) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v % 32]
          ).join('');
        } while (rooms.has(code));
        const room = makeRoom(
          code,
          member,
          {
            mode: payload.mode,
            missionId: payload.missionId,
            sport: c.completed.length >= 3
          },
          now()
        );
        rooms.set(code, room);
        memberships.set(accountId, code);
        return { room: roomSnapshot(room, id), career: c };
      }
      const code = String(payload.roomId || '').toUpperCase(),
        room = rooms.get(code);
      if (!room)
        throw Error(
          'This room expired. Return to the lobby and create a new run.'
        );
      if (action === 'join') {
        if (current && current !== code)
          throw Error(
            'Leave your current session before joining another crew.'
          );
      } else if (current !== code)
        throw Error('Join this city room before sending controls.');
      applyRoom(
        room,
        member,
        action,
        { ...payload, action: payload.interaction },
        now()
      );
      if (action === 'join') memberships.set(accountId, code);
      if (room.mode === 'career' && room.state?.players[id]?.finished)
        await save(room);
      if (action === 'leave') memberships.delete(accountId);
      return { room: roomSnapshot(room, id), career: profiles.get(accountId) };
    });
  }
  function attach(socket) {
    socket.on('tirana:request', async (payload, ack) => {
      if (typeof ack !== 'function') return;
      try {
        ack({ success: true, data: await request(socket, payload) });
      } catch (e) {
        ack({
          success: false,
          error: e.message || 'City service is unavailable.'
        });
      }
    });
  }
  const timer = autoTick ? setInterval(tick, 1000 / 30) : null;
  timer?.unref();
  return {
    attach,
    request,
    tick,
    rooms,
    close() {
      if (timer) clearInterval(timer);
    }
  };
}
