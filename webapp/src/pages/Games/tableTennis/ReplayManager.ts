import * as THREE from "three";

export type ReplayEventType = "paddleHit" | "tableBounce" | "netHit" | "score";
export type ReplayFrame = { pos: THREE.Vector3; vel: THREE.Vector3; spin: THREE.Vector3; events: ReplayEventType[] };

export class ReplayManager {
  private frames: ReplayFrame[] = [];
  private index = 0;
  private replayT = 0;
  private pendingEvents: ReplayEventType[] = [];

  get isReplaying() { return this.replayT > 0; }
  get inputDisabled() { return this.isReplaying; }
  get statusText() { return this.isReplaying ? "VAR Replay: slow motion review" : ""; }

  recordEvent(type: ReplayEventType) { this.pendingEvents.push(type); }

  record(pos: THREE.Vector3, vel: THREE.Vector3, spin: THREE.Vector3) {
    this.frames.push({ pos: pos.clone(), vel: vel.clone(), spin: spin.clone(), events: this.pendingEvents.splice(0) });
    if (this.frames.length > 260) this.frames.shift();
  }

  start(duration = 1.2) {
    this.replayT = duration;
    this.index = Math.max(0, this.frames.length - 1);
  }

  update(dt: number) {
    if (!this.isReplaying || this.frames.length === 0) return null;
    this.replayT = Math.max(0, this.replayT - dt);
    this.index = Math.max(0, this.index - 1);
    return this.frames[this.index] ?? null;
  }
}
