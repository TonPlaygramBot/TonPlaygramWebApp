import { sampleCircuitDistance, cornerSpeedLimit } from './circuitMetrics.mjs';

export const RACE_ITEM_RULES = Object.freeze({ pickupRadius: 2.25, pickupCooldown: 12,
  shieldDuration: 4, boostDuration: 1.8, rocketSpeed: 52, rocketLife: 1.7,
  rocketRadius: 1.1, hitSpeedFactor: .68, hitImmunity: 1.5, maxPickups: 24 });
const active = r => !r.finished && !r.retired && !r.disconnected;
const layouts = new WeakMap();
/** Geometry only is cached; race state lives entirely on racers and survives snapshots.
 * Supplies are personal, so side-by-side racers are never favored by array order. */
export function raceItemPickups(track) {
  if (layouts.has(track)) return layouts.get(track);
  const count = Math.min(RACE_ITEM_RULES.maxPickups, Math.max(6, Math.ceil(track.length / 125)));
  const kinds = ['rocket', 'shield', 'boost'];
  const result = Array.from({ length: count }, (_, id) => {
    const p = sampleCircuitDistance(track, track.length * (id + .42) / count);
    const kind=kinds[id%kinds.length];
    if(kind==='rocket')return {...p,id,kind};
    // Keep the fastest line separate from optional boost and shield supplies.
    // Only offer that choice well inside a wide, straight racing ribbon.
    const nearby=[-16,0,16].map(offset=>sampleCircuitDistance(track,p.distance+offset));
    const width=Math.min(...nearby.flatMap(q=>[
      track.points[q.index].width??track.width,
      track.points[(q.index+1)%track.points.length].width??track.width
    ]));
    const straight=nearby.every(q=>Math.cos(q.yaw-p.yaw)>.985);
    if(!(width>=9.2)||!straight)return {...p,id,kind};
    const lateral=(id%2?1:-1)*Math.min(3.15,width*.28);
    return {...p,x:p.x+Math.cos(p.yaw)*lateral,z:p.z-Math.sin(p.yaw)*lateral,id,kind};
  });
  layouts.set(track, result);
  return result;
}
export function initializeRaceItems(r) {
  r.raceItem ??= null;
  r.itemCooldowns ??= {};
  r.itemShield ??= 0;
  r.itemRocket ??= null;
  r.itemUseHeld ??= false;
  r.itemEvent ??= 0;
  r.itemEventKind ??= '';
  r.itemHitImmunity ??= 0;
}
const event = (r, kind) => { r.itemEvent = (r.itemEvent || 0) + 1; r.itemEventKind = kind; };
function distanceToSegment(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
  return { distance: Math.hypot(x - ax - dx * t, z - az - dz * t), t };
}
// Stay within the nearby road corridor instead of shooting across city blocks.
function rocketOnRoad(p, track) {
  const count = track.points.length;
  let nearest = null;
  for (let offset = -8; offset <= 8; offset++) {
    const index = ((p.index || 0) + offset + count) % count;
    const a = track.points[index], b = track.points[(index + 1) % count];
    const d = distanceToSegment(p.x, p.z, a.x, a.z, b.x, b.z).distance;
    if (!nearest || d < nearest.distance) nearest = { distance: d, index,
      width: Math.min(a.width ?? track.width, b.width ?? track.width) };
  }
  if (nearest.distance > Math.max(1, nearest.width * .5)) return false;
  p.index = nearest.index;
  return true;
}
function targetAhead(r, racers, distance = 45) {
  const s = Math.sin(r.yaw), c = Math.cos(r.yaw);
  return racers.some(o => {
    if (o === r || !active(o)) return false;
    const dx = o.x - r.x, dz = o.z - r.z, ahead = dx * s + dz * c;
    return ahead > 4 && ahead < distance && Math.abs(dx * c - dz * s) < 1.8 &&
      Math.abs((o.groundY || 0) - (r.groundY || 0)) < 2.5;
  });
}
/** AI has exactly the same supplies and timers. It never invents ammunition,
 * rubber-bands, changes the player, or fires through a corner at a locked target. */
export function shouldAIUseRaceItem(r, racers, track, time) {
  if (!r.raceItem || !active(r) || r.itemUseHeld || time < 2) return false;
  if (r.raceItem === 'rocket') return !r.airborne && targetAhead(r, racers);
  if (r.raceItem === 'shield') return racers.some(o => {
    const p = o.itemRocket;
    if (o === r || !p) return false;
    const dx = r.x - p.x, dz = r.z - p.z;
    return Math.hypot(dx, dz) < 32 && dx * p.vx + dz * p.vz > 0;
  });
  const p = track.points[r.index];
  return r.raceItem === 'boost' && !r.airborne && r.speed > 10 &&
    !r.braking && Math.abs(r.steering || 0) < .18 &&
    cornerSpeedLimit(track, { ...p, index: r.index }, 45) > 31;
}
/** Called once per fixed physics step on the authority. previousPositions is
 * captured before physics, providing swept pickups even on slower devices. */
export function stepRaceItems(racers, track, dt, time, previousPositions = []) {
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(time)) return;
  dt = Math.min(dt, .05);
  const pickups = raceItemPickups(track);
  for (let i = 0; i < racers.length; i++) {
    const r = racers[i];
    initializeRaceItems(r);
    r.itemShield = Math.max(0, r.itemShield - dt);
    r.itemHitImmunity = Math.max(0, r.itemHitImmunity - dt);
    const pressed = r.input?.useItem === true;
    const rising = pressed && !r.itemUseHeld;
    r.itemUseHeld = pressed;
    if (!active(r)) { r.itemRocket = null; r.itemShield = 0; continue; }
    if (!r.raceItem && time > 1 && !r.airborne && r.speed > 1) {
      const old = previousPositions[i] || r;
      for (const p of pickups) {
        if (time < (r.itemCooldowns[p.id] || 0)) continue;
        if (distanceToSegment(p.x, p.z, old.x, old.z, r.x, r.z).distance > RACE_ITEM_RULES.pickupRadius) continue;
        r.raceItem = p.kind;
        r.itemCooldowns[p.id] = time + RACE_ITEM_RULES.pickupCooldown;
        event(r, 'pickup');
        break;
      }
    }
    if (!rising || !r.raceItem) continue;
    const kind = r.raceItem;
    // Do not consume a second rocket while one is still flying.
    if (kind === 'rocket' && (r.itemRocket || r.airborne)) continue;
    r.raceItem = null;
    event(r, kind);
    if (kind === 'shield') r.itemShield = RACE_ITEM_RULES.shieldDuration;
    else if (kind === 'boost') {
      r.turbo = Math.max(r.turbo || 0, RACE_ITEM_RULES.boostDuration);
      r.boost = Math.min(100, (r.boost || 0) + 20);
      r.boostEvent = (r.boostEvent || 0) + 1;
    } else {
      const s = Math.sin(r.yaw), c = Math.cos(r.yaw);
      const offset = (r.bodyLength || 2) * .5 + .5;
      r.itemRocket = { id: r.itemEvent, x: r.x + s * offset, z: r.z + c * offset,
        y: (r.groundY || 0) + .65, index: r.index, vx: s * RACE_ITEM_RULES.rocketSpeed,
        vz: c * RACE_ITEM_RULES.rocketSpeed, life: RACE_ITEM_RULES.rocketLife };
    }
  }
  // Collect hit intents before applying them: simultaneous rockets have no
  // dependence on racer iteration order, and shield activation always wins ties.
  const hits = [];
  for (const owner of racers) {
    const p = owner.itemRocket;
    if (!p || !active(owner)) continue;
    const nx = p.x + p.vx * dt, nz = p.z + p.vz * dt;
    const roadProbe = { ...p, x: nx, z: nz };
    if (!rocketOnRoad(roadProbe, track)) { owner.itemRocket = null; continue; }
    p.index = roadProbe.index;
    let hit = null;
    for (const target of racers) {
      if (target === owner || !active(target) || target.airborne ||
          Math.abs(p.y - ((target.groundY || 0) + .65)) > 2.5) continue;
      const test = distanceToSegment(target.x, target.z, p.x, p.z, nx, nz);
      if (test.distance <= RACE_ITEM_RULES.rocketRadius + (target.bodyWidth || 1.27) * .35 &&
          (!hit || test.t < hit.t || (test.t === hit.t && String(target.id) < String(hit.target.id)))) hit = { target, t: test.t };
    }
    if (hit) { hits.push({ owner, target: hit.target }); owner.itemRocket = null; }
    else { p.x = nx; p.z = nz; p.life -= dt; if (p.life <= 0) owner.itemRocket = null; }
  }
  const impacted = new Set();
  for (const { owner, target } of hits) {
    event(owner, 'hit');
    if (target.itemShield > 0) { event(target, 'blocked'); continue; }
    if (target.itemHitImmunity > 0 || impacted.has(target)) continue;
    impacted.add(target);
    target.speed *= RACE_ITEM_RULES.hitSpeedFactor;
    target.hitFlash = Math.max(target.hitFlash || 0, .3);
    target.itemHitImmunity = RACE_ITEM_RULES.hitImmunity;
    event(target, 'hit');
  }
}
