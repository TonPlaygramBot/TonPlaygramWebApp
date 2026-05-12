import * as THREE from "three";
import { BALL_SURFACE_Y, TABLE_HALF_L, TABLE_HALF_W, TABLE_TENNIS_CONFIG as CFG, clamp, clamp01 } from "./gameConfig";

export type AiDifficulty = { reactionTime: number; moveSpeed: number; accuracy: number; shotPower: number; mistakeChance: number; maxReach: number };
export const DEFAULT_AI_DIFFICULTY: AiDifficulty = { reactionTime: 0.18, moveSpeed: CFG.aiSpeed, accuracy: 0.82, shotPower: 0.72, mistakeChance: 0.1, maxReach: 0.72 };
export type AiPlan = { target: THREE.Vector3; power: number; topSpin: number; sideSpin: number; tactic: "serve" | "loop" | "drive" | "push" | "wide" | "body"; action: "forehand" | "backhand" };

export class AIController {
  private reactionClock = 0;
  private committedMiss = false;
  constructor(private readonly difficulty = DEFAULT_AI_DIFFICULTY) {}

  update(dt: number, ball: { pos: THREE.Vector3; vel: THREE.Vector3; lastHitBy: "near" | "far" | null }, ai: { pos: THREE.Vector3; target: THREE.Vector3 }, predictLanding: () => THREE.Vector3) {
    const home = new THREE.Vector3(0, 0, -TABLE_HALF_L - 1.05);
    const incoming = ball.lastHitBy === "near" && ball.pos.z < 0.28 && ball.vel.z < 0.4;
    if (!incoming) {
      this.reactionClock = 0;
      this.committedMiss = false;
      ai.target.lerp(home, 0.04);
      return { incoming: false, reachable: false };
    }
    this.reactionClock += dt;
    const landing = predictLanding();
    const reachable = Math.abs(landing.x - ai.pos.x) < this.difficulty.maxReach && landing.z < 0.15;
    if (this.reactionClock < this.difficulty.reactionTime || !reachable) return { incoming: true, reachable };
    const strikeZ = landing.z - (ball.pos.y > CFG.tableY + 0.35 ? 0.42 : 0.32);
    ai.target.x = clamp(landing.x, -TABLE_HALF_W * 0.82, TABLE_HALF_W * 0.82);
    ai.target.z = clamp(strikeZ, -TABLE_HALF_L - 1.45, -TABLE_HALF_L - 0.42);
    if (!this.committedMiss && Math.random() < this.difficulty.mistakeChance * dt) this.committedMiss = true;
    return { incoming: true, reachable: reachable && !this.committedMiss };
  }

  makeReturn(nearX: number, ballY: number): AiPlan {
    const highBall = ballY > CFG.tableY + 0.34;
    const lowBall = ballY < CFG.tableY + 0.16;
    const roll = Math.random();
    const tactic: AiPlan["tactic"] = lowBall ? (roll < 0.62 ? "push" : "wide") : highBall ? (roll < 0.72 ? "loop" : "drive") : roll < 0.38 ? "wide" : roll < 0.7 ? "body" : "drive";
    const pressure = clamp01((TABLE_HALF_L) / CFG.tableL);
    let x = 0, z = 0.92, power = this.difficulty.shotPower, topSpin = 0.75, sideSpin = clamp((Math.random() - 0.5) * 0.8, -0.8, 0.8);
    if (tactic === "push") { x = clamp(-nearX * 0.42 + (Math.random() - 0.5) * 0.24, -TABLE_HALF_W + 0.14, TABLE_HALF_W - 0.14); z = 0.32 + Math.random() * 0.26; power = 0.38; topSpin = -0.28; }
    else if (tactic === "wide") { const openSide = nearX > 0 ? -1 : 1; x = openSide * (TABLE_HALF_W - 0.14); z = 0.74 + Math.random() * (TABLE_HALF_L - 0.9); power = 0.72; topSpin = 0.9; sideSpin = openSide * 0.6; }
    else if (tactic === "body") { x = clamp(nearX * 0.78, -TABLE_HALF_W + 0.12, TABLE_HALF_W - 0.12); z = 0.62 + Math.random() * 0.33; power = 0.68; }
    else if (tactic === "loop") { x = clamp(-nearX * 0.72, -TABLE_HALF_W + 0.12, TABLE_HALF_W - 0.12); z = TABLE_HALF_L - 0.34 + Math.random() * 0.21; power = 0.82; topSpin = 1.08 + pressure * 0.1; }
    else { x = clamp(-nearX * 0.56 + (Math.random() - 0.5) * 0.34, -TABLE_HALF_W + 0.12, TABLE_HALF_W - 0.12); z = 0.68 + Math.random() * (TABLE_HALF_L - 0.86); }
    const accuracyMiss = (1 - this.difficulty.accuracy) * 0.22;
    x = clamp(x + (Math.random() - 0.5) * accuracyMiss, -TABLE_HALF_W + 0.1, TABLE_HALF_W - 0.1);
    return { target: new THREE.Vector3(x, BALL_SURFACE_Y, z), power, topSpin, sideSpin, tactic, action: tactic === "push" || x > 0 ? "backhand" : "forehand" };
  }
}
