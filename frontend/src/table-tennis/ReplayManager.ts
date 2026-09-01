import * as THREE from 'three';
import { BallStateName } from './BallPhysics';
import { ShotType, Side } from './gameConfig';

export type ReplayEvent =
  | { type: 'ball'; time: number; position: THREE.Vector3; state: BallStateName }
  | { type: 'hit'; time: number; side: Side; shotType: ShotType; position: THREE.Vector3 }
  | { type: 'bounce'; time: number; side?: Side; position: THREE.Vector3 }
  | { type: 'score'; time: number; winner: Side; score: { player: number; ai: number }; reason: string };

export class ReplayManager {
  events: ReplayEvent[] = [];
  isReplaying = false;
  private replayTime = 0;
  private duration = 0;

  startRecording() {
    this.events = [];
    this.isReplaying = false;
    this.replayTime = 0;
    this.duration = 0;
  }

  recordBall(time: number, position: THREE.Vector3, state: BallStateName) {
    if (this.isReplaying) return;
    this.events.push({ type: 'ball', time, position: position.clone(), state });
    this.duration = Math.max(this.duration, time);
  }

  recordHit(time: number, side: Side, shotType: ShotType, position: THREE.Vector3) {
    this.events.push({ type: 'hit', time, side, shotType, position: position.clone() });
  }

  recordBounce(time: number, side: Side | undefined, position: THREE.Vector3) {
    this.events.push({ type: 'bounce', time, side, position: position.clone() });
  }

  recordScore(time: number, winner: Side, score: { player: number; ai: number }, reason: string) {
    this.events.push({ type: 'score', time, winner, score: { ...score }, reason });
  }

  beginReplay() {
    if (this.events.length < 2) return false;
    this.isReplaying = true;
    this.replayTime = 0;
    return true;
  }

  update(dt: number) {
    if (!this.isReplaying) return null;
    this.replayTime += dt * 0.42;
    if (this.replayTime >= this.duration) {
      this.isReplaying = false;
      return null;
    }
    return this.sampleBall(this.replayTime);
  }

  private sampleBall(time: number) {
    const balls = this.events.filter((event): event is Extract<ReplayEvent, { type: 'ball' }> => event.type === 'ball');
    let prev = balls[0];
    let next = balls[balls.length - 1];
    for (let i = 1; i < balls.length; i += 1) {
      if (balls[i].time >= time) {
        next = balls[i];
        prev = balls[i - 1];
        break;
      }
    }
    const t = next.time === prev.time ? 0 : (time - prev.time) / (next.time - prev.time);
    return prev.position.clone().lerp(next.position, THREE.MathUtils.clamp(t, 0, 1));
  }
}
