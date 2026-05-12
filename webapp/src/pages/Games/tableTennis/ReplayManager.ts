import * as THREE from "three";
import type { BallStateName, PlayerSide, PointReason, ShotType } from "./gameConfig";

export type ReplayEvent =
  | { kind: "hit"; side: PlayerSide; shot: ShotType; t: number; pos: THREE.Vector3 }
  | { kind: "bounce"; side: PlayerSide; t: number; pos: THREE.Vector3 }
  | { kind: "score"; winner: PlayerSide; reason: PointReason; t: number; pos: THREE.Vector3 };

export type ReplayFrame = { pos: THREE.Vector3; vel: THREE.Vector3; spin: THREE.Vector3; state: BallStateName; t: number; events: ReplayEvent[] };

export class ReplayManager {
  private frames: ReplayFrame[] = [];
  private events: ReplayEvent[] = [];
  private cursor = 0;
  private replaying = false;
  private elapsed = 0;

  get isReplaying() { return this.replaying; }
  get banner() { return this.replaying ? "VAR Replay: slow motion review" : ""; }

  clear() { this.frames = []; this.events = []; this.cursor = 0; this.replaying = false; this.elapsed = 0; }

  recordFrame(pos: THREE.Vector3, vel: THREE.Vector3, spin: THREE.Vector3, state: BallStateName, t: number) {
    if (this.replaying) return;
    this.frames.push({ pos: pos.clone(), vel: vel.clone(), spin: spin.clone(), state, t, events: this.events.splice(0) });
    if (this.frames.length > 260) this.frames.shift();
  }

  recordHit(side: PlayerSide, shot: ShotType, pos: THREE.Vector3, t: number) { this.events.push({ kind: "hit", side, shot, pos: pos.clone(), t }); }
  recordBounce(side: PlayerSide, pos: THREE.Vector3, t: number) { this.events.push({ kind: "bounce", side, pos: pos.clone(), t }); }
  recordScore(winner: PlayerSide, reason: PointReason, pos: THREE.Vector3, t: number) { this.events.push({ kind: "score", winner, reason, pos: pos.clone(), t }); }

  startSlowMotion(seconds = 1.2) {
    if (this.frames.length < 2) return;
    this.cursor = Math.max(0, this.frames.length - 1);
    this.elapsed = seconds;
    this.replaying = true;
  }

  update(dt: number): ReplayFrame | null {
    if (!this.replaying) return null;
    this.elapsed -= dt;
    this.cursor = Math.max(0, this.cursor - 1);
    if (this.elapsed <= 0 || this.cursor <= 0) this.replaying = false;
    return this.frames[this.cursor] ?? null;
  }
}
