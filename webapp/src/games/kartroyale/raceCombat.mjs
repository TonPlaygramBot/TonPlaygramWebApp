import { WEAPONS } from './suppliedWeaponCatalog.mjs';
import { damageRacer } from './collisions.mjs';
const weaponById = new Map(WEAPONS.map((w) => [w.id, w]));
const states = new WeakMap();
const active = (r) =>
  !r.retired && !r.finished && !r.disconnected && !(r.respawn > 0);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const MAX_PROJECTILES = 64;
export function validWeaponId(id) {
  return typeof id === 'string' && weaponById.has(id) ? id : '';
}
export function selectedWeapon(r) {
  const item = r.inventory?.find((w) => w.id === r.weaponId && w.ammo > 0);
  return item ? { ...weaponById.get(item.id), ammo: item.ammo } : null;
}
export function syncWeapon(r) {
  if (!r.inventory?.some((w) => w.id === r.weaponId && w.ammo > 0))
    r.weaponId = r.inventory?.find((w) => w.ammo > 0)?.id || '';
  r.ammunition = r.inventory?.find((w) => w.id === r.weaponId)?.ammo || 0;
}
export function equipCombat(r, ammo) {
  r.inventory = [{ id: 'pistol', ammo: Math.max(0, Math.floor(ammo)) }];
  r.weaponId = 'pistol';
  r.respawn = 0;
  r.shotId = 0;
  r.pickupId = 0;
  r.fireCooldown = 0;
  syncWeapon(r);
}
export function collectWeapon(r, id) {
  const w = weaponById.get(id);
  if (!w) return false;
  const current = r.inventory.find((item) => item.id === id);
  if (current) current.ammo = Math.min(999, current.ammo + w.ammo);
  else r.inventory.push({ id, ammo: w.ammo });
  syncWeapon(r);
  r.pickupId++;
  return true;
}
export function pointOnRace(track, t, lane = 0) {
  const distance = (((t % 1) + 1) % 1) * track.length;
  let i = track.points.length - 1;
  for (let j = 0; j < track.points.length - 1; j++)
    if (track.points[j + 1].distance > distance) {
      i = j;
      break;
    }
  const a = track.points[i],
    b = track.points[(i + 1) % track.points.length],
    length = Math.hypot(b.x - a.x, b.z - a.z);
  const u = clamp((distance - a.distance) / (length || 1), 0, 1),
    yaw = Math.atan2(b.x - a.x, b.z - a.z);
  return {
    x: a.x + (b.x - a.x) * u - Math.cos(yaw) * lane,
    z: a.z + (b.z - a.z) * u + Math.sin(yaw) * lane,
    yaw
  };
}
export function createCombatState(track) {
  return {
    nextShot: 1,
    shots: [],
    explosions: [],
    pickups: [
      ...WEAPONS.map((w, i) => ({
        id: i,
        weaponId: w.id,
        ...pointOnRace(
          track,
          (i + 1) / (WEAPONS.length + 3),
          ((i % 3) - 1) * 1.55
        ),
        cooldown: 0,
        special: false
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        id: WEAPONS.length + i,
        weaponId: '',
        ...pointOnRace(track, 0.08 + i * 0.15, i % 2 ? 2.1 : -2.1),
        cooldown: 0,
        special: true
      }))
    ]
  };
}
export function raceCombat(racers, track) {
  let state = states.get(racers);
  if (!state) {
    state = createCombatState(track);
    states.set(racers, state);
  }
  return state;
}
export function combatSnapshot(racers, track) {
  const s = raceCombat(racers, track);
  return {
    pickups: s.pickups.map((p) => ({ ...p })),
    shots: s.shots.map((p) => ({ ...p })),
    explosions: s.explosions.map((p) => ({ ...p }))
  };
}
export function projectileStyle(id) {
  if (/awp|mosin/i.test(id))
    return { color: 0x8c62ee, size: 0.16, life: 4.5, homing: 0.45 };
  if (/shotgun|sawed|pump|fps|longshot/i.test(id))
    return { color: 0xffd166, size: 0.14, life: 3.2, homing: 0.28 };
  if (/pistol|revolver|smith|sig|silver/i.test(id))
    return { color: 0x9ad1ff, size: 0.11, life: 3.6, homing: 0.36 };
  return { color: 0xff7a1f, size: 0.12, life: 4, homing: 0.4 };
}
export function nearestWeaponTarget(owner, racers, range = 76) {
  let target = null,
    best = Infinity;
  for (const r of racers) {
    if (r === owner || !active(r)) continue;
    const dx = r.x - owner.x,
      dz = r.z - owner.z,
      d = Math.hypot(dx, dz),
      dot = (dx * Math.sin(owner.yaw) + dz * Math.cos(owner.yaw)) / (d || 1);
    if (d > range || dot < -0.25) continue;
    const score = d * (1.35 - dot);
    if (score < best) {
      best = score;
      target = r;
    }
  }
  return target;
}
export function fireRaceWeapon(state, owner, racers) {
  const weapon = selectedWeapon(owner),
    target = nearestWeaponTarget(owner, racers);
  if (
    !active(owner) ||
    !weapon ||
    owner.fireCooldown > 0 ||
    !target ||
    state.shots.length >= MAX_PROJECTILES
  )
    return false;
  owner.inventory.find((w) => w.id === weapon.id).ammo--;
  owner.fireCooldown = weapon.cooldown;
  owner.shotId++;
  const style = projectileStyle(weapon.id),
    dx = Math.sin(owner.yaw),
    dz = Math.cos(owner.yaw);
  state.shots.push({
    id: state.nextShot++,
    weaponId: weapon.id,
    ownerId: owner.id,
    targetId: target.id,
    x: owner.x + dx * 1.55,
    y: 0.65,
    z: owner.z + dz * 1.55,
    vx: dx * weapon.speed,
    vy: 0,
    vz: dz * weapon.speed,
    life: style.life
  });
  syncWeapon(owner);
  return true;
}
// Swept relative motion prevents fast projectiles or crossing karts tunnelling.
export function shotContact(a, b, r, before = r) {
  const x = a.x - before.x,
    z = a.z - before.z,
    dx = b.x - r.x - x,
    dz = b.z - r.z - z;
  const t = clamp(-(x * dx + z * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(x + dx * t, z + dz * t) < 1.45 ? t : null;
}
export function applyWeaponHit(target, weapon) {
  // Preserve supplied passive shield reduction. The existing SHIELD button also
  // retains its active protection through the shared collision/damage function.
  const shieldHit = Math.min(target.shield || 0, weapon.power * 7);
  target.shield = Math.max(0, (target.shield || 0) - shieldHit);
  damageRacer(target, Math.max(0, weapon.power * 18 - shieldHit * 0.5));
  target.speed *= 0.4;
  target.hitFlash = 0.45;
  if (target.health <= 0) startCombatRepair(target);
}
export function startCombatRepair(target) {
  target.retired = false;
  target.respawn = target.ai ? 3 : 2.2;
  target.speed = 0;
  target.drifting = false;
  target.shieldActive = false;
}
export function stepCombat(
  state,
  racers,
  track,
  dt,
  time,
  nearestPoint,
  previous = new Map()
) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 0.05);
  state.explosions = state.explosions.filter((e) => (e.life -= dt) > 0);
  for (const p of state.pickups) {
    if (p.cooldown > 0) {
      p.cooldown = Math.max(0, p.cooldown - dt);
      continue;
    }
    for (const r of racers) {
      if (!active(r)) continue;
      const before = previous.get(r.id) || r,
        dx = r.x - before.x,
        dz = r.z - before.z;
      const u = clamp(
        ((p.x - before.x) * dx + (p.z - before.z) * dz) /
          (dx * dx + dz * dz || 1),
        0,
        1
      );
      if (Math.hypot(before.x + dx * u - p.x, before.z + dz * u - p.z) > 1.7)
        continue;
      if (p.special) {
        r.boost = Math.min(100, r.boost + 45);
        r.health = Math.min(100, r.health + 20);
        r.pickupId++;
      } else collectWeapon(r, p.weaponId);
      p.cooldown = p.special ? 8 : 10;
      break;
    }
  }
  for (const r of racers) {
    if (!active(r)) continue;
    const requested = validWeaponId(r.input?.weaponId);
    if (requested && r.inventory.some((w) => w.id === requested && w.ammo > 0))
      r.weaponId = requested;
    syncWeapon(r);
    const auto =
      r.ai &&
      Math.floor((time + r.slot * 0.41) / 2.6) !==
        Math.floor((time - dt + r.slot * 0.41) / 2.6);
    if (r.input?.fire || auto) fireRaceWeapon(state, r, racers);
  }
  for (let i = state.shots.length - 1; i >= 0; i--) {
    const s = state.shots[i],
      weapon = weaponById.get(s.weaponId),
      style = projectileStyle(s.weaponId),
      before = { x: s.x, z: s.z };
    s.life -= dt;
    if (s.life <= 0) {
      state.shots.splice(i, 1);
      continue;
    }
    const target = racers.find((r) => r.id === s.targetId && active(r));
    if (target) {
      const dx = target.x - s.x,
        dy = 0.55 - s.y,
        dz = target.z - s.z,
        n = Math.hypot(dx, dy, dz) || 1,
        k = 1 - Math.exp(-style.homing * 6 * dt);
      s.vx += ((dx / n) * weapon.speed - s.vx) * k;
      s.vy += ((dy / n) * weapon.speed - s.vy) * k;
      s.vz += ((dz / n) * weapon.speed - s.vz) * k;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    let hit = null,
      first = Infinity;
    for (const r of racers) {
      if (r.id === s.ownerId || !active(r)) continue;
      const t = shotContact(before, s, r, previous.get(r.id));
      if (t !== null && t < first) {
        first = t;
        hit = r;
      }
    }
    if (hit) {
      applyWeaponHit(hit, weapon);
      const owner = racers.find((r) => r.id === s.ownerId);
      if (owner) owner.missileHits++;
      state.explosions.push({
        id: s.id,
        x: before.x + (s.x - before.x) * first,
        y: s.y,
        z: before.z + (s.z - before.z) * first,
        life: 0.7
      });
      state.shots.splice(i, 1);
    } else if (nearestPoint(track, s.x, s.z).distance > track.width / 2 + 0.5)
      state.shots.splice(i, 1);
  }
}
