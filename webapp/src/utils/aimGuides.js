// Advanced aim guide calculations for 8 Pool Royale
// Implements dotted guide lines for cue and object balls taking into account
// power, spin and simple reflections on a rectangular table with pockets.

// ---------------- Vector helpers ----------------
function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function scale(a, s) {
  return { x: a.x * s, y: a.y * s };
}

function length(a) {
  return Math.hypot(a.x, a.y);
}

function normalize(a) {
  const len = length(a);
  return len === 0 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len };
}

function perp(a) {
  return { x: -a.y, y: a.x };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function rotate(v, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// simple ease-out curve (quadratic)
function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

// Convert hex color to rgba string with given alpha
function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------------- Drawing helpers ----------------
export function drawDottedLine(ctx, start, end, color, dotSize, gap) {
  const dir = sub(end, start);
  const len = length(dir);
  const unit = normalize(dir);
  const steps = Math.floor(len / gap);

  for (let i = 0; i <= steps; i++) {
    const p = add(start, scale(unit, i * gap));
    const alpha = 1 - i / steps;
    ctx.fillStyle = hexToRgba(color, alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, dotSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSegmented(ctx, points, color, dotSize, gap) {
  for (let i = 0; i < points.length - 1; i++) {
    drawDottedLine(ctx, points[i], points[i + 1], color, dotSize, gap);
  }
}

// -------------- Physics helpers --------------
// Ray-circle intersection, returns distance t or Infinity
function rayCircle(pos, dir, center, radius) {
  const oc = sub(pos, center);
  const b = 2 * dot(oc, dir);
  const c = dot(oc, oc) - radius * radius;
  const disc = b * b - 4 * c; // dir normalized -> a=1
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / 2;
  return t >= 0 ? t : Infinity;
}

// Cast path within rectangular table with pockets and reflections
function castPath(start, direction, table, maxBounces, maxLength) {
  const points = [start];
  let pos = { ...start };
  let dir = normalize(direction);
  let remaining = maxLength;
  let bounces = 0;

  while (remaining > 0 && bounces <= maxBounces) {
    const tX = dir.x > 0 ? (table.width - pos.x) / dir.x : (0 - pos.x) / dir.x;
    const tY = dir.y > 0 ? (table.height - pos.y) / dir.y : (0 - pos.y) / dir.y;
    let t = Math.min(tX, tY);
    let hitWall = t === tX ? 'x' : 'y';

    // check pockets along the ray
    if (Array.isArray(table.pockets)) {
      for (const p of table.pockets) {
        const d = rayCircle(pos, dir, p, p.captureRadius || p.r || 0);
        if (d < t) {
          t = d;
          hitWall = 'pocket';
          break;
        }
      }
    }

    if (t > remaining) {
      points.push(add(pos, scale(dir, remaining)));
      break;
    }

    pos = add(pos, scale(dir, t));
    points.push(pos);
    remaining -= t;

    if (hitWall === 'pocket') break;

    if (hitWall === 'x') dir.x = -dir.x;
    else if (hitWall === 'y') dir.y = -dir.y;
    bounces++;
  }

  return points;
}

// -------------- AimGuide main class --------------
export class AimGuide {
  constructor(ctx, table, options = {}) {
    this.ctx = ctx;
    this.table = table; // { width, height, ballRadius, pockets? }
    this.options = options;
    this.lines = { pre: [], cue: [], object: [] };
    this.step = 8;
    this.dotSize = 2;
    this.maxBounces = options.maxBounces ?? 2;
  }

  update({ cueBall, targetBall, power = 0, spin = { side: 0, top: 0 } }) {
    const R = this.table.ballRadius;
    const u = normalize(sub(targetBall, cueBall));
    const P = sub(targetBall, scale(u, R));
    const G = sub(targetBall, scale(u, 2 * R));

    // visual parameters
    this.step = 8 + 6 * clamp(power, 0, 1);
    this.dotSize = 2 + 1 * clamp(power, 0, 1);
    const pf = Math.max(this.table.width, this.table.height);
    const Lmin = pf * 0.35;
    const Lmax = pf * 0.9;
    const lineLen = Lmin + (Lmax - Lmin) * easeOut(clamp(power, 0, 1));

    // object ball path (with throw from side spin)
    const thetaThrow = (Math.PI / 180) *
      (0.5 + 1.5 * (1 - power)) * clamp(spin.side, -1, 1) * (this.options.kThrow ?? 1);
    const uObj = rotate(u, thetaThrow);
    const objPath = castPath(P, uObj, this.table, this.maxBounces, lineLen);

    // cue ball direction after impact
    const t = perp(u);
    const alpha = 1 - 0.55 * Math.abs(spin.top);
    const beta = 0.65 * spin.top;
    let dCue = normalize(add(scale(t, alpha), scale(u, beta)));
    const phiSwerve = (Math.PI / 180) *
      (0.3 + 2.0 * (1 - power)) * clamp(spin.side, -1, 1) * (this.options.kSwerve ?? 1);
    dCue = rotate(dCue, phiSwerve);
    const cuePath = castPath(P, dCue, this.table, this.maxBounces, lineLen);

    this.lines = {
      pre: [cueBall, P],
      cue: cuePath,
      object: objPath,
      ghost: { center: G, r: R },
    };
  }

  draw() {
    const ctx = this.ctx;
    drawSegmented(ctx, this.lines.pre, '#ffffff', this.dotSize, this.step);
    drawSegmented(ctx, this.lines.cue, '#ffffff', this.dotSize, this.step);
    drawSegmented(ctx, this.lines.object, '#facc15', this.dotSize, this.step);
  }
}

