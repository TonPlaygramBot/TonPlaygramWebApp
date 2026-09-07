import {
  BALL_RADIUS,
  GRAVITY,
  groundTime,
  bounceVelocity,
  type Impact
} from './court.js';

export type MovingBall = Impact & {
  spin: number;
  bounces: number;
  serve: boolean;
  netTouch: boolean;
};
type Contacts = {
  bounce?: (
    impact: Impact,
    rebound: ReturnType<typeof bounceVelocity>,
    elapsed: number,
    first: boolean
  ) => boolean | void;
  net?: (letCandidate: boolean) => boolean | void;
};
const REST_SPEED = 0.28;

export function ballAtRest(b: MovingBall) {
  return (
    b.y <= BALL_RADIUS + 1e-7 && b.vy === 0 && Math.hypot(b.vx, b.vz) === 0
  );
}

function fly(b: MovingBall, dt: number) {
  b.x += b.vx * dt;
  b.z += b.vz * dt;
  b.y += b.vy * dt - (GRAVITY * dt * dt) / 2;
  b.vy -= GRAVITY * dt;
}

function roll(b: MovingBall, dt: number, surface: string) {
  const drag = surface === 'clay' ? 3.6 : surface === 'grass' ? 2.8 : 2.2;
  const decay = Math.exp(-drag * dt),
    distance = (1 - decay) / drag;
  b.x += b.vx * distance;
  b.z += b.vz * distance;
  b.vx *= decay;
  b.vz *= decay;
  b.y = BALL_RADIUS;
  b.vy = 0;
  if (Math.hypot(b.vx, b.vz) < 0.08) b.vx = b.vz = 0;
}

/** The ball keeps obeying physics after the score is decided. Callbacks only
 * adjudicate contacts; returning false pauses at contact for a line review. */
export function advanceBall(
  b: MovingBall,
  seconds: number,
  surface: string,
  contacts: Contacts = {}
) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  let remaining = Math.min(seconds, 1 / 30),
    elapsed = 0;
  // Repeated low bounces can occur within one fixed step. Settle them into
  // rolling contact instead of letting the remainder push the ball underground.
  for (let collision = 0; remaining > 1e-9 && collision < 8; collision++) {
    if (b.bounces > 0 && b.y <= BALL_RADIUS + 1e-7 && b.vy === 0) {
      roll(b, remaining, surface);
      return;
    }
    const floor = groundTime(b);
    const net = b.vz === 0 ? Infinity : -b.z / b.vz;
    const travel = Math.min(remaining, floor);
    if (net > 1e-9 && net <= travel) {
      const x = b.x + b.vx * net;
      const y = b.y + b.vy * net - (GRAVITY * net * net) / 2;
      if (Math.abs(x) < 5.6 && y < 0.98 + BALL_RADIUS) {
        fly(b, net);
        elapsed += net;
        remaining -= net;
        const letCandidate = b.serve && b.bounces === 0 && y > 0.86;
        if (letCandidate) {
          b.netTouch = true;
          b.z = Math.sign(b.vz) * 0.002;
          b.vz *= 0.82;
          b.vy = Math.max(b.vy, 1.5);
        } else {
          b.z = -Math.sign(b.vz) * (BALL_RADIUS + 0.002);
          b.vx *= 0.55;
          b.vz *= -0.12;
          b.vy = Math.min(b.vy, 0) * 0.35;
        }
        if (contacts.net?.(letCandidate) === false) return;
        continue;
      }
    }
    fly(b, travel);
    remaining -= travel;
    elapsed += travel;
    if (floor > travel + 1e-9) return;
    b.y = BALL_RADIUS;
    const impact: Impact = {
      x: b.x,
      y: b.y,
      z: b.z,
      vx: b.vx,
      vy: b.vy,
      vz: b.vz
    };
    const rebound = bounceVelocity(impact, surface, b.spin),
      first = b.bounces === 0;
    if (rebound.vy < REST_SPEED) rebound.vy = 0;
    b.bounces++;
    Object.assign(b, rebound);
    if (contacts.bounce?.(impact, rebound, elapsed, first) === false) return;
  }
}
