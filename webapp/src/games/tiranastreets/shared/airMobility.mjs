const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const center = (polygon) => {
  const sum = polygon.reduce((v, p) => ({ x: v.x + p[0], z: v.z + p[1] }), { x: 0, z: 0 });
  return { x: sum.x / polygon.length, z: sum.z / polygon.length };
};

export function helicopterSite(world) {
  const candidates = world.buildings.filter((b) => b.p?.length >= 3 && b.h >= 18);
  const building = candidates.sort((a, b) => b.h - a.h)[0] || world.buildings[0];
  const pad = center(building.p);
  const edge = building.p.reduce((best, p) => (p[1] > best[1] ? p : best), building.p[0]);
  return {
    buildingId: building.id,
    x: pad.x,
    z: pad.z,
    roofY: Math.max(10, building.h + 0.7),
    stairX: edge[0],
    stairZ: edge[1] + 1.4,
  };
}

export function initAirMobility(state, world) {
  const site = helicopterSite(world);
  state.helicopter = {
    id: "tirana-rescue-helicopter",
    ...site,
    y: site.roofY + 0.65,
    heading: Math.PI,
    speed: 0,
    pilot: null,
    airborne: false,
    nextMissile: 0,
  };
}

export function airAction(state, player, action) {
  const helicopter = state.helicopter;
  if (!helicopter || action !== "helicopter") return false;
  if (player.aircraftId === helicopter.id) {
    if (helicopter.y > helicopter.roofY + 1.2 || helicopter.speed > 1.5) return true;
    helicopter.pilot = null;
    helicopter.airborne = false;
    player.aircraftId = null;
    player.x = helicopter.stairX;
    player.z = helicopter.stairZ;
    return true;
  }
  const atStairs = Math.hypot(player.x - helicopter.stairX, player.z - helicopter.stairZ) <= 12;
  if (player.carId || helicopter.pilot || (!atStairs && distance(player, helicopter) > 8)) return true;
  helicopter.pilot = player.id;
  player.aircraftId = helicopter.id;
  player.x = helicopter.x;
  player.z = helicopter.z;
  return true;
}

function missile(state, helicopter) {
  if (state.elapsed < helicopter.nextMissile) return;
  helicopter.nextMissile = state.elapsed + 0.7;
  const range = 75;
  const toX = helicopter.x - Math.sin(helicopter.heading) * range;
  const toZ = helicopter.z - Math.cos(helicopter.heading) * range;
  state.effects.push({
    id: ++state.effectSeq,
    at: state.elapsed,
    kind: "missile",
    x: helicopter.x,
    z: helicopter.z,
    y: helicopter.y - 0.8,
    toX,
    toZ,
    owner: helicopter.pilot,
    weapon: "helicopterAttack",
  });
  for (const npc of state.npcs) {
    if (npc.health > 0 && Math.hypot(npc.x - toX, npc.z - toZ) < 10 && npc.kind !== "dealer") {
      npc.health = Math.max(0, npc.health - 90);
      npc.downUntil = state.elapsed + 35;
    }
  }
}

export function updateAirMobility(state, dt) {
  const h = state.helicopter;
  if (!h || h.careerManaged) return;
  const p = h.pilot && state.players[h.pilot];
  if (!p) {
    h.pilot = null;
    h.speed *= Math.exp(-2 * dt);
    h.y = Math.max(h.roofY + 0.65, h.y - dt * 2.2);
    h.airborne = h.y > h.roofY + 1;
    return;
  }
  const input = state.elapsed - p.inputAt < 0.45 ? p.input : { x: 0, y: 0, fast: false, brake: false, fire: false };
  h.heading += -input.x * dt * 1.25;
  h.y = Math.max(h.roofY + 0.65, Math.min(105, h.y + (input.fast ? 8 : 0) * dt - (input.brake ? 7 : 0) * dt));
  h.airborne = h.y > h.roofY + 1.1;
  const desired = h.airborne ? input.y * 28 : 0;
  h.speed += (desired - h.speed) * Math.min(1, dt * 2.2);
  h.x -= Math.sin(h.heading) * h.speed * dt;
  h.z -= Math.cos(h.heading) * h.speed * dt;
  p.x = h.x;
  p.z = h.z;
  p.heading = h.heading;
  p.speed = Math.abs(h.speed);
  if (input.fire && h.airborne) missile(state, h);
}
