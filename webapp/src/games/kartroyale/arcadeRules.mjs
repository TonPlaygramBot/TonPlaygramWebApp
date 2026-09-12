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
  const sections = clamp(Math.ceil(track.length / 85), 12, 36);
  for (let i = 0; i < sections; i++) {
    // Distribute across the entire route, leaving a braking approach to turns.
    for (let attempt = 0; attempt < 12; attempt++) {
      const p = sampleCircuitDistance(track, track.length * ((i + .15 + attempt * .065) / sections));
      if (cornerSpeedLimit(track, p, 65) < 32) continue;
      if (result.some(other => Math.hypot(other.x-p.x, other.z-p.z) < 28)) continue;
      result.push({ ...p, id: i, length: 6, width: Math.min(4.8, (track.points[p.index].width ?? track.width) * .62) });
      break;
    }
  }
  pads.set(track, result);
  return result;
}
export function stepBoostPads(r, track, time, previousX = r.x, previousZ = r.z) {
  if (r.speed < 2 || r.finished || r.retired || r.disconnected) return;
  for (const pad of boostPads(track)) {
    const dx = r.x - pad.x, dz = r.z - pad.z;
    const along = dx * Math.sin(pad.yaw) + dz * Math.cos(pad.yaw);
    const across = dx * Math.cos(pad.yaw) - dz * Math.sin(pad.yaw);
    const cooldown = r.padCooldowns?.[pad.id] || 0;
    if (time < cooldown || Math.cos(r.velocityYaw - pad.yaw) < .55) continue;
    const oldX = previousX - pad.x, oldZ = previousZ - pad.z;
    const oldAlong = oldX * Math.sin(pad.yaw) + oldZ * Math.cos(pad.yaw);
    const oldAcross = oldX * Math.cos(pad.yaw) - oldZ * Math.sin(pad.yaw);
    // Sweep the travel segment through the pad rectangle, including a long
    // fixed step on slower phones. A parallel near miss must remain a miss.
    let enter = 0, exit = 1;
    for (const [from,to,half] of [[oldAlong,along,pad.length/2],[oldAcross,across,pad.width/2]]) {
      const delta = to-from;
      if (Math.abs(delta)<1e-8) { if (Math.abs(from)>half) exit=-1; }
      else { const a=(-half-from)/delta,b=(half-from)/delta; enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b)); }
    }
    if (enter>exit) continue;
    r.padCooldowns ||= {};
    r.padCooldowns[pad.id] = time + 8;
    r.turbo = Math.max(r.turbo, 1.15);
    r.boost = Math.min(100, r.boost + 24);
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
