import * as THREE from "three";
import { BALL_SURFACE_Y, clamp, lerp, PlayerSide, TABLE_HALF_L, TABLE_HALF_W, TT } from "./gameConfig";
import type { BallPhysics } from "./BallPhysics";
import type { ShotType } from "./gameConfig";

export type AiDifficulty = typeof TT.ai;
export type AiDecision = { shouldSwing: boolean; shot: ShotType; target: THREE.Vector3; power: number; topSpin: number; sideSpin: number; label: string };

export class AIController {
  private reactionClock = 0;
  private reactedToRally = false;

  constructor(private difficulty: AiDifficulty = TT.ai) {}

  reset() { this.reactionClock = 0; this.reactedToRally = false; }

  updateTarget(dt: number, physics: BallPhysics, aiPos: THREE.Vector3, target: THREE.Vector3) {
    const incoming = physics.state.lastHitBy === "near" && physics.state.vel.z < 0;
    if (!incoming) {
      this.reactionClock = 0;
      this.reactedToRally = false;
      target.lerp(new THREE.Vector3(0, 0, -TABLE_HALF_L - 1.05), 0.04);
      return false;
    }
    this.reactionClock += dt;
    if (this.reactionClock < this.difficulty.reactionTime) return true;
    this.reactedToRally = true;
    const landing = physics.predictedLandingPoint();
    const strikeZ = landing.z - (physics.state.pos.y > BALL_SURFACE_Y + 0.3 ? 0.42 : 0.32);
    target.x = clamp(landing.x, -TABLE_HALF_W * 0.82, TABLE_HALF_W * 0.82);
    target.z = clamp(strikeZ, -TABLE_HALF_L - 1.45, -TABLE_HALF_L - 0.42);
    return true;
  }

  decide(physics: BallPhysics, aiPos: THREE.Vector3, nearPlayerX: number): AiDecision | null {
    if (!this.reactedToRally || physics.state.lastHitBy !== "near") return null;
    const distance = physics.state.pos.distanceTo(new THREE.Vector3(aiPos.x, physics.state.pos.y, aiPos.z));
    const landing = physics.predictedLandingPoint(1.1);
    const unreachable = distance > this.difficulty.maxReach || Math.abs(landing.x) > TABLE_HALF_W + 0.18;
    if (unreachable || Math.random() < this.difficulty.mistakeChance) return null;
    const highBall = physics.state.pos.y > BALL_SURFACE_Y + 0.3;
    const lowBall = physics.state.pos.y < BALL_SURFACE_Y + 0.08;
    const shot: ShotType = lowBall ? "push" : highBall ? "brush/topspin" : Math.abs(physics.state.pos.x - aiPos.x) > 0.32 ? "backhand drive" : "forehand drive";
    const openSide = nearPlayerX > 0 ? -1 : 1;
    const wide = Math.random() < 0.42;
    const targetX = wide ? openSide * (TABLE_HALF_W - 0.14) : clamp(-nearPlayerX * 0.6 + (Math.random() - 0.5) * 0.24, -TABLE_HALF_W + 0.12, TABLE_HALF_W - 0.12);
    const targetZ = shot === "push" ? lerp(0.28, 0.58, Math.random()) : lerp(0.7, TABLE_HALF_L - 0.16, Math.random());
    return {
      shouldSwing: true,
      shot,
      target: new THREE.Vector3(targetX, BALL_SURFACE_Y, targetZ),
      power: this.difficulty.shotPower,
      topSpin: shot === "push" ? -0.25 : shot === "brush/topspin" ? 1.15 : 0.72,
      sideSpin: wide ? openSide * 0.65 : (Math.random() - 0.5) * 0.55,
      label: shot === "push" ? "AI short push" : shot === "brush/topspin" ? "AI loop" : wide ? "AI wide angle" : "AI drive",
    };
  }
}
