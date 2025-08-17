// Utility functions and class for drawing aim guides in 8 Pool Royale
// Implements dotted lines with fade-out and simple trajectory simulation
// respecting table boundaries and up to two bounces.

// Basic vector helpers
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

// Convert hex color to rgba string with given alpha
function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Draw dotted line with optional fade-out
export function drawDottedLine(ctx, start, end, color, dotSize = 3, gap = 8, fade = true) {
  const dir = sub(end, start);
  const len = length(dir);
  const step = gap;
  const unit = normalize(dir);
  const steps = Math.floor(len / step);

  for (let i = 0; i <= steps; i++) {
    const p = add(start, scale(unit, i * step));
    const alpha = fade ? 1 - i / steps : 1;
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

// Simulate a path within rectangular table boundaries with reflections
function simulatePath(start, direction, table, maxBounces = 2) {
  const points = [start];
  let pos = { ...start };
  let dir = normalize(direction);
  let bounces = 0;

  while (bounces < maxBounces) {
    const tX = dir.x > 0 ? (table.width - pos.x) / dir.x : (0 - pos.x) / dir.x;
    const tY = dir.y > 0 ? (table.height - pos.y) / dir.y : (0 - pos.y) / dir.y;
    let t = Math.min(tX, tY);
    if (!isFinite(t)) break;
    const end = add(pos, scale(dir, t));
    points.push(end);
    if (end.x <= 0 || end.x >= table.width) dir.x = -dir.x;
    if (end.y <= 0 || end.y >= table.height) dir.y = -dir.y;
    pos = end;
    bounces++;
  }

  return points;
}

// Main AimGuide class
export class AimGuide {
  constructor(ctx, table, options = {}) {
    this.ctx = ctx;
    this.table = table; // { width, height, ballRadius }
    this.options = options;
    this.lines = { aim: [], cue: [], object: [] };
    this.gap = 8;
    this.dotSize = options.dotSize || 3;
  }

  update({ cueBall, targetBall, power = 0, spin = { side: 0, top: 0 } }) {
    const R = this.table.ballRadius;
    const n = normalize(sub(targetBall, cueBall));
    const contact = add(cueBall, scale(n, 2 * R));
    const t = perp(n);

    // Scale gap with power (assumes power 0..1)
    this.gap = 6 + 4 * Math.min(Math.max(power, 0), 1);

    const cueDir = normalize({
      x: t.x + spin.side * 0.5,
      y: t.y + spin.top * 0.5,
    });

    this.lines.aim = [cueBall, contact];
    this.lines.cue = simulatePath(contact, cueDir, this.table, 2);
    this.lines.object = simulatePath(contact, n, this.table, 2);
  }

  draw() {
    const ctx = this.ctx;
    drawSegmented(ctx, this.lines.aim, '#ffffff', this.dotSize, this.gap);
    drawSegmented(ctx, this.lines.cue, '#ffffff', this.dotSize, this.gap);
    drawSegmented(ctx, this.lines.object, '#facc15', this.dotSize, this.gap);
  }
}

