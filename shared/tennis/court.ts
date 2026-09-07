// Court dimensions are measured to the outside edge of the painted lines.
export const HALF_WIDTH = 4.115;
export const HALF_LENGTH = 11.885;
export const SERVICE = 6.4;
export const CENTRE_LINE_HALF = 0.025;
export const GRAVITY = 14;
// The live ball is enlarged for phone visibility. Calls use its physical footprint.
export const BALL_RADIUS = 0.12;
export const CONTACT_RADIUS = 0.0335;
export const REVIEW_SECONDS = 4.4;
export type LineCall = {
  x: number;
  z: number;
  in: boolean;
  margin: number;
  close: boolean;
  line: 'Sideline' | 'Baseline' | 'Service line' | 'Centre service line';
  a: { x: number; z: number };
  b: { x: number; z: number };
};
export type Impact = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};
export type CloseCall = {
  call: LineCall;
  impact: Impact;
  rebound: { vx: number; vy: number; vz: number };
  players: { x: number; z: number }[];
  flightTime: number;
};
export type Review = CloseCall & { id: number; startedAt: number };

/** Circle/rectangle contact, including corners. Any contact with a line is in. */
export function lineCall(
  x: number,
  z: number,
  hitter: 0 | 1,
  serve = false,
  serverX = 0
): LineCall {
  const sign = hitter === 0 ? 1 : -1;
  const loX = serve && serverX < 0 ? -CENTRE_LINE_HALF : -HALF_WIDTH;
  const hiX = serve && serverX >= 0 ? CENTRE_LINE_HALF : HALF_WIDTH;
  const length = serve ? SERVICE : HALF_LENGTH;
  const loZ = sign > 0 ? -length : 0,
    hiZ = sign > 0 ? 0 : length;
  const edges = [
    {
      gap: x - loX,
      line: (loX === -HALF_WIDTH
        ? 'Sideline'
        : 'Centre service line') as LineCall['line'],
      a: { x: loX, z: loZ },
      b: { x: loX, z: hiZ }
    },
    {
      gap: hiX - x,
      line: (hiX === HALF_WIDTH
        ? 'Sideline'
        : 'Centre service line') as LineCall['line'],
      a: { x: hiX, z: loZ },
      b: { x: hiX, z: hiZ }
    },
    {
      gap: sign > 0 ? z - loZ : hiZ - z,
      line: (serve ? 'Service line' : 'Baseline') as LineCall['line'],
      a: { x: loX, z: -sign * length },
      b: { x: hiX, z: -sign * length }
    }
  ];
  const nearest = edges.reduce((a, b) => (a.gap < b.gap ? a : b));
  const outside = Math.hypot(
    Math.max(loX - x, 0, x - hiX),
    Math.max(loZ - z, 0, z - hiZ)
  );
  const signed =
    outside > 0 ? -outside : Math.min(x - loX, hiX - x, z - loZ, hiZ - z);
  const margin = signed + CONTACT_RADIUS;
  const correctHalf = z * sign < 0;
  return {
    x,
    z,
    in: correctHalf && margin >= -1e-9,
    margin,
    close: correctHalf && Math.abs(margin) <= 0.18 && Math.abs(z) > 0.2,
    line: nearest.line,
    a: nearest.a,
    b: nearest.b
  };
}

export function groundTime(b: Pick<Impact, 'y' | 'vy'>) {
  return (
    (b.vy +
      Math.sqrt(b.vy * b.vy + 2 * GRAVITY * Math.max(0, b.y - BALL_RADIUS))) /
    GRAVITY
  );
}
export function bounceVelocity(b: Impact, surface: string, spin: number) {
  return {
    vx: b.vx * 0.85,
    vz: b.vz * (surface === 'clay' ? 0.73 : 0.85),
    vy:
      Math.abs(b.vy) *
      (surface === 'clay' ? 0.72 : surface === 'grass' ? 0.58 : 0.66) *
      (1 + spin * 0.12)
  };
}
export function reviewActive(s: { time: number; review: Review | null }) {
  return !!s.review && s.time < s.review.startedAt + REVIEW_SECONDS;
}
/** Analytic replay of the recorded final approach and physical rebound. */
export function reviewBall(r: CloseCall, timeFromImpact: number): Impact {
  const t = Math.max(-r.flightTime, timeFromImpact),
    v = t <= 0 ? r.impact : r.rebound;
  return {
    x: r.impact.x + v.vx * t,
    z: r.impact.z + v.vz * t,
    y: Math.max(BALL_RADIUS, BALL_RADIUS + v.vy * t - (GRAVITY * t * t) / 2),
    vx: v.vx,
    vy: v.vy - GRAVITY * t,
    vz: v.vz
  };
}
