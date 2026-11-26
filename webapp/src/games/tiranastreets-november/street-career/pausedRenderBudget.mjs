export const PAUSED_SETTLE_MS = 1500;
export const PAUSED_SETTLE_FPS = 15;
export const PAUSED_IDLE_FPS = 3;

/** Keep paused camera/settings/resize changes responsive, then retain a low
 * heartbeat for late streamed assets without treating a menu as gameplay. */
export class PausedRenderBudget {
  #settleUntil = -Infinity;
  #width;
  #height;
  invalidate(now) { this.#settleUntil = now + PAUSED_SETTLE_MS; }
  rate(now, width, height) {
    if (width !== this.#width || height !== this.#height) {
      this.#width = width;
      this.#height = height;
      this.invalidate(now);
    }
    return now < this.#settleUntil ? PAUSED_SETTLE_FPS : PAUSED_IDLE_FPS;
  }
}
