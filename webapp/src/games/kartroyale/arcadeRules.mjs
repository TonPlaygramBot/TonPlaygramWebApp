import { sampleCircuitDistance, cornerSpeedLimit } from './circuitMetrics.mjs';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const DRIFT_TIERS = Object.freeze([.55, 1.15, 1.9]);
export const driftTier = charge => DRIFT_TIERS.filter(t => charge >= t).length;
/** Charge is earned through a moving turn; braking/reversing cancels the reward. */
export function stepDrift(r, input, dt) {
  const active = input.drift === true && !input.brake && !input.reverse && r.speed > 8 && Math.abs(r.steering) > .16;
  r.turbo = Math.max(0, r.turbo - dt);
  r.hop = Math.max(0, (r.hop || 0) - dt);
  if (active) {
    if (!r.drifting) r.hop = .24;
    r.driftCharge = Math.min(2.3, r.driftCharge + dt * (.7 + Math.abs(r.steering) * .3));
  } else {
    const tier = driftTier(r.driftCharge);
    if (r.drifting && !input.brake && !input.reverse && tier) {
      r.turbo = [.0, .85, 1.5, 2.2][tier];
      r.boost = Math.min(100, r.boost + tier * 8);
      r.boostEvent = (r.boostEvent || 0) + 1;
    }
    r.driftCharge = 0;
  }
  r.drifting = active;
  return active;
}
const pads = new WeakMap();
export function boostPads(track) {
  if (pads.has(track)) return pads.get(track);
  const result = [];
  for (let i = 0; i < 6; i++) {
    // Search each sixth of the route for a straight, retaining the road geometry.
    for (let attempt = 0; attempt < 10; attempt++) {
      const p = sampleCircuitDistance(track, track.length * ((i + .32 + attempt * .05) / 6));
      if (cornerSpeedLimit(track, p, 32) < 26) continue;
      result.push({ ...p, id: i, width: Math.min(3.8, (track.points[p.index].width ?? track.width) * .48) });
      break;
    }
  }
  pads.set(track, result);
  return result;
}
export function stepBoostPads(r, track, time) {
  if (r.speed < 2 || r.finished || r.retired || r.disconnected) return;
  for (const pad of boostPads(track)) {
    const dx = r.x - pad.x, dz = r.z - pad.z;
    const along = dx * Math.sin(pad.yaw) + dz * Math.cos(pad.yaw);
    const across = dx * Math.cos(pad.yaw) - dz * Math.sin(pad.yaw);
    const cooldown = r.padCooldowns?.[pad.id] || 0;
    if (Math.abs(along) > 2 || Math.abs(across) > pad.width / 2 || time < cooldown) continue;
    r.padCooldowns ||= {};
    r.padCooldowns[pad.id] = time + 8;
    r.turbo = Math.max(r.turbo, .85);
    r.boost = Math.min(100, r.boost + 18);
    r.boostEvent = (r.boostEvent || 0) + 1;
  }
}
export function stepSlipstream(racers, dt) {
  for (const r of racers) {
    if (r.finished || r.retired || r.disconnected) continue;
    const following = r.speed > 10 && racers.some(other => {
      if (other === r || other.finished || other.retired || other.disconnected) return false;
      const dx = other.x - r.x, dz = other.z - r.z;
      const ahead = dx * Math.sin(r.yaw) + dz * Math.cos(r.yaw);
      return ahead > 4 && ahead < 20 && Math.abs(dx * Math.cos(r.yaw) - dz * Math.sin(r.yaw)) < 2.2 && Math.cos(other.yaw - r.yaw) > .92;
    });
    r.slipstream = clamp((r.slipstream || 0) + dt * (following ? 1 : -2), 0, 1.5);
    if (r.slipstream >= 1.5 && !(r.draftCooldown > 0)) {
      r.turbo = Math.max(r.turbo, 1.1);
      r.boostEvent = (r.boostEvent || 0) + 1;
      r.draftCooldown = 4;
    }
    r.draftCooldown = Math.max(0, (r.draftCooldown || 0) - dt);
  }
}
