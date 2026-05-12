import * as THREE from "three";
import { BALL_SURFACE_Y, PlayerSide, ShotType, TABLE_HALF_L, TABLE_HALF_W, clamp, gameConfig } from "./gameConfig";
import { BallPhysics } from "./BallPhysics";
import { PlayerController } from "./PlayerController";

export type AIShotPlan = { target: THREE.Vector3; shotType: ShotType; power: number; spin: number };

export class AIController {
  private reaction = 0;
  private targetLanding = new THREE.Vector3();
  private committedMiss = false;

  constructor(private readonly controller: PlayerController, private readonly difficulty = gameConfig.ai) {}

  update(dt: number, physics: BallPhysics) {
    const ball = physics.ball;
    const avatar = this.controller.avatar;
    const incoming = ball.lastHitBy === "near" && ball.position.z < 0.35;
    if (!incoming) {
      this.reaction = this.difficulty.reactionTime;
      this.committedMiss = false;
      this.controller.setTarget(0, -TABLE_HALF_L - 0.72);
      return;
    }
    this.reaction -= dt;
    if (this.reaction <= 0) this.targetLanding.copy(physics.predictLandingPoint());
    const strikeZ = clamp(this.targetLanding.z - 0.34, -TABLE_HALF_L - 1.05, -TABLE_HALF_L - 0.28);
    this.controller.setTarget(this.targetLanding.x, strikeZ);

    if (this.targetLanding.distanceTo(avatar.position) > this.difficulty.maxReach + 0.8) this.committedMiss = true;
  }

  canAttempt(physics: BallPhysics) {
    const ball = physics.ball;
    const a = this.controller.avatar;
    if (this.committedMiss) return false;
    if (Math.random() < this.difficulty.mistakeChance * 0.012) return false;
    return ball.lastHitBy === "near" && ball.bounceSide === "far" && ball.bounceCountOnSide === 1 && a.paddleWorld.distanceTo(ball.position) <= this.difficulty.maxReach;
  }

  makeShot(): AIShotPlan {
    const wide = Math.random() < 0.38;
    const targetX = wide ? (Math.random() < 0.5 ? -1 : 1) * (TABLE_HALF_W - 0.18) : (Math.random() - 0.5) * 0.9;
    const targetZ = clamp(TABLE_HALF_L * (0.36 + Math.random() * 0.48), 0.2, TABLE_HALF_L - 0.13);
    const roll = Math.random();
    const shotType: ShotType = roll < 0.18 ? "push" : roll < 0.36 ? "brush/topspin" : roll < 0.45 ? "lob" : "forehand drive";
    return {
      target: new THREE.Vector3(targetX, BALL_SURFACE_Y, targetZ),
      shotType,
      power: clamp(this.difficulty.shotPower + (Math.random() - 0.5) * 0.16, 0.35, 0.95),
      spin: clamp((Math.random() - 0.5) * 0.8, -1, 1),
    };
  }
}
