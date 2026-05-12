import * as THREE from "three";
import { BALL_SURFACE_Y, CFG, TABLE_HALF_L, TABLE_HALF_W, type BallState, type DesiredHit, type DifficultyConfig, type PlayerSide, clamp, lerp } from "./gameConfig";

export type AIControlledPlayer = { side: PlayerSide; pos: THREE.Vector3; target: THREE.Vector3; swingT: number };

export class AIController {
  private reactionClock = 0;
  private currentLanding = new THREE.Vector3();
  private intentionallyMiss = false;

  constructor(private readonly difficulty: DifficultyConfig = CFG.aiDifficulty) {}

  update(player: AIControlledPlayer, ball: BallState, predictedLanding: THREE.Vector3, dt: number) {
    const home = new THREE.Vector3(0, 0, -TABLE_HALF_L - 1.05);
    const incoming = ball.lastHitBy === "near" && ball.pos.z < 0.24;
    if (!incoming) {
      this.reactionClock = 0;
      player.target.lerp(home, 0.04);
      return { incoming: false, reachable: false };
    }

    this.reactionClock += dt;
    if (this.reactionClock >= this.difficulty.reactionTime && !this.currentLanding.equals(predictedLanding)) {
      this.currentLanding.copy(predictedLanding);
      this.intentionallyMiss = Math.random() < this.difficulty.mistakeChance;
    }

    const strikeZ = predictedLanding.z - (ball.pos.y > CFG.tableY + 0.35 ? 0.42 : 0.32);
    const targetX = this.intentionallyMiss ? predictedLanding.x + Math.sign(predictedLanding.x || 1) * 0.9 : predictedLanding.x;
    player.target.x = clamp(targetX, -TABLE_HALF_W * 0.82, TABLE_HALF_W * 0.82);
    player.target.z = clamp(strikeZ, -TABLE_HALF_L - 1.45, -TABLE_HALF_L - 0.42);
    const reachable = !this.intentionallyMiss && player.pos.distanceTo(new THREE.Vector3(predictedLanding.x, 0, strikeZ)) <= this.difficulty.maxReach + 0.52;
    return { incoming: true, reachable };
  }

  makeTarget(nearX: number, ball: BallState): DesiredHit {
    const pressure = Math.max(0, Math.min(1, (-ball.pos.z + TABLE_HALF_L) / CFG.tableL));
    const wide = Math.random() < 0.42;
    const openSide = nearX > 0 ? -1 : 1;
    const x = wide ? openSide * (TABLE_HALF_W - 0.14) : -nearX * 0.56 + (Math.random() - 0.5) * (1 - this.difficulty.accuracy) * 0.65;
    const z = lerp(0.58, TABLE_HALF_L - 0.16, Math.random());
    const push = ball.pos.y < CFG.tableY + 0.18 && Math.random() < 0.55;
    return {
      target: new THREE.Vector3(clamp(x, -TABLE_HALF_W + 0.12, TABLE_HALF_W - 0.12), BALL_SURFACE_Y, push ? lerp(0.26, 0.58, Math.random()) : z),
      power: clamp((push ? 0.42 : 0.62 + pressure * 0.2) * this.difficulty.shotPower, 0.32, 0.96),
      topSpin: push ? -0.18 : 0.72 + pressure * 0.22,
      sideSpin: wide ? openSide * 0.6 : (Math.random() - 0.5) * 0.45,
      tactic: push ? "push" : wide ? "wide" : "drive",
    };
  }
}
