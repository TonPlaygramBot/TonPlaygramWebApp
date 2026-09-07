/** Cosmetic response only: no racer, wallet, physics or reward state is accepted. */
export const WATER_DURATION = 2.1;
export const WATER_COOLDOWN = 5.5;
export function createWaterState() {
  return { lastEvent: -1, nextAt: 0, started: -10, target: null };
}
export function updateWater(state, events, truck, time, running) {
  if (!running) return state;
  if (time >= state.nextAt) {
    const event = events.find(
      (e) =>
        e.id > state.lastEvent &&
        time - e.time >= 0.35 &&
        time - e.time < 2.8 &&
        Math.hypot(e.x - truck.x, e.z - truck.z) < 36
    );
    if (event) {
      state.lastEvent = event.id;
      state.started = time;
      state.nextAt = time + WATER_COOLDOWN;
      state.target = { x: event.x, y: 1.15, z: event.z, seed: event.seed };
    }
  }
  if (time - state.started > WATER_DURATION) state.target = null;
  return state;
}
export function waterPoint(origin, target, t, time = 0) {
  return {
    x: origin.x + (target.x - origin.x) * t,
    y:
      origin.y +
      (target.y - origin.y) * t +
      1.4 * t * (1 - t) +
      Math.sin(time * 31 + t * 47) * 0.018 * t,
    z: origin.z + (target.z - origin.z) * t
  };
}
