import {
  beginSwipe,
  sampleSwipe,
  readSwipe,
  TAP_POWER,
  type SwipeGesture
} from '../../../../shared/tabletennis/swipe';
import type { Shot } from './engine';
type Finger = { x: number; y: number; startX: number; startY: number };
export type TouchResult = ReturnType<typeof readSwipe> & {
  kind: 'tap' | 'swipe' | 'menu';
  fingers: number;
  travelY: number;
};

/** One gesture commits once, after all fingers lift. Cancellation never hits. */
export class TableTouches {
  fingers = new Map<number, Finger>();
  primary = -1;
  count = 0;
  started = 0;
  width = 1;
  travel = 0;
  swipe: SwipeGesture | null = null;
  rejected = false;
  down(id: number, x: number, y: number, time: number, width: number) {
    if (this.fingers.has(id)) return;
    if (!this.fingers.size) {
      this.primary = id;
      this.started = time;
      this.width = width;
      this.count = 0;
      this.travel = 0;
      this.rejected = false;
      this.swipe = beginSwipe(x, y, time, width);
    }
    this.fingers.set(id, { x, y, startX: x, startY: y });
    this.count++;
    if (this.count > 2) this.rejected = true;
  }
  move(id: number, x: number, y: number, time: number) {
    const f = this.fingers.get(id);
    if (!f) return;
    f.x = x;
    f.y = y;
    this.travel = Math.max(this.travel, Math.hypot(x - f.startX, y - f.startY));
    if (id === this.primary && this.swipe) sampleSwipe(this.swipe, x, y, time);
  }
  read() {
    return this.swipe ? readSwipe(this.swipe) : null;
  }
  up(id: number, x: number, y: number, time: number): TouchResult | null {
    if (!this.fingers.has(id)) return null;
    this.move(id, x, y, time);
    this.fingers.delete(id);
    if (this.fingers.size || !this.swipe) return null;
    const stroke = readSwipe(this.swipe),
      last = this.swipe.samples.at(-1)!;
    const tap = this.travel < Math.max(9, this.width * 0.025);
    const result: TouchResult | null = this.rejected
      ? null
      : {
          ...stroke,
          ...(tap ? { power: TAP_POWER, speed: 0, dx: 0, dy: 0 } : {}),
          kind: this.count === 2 && tap ? 'menu' : tap ? 'tap' : 'swipe',
          fingers: this.count,
          travelY: last.y - this.swipe.start.y
        };
    this.clear();
    return result;
  }
  clear() {
    this.fingers.clear();
    this.swipe = null;
    this.primary = -1;
    this.count = 0;
    this.rejected = false;
  }
}
export function touchShot(stroke: TouchResult, highBall: boolean): Shot {
  if (stroke.kind === 'tap') return 'drive';
  if (stroke.fingers === 2) return 'backspin';
  if (highBall && stroke.power > 0.82) return 'smash';
  return stroke.speed > 1.5 ? 'topspin' : 'drive';
}
