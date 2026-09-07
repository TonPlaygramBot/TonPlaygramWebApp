// Cosmetic crowd projectiles. They never mutate racer health, input or standings.
export const GRAVITY = 9.81;
export const FOOD_LIFETIME = 2.4;
export const randomUnit = (seed) => {
  let n = Math.imul(seed | 0, 1597334677) ^ 3812015801;
  n = Math.imul(n ^ (n >>> 16), 2246822507);
  return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
};
export function launchFood(origin, racer, kind, seed = 1) {
  const distance = Math.hypot(racer.x - origin.x, racer.z - origin.z);
  const flight = Math.max(0.48, Math.min(0.85, distance / 30));
  const scatter = (randomUnit(seed) - 0.5) * 2.6;
  const aim = {
    x:
      racer.x +
      Math.sin(racer.velocityYaw) * racer.speed * flight +
      Math.cos(racer.yaw) * scatter,
    z:
      racer.z +
      Math.cos(racer.velocityYaw) * racer.speed * flight -
      Math.sin(racer.yaw) * scatter
  };
  return {
    kind,
    seed,
    age: 0,
    x: origin.x,
    y: origin.y,
    z: origin.z,
    vx: (aim.x - origin.x) / flight,
    vy: (0.9 - origin.y + 0.5 * GRAVITY * flight * flight) / flight,
    vz: (aim.z - origin.z) / flight
  };
}
export function stepFood(p, dt) {
  p.x += p.vx * dt;
  p.y += p.vy * dt - 0.5 * GRAVITY * dt * dt;
  p.z += p.vz * dt;
  p.vy -= GRAVITY * dt;
  p.age += dt;
}
/** Moving sphere against swept moving kart volume: fast shots cannot tunnel. */
export function foodHit(from, to, previousKart, kart) {
  const ax = from.x - previousKart.x,
    az = from.z - previousKart.z;
  const dx = to.x - kart.x - ax,
    dz = to.z - kart.z - az;
  const denom = dx * dx + dz * dz;
  const t =
    denom > 1e-8 ? Math.max(0, Math.min(1, -(ax * dx + az * dz) / denom)) : 0;
  const y = from.y + (to.y - from.y) * t;
  if (y < 0.15 || y > 1.55 || Math.hypot(ax + dx * t, az + dz * t) > 1.12)
    return null;
  return {
    x: from.x + (to.x - from.x) * t,
    y,
    z: from.z + (to.z - from.z) * t
  };
}
