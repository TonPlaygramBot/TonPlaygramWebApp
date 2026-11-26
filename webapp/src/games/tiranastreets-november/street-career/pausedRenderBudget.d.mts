export const PAUSED_SETTLE_MS: number;
export const PAUSED_SETTLE_FPS: number;
export const PAUSED_IDLE_FPS: number;
export class PausedRenderBudget {
  invalidate(now: number): void;
  rate(now: number, width: number, height: number): number;
}
