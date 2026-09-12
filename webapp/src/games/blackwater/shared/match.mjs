import { OBSTACLES, SPAWNS } from './layout.mjs';
import {
  WEAPONS,
  clamp,
  collides,
  moveCircle,
  rayBox,
  createRng,
  reloadAmmo
} from './physics.mjs';
export const STEP = 1 / 60,
  MATCH_LIMIT = 180,
  KILL_LIMIT = 5;
export const idleInput = () => ({
  seq: 0,
  rx: 0,
  forward: 0,
  yaw: 0,
  pitch: 0,
  fire: false,
  aim: false,
  crouch: false,
  sprint: false,
  reload: false,
  heal: false
});
export function sanitizeInput(value) {
  if (
    !value ||
    !Number.isSafeInteger(value.seq) ||
    value.seq < 0 ||
    !['rx', 'forward', 'yaw', 'pitch'].every((k) => Number.isFinite(value[k]))
  )
    return null;
  let rx = clamp(value.rx, -1, 1),
    forward = clamp(value.forward, -1, 1),
    length = Math.hypot(rx, forward);
  if (length > 1) {
    rx /= length;
    forward /= length;
  }
  return {
    seq: value.seq,
    rx,
    forward,
    yaw: ((value.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
    pitch: clamp(value.pitch, -1.22, 1.22),
    ...Object.fromEntries(
      ['fire', 'aim', 'crouch', 'sprint', 'reload', 'heal'].map((k) => [
        k,
        value[k] === true
      ])
    )
  };
}
export function spawnPoint(index, players = []) {
  const order = SPAWNS.map((s, i) => ({
    s,
    i,
    score: players
      .filter((p) => p.hp > 0)
      .reduce((d, p) => Math.min(d, Math.hypot(p.x - s.x, p.z - s.z)), 999)
  })).sort(
    (a, b) =>
      b.score - a.score || ((a.i - index + 8) % 8) - ((b.i - index + 8) % 8)
  );
  for (const { s } of order)
    for (let r = 0; r < 8; r++)
      for (let n = 0; n < 8; n++) {
        const p = {
          x: s.x + Math.sin((n * Math.PI) / 4) * r,
          z: s.z + Math.cos((n * Math.PI) / 4) * r
        };
        if (!collides(p.x, p.z, 0.45, OBSTACLES)) return p;
      }
  throw new Error('blackwater_no_safe_spawn');
}
export function createPlayer(id, name, index, players = []) {
  const p = spawnPoint(index, players);
  return {
    id,
    name,
    ...p,
    yaw: 0,
    pitch: 0,
    hp: 100,
    weapon: 'ar',
    ammo: 30,
    reserve: 150,
    kills: 0,
    deaths: 0,
    shots: 0,
    hits: 0,
    medkits: 1,
    reload: 0,
    cooldown: 0,
    protection: 2,
    respawn: 0,
    input: idleInput(),
    lastSeq: -1,
    lastInput: 0,
    connected: false,
    forfeited: false,
    crouch: false,
    shotSerial: 0
  };
}
export function makeMatch(players, options = {}) {
  const match = {
    rule: options.rule === 'last-stand' ? 'last-stand' : 'deathmatch',
    elapsed: 0,
    players: [],
    rng: createRng(19439),
    events: [],
    winnerAccountId: '',
    done: false,
    reason: ''
  };
  for (const [i, p] of players.entries())
    match.players.push(createPlayer(p.id, p.name, i, match.players));
  return match;
}
function sphere(origin, dir, center, r) {
  const x = center.x - origin.x,
    y = center.y - origin.y,
    z = center.z - origin.z,
    t = x * dir.x + y * dir.y + z * dir.z,
    d = x * x + y * y + z * z - t * t;
  return t < 0 || d > r * r ? Infinity : t - Math.sqrt(r * r - d);
}
export function stepMatch(match, dt = STEP) {
  if (match.done) return;
  match.elapsed += dt;
  match.events = [];
  for (const p of match.players) {
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.protection = Math.max(0, p.protection - dt);
    if (p.forfeited) continue;
    if (p.hp <= 0) {
      if (match.rule === 'last-stand') continue;
      p.respawn -= dt;
      if (p.respawn <= 0) {
        Object.assign(
          p,
          spawnPoint(
            p.deaths,
            match.players.filter((v) => v !== p)
          ),
          {
            hp: 100,
            ammo: WEAPONS[p.weapon].mag,
            reserve: 150,
            medkits: 1,
            protection: 2,
            reload: 0,
            cooldown: 0
          }
        );
      }
      continue;
    }
    const input = p.connected ? p.input : idleInput(),
      w = WEAPONS[p.weapon];
    p.yaw = input.yaw;
    p.pitch = input.pitch;
    p.crouch = input.crouch;
    if (input.heal && p.medkits && p.hp < 100) {
      p.hp = Math.min(100, p.hp + 60);
      p.medkits--;
    }
    if (p.reload > 0) {
      p.reload = Math.max(0, p.reload - dt);
      if (!p.reload) Object.assign(p, reloadAmmo(p.ammo, p.reserve, w.mag));
    }
    if (input.reload && !p.reload && p.ammo < w.mag && p.reserve > 0)
      p.reload = w.reload;
    const sprint = input.sprint && !input.aim && !input.fire,
      speed = input.crouch ? 2.2 : input.aim ? 3.3 : sprint ? 8.5 : 5.2;
    moveCircle(
      p,
      (Math.cos(p.yaw) * input.rx - Math.sin(p.yaw) * input.forward) *
        speed *
        dt,
      (-Math.sin(p.yaw) * input.rx - Math.cos(p.yaw) * input.forward) *
        speed *
        dt,
      0.34,
      OBSTACLES
    );
    if (!input.fire || p.reload > 0 || p.cooldown > 0) continue;
    if (!p.ammo) {
      if (p.reserve) p.reload = w.reload;
      continue;
    }
    p.ammo--;
    p.shots++;
    p.shotSerial++;
    p.cooldown = w.interval;
    p.protection = 0;
    const origin = { x: p.x, y: p.crouch ? 0.86 : 1.68, z: p.z },
      spread = w.spread * (input.aim ? 0.25 : 1);
    const dir = {
      x: -Math.sin(p.yaw) * Math.cos(p.pitch) + (match.rng() - 0.5) * spread,
      y: Math.sin(p.pitch) + (match.rng() - 0.5) * spread,
      z: -Math.cos(p.yaw) * Math.cos(p.pitch)
    };
    const length = Math.hypot(dir.x, dir.y, dir.z);
    for (const k of ['x', 'y', 'z']) dir[k] /= length;
    let distance = 80,
      victim = null,
      head = false;
    for (const o of OBSTACLES)
      distance = Math.min(distance, rayBox(origin, dir, o));
    for (const other of match.players) {
      if (other === p || other.hp <= 0 || other.forfeited) continue;
      const scale = other.crouch ? 0.52 : 1;
      const h = sphere(
          origin,
          dir,
          { x: other.x, y: 1.79 * scale, z: other.z },
          0.24
        ),
        b = sphere(
          origin,
          dir,
          { x: other.x, y: 1.16 * scale, z: other.z },
          0.45
        ),
        l = sphere(
          origin,
          dir,
          { x: other.x, y: 0.56 * scale, z: other.z },
          0.3
        ),
        d = Math.min(h, b, l);
      if (d < distance) {
        distance = d;
        victim = other;
        head = h <= Math.min(b, l);
      }
    }
    if (victim && victim.protection <= 0) {
      p.hits++;
      victim.hp = Math.max(0, victim.hp - w.damage * (head ? 2.75 : 1));
      if (!victim.hp) {
        p.kills++;
        victim.deaths++;
        victim.respawn = match.rule === 'last-stand' ? 0 : 3;
        victim.input = idleInput();
        match.events.push({ type: 'kill', by: p.id, target: victim.id, head });
      }
    }
  }
  if(match.rule==='last-stand') {
    const alive=match.players.filter(p=>p.hp>0&&!p.forfeited);
    if(alive.length<=1||match.elapsed>=MATCH_LIMIT){
      match.done=true;match.winnerAccountId=alive.length===1?alive[0].id:'';
      match.reason=match.winnerAccountId?'match_complete':'tie_refund';
    }
    return;
  }
  if (
    match.players.some((p) => p.kills >= KILL_LIMIT) ||
    match.elapsed >= MATCH_LIMIT
  ) {
    const ranked = match.players
      .filter((p) => !p.forfeited)
      .sort((a, b) => b.kills - a.kills);
    match.done = true;
    const top = ranked[0];
    match.winnerAccountId =
      top && top.kills > 0 && (!ranked[1] || top.kills > ranked[1].kills)
        ? top.id
        : '';
    match.reason = match.winnerAccountId ? 'match_complete' : 'tie_refund';
  }
}
export function publicMatch(match) {
  return {
    rule: match.rule,
    alive: match.players.filter(p=>p.hp>0&&!p.forfeited).length,
    elapsed: match.elapsed,
    limit: MATCH_LIMIT,
    killLimit: KILL_LIMIT,
    players: match.players.map(
      ({
        input,
        cooldown,
        lastInput,
        lastSeq,
        socketId,
        disconnectedAt,
        ...p
      }) => p
    ),
    events: match.events,
    winnerAccountId: match.winnerAccountId,
    reason: match.reason
  };
}
