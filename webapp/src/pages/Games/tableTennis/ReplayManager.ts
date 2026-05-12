import * as THREE from "three";

export type ReplayEvent = "position" | "paddleHit" | "bounce" | "net" | "score";
export type ReplayFrame = { pos: THREE.Vector3; vel: THREE.Vector3; spin: THREE.Vector3; event?: ReplayEvent; label?: string };

export class ReplayManager {
  private frames: ReplayFrame[] = [];
  private replayIndex = 0;
  private replayTime = 0;
  constructor(private readonly maxFrames = 260) {}
  get isReplaying() { return this.replayTime > 0; }
  get statusLabel() { return this.isReplaying ? "VAR Replay: slow motion review" : ""; }
  record(pos: THREE.Vector3, vel: THREE.Vector3, spin: THREE.Vector3, event: ReplayEvent = "position", label?: string) {
    if (this.isReplaying) return;
    this.frames.push({ pos: pos.clone(), vel: vel.clone(), spin: spin.clone(), event, label });
    if (this.frames.length > this.maxFrames) this.frames.shift();
  }
  start(seconds = 1.2) {
    this.replayTime = seconds;
    this.replayIndex = Math.max(0, this.frames.length - 1);
  }
  sample(dt: number) {
    if (!this.isReplaying || this.frames.length === 0) return null;
    this.replayTime = Math.max(0, this.replayTime - dt);
    this.replayIndex = Math.max(0, this.replayIndex - 1);
    return this.frames[this.replayIndex] ?? null;
  }
  clear() { this.frames = []; this.replayIndex = 0; this.replayTime = 0; }
}
