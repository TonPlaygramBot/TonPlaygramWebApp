import * as THREE from "three";
import { gameConfig, PlayerSide } from "./gameConfig";

export type AIDifficulty = typeof gameConfig.aiDifficulty;

export class AIController {
  public cooldown = 0;
  constructor(private difficulty: AIDifficulty = gameConfig.aiDifficulty, private cfg = gameConfig) {}
  updateCooldown(dt: number) { this.cooldown = Math.max(0, this.cooldown - dt); }
  chooseReturnPosition(landing: THREE.Vector3) {
    return new THREE.Vector3(
      THREE.MathUtils.clamp(landing.x, -this.cfg.courtW / 2 + 0.35, this.cfg.courtW / 2 - 0.35),
      0,
      THREE.MathUtils.clamp(Math.min(-0.72, landing.z + 0.42), -this.cfg.courtL / 2 + 0.42, -0.64)
    );
  }
  canReach(aiPosition: THREE.Vector3, ballPosition: THREE.Vector3) { return aiPosition.distanceTo(ballPosition) <= this.difficulty.reachRadius && ballPosition.y >= 0.25 && ballPosition.y <= 1.85; }
  shouldMiss() { return Math.random() < this.difficulty.mistakeChance; }
  neutralPosition() { return new THREE.Vector3(0, 0, -this.cfg.courtL / 2 + 0.95); }
  targetForOpponent(opponent: PlayerSide) { return new THREE.Vector3((Math.random() - 0.5) * this.cfg.courtW * 0.66, this.cfg.ballR, opponent === "near" ? this.cfg.courtL / 2 - 2.0 : -this.cfg.courtL / 2 + 2.0); }
}
