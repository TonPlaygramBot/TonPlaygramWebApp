export type GameplayFrameSample = {
  fps: number; p95: number; longestMs: number; samples: number;
};
export class GameplayFrameStats {
  suspend(): void;
  record(now: number, active: boolean): GameplayFrameSample | null;
}
