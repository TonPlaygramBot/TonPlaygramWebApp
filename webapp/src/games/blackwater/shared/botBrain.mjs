const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const point = p => ({x: p.x, z: p.z});
const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
const hash = value => {let h = 0; for (const c of String(value)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h;};
const coverCache = new WeakMap(), maneuverCache = new WeakMap();

export function createBrain(id) {
  return {id, target: null, lastSeen: null, seenAt: -100, acquiredAt: 0,
    ammo: 12, reserve: 72, reload: 0, medkit: true, healTime: 0, heardAt: -100,
    suppression: 0, previousHp: null, previousAmmo: 12, burstShots: 0, burstUntil: 0};
}
const slot = (center, id, r) => {
  const a = (hash(id) * 2.399963229728653) % (Math.PI * 2);
  return {x: center.x + Math.sin(a) * r, z: center.z + Math.cos(a) * r};
};

function firingLaneBlocked(self, target, allies) {
  const dx = target.x - self.x, dz = target.z - self.z, length2 = dx * dx + dz * dz;
  if (length2 < .01) return false;
  return allies.some(a => {
    if (a.id === self.id || a.id === target.id || a.hp <= 0 || a.health <= 0) return false;
    const ax = a.x - self.x, az = a.z - self.z, t = (ax * dx + az * dz) / length2;
    return t > .02 && t < .98 && (ax * dz - az * dx) ** 2 < .65 ** 2 * length2;
  });
}
function occupied(goal, self, allies, spacing = 1.7) {
  return allies.some(a => a.id !== self.id && a.hp !== 0 && a.health !== 0 && distance(a, goal) < spacing);
}

// Cover search is demand-driven and bounded: pathfinding runs for at most four
// nearby candidates per half-second, never once per obstacle per render frame.
function selectCover(brain, self, threat, now, context) {
  const allies = context.allies || [], cached = coverCache.get(brain);
  const usable = p => finitePoint(p) && distance(self, p) < 24 && !occupied(p, self, allies, 1.2)
    && (!threat || !context.clear(p, threat));
  if (cached && now >= cached.at && now < cached.until && (!cached.goal || usable(cached.goal))) return cached.goal;
  const candidates = (context.covers || []).filter(usable)
    .sort((a, b) => distance(self, a) - distance(self, b));
  let goal = null;
  // Continue an unsuccessful search on the next decision instead of starving a
  // reachable fifth candidate forever. Keep successful cover until invalidated.
  const start = cached?.goal ? Math.max(0, candidates.findIndex(p => distance(p, cached.goal) < .1)) : (cached?.nextIndex || 0) % Math.max(1, candidates.length);
  let checked = 0;
  while (checked < Math.min(4, candidates.length)) {
    const candidate = candidates[(start + checked++) % candidates.length];
    if (!context.canReach || context.canReach(self, candidate)) {goal = point(candidate); break;}
  }
  coverCache.set(brain, {at: now, until: now + .5 + hash(self.id) % 5 * .035,
    nextIndex: (start + checked) % Math.max(1, candidates.length), goal});
  return goal;
}

/** Only visible opponents, timestamped observations and sound events enter the
 * brain. A facing direction is optional for compatibility with server callers;
 * the rendered Battlefield supplies yaw and gains peripheral vision limits. */
export function thinkBot(brain, self, opponents, now, dt, clear, objective, context = {}) {
  dt = Number.isFinite(dt) ? Math.max(0, Math.min(.25, dt)) : 0;
  brain.reserve ??= 72; brain.healTime ??= 0; brain.heardAt ??= -100;
  brain.suppression = Math.max(0, (brain.suppression || 0) - dt * .4);
  if (Number.isFinite(brain.previousHp) && self.hp < brain.previousHp) {
    brain.suppression = Math.min(1, brain.suppression + (brain.previousHp - self.hp) / 35 + .2);
    brain.healTime = 0;
  }
  brain.previousHp = self.hp;
  brain.burstShots = (brain.burstShots || 0) + Math.max(0, (brain.previousAmmo ?? brain.ammo) - brain.ammo);
  if (brain.burstShots >= 3) {brain.burstUntil = now + .45 + hash(self.id) % 4 * .08; brain.burstShots = 0;}
  if (brain.reload > 0) {
    brain.reload = Math.max(0, brain.reload - dt);
    if (!brain.reload) {const add = Math.min(12 - brain.ammo, brain.reserve); brain.ammo += add; brain.reserve -= add; brain.burstShots = 0;}
  }
  brain.previousAmmo = brain.ammo;
  const allies = context.allies || [];
  let target = null, nearest = Infinity;
  for (const p of opponents) {
    if (p.hp <= 0 || !finitePoint(p)) continue;
    const d = distance(self, p);
    if (d >= 65) continue;
    // Nearby footsteps and a recent hit permit a fast turn. Otherwise the
    // operator must turn toward a sound/report before seeing behind themselves.
    if (Number.isFinite(self.yaw) && d > 8 && brain.suppression < .15) {
      const facing = (-Math.sin(self.yaw) * (p.x - self.x) - Math.cos(self.yaw) * (p.z - self.z)) / d;
      if (facing < -.17) continue;
    }
    if (!clear(self, p)) continue;
    const score = d * (p.id === brain.target ? .72 : 1);
    if (score < nearest || score === nearest && String(p.id) < String(target?.id)) {target = p; nearest = score;}
  }
  if (target) {
    if (brain.target !== target.id) brain.acquiredAt = now;
    brain.target = target.id; brain.lastSeen = point(target); brain.seenAt = now;
  } else {
    brain.target = null;
    let report = null;
    for (const r of context.reports || []) {
      if (finitePoint(r.lastSeen) && Number.isFinite(r.seenAt) && r.seenAt <= now && now - r.seenAt < 5
        && r.seenAt > brain.seenAt && (!report || r.seenAt > report.seenAt)) report = r;
    }
    if (report) {brain.lastSeen = point(report.lastSeen); brain.seenAt = report.seenAt;}
    const noise = context.noise;
    if (finitePoint(noise) && noise.at <= now && noise.at > brain.heardAt && noise.at > brain.seenAt
      && now - noise.at < 2 && distance(self, noise) < 38) {
      brain.lastSeen = point(noise); brain.seenAt = noise.at; brain.heardAt = noise.at;
    }
  }
  if ((brain.ammo <= 0 || !target && brain.ammo <= 3 && now - brain.seenAt > 2) && !brain.reload && brain.reserve > 0) brain.reload = 2.2;
  const members = [self, ...allies.filter(a => a.id !== self.id && a.hp !== 0 && a.health !== 0)]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const index = Math.max(0, members.findIndex(a => a.id === self.id));
  const role = context.mode === 'last-stand' || members.length === 1 ? 'assault' : index % 4 === 0 ? 'support' : index % 4 === 1 ? 'assault' : 'flank';
  const fire = !!target && !brain.reload && brain.ammo > 0 && now - brain.acquiredAt > .6
    && now >= (brain.burstUntil || 0) && brain.suppression < .85 && !firingLaneBlocked(self, target, allies);
  const result = (state, goal, priority = false, extra = {}) => ({target, goal: point(goal), fire, state, priority,
    heal: 0, pickup: null, role, anim: 'run', moveSpeed: brain.suppression > .35 ? 3.1 : 4.1, ...extra});
  if (context.mode === 'last-stand' && distance(self, objective) > Math.max(1, (context.zoneRadius ?? 110) - 8)) {
    brain.healTime = 0;
    return result('zone', slot(objective, self.id, Math.max(0, (context.zoneRadius ?? 110) * .35)), true, {fire: false});
  }
  const threat = target || (now - brain.seenAt < 6 ? brain.lastSeen : null);
  const needsCover = brain.reload || self.hp < 40 || brain.suppression > .35;
  const cover = needsCover ? selectCover(brain, self, threat, now, {...context, clear}) : null;
  if (brain.medkit && self.hp < 40 && !target && brain.suppression < .4) {
    if (cover && distance(self, cover) > 1) return result('cover', cover, true, {fire: false, anim: 'cover'});
    brain.healTime += dt;
    if (brain.healTime >= 1.8) {brain.medkit = false; brain.healTime = 0; return result('heal', self, true, {fire: false, heal: 40, anim: 'cover'});}
    return result('heal', self, true, {fire: false, anim: 'cover'});
  }
  brain.healTime = 0;
  if (brain.reload || target && (self.hp < 30 || brain.suppression > .35)) {
    if (cover) return result('cover', cover, true, {fire: false, anim: 'cover'});
    if (target) {
      const d = distance(self, target) || 1;
      return result('retreat', {x: self.x + (self.x - target.x) / d * 8, z: self.z + (self.z - target.z) / d * 8}, true, {fire: false});
    }
  }
  if (brain.ammo === 0 && brain.reserve === 0) {
    let loot = null, nearestLoot = 45;
    for (const l of context.loot || []) if (l.ammo > 0 && distance(self, l) < nearestLoot && clear(self, l)) {loot = l; nearestLoot = distance(self, l);}
    if (loot) return result('resupply', loot, true, {fire: false, pickup: nearestLoot < 1.55 ? loot.id : null});
    return result('cover', cover || self, true, {fire: false, anim: 'cover'});
  }
  const objectiveSlot = (center, radius) => members.length < 2 ? slot(center, self.id, radius) : {
    x: center.x + Math.sin(index / members.length * Math.PI * 2) * radius,
    z: center.z + Math.cos(index / members.length * Math.PI * 2) * radius
  };
  const missionGoal = context.mode === 'hold' ? objectiveSlot(objective, 4 + Math.min(2, index * .25))
    : context.mode === 'extraction' ? objectiveSlot(context.intelCollected ? context.extractionPoint || objective : context.intelPoint || objective, 3 + Math.min(2, index * .3)) : null;
  if (missionGoal && distance(self, missionGoal) > 2 && (!target || distance(self, target) > 12)) return result('objective', missionGoal, true);
  if (target) {
    const d = distance(self, target), safeDistance = role === 'support' ? 26 : 19;
    if (role === 'flank' && d > 11 && d < 42) {
      let maneuver = maneuverCache.get(brain);
      if (!maneuver || maneuver.target !== target.id || now < maneuver.at || now >= maneuver.until) {
        const angle = Math.atan2(self.x - target.x, self.z - target.z) + (index % 2 ? 1 : -1) * .65;
        const goal = {x: target.x + Math.sin(angle) * 18, z: target.z + Math.cos(angle) * 18};
        const reachable = !occupied(goal, self, allies, 2.3) && clear(self, goal) && (!context.canReach || context.canReach(self, goal));
        maneuver = {at: now, until: now + 6, moveUntil: now + 3.5, target: target.id, goal: reachable ? goal : null};
        maneuverCache.set(brain, maneuver);
      }
      if (maneuver.goal) {
        if (now < maneuver.moveUntil && distance(self, maneuver.goal) > 1.2) return result('flank', maneuver.goal, true, {fire: false});
        return result('aim', self, true, {anim: 'aim', moveSpeed: 0});
      }
    }
    if (d > safeDistance + 5) {
      const goal = {x: target.x + (self.x - target.x) / d * safeDistance, z: target.z + (self.z - target.z) / d * safeDistance};
      return result('advance', goal, true, {fire: false});
    }
    const blocker = allies.find(a => a.id !== self.id && distance(self, a) < 1.5);
    if (blocker) {
      const angle = Math.atan2(self.x - target.x, self.z - target.z) + (hash(self.id) % 2 ? 1 : -1) * .18;
      const goal = {x: target.x + Math.sin(angle) * Math.max(d, 8), z: target.z + Math.cos(angle) * Math.max(d, 8)};
      if (clear(self, goal) && !occupied(goal, self, allies, 1.3)) return result('spread', goal, true, {fire: false, moveSpeed: 2.8});
    }
    return result('aim', self, true, {anim: 'aim', moveSpeed: 0});
  }
  if (brain.lastSeen && now - brain.seenAt < 8) {
    const goal = distance(self, brain.lastSeen) > 1.2 ? brain.lastSeen : slot(brain.lastSeen, self.id + Math.floor((now - brain.seenAt) / 2), 4);
    return result('search', goal, true, {fire: false, moveSpeed: 2.6, anim: 'walk'});
  }
  if (missionGoal) return result('guard', missionGoal, true, {fire: false, anim: 'aim', moveSpeed: 2.4});
  return result('patrol', context.mode ? slot(objective, self.id + Math.floor(now / 12), context.mode === 'last-stand' ? Math.min(20, (context.zoneRadius ?? 110) * .4) : 14) : objective, true, {fire: false, moveSpeed: 2.6, anim: 'walk'});
}
