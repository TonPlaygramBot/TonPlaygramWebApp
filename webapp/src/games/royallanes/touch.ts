import type { Shot } from './types';
export type TouchPoint = { x: number; y: number; t: number };
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
/** Coordinates are CSS screen pixels: right stays right, up is a forward throw. */
export function resolveGesture(
  points: TouchPoint[],
  width: number,
  height: number,
  aim: number
):
  | { kind: 'aim'; aim: number }
  | { kind: 'roll'; shot: Shot }
  | { kind: 'cancel' } {
  if (
    points.length < 2 ||
    !Number.isFinite(aim) ||
    ![width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    points.some((p) => ![p.x, p.y, p.t].every(Number.isFinite))
  )
    return { kind: 'cancel' };
  const first = points[0],
    last = points.at(-1)!;
  const dx = last.x - first.x,
    up = first.y - last.y;
  if (up < Math.max(45, height * 0.075) || up < Math.abs(dx) * 0.75)
    return Math.abs(dx) > 8
      ? { kind: 'aim', aim: clamp(aim + (dx / width) * 1.9, -1.2, 1.2) }
      : { kind: 'cancel' };
  const mid =
    points.find((p) => first.y - p.y >= up * 0.6) ??
    points[Math.floor(points.length / 2)];
  const midUp = first.y - mid.y;
  const projected = midUp > 10 ? ((mid.x - first.x) * up) / midUp : dx;
  const curve = dx - projected;
  // Use the recent release stroke, excluding time spent holding before the swipe.
  const cutoff = last.t - 140;
  let tail = first;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (b.t >= cutoff) {
      const blend = clamp((cutoff - a.t) / Math.max(1, b.t - a.t), 0, 1);
      tail = {
        x: a.x + (b.x - a.x) * blend,
        y: a.y + (b.y - a.y) * blend,
        t: a.t + (b.t - a.t) * blend
      };
      break;
    }
  }
  const speed = Math.max(0, tail.y - last.y) / Math.max(32, last.t - tail.t);
  return {
    kind: 'roll',
    shot: {
      aim: clamp(
        aim + ((mid.x - first.x) / Math.max(80, midUp)) * 0.22,
        -1.2,
        1.2
      ),
      hook: clamp(curve / (width * 0.16), -1, 1),
      power: clamp(42 + (up / height) * 62 + speed * 15, 35, 100)
    }
  };
}
export class BowlingTouch {
  private points: TouchPoint[] = [];
  private aim = 0;
  private originAim = 0;
  private primary: number | null = null;
  private fingers = new Set<number>();
  private multi = false;
  private startAt = 0;
  private beganReady = false;
  constructor(
    private element: HTMLElement,
    private callbacks: {
      ready: () => boolean;
      onAim: (v: number) => void;
      onRoll: (s: Shot) => void;
      onPause: () => void;
      onTap: () => void;
      onInteraction: () => void;
    }
  ) {
    element.addEventListener('pointerdown', this.down);
    element.addEventListener('pointermove', this.move);
    element.addEventListener('pointerup', this.up);
    element.addEventListener('pointercancel', this.cancel);
    element.addEventListener('lostpointercapture', this.lost);
  }
  setAim(value: number) {
    this.aim = value;
  }
  private down = (e: PointerEvent) => {
    this.callbacks.onInteraction();
    this.fingers.add(e.pointerId);
    this.element.setPointerCapture(e.pointerId);
    if (this.fingers.size > 1) {
      this.multi = true;
      this.points = [];
      return;
    }
    this.beganReady = this.callbacks.ready();
    this.primary = e.pointerId;
    this.originAim = this.aim;
    this.startAt = performance.now();
    this.points = [{ x: e.clientX, y: e.clientY, t: this.startAt }];
  };
  private move = (e: PointerEvent) => {
    if (
      this.primary !== e.pointerId ||
      this.multi ||
      !this.beganReady ||
      !this.callbacks.ready()
    )
      return;
    this.points.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (this.points.length > 100) this.points.splice(1, 1);
    const a = this.points[0];
    if (Math.abs(a.y - e.clientY) < 25)
      this.callbacks.onAim(
        clamp(
          this.originAim + ((e.clientX - a.x) / this.element.clientWidth) * 1.9,
          -1.2,
          1.2
        )
      );
  };
  private up = (e: PointerEvent) => {
    this.fingers.delete(e.pointerId);
    if (this.multi) {
      if (!this.fingers.size) {
        this.multi = false;
        this.primary = null;
        this.points = [];
        if (performance.now() - this.startAt < 500) this.callbacks.onPause();
      }
      return;
    }
    if (this.primary !== e.pointerId) return;
    this.points.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    const points = this.points;
    this.primary = null;
    this.points = [];
    if (!this.callbacks.ready() || !this.beganReady) {
      if (performance.now() - this.startAt < 500) this.callbacks.onTap();
      return;
    }
    const result = resolveGesture(
      points,
      this.element.clientWidth,
      this.element.clientHeight,
      this.originAim
    );
    if (result.kind === 'aim') {
      this.aim = result.aim;
      this.callbacks.onAim(result.aim);
    } else if (result.kind === 'roll') {
      this.aim = result.shot.aim;
      this.callbacks.onRoll(result.shot);
    }
  };
  private cancel = (e: PointerEvent) => {
    this.fingers.delete(e.pointerId);
    this.primary = null;
    this.points = [];
    if (!this.fingers.size) this.multi = false;
  };
  private lost = (e: PointerEvent) => {
    if (this.fingers.has(e.pointerId)) this.cancel(e);
  };
  dispose() {
    this.element.removeEventListener('pointerdown', this.down);
    this.element.removeEventListener('pointermove', this.move);
    this.element.removeEventListener('pointerup', this.up);
    this.element.removeEventListener('pointercancel', this.cancel);
    this.element.removeEventListener('lostpointercapture', this.lost);
    this.fingers.clear();
  }
}
