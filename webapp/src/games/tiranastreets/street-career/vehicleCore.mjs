import {groundHeight} from '../../tirana-east/terrainCore.mjs';
import { driverSocket } from '../shared/driverView.mjs';
/** Anchors in metres, forward = -Z, right = +X, relative to the simulation car.
 * The existing city-car GLB has seats/dashboard/steering; generic models use a
 * documented authored basic cabin, not a claimed detailed original interior. */
export const VEHICLE_ANCHORS = Object.freeze({
  doors: [
    { x: -1.65, y: 0, z: 0.15 },
    { x: 1.65, y: 0, z: 0.15 }
  ],
  seat: { x: -0.38, y: 0.5, z: 0.12 },
  eye: { x: -0.38, y: 1.18, z: 0.04 },
  wheel: { x: -0.38, y: 0.94, z: -0.54 },
  maxSpeed: 2.5
});
// Reuse the cabin/seat profiles merged on main in #25857. The Blender wheel is
// centred at (0, -.40, -.39) relative to the canonical driver eye.
export const vehicleAnchors = (car) => {
  const eye = driverSocket(car);
  return {
    ...VEHICLE_ANCHORS,
    doors: car.model==='tirana-bus' ? [{x:-1.9,y:0,z:-7.2},{x:1.9,y:0,z:-7.2}] : VEHICLE_ANCHORS.doors,
    eye: { x: eye.x, y: eye.y, z: eye.z },
    seat: { x: eye.x, y: eye.y - 0.55, z: eye.z - 0.02 },
    wheel: { x: eye.x, y: eye.y - 0.4, z: eye.z - 0.39 }
  };
};
export const carPoint = (car, p) => ({
  x: car.x + p.x * Math.cos(car.heading) + p.z * Math.sin(car.heading),
  y: p.y+groundHeight(car.x,car.z),
  z: car.z - p.x * Math.sin(car.heading) + p.z * Math.cos(car.heading)
});
export function exitPoint(state, car, world) {
  for (const side of [-1, 1])
    for (const z of (car.model==='tirana-bus'?[-7.2,-6.5,-7.8]:[0.15, 0.9, -0.6])) {
      const p = carPoint(car, { x: side * 1.85, y: 0, z });
      const floor=groundHeight(car.x,car.z);
      p.y = world.surface(p.x, p.z, floor+0.38);
      if (p.y > floor+0.38 || !world.clearance(p, 1.78, 0.38)) continue;
      if (
        [...state.cars, ...state.traffic, ...state.units].some(
          (c) => c.id !== car.id && Math.hypot(c.x - p.x, c.z - p.z) < 1.7
        )
      )
        continue;
      if (
        world.clear(
          carPoint(car, { x: side * 1.08, y: 0.6, z }),
          { ...p, y: p.y + 0.6 },
          [],
          car.id
        )
      )
        return p;
    }
  return null;
}
export function takeVehicle(state, p, car) {
  // One object, one simulation list and one driver. Commit only after validation.
  if (
    (car.driver && car.driver !== 'npc') ||
    p.carId ||
    Math.abs(car.speed) > VEHICLE_ANCHORS.maxSpeed
  )
    return false;
  const traffic = state.traffic.indexOf(car);
  if (traffic < 0 && !state.cars.includes(car)) return false;
  if (traffic >= 0) {
    state.traffic.splice(traffic, 1);
    state.cars.push(car);
  }
  for (const n of state.npcs)
    if (n.unit === car.id && n.motion === 'drive') {
      n.unit = undefined;
      n.motion = 'walk';
      n.deployed = true;
      n.x = car.x + 2;
      n.z = car.z;
      n.speed = 0;
    }
  car.npcDriver = false;
  car.driver = p.id;
  car.speed = 0;
  car.vx = 0;
  car.vz = 0;
  p.carId = car.id;
  p.x = car.x;
  p.z = car.z;
  p.heading = car.heading;
  return true;
}
