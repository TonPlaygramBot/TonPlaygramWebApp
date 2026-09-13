import { sampleCircuitDistance, cornerSpeedLimit } from './circuitMetrics.mjs';
import { boostPads } from './arcadeRules.mjs';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const cache = new WeakMap();
export const ROAD_SURFACE_Y = .115;
export const TYRE_RADIUS = .57;
export const TYRE_EDGE_OFFSET = .62;

/** Authored event humps, not claims about real Tirana road obstacles. The same
 * immutable profiles drive the visible mesh, every wheel and server physics. */
export function roadBumps(track) {
  if (cache.has(track)) return cache.get(track);
  const bumps = [];
  // Keep simple synthetic/test tracks and the original API free of obstacles.
  if (track.roadFeelVersion === 1) {
    const count = clamp(Math.floor(track.length / 340), 3, 8);
    const pads = boostPads(track);
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 16; attempt++) {
        const p = sampleCircuitDistance(track, track.length * (i + .45) / count + attempt * 9);
        const width = track.points[p.index].width ?? track.width;
        if (p.distance < 65 || track.length - p.distance < 65 || width < 8 ||
            cornerSpeedLimit(track, p, 30) < 24 ||
            pads.some(b => Math.hypot(b.x - p.x, b.z - p.z) < 23) ||
            bumps.some(b => Math.hypot(b.x - p.x, b.z - p.z) < 130)) continue;
        bumps.push({ ...p, id: i, width: width - 1.2, length: 4.4,
          height: .10 + (i % 3) * .025 });
        break;
      }
    }
  }
  cache.set(track, bumps);
  return bumps;
}

export function roadHeight(bumps, x, z) {
  let height = 0;
  for (const b of bumps) {
    const dx = x - b.x, dz = z - b.z;
    const along = dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw);
    const across = Math.abs(dx * Math.cos(b.yaw) - dz * Math.sin(b.yaw));
    if (Math.abs(along) >= b.length / 2 || across >= b.width / 2) continue;
    const edge = clamp((b.width / 2 - across) / .35, 0, 1);
    height = Math.max(height, b.height * Math.cos(along / b.length * Math.PI) ** 2 * edge);
  }
  return height;
}

export function resetSuspension(r) {
  r.suspension = { height: 0, velocity: 0, pitch: 0, pitchVelocity: 0,
    roll: 0, rollVelocity: 0, wheels: [0, 0, 0, 0], grip: 1 };
  r.bumpImpact = 0;
}

/** Four contact patches and damped body springs, advanced only by the fixed
 * simulation clock. Fast humps unload the tyres briefly without random flips. */
export function stepSuspension(r, track, dt) {
  if (!r.suspension) resetSuspension(r);
  const state = r.suspension, bumps = roadBumps(track);
  const s = Math.sin(r.yaw), c = Math.cos(r.yaw);
  const wheelbase = (r.bodyLength || 2.7) * .67;
  const trackWidth = (r.bodyWidth || 1.72) * .83;
  const previous = state.wheels.reduce((a, b) => a + b, 0) / 4;
  for (let i = 0; i < 4; i++) {
    const side = (i % 2 ? -1 : 1) * trackWidth / 2;
    const along = (i < 2 ? 1 : -1) * wheelbase / 2;
    state.wheels[i] = roadHeight(bumps, r.x + s * along + c * side, r.z + c * along - s * side);
  }
  const [fl, fr, rl, rr] = state.wheels;
  const average = (fl + fr + rl + rr) / 4;
  const bumpRate = Math.abs(average - previous) / dt;
  r.bumpImpact = Math.max((r.bumpImpact || 0) * Math.exp(-dt * 8), clamp(bumpRate * .16, 0, 1));
  const heavy = ['oopi', 'aegis'].includes(r.kartId);
  const spring = heavy ? 125 : 165, damping = heavy ? 17 : 21;
  const pitch = clamp(((rl + rr) - (fl + fr)) / (2 * wheelbase) - (r.acceleration || 0) * .0026, -.14, .14);
  const roll = clamp(((fl + rl) - (fr + rr)) / (2 * trackWidth) + (r.yawRate || 0) * r.speed * .0025, -.14, .14);
  const steps = Math.ceil(dt * 120), step = dt / steps;
  for (let i = 0; i < steps; i++) {
    for (const [key, velocity, target] of [['height', 'velocity', average], ['pitch', 'pitchVelocity', pitch], ['roll', 'rollVelocity', roll]]) {
      state[velocity] += ((target - state[key]) * spring - state[velocity] * damping) * step;
      state[key] += state[velocity] * step;
    }
  }
  state.height = clamp(state.height, -.04, .3);
  state.grip = clamp(1 - Math.max(0, state.height - average) * 1.6 - r.bumpImpact * .12, .72, 1);
}
