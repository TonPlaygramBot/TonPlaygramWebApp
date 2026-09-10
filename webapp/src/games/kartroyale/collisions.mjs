// Equal-mass planar contact response, shared by browser and authoritative server.
// Damage uses closing velocity along the contact normal, never absolute speed.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const KART_RADIUS = 1.05;
export function damageRacer(r, amount) {
  if (!Number.isFinite(amount) || amount <= 0 || r.retired || r.finished)
    return 0;
  r.health = clamp(Number.isFinite(r.health) ? r.health : 100, 0, 100);
  if (r.shieldActive && r.shield > 0) {
    const absorbed = Math.min(r.shield, amount * .8);
    r.shield -= absorbed;
    amount -= absorbed;
  }
  const damage = Math.min(r.health, amount);
  r.health -= damage;
  r.hitFlash = Math.max(r.hitFlash || 0, Math.min(0.5, damage / 20));
  if (r.health <= 0) {
    r.retired = true;
    r.speed = 0;
    r.drifting = false;
  }
  return damage;
}
function velocity(r) {
  return {
    x: Math.sin(r.velocityYaw) * r.speed,
    z: Math.cos(r.velocityYaw) * r.speed
  };
}
function applyVelocity(r, x, z) {
  r.speed = Math.hypot(x, z);
  if (r.speed > 0.01) r.velocityYaw = Math.atan2(x, z);
}
function impact(r, normalSpeed, nx, nz) {
  // Feedback stays punchy, but ordinary racing contacts must not end a race.
  // One physical collision can span several contacts/steps: charge it once.
  if ((r.impactCooldown || 0) > 0) return;
  const damage = damageRacer(
    r,
    Math.min(14, Math.max(0, normalSpeed - 3.5) ** 2 * 0.018)
  );
  if (normalSpeed > 1.5) {
    r.impactId = (r.impactId || 0) + 1;
    r.impact = clamp(normalSpeed / 28, 0.08, 1);
    r.impactNx = nx;
    r.impactNz = nz;
    r.impactCooldown = 0.3;
    const front = Math.sin(r.yaw) * nx + Math.cos(r.yaw) * nz;
    const key =
      front > 0.35
        ? 'damageFront'
        : front < -0.35
          ? 'damageRear'
          : 'damageSide';
    r[key] = clamp((r[key] || 0) + damage, 0, 100);
  }
  r.collision = Math.max(r.collision || 0, 0.18);
}
export function resolveWallContact(r, near, width, dt, damage = true) {
  const limit = width * 0.5 - KART_RADIUS;
  if (near.distance <= limit) {
    r.wallContact = false;
    return;
  }
  const nx = (r.x - near.x) / Math.max(near.distance, 0.001);
  const nz = (r.z - near.z) / Math.max(near.distance, 0.001);
  r.x = near.x + nx * limit;
  r.z = near.z + nz * limit;
  const v = velocity(r),
    closing = v.x * nx + v.z * nz;
  if (closing > 0) {
    const tx = v.x - closing * nx,
      tz = v.z - closing * nz;
    // A glancing scrape retains tangential speed. Head-on hits rebound lightly.
    const restitution = r.wallContact ? 0 : 0.13;
    const friction = Math.max(0.84, 1 - closing * 0.003);
    applyVelocity(
      r,
      tx * friction - closing * restitution * nx,
      tz * friction - closing * restitution * nz
    );
    if (damage) {
      if (!r.wallContact) impact(r, closing, nx, nz);
      else damageRacer(r, Math.max(0, closing - 3.5) * 0.035 * dt);
    }
    r.yawRate += clamp(
      (Math.sin(r.yaw) * nz - Math.cos(r.yaw) * nx) * closing * 0.035,
      -0.8,
      0.8
    );
  }
  r.wallContact = true;
  if (r.retired) r.speed = 0;
}
export function resolveKartContact(a, b) {
  if (
    a.finished ||
    b.finished ||
    a.disconnected ||
    b.disconnected ||
    a.retired ||
    b.retired
  )
    return;
  let dx = b.x - a.x,
    dz = b.z - a.z,
    distance = Math.hypot(dx, dz);
  const diameter = KART_RADIUS * 2;
  if (distance >= diameter) return;
  let nx, nz;
  if (distance < 1e-6) {
    nx = a.slot <= b.slot ? 1 : -1;
    nz = 0;
    distance = 0;
  } else {
    nx = dx / distance;
    nz = dz / distance;
  }
  const correction = (diameter - distance + 0.002) * 0.5;
  a.x -= nx * correction;
  a.z -= nz * correction;
  b.x += nx * correction;
  b.z += nz * correction;
  const av = velocity(a),
    bv = velocity(b);
  const closing = (av.x - bv.x) * nx + (av.z - bv.z) * nz;
  if (closing <= 0) return; // Separating overlaps never cause phantom damage.
  const impulse = closing * 0.57;
  const tangent = clamp(
    ((av.x - bv.x) * -nz + (av.z - bv.z) * nx) * 0.1,
    -impulse * 0.22,
    impulse * 0.22
  );
  const ix = nx * impulse - nz * tangent,
    iz = nz * impulse + nx * tangent;
  applyVelocity(a, av.x - ix, av.z - iz);
  applyVelocity(b, bv.x + ix, bv.z + iz);
  impact(a, closing * 0.65, nx, nz);
  impact(b, closing * 0.65, -nx, -nz);
  a.yawRate -= tangent * 0.12;
  b.yawRate += tangent * 0.12;
  if (a.retired) a.speed = 0;
  if (b.retired) b.speed = 0;
}
