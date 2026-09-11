/** Deterministic arcade recovery shared with the server. Only an energetic side
 * contact can overturn; normal cornering cannot randomly flip a kart. */
export function beginRollover(r, closing, nx, nz) {
  const side = Math.cos(r.yaw) * nx - Math.sin(r.yaw) * nz;
  if (
    closing < 19 ||
    Math.abs(side) < 0.65 ||
    r.rollTime > 0 ||
    r.rollCooldown > 0 ||
    r.retired
  )
    return;
  r.rollTime = 2.2;
  r.rollDirection = side < 0 ? -1 : 1;
  r.rollCooldown = 4;
  r.drifting = false;
  r.driftCharge = 0;
  r.turbo = 0;
}
export function stepRollover(r, dt) {
  r.rollCooldown = Math.max(0, (r.rollCooldown || 0) - dt);
  if (!(r.rollTime > 0)) {
    r.rollAngle = 0;
    r.lift = 0;
    return false;
  }
  r.rollTime = Math.max(0, r.rollTime - dt);
  const t = 1 - r.rollTime / 2.2;
  // Tumble, rest briefly inverted, then recover. The server owns this timer.
  const angle =
    t < 0.35
      ? (Math.PI * t) / 0.35
      : t < 0.7
        ? Math.PI
        : Math.PI * (1 + (t - 0.7) / 0.3);
  r.rollAngle = r.rollTime ? angle * r.rollDirection : 0;
  r.lift = r.rollTime
    ? 0.88 * Math.abs(Math.sin(angle)) + 1.42 * Math.max(0, -Math.cos(angle))
    : 0;
  r.speed *= Math.exp(-dt * 3.5);
  r.x += Math.sin(r.velocityYaw) * r.speed * dt;
  r.z += Math.cos(r.velocityYaw) * r.speed * dt;
  r.acceleration = 0;
  r.yawRate = 0;
  r.drifting = false;
  return true;
}
