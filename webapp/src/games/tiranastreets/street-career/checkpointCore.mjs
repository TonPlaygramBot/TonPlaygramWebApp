import {groundHeight} from '../../tirana-east/terrainCore.mjs';
/** Versioned phase checkpoints inside the existing v1 profile/key. Old profiles
 * remain readable and old mission-start checkpoints remain the safe fallback. */
const finite = (v, a, b, f) =>
  Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : f;
export function normalizeCheckpoint(raw, loadout, stops = 0) {
  if (
    !raw ||
    raw.version !== 2 ||
    !Number.isInteger(raw.index) ||
    raw.index < 0 ||
    raw.index >= stops
  )
    return null;
  const q = raw.player;
  if (!q || ![q.x, q.z].every(Number.isFinite)) return null;
  const car = raw.car;
  return {
    version: 2,
    index: raw.index,
    elapsed: finite(raw.elapsed, 0, 86400, 0),
    player: {
      x: finite(q.x, -100000, 100000, 0),
      z: finite(q.z, -100000, 100000, 0),
      heading: finite(q.heading, -Math.PI * 2, Math.PI * 2, 0),
      health: finite(q.health, 1, 100, 100),
      armor: finite(q.armor, 0, 100, 0),
      wanted: finite(q.wanted, 0, 500, 0),
      ...loadout(q)
    },
    car:
      car &&
      typeof car.id === 'string' &&
      typeof car.model === 'string' &&
      [car.x, car.z, car.heading].every(Number.isFinite)
        ? {
            id: car.id.slice(0, 120),
            model: car.model.slice(0, 100),
            x: car.x,
            z: car.z,
            heading: car.heading,
            collectionVehicle:
              typeof car.collectionVehicle === 'string'
                ? car.collectionVehicle
                : undefined,
            racingAsset:
              typeof car.racingAsset === 'string' ? car.racingAsset : undefined
          }
        : null,
    job: {
      parcel: raw.job?.parcel === true,
      defend: finite(raw.job?.defend, 0, 12, 0),
      tutorial: Array.isArray(raw.job?.tutorial)
        ? raw.job.tutorial.filter((x) => typeof x === 'string').slice(0, 20)
        : []
    },
    defeated: Array.isArray(raw.defeated)
      ? raw.defeated
          .filter((id) => typeof id === 'string' && /^gang-\d+$/.test(id))
          .slice(0, 50)
      : [],
    claimed: Array.isArray(raw.claimed)
      ? raw.claimed
          .filter((id) => typeof id === 'string' && (id.startsWith('drop:') || /^city-weapon-\d+$/.test(id)))
          .slice(0, 428)
      : []
  };
}
export function captureCheckpoint(sim) {
  const p = sim.player;
  if (p.health <= 0 || p.failed || p.finished || sim.state.phase !== 'active')
    return null;
  const car = sim.state.cars.find((c) => c.id === p.carId);
  return {
    version: 2,
    index: p.index,
    elapsed: sim.state.elapsed,
    player: JSON.parse(JSON.stringify(p)),
    car: car ? { ...car } : null,
    job: { ...sim.job },
    defeated: sim.state.npcs
      .filter((n) => n.kind === 'gang' && n.health <= 0)
      .map((n) => n.id),
    claimed: [...sim.claimed]
  };
}
export function restoreCheckpoint(sim, checkpoint, apply) {
  if (!checkpoint) return false;
  const p = sim.player,
    q = { ...checkpoint.player, y: groundHeight(checkpoint.player.x,checkpoint.player.z)+0.08 };
  if (!sim.world.clearance(q, 1.78)) return false;
  apply(p, checkpoint.player);
  Object.assign(p, {
    x: q.x,
    z: q.z,
    heading: q.heading,
    health: q.health,
    armor: q.armor,
    wanted: q.wanted,
    index: checkpoint.index
  });
  sim.state.elapsed = checkpoint.elapsed;
  sim.body.y = q.y;
  sim.body.yaw = p.heading;
  sim.intent.yaw = p.heading;
  sim.body.tutorial = [...checkpoint.job.tutorial];
  Object.assign(sim.job, checkpoint.job, { stage: p.index });
  for (const n of sim.state.npcs)
    if (checkpoint.defeated.includes(n.id)) {
      n.health = 0;
      n.downUntil = 86400;
    }
  sim.claimed = new Set(checkpoint.claimed);
  for(const item of sim.loot)if(sim.claimed.has(item.id)){item.collected=true;item.collectedBy=p.id;}
  if (checkpoint.car) {
    const saved = checkpoint.car;
    let car =
      sim.state.cars.find((c) => c.id === saved.id) ||
      sim.state.traffic.find((c) => c.id === saved.id);
    if (car) {
      sim.state.traffic = sim.state.traffic.filter((c) => c !== car);
      if (!sim.state.cars.includes(car)) sim.state.cars.push(car);
    } else {
      car = { ...saved, speed: 0, vx: 0, vz: 0, steering: 0, driver: null };
      sim.state.cars.push(car);
    }
    Object.assign(car, saved, {
      speed: 0,
      vx: 0,
      vz: 0,
      steering: 0,
      driver: p.id,
      npcDriver: false
    });
    p.carId = car.id;
    p.x = car.x;
    p.z = car.z;
    sim.job.vehicleId = car.id;
    sim.body.interaction = 'driving';
  }
  return true;
}
