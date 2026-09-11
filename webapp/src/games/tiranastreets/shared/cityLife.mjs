import { WEAPON_BY_ID, STARTER_WEAPON, difficultyOf } from "./weapons.mjs";
import { forceDispatch } from "./albanianForces.mjs";

// Gameplay-only, bounded systems. The server owns these values in connected runs.
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const bounded = (n, a, b) => Math.max(a, Math.min(b, n));
const armed = (n) => ["gang", "police", "soldier"].includes(n.kind);
export const wantedStars = (points) =>
  points <= 0 ? 0 : Math.min(5, Math.ceil(points / 100));
export function equipStarter(p) {
  p.health = 100;
  p.armor = 0;
  p.cash = 750;
  p.wanted = 0;
  p.lastCrime = -100;
  p.lastDamage = -100;
  p.respawnAt = 0;
  p.weapon = STARTER_WEAPON;
  p.inventory = { [STARTER_WEAPON]: { ammo: 16, reserve: 96 } };
  p.nextShot = 0;
  p.reloadAt = 0;
  p.kills = 0;
  p.shopMessage = "";
}
export function initCityLife(state, env, mission) {
  state.lifeVersion = 2;
  state.npcs = [];
  state.units = [];
  state.effects = [];
  state.effectSeq = 0;
  state.nextDispatch = 8;
  state.shop = {
    x: env.spawn.x + 12,
    z: env.spawn.z + 2,
    name: "Arben · Arsenal",
  };
  env.collide(state.shop, 1);
  state.npcs.push({
    ...state.shop,
    id: "dealer",
    kind: "dealer",
    motion: "idle",
    heading: 0,
    speed: 0,
    health: 100,
    weapon: null,
    downUntil: 0,
  });
  const paths = env.world.roads
    .filter(
      (r) =>
        r.walk && dist({ x: r.a[0], z: r.a[1] }, { x: r.b[0], z: r.b[1] }) > 10,
    )
    .sort(
      (a, b) =>
        dist({ x: a.a[0], z: a.a[1] }, env.spawn) -
        dist({ x: b.a[0], z: b.a[1] }, env.spawn),
    );
  // Populate the full city; the renderer selects only nearby pedestrians.
  for (let i = 0; i < 44 && paths.length; i++) {
    const r = paths[i < 16 ? i * 2 : (i * 59) % paths.length];
    const t = (i * 0.173) % 1;
    const n = {
      id: `citizen-${i}`,
      kind: "civilian",
      motion: i % 7 === 0 ? "cycle" : "walk",
      x: r.a[0] + (r.b[0] - r.a[0]) * t,
      z: r.a[1] + (r.b[1] - r.a[1]) * t,
      heading: 0,
      speed: 0,
      health: 100,
      weapon: null,
      path: [
        { x: r.a[0], z: r.a[1] },
        { x: r.b[0], z: r.b[1] },
      ],
      pathIndex: 1,
      panicUntil: 0,
      downUntil: 0,
    };
    env.collide(n, 0.4);
    state.npcs.push(n);
  }
  // Distinct, deterministic neighborhood routines keep the city readable online.
  const parks = env.world.parks.filter((p) => p.length >= 3);
  for (let i = 0; i < Math.min(8, parks.length * 2); i++) {
    const park = parks[i % parks.length];
    const a = park[(i * 2) % park.length], b = park[(i * 2 + 1) % park.length];
    state.npcs.push({
      id: `park-child-${i}`,
      kind: "civilian",
      role: "child",
      motion: "play",
      x: a[0], z: a[1], heading: 0, speed: 0, health: 100, weapon: null,
      path: [{ x: a[0], z: a[1] }, { x: b[0], z: b[1] }],
      pathIndex: 1, panicUntil: 0, downUntil: 0,
    });
  }
  for (let i = 0; i < 6 && paths.length; i++) {
    const r = paths[(i * 7 + 3) % paths.length];
    state.npcs.push({
      id: `dog-walker-${i}`,
      kind: "civilian",
      role: "dog-walker",
      motion: "walk",
      x: r.a[0], z: r.a[1], heading: 0, speed: 0, health: 100, weapon: null,
      path: [{ x: r.a[0], z: r.a[1] }, { x: r.b[0], z: r.b[1] }],
      pathIndex: 1, panicUntil: 0, downUntil: 0,
    });
  }
  // Cafe regulars complement the moving crowd with small, readable social
  // groups. They use the same shared character roster as every other citizen.
  for (let i = 0; i < 10 && paths.length; i++) {
    const r = paths[(i * 13 + 5) % paths.length], t = 0.35 + (i % 3) * 0.12;
    const x = r.a[0] + (r.b[0] - r.a[0]) * t,
      z = r.a[1] + (r.b[1] - r.a[1]) * t;
    state.npcs.push({
      id: `cafe-regular-${i}`, kind: "civilian", role: "cafe-guest",
      motion: "idle", x, z, heading: Math.atan2(r.b[0] - r.a[0], r.b[1] - r.a[1]) + (i % 2 ? Math.PI : 0),
      speed: 0, health: 100, weapon: null,
      path: [{ x, z }, { x: x + 0.01, z }], pathIndex: 1,
      panicUntil: 0, downUntil: 0,
    });
  }
  // Ambulance, fire brigade and patrol vehicles share the road graph and can be
  // promoted to incident responders without a second traffic simulation.
  for (const [i, service] of ["ambulance", "fire-brigade", "police-patrol"].entries()) {
    const node = env.nearestNode(env.spawn.x + 35 + i * 14, env.spawn.z - 30);
    const p = env.world.graph.nodes[node];
    const next = env.world.graph.edges.find((e) => e[0] === node)?.[1] ?? node;
    state.traffic.push({
      id: `service-${service}`,
      x: p[0], z: p[1], heading: 0, speed: 0, vx: 0, vz: 0, steering: 0,
      driver: null, model: service === "police-patrol" ? "police" : service === "ambulance" ? "taxi" : "sedan",
      service, responding: false, node, next, seed: 700 + i * 41, cruise: 7 + i,
      ...(service === "police-patrol" ? {forceVehicle: "patrol_sedan", forceCharacter: "patrol_officer"} : {}),
    });
  }
  if (mission.type === "combat") {
    const target = mission.stops[0];
    for (let i = 0; i < mission.enemies; i++) {
      const n = {
        id: `gang-${i}`,
        kind: "gang",
        motion: "walk",
        x: target.x + Math.cos(i * 1.7) * 10,
        z: target.z + Math.sin(i * 1.7) * 10,
        heading: 0,
        speed: 0,
        health: 65,
        weapon: i % 2 ? "uziSprayAttack" : "ak47VolleyAttack",
        nextShot: 3 + i,
        downUntil: 0,
        origin: { ...target },
      };
      env.collide(n, 0.45);
      state.npcs.push(n);
    }
  }
  for (const p of Object.values(state.players))
    if (mission.stars) {
      p.wanted = (mission.stars - 1) * 100 + 55;
      p.lastCrime = 0;
    }
}
export function reportCrime(state, p, amount) {
  const previous = wantedStars(p.wanted);
  p.wanted = bounded(p.wanted + amount, 0, 500);
  p.lastCrime = state.elapsed;
  if (wantedStars(p.wanted) > previous) emit(state, "alert", p, p, p.id);
}
function emit(state, kind, from, to, owner, weapon = "") {
  state.effects.push({
    id: ++state.effectSeq,
    at: state.elapsed,
    kind,
    x: from.x,
    z: from.z,
    toX: to.x,
    toZ: to.z,
    owner,
    weapon,
  });
  if (state.effects.length > 48)
    state.effects.splice(0, state.effects.length - 48);
}
export function lifeAction(state, p, action) {
  if (action === "reload") {
    const w = WEAPON_BY_ID.get(p.weapon),
      inv = p.inventory[p.weapon];
    if (w && inv && inv.ammo < w.magazine && inv.reserve > 0 && !p.reloadAt) {
      p.reloadAt = state.elapsed + w.reload;
      emit(state, "reload", p, p, p.id);
    }
    return true;
  }
  if (action === "holster") {
    p.weapon = p.weapon ? "" : Object.keys(p.inventory)[0];
    p.reloadAt = 0;
    return true;
  }
  if (action.startsWith("equip:")) {
    const id = action.slice(6);
    if (p.inventory[id] && WEAPON_BY_ID.has(id)) {
      p.weapon = id;
      p.reloadAt = 0;
    }
    return true;
  }
  if (!action.startsWith("buy:")) return false;
  p.shopMessage = "";
  if (p.carId || dist(p, state.shop) > 9 || p.health <= 0) {
    p.shopMessage = "Walk up to Arben to shop.";
    return true;
  }
  if (wantedStars(p.wanted) > 0) {
    p.shopMessage = "Lose your wanted stars before shopping.";
    return true;
  }
  const id = action.slice(4);
  if (id === "medkit" || id === "armor") {
    const price = id === "medkit" ? 90 : 180;
    if ((id === "medkit" ? p.health : p.armor) >= 100) {
      p.shopMessage = "Already full.";
      return true;
    }
    if (p.cash < price) {
      p.shopMessage = "Not enough street cash.";
      return true;
    }
    p.cash -= price;
    if (id === "medkit") p.health = 100;
    else p.armor = 100;
    p.shopMessage = id === "medkit" ? "Health restored." : "Armor equipped.";
    emit(state, "purchase", p, p, p.id);
    return true;
  }
  const w = WEAPON_BY_ID.get(id);
  if (!w) {
    p.shopMessage = "That item is unavailable.";
    return true;
  }
  const own = p.inventory[id],
    price = own ? Math.max(30, Math.round(w.price * 0.2)) : w.price;
  if (own && own.reserve >= w.magazine * 8) {
    p.shopMessage = "Ammo is full.";
    return true;
  }
  if (p.cash < price) {
    p.shopMessage = "Not enough street cash.";
    return true;
  }
  p.cash -= price;
  if (own) own.reserve = Math.min(w.magazine * 8, own.reserve + w.magazine * 3);
  else p.inventory[id] = { ammo: w.magazine, reserve: w.magazine * 3 };
  p.weapon = id;
  p.reloadAt = 0;
  p.shopMessage = own ? "Ammo restocked." : `${w.label} equipped.`;
  emit(state, "purchase", p, p, p.id);
  return true;
}
function harm(state, target, amount, attacker, env) {
  if (
    target.health <= 0 ||
    target.kind === "dealer" ||
    target.finished ||
    target.failed
  )
    return;
  if (target.kind) {
    target.health = Math.max(0, target.health - amount);
    target.panicUntil = state.elapsed + 12;
    if (!target.health) {
      target.downUntil = state.elapsed + (target.kind === "gang" ? 3600 : 35);
      if (attacker?.inventory && target.kind === "gang") {
        attacker.kills++;
        attacker.cash += 75;
      }
    }
  } else {
    const absorbed = Math.min(target.armor, amount * 0.65);
    target.armor -= absorbed;
    target.health = Math.max(0, target.health - (amount - absorbed));
    target.lastDamage = state.elapsed;
    if (!target.health) {
      const c = state.cars.find((c) => c.id === target.carId);
      if (c) {
        c.driver = null;
        c.speed = 0;
        c.vx = 0;
        c.vz = 0;
      }
      target.carId = null;
      target.speed = 0;
      target.reloadAt = 0;
      target.respawnAt = state.elapsed + 4;
      if (state.missionId !== "free-roam") {
        target.failed = true;
        state.message = "Run ended. Regroup and try again.";
      }
    }
  }
  emit(state, "hit", target, target, attacker?.id || "");
}
function fire(state, p, env) {
  const w = WEAPON_BY_ID.get(p.weapon),
    inv = p.inventory[p.weapon];
  if (
    !w ||
    !inv ||
    p.carId ||
    p.health <= 0 ||
    p.reloadAt ||
    state.elapsed < p.nextShot
  )
    return;
  if (!inv.ammo) {
    lifeAction(state, p, "reload");
    return;
  }
  inv.ammo--;
  p.nextShot = state.elapsed + w.interval;
  p.heading = p.input.yaw;
  const dx = -Math.sin(p.input.yaw),
    dz = -Math.cos(p.input.yaw);
  let target = null,
    nearest = w.range;
  const candidates = [
    ...state.npcs,
    ...Object.values(state.players).filter(
      (o) => o.id !== p.id && state.mode === "rivals",
    ),
  ];
  for (const n of candidates) {
    if (n.health <= 0 || n.kind === "dealer" || n.finished || n.failed)
      continue;
    const x = n.x - p.x,
      z = n.z - p.z,
      forward = x * dx + z * dz,
      side = Math.abs(x * dz - z * dx);
    // Small, explicit touch aim assist; all hits still require server line of sight.
    if (
      forward > 0 &&
      forward < nearest &&
      side < 0.7 + Math.min(1.4, forward * 0.035) &&
      env.clear(p, n)
    ) {
      target = n;
      nearest = forward;
    }
  }
  let end = { x: p.x + dx * nearest, z: p.z + dz * nearest };
  if (!env.clear(p, end)) {
    let low = 0,
      high = nearest;
    for (let i = 0; i < 8; i++) {
      const m = (low + high) / 2;
      if (env.clear(p, { x: p.x + dx * m, z: p.z + dz * m })) low = m;
      else high = m;
    }
    end = { x: p.x + dx * low, z: p.z + dz * low };
    target = null;
  }
  const hostile = target && armed(target);
  reportCrime(
    state,
    p,
    hostile && target.kind === "gang"
      ? 4
      : target?.kind === "civilian"
        ? 85
        : target
          ? 60
          : 12,
  );
  emit(state, w.radius ? "explosion" : "shot", p, end, p.id, w.id);
  if (w.radius) {
    for (const n of candidates)
      if (dist(n, end) < w.radius && env.clear(end, n))
        harm(
          state,
          n,
          w.damage * (1 - dist(n, end) / (w.radius * 1.3)),
          p,
          env,
        );
    if (dist(p, end) < w.radius) harm(state, p, w.damage * 0.4, p, env);
  } else if (target) harm(state, target, w.damage, p, env);
  for (const n of state.npcs)
    if (n.kind === "civilian" && dist(p, n) < 55)
      n.panicUntil = state.elapsed + 10;
}
function dispatch(state, p, stars, env) {
  const slot = state.units.length,
    a = state.elapsed * 1.3 + slot * 2.1;
  const pos = env.roadPoint(p.x + Math.cos(a) * 95, p.z + Math.sin(a) * 95);
  const military = stars === 5,
    id = `unit-${state.effectSeq}-${Math.floor(state.elapsed * 1000)}-${slot}`;
  const force = forceDispatch(stars, slot + Math.floor(state.elapsed / 30));
  const unit = {
    ...pos,
    ...force,
    id,
    model: military ? "military-suv" : "police",
    kind: military ? "military" : stars >= 4 ? "tactical" : "patrol",
    heading: 0,
    speed: 0,
    vx: 0,
    vz: 0,
    steering: 0,
    driver: "npc",
    target: p.id,
    path: [],
    pathIndex: 0,
    nextRoute: 0,
  };
  state.units.push(unit);
  for (let i = 0; i < (military ? 2 : 1); i++)
    state.npcs.push({
      id: `${id}-officer-${i}`,
      unit: id,
      forceCharacter: force.forceCharacter,
      kind: military ? "soldier" : "police",
      motion: "drive",
      x: pos.x + i,
      z: pos.z,
      heading: 0,
      speed: 0,
      health: military ? 150 : 100,
      weapon: military ? "ak47VolleyAttack" : "polyPistol01Attack",
      nextShot: state.elapsed + 3 + i,
      downUntil: 0,
      panicUntil: 0,
    });
}
export function updateCityLife(state, dt, env, mission) {
  // Retain a short, bounded event window so polling clients receive audiovisual events.
  state.effects = state.effects.filter((e) => state.elapsed - e.at < 0.7);
  const players = Object.values(state.players),
    cfg = difficultyOf(state.difficulty);
  const activeEmergency = players.some((p) => p.wanted > 0 || state.elapsed - p.lastDamage < 8);
  for (const vehicle of state.traffic || []) {
    if (!vehicle.service) continue;
    vehicle.responding = activeEmergency;
    vehicle.cruise = activeEmergency
      ? vehicle.service === "police-patrol" ? 15 : 12
      : vehicle.service === "police-patrol" ? 8 : 7;
  }
  for (const p of players) {
    if (p.health <= 0) {
      if (state.missionId === "free-roam" && state.elapsed >= p.respawnAt) {
        Object.assign(p, env.spawn);
        p.health = 100;
        p.armor = 0;
        p.wanted = 0;
        p.lastCrime = -100;
        p.lastDamage = state.elapsed;
        p.cash = Math.max(0, p.cash - 100);
        p.input = env.emptyInput();
        p.inputAt = -10;
      }
      continue;
    }
    if (p.finished || p.failed) continue;
    if (p.reloadAt && state.elapsed >= p.reloadAt) {
      const w = WEAPON_BY_ID.get(p.weapon),
        inv = p.inventory[p.weapon];
      if (w && inv) {
        const n = Math.min(w.magazine - inv.ammo, inv.reserve);
        inv.ammo += n;
        inv.reserve -= n;
      }
      p.reloadAt = 0;
    }
    if (!p.aircraftId && state.elapsed - p.inputAt < 0.45 && p.input.fire) fire(state, p, env);
    if (state.elapsed - p.lastDamage > 18 && p.health < 100)
      p.health = Math.min(100, p.health + dt * 1.5);
    const visible = state.npcs.some(
      (n) =>
        ["police", "soldier"].includes(n.kind) &&
        n.health > 0 &&
        dist(n, p) < 60 &&
        env.clear(n, p),
    );
    if (!visible && state.elapsed - p.lastCrime > 14)
      p.wanted = Math.max(
        0,
        p.wanted - dt * (state.difficulty === "hard" ? 5 : 8),
      );
    p.searching = p.wanted > 0 && !visible;
    p.heat = wantedStars(p.wanted) / 5;
  }
  const target = players
    .filter((p) => p.health > 0 && !p.failed && !p.finished)
    .sort((a, b) => b.wanted - a.wanted)[0];
  const stars = wantedStars(target?.wanted || 0);
  const capacity = stars ? Math.min(6, stars + 1) : 0;
  if (target && stars && state.elapsed >= state.nextDispatch) {
    state.nextDispatch = state.elapsed + 5;
    if (
      state.units.length < capacity ||
      (stars === 5 && !state.units.some((u) => u.kind === "military"))
    ) {
      if (state.units.length >= 6) {
        const old = state.units.shift();
        state.npcs = state.npcs.filter((n) => n.unit !== old.id);
      }
      dispatch(state, target, stars, env);
    }
  }
  if (!stars) {
    state.units = [];
    state.npcs = state.npcs.filter((n) => !n.unit);
  }
  for (const unit of state.units) {
    const p = state.players[unit.target] || target;
    if (!p) continue;
    if (state.elapsed >= unit.nextRoute) {
      unit.path = env.route(
        env.nearestNode(unit.x, unit.z),
        env.nearestNode(p.x, p.z),
      );
      unit.pathIndex = 0;
      unit.nextRoute = state.elapsed + 3.5;
    }
    const d = dist(unit, p);
    unit.speed = 0;
    if (
      d > 16 &&
      unit.path[unit.pathIndex] &&
      env.along(
        unit,
        unit.path[unit.pathIndex],
        unit.model === "military-suv" ? 10 : 11 + stars,
        dt,
      )
    )
      unit.pathIndex++;
  }
  for (const n of state.npcs) {
    if (n.health <= 0) {
      n.speed = 0;
      if (n.kind === "civilian" && state.elapsed > n.downUntil) {
        n.health = 100;
        n.panicUntil = 0;
      }
      continue;
    }
    if (n.kind === "dealer") continue;
    if (n.kind === "civilian") {
      const danger = players.find(
        (p) => state.elapsed - p.lastCrime < 9 && dist(p, n) < 40,
      );
      const panic = state.elapsed < n.panicUntil;
      if (panic && danger) {
        const d = dist(n, danger) || 1,
          to = {
            x: n.x + ((n.x - danger.x) / d) * 6,
            z: n.z + ((n.z - danger.z) / d) * 6,
          };
        env.along(n, to, n.motion === "cycle" ? 6 : 4.8, dt);
        env.collide(n, 0.45);
      } else if (n.path?.length) {
        if (
          env.along(
            n,
            n.path[n.pathIndex],
            n.motion === "cycle" ? 4.5 : n.role === "child" ? 2.1 : 1.3,
            dt,
          )
        )
          n.pathIndex = 1 - n.pathIndex;
        env.collide(n, 0.4);
      }
      n.anim = panic ? "run" : n.motion === "cycle" ? "ride" : n.role === "child" ? "run" : "walk";
      const car = state.cars.find(
        (c) => c.driver && Math.abs(c.speed) > 6 && dist(c, n) < 1.6,
      );
      if (car && state.elapsed - (n.hitAt || -10) > 2) {
        n.hitAt = state.elapsed;
        const driver = state.players[car.driver];
        if (driver) {
          harm(state, n, 35, driver, env);
          reportCrime(state, driver, 70);
          car.speed *= 0.7;
        }
      }
      continue;
    }
    const p = players
      .filter(
        (p) =>
          p.health > 0 &&
          !p.failed &&
          !p.finished &&
          (n.kind === "gang" || p.wanted > 0),
      )
      .sort((a, b) => dist(a, n) - dist(b, n))[0];
    if (!p) {
      n.speed = 0;
      continue;
    }
    const unit = n.unit && state.units.find((u) => u.id === n.unit),
      d = dist(n, p);
    if (unit && dist(unit, p) > 23) {
      n.motion = "drive";
      n.x = unit.x;
      n.z = unit.z;
      n.heading = unit.heading;
      continue;
    }
    n.motion = "walk";
    n.anim = "aim";
    if (d > 16 && d < 100) {
      env.along(n, p, n.kind === "soldier" ? 3.6 : 2.7, dt);
      env.collide(n, 0.45);
      n.anim = "run";
    } else n.speed = 0;
    n.heading = Math.atan2(n.x - p.x, n.z - p.z);
    if (d < 46 && state.elapsed >= n.nextShot && env.clear(n, p)) {
      n.nextShot =
        state.elapsed + (n.kind === "soldier" ? 0.85 : 1.6) / cfg.damage;
      // Grace period and readable cadence give touch players time to react.
      if (state.elapsed - p.lastDamage > 0.35)
        harm(state, p, (n.kind === "soldier" ? 8 : 5) * cfg.damage, n, env);
      emit(state, "shot", n, p, n.id, n.weapon);
    }
  }
  if (mission.type === "combat") {
    const remaining = state.npcs.filter(
      (n) => n.kind === "gang" && n.health > 0,
    ).length;
    state.objectiveRemaining = remaining;
    if (!remaining) state.message = "Area clear. Reach the extraction marker.";
  }
}
