export const FRAME_RATES = [50, 60, 75, 90, 120] as const;
export type TargetFps = typeof FRAME_RATES[number];
export function targetFps(value: unknown): TargetFps {
  return FRAME_RATES.includes(value as TargetFps) ? value as TargetFps : 60;
}

/** Bound the actual framebuffer, not texture quality or city visibility. This
 * avoids allocating multi-megapixel buffers on large/high-DPI displays. */
export function renderPixelRatio(width:number,height:number,deviceRatio:number,requestedRatio:number,pixels=2_000_000){
  const valid=(n:number,fallback:number)=>Number.isFinite(n)&&n>0?n:fallback;
  return Math.min(valid(deviceRatio,1),valid(requestedRatio,1),
    Math.sqrt(valid(pixels,2_000_000)/(valid(width,1)*valid(height,1))));
}

/** Render deadlines retain their remainder on 60/90/120 Hz displays. Physics
 * runs independently; late frames never cause a burst of catch-up renders. */
export class FramePacer {
  private deadline = 0;
  private rate = 0;
  shouldRender(now: number, fps: number) {
    if (fps !== this.rate) { this.rate = fps; this.deadline = now; }
    const interval = 1000 / fps;
    if (now + 0.1 < this.deadline) return false;
    this.deadline += Math.max(1, Math.floor((now - this.deadline + 0.1) / interval) + 1) * interval;
    return true;
  }
}

// Both city streams share one CPU allowance. Budget is spent only on generation,
// not on unrelated animation or rendering. Each stream gets at most half.
let remaining = 4;
let allowance = 4;
let frameQueues = new WeakSet<object>();
let frameRate = 60;
export function beginCityFrame(fps = 60) {
  frameRate = targetFps(fps);
  allowance = Math.min(4, 1000 / frameRate * 0.24);
  remaining = allowance;
  frameQueues = new WeakSet();
}
export function runCityWork(queue: {run(budget: number, maxSteps: number): void}, battery: boolean) {
  // Older scene/review hosts call streams directly. Seeing the same queue again
  // starts their next frame, so those consumers cannot exhaust a permanent pool.
  if (frameQueues.has(queue)) beginCityFrame(frameRate);
  frameQueues.add(queue);
  const budget = Math.min(remaining, allowance / 2, battery ? 1 : 2);
  if (budget <= 0) return;
  const started = performance.now();
  queue.run(budget, 600);
  remaining = Math.max(0, remaining - (performance.now() - started));
}

export const CITY_RADIUS = { battery: 2200, high: 3200 } as const;
export const CITY_CACHE = { battery: 320, high: 700 } as const;
