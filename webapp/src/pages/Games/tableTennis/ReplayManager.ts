import * as THREE from "three";
import { gameConfig } from "./gameConfig";
import type { BallData, PhysicsEvent } from "./BallPhysics";

export type ReplayFrame = { position: THREE.Vector3; velocity: THREE.Vector3; spin: THREE.Vector3; events: PhysicsEvent[] };

export class ReplayManager {
  private frames: ReplayFrame[] = [];
  private index = 0;
  private timeLeft = 0;
  readonly label = "VAR Replay: slow motion review";

  get active() {
    return this.timeLeft > 0;
  }

  record(ball: BallData, events: PhysicsEvent[] = []) {
    if (this.active) return;
    this.frames.push({ position: ball.position.clone(), velocity: ball.velocity.clone(), spin: ball.spin.clone(), events });
    if (this.frames.length > gameConfig.replay.maxFrames) this.frames.shift();
  }

  recordEvent(ball: BallData, event: PhysicsEvent) {
    this.record(ball, [event]);
  }

  start() {
    this.timeLeft = gameConfig.replay.seconds;
    this.index = Math.max(0, this.frames.length - 1);
  }

  update(dt: number, ball: BallData) {
    if (!this.active || this.frames.length === 0) return false;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    this.index = Math.max(0, this.index - 1);
    const frame = this.frames[this.index];
    ball.position.copy(frame.position);
    ball.velocity.copy(frame.velocity);
    ball.spin.copy(frame.spin);
    return true;
  }
}
