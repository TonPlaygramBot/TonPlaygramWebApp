import { clamp, side, type Seat, type Shot } from './engine.js';

type Sample = { x: number; y: number; time: number };
export type Swipe = { width: number; start: Sample; samples: Sample[] };
const WINDOW_MS = 120;
export const TAP_POWER = 0.1;

export function beginSwipe(
  x: number,
  y: number,
  time: number,
  width: number
): Swipe {
  const start = { x, y, time };
  return { width: Math.max(1, width), start, samples: [start] };
}

export function sampleSwipe(swipe: Swipe, x: number, y: number, time: number) {
  if (![x, y, time].every(Number.isFinite)) return;
  const samples = swipe.samples;
  const last = samples[samples.length - 1];
  if (time < last.time) return;
  if (time === last.time) samples[samples.length - 1] = { x, y, time };
  else samples.push({ x, y, time });
  // Retain one point before the window so sparse pointer events interpolate.
  while (samples.length > 2 && samples[1].time < time - WINDOW_MS)
    samples.shift();
}

/** Screen widths/second, independent of device pixel ratio and frame rate.
 * A stationary hold adds no power; a flick after a hold still uses its speed.
 */
export function readSwipe(
  swipe: Swipe,
  now = swipe.samples[swipe.samples.length - 1].time
) {
  const samples = swipe.samples;
  const last = samples[samples.length - 1];
  now = Math.max(last.time, now);
  const from = Math.max(samples[0].time, now - WINDOW_MS);
  let start = last;
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i],
      b = samples[i + 1];
    if (a.time <= from && b.time >= from) {
      const t = (from - a.time) / Math.max(1, b.time - a.time);
      start = {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        time: from
      };
      break;
    }
  }
  const distance = Math.hypot(last.x - start.x, last.y - start.y) / swipe.width;
  const speed =
    distance < 0.008 ? 0 : (distance * 1000) / Math.max(16, now - from);
  const power =
    TAP_POWER +
    (1 - TAP_POWER) * Math.pow(clamp((speed - 0.25) / 3.75, 0, 1), 0.8);
  const dx = last.x - start.x,
    dy = last.y - start.y;
  const length = Math.hypot(dx, dy);
  return {
    speed,
    power,
    dx: speed ? dx / length : 0,
    dy: speed ? dy / length : 0
  };
}

export function swipeShot(swipe: Swipe): Shot {
  const end = swipe.samples[swipe.samples.length - 1];
  const dy = (end.y - swipe.start.y) / swipe.width;
  // A long, slow upward gesture deliberately lobs; a fast upward flick drives topspin.
  if (dy < -0.27 && readSwipe(swipe).speed < 1.5) return 'lob';
  if (dy < -0.07) return 'topspin';
  if (dy > 0.07) return 'slice';
  return 'flat';
}

export function screenAim(fraction: number, seat: Seat) {
  return clamp((fraction - 0.5) * 2, -1, 1) * side(seat);
}
