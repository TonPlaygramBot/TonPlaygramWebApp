import * as THREE from "three";
import { BALL_SURFACE_Y, TABLE_HALF_L, TABLE_HALF_W, TABLE_TENNIS_CONFIG as CFG, clamp, PlayerSide } from "./gameConfig";

export type ShotType = "forehand drive" | "backhand drive" | "push" | "brush/topspin" | "lob";

export type PaddleHitInput = {
  side: PlayerSide;
  paddlePosition: THREE.Vector3;
  paddleNormal: THREE.Vector3;
  ballPosition: THREE.Vector3;
  ballVelocity: THREE.Vector3;
  swingT: number;
  action: "ready" | "forehand" | "backhand" | "serve";
  target: THREE.Vector3;
  power: number;
  topSpin: number;
  sideSpin: number;
  accuracy?: number;
  radius?: number;
};

export type PaddleHitResult = {
  valid: boolean;
  reason?: "distance" | "angle" | "timing" | "sameSide" | "height";
  shotType?: ShotType;
  velocity?: THREE.Vector3;
  spin?: THREE.Vector3;
  label?: string;
};

function ballisticVelocity(from: THREE.Vector3, target: THREE.Vector3, flight: number) {
  return new THREE.Vector3(
    (target.x - from.x) / flight,
    (target.y - from.y + 0.5 * CFG.gravity * flight * flight) / flight,
    (target.z - from.z) / flight
  );
}

export class PaddleHitDetector {
  private readonly cfg: { hitRadius: number; minDot: number; timingPad: number };

  constructor(cfg = { hitRadius: CFG.hitRadius, minDot: CFG.hitAngleDot, timingPad: CFG.hitTimingPad }) {
    this.cfg = cfg;
  }

  detect(input: PaddleHitInput): PaddleHitResult {
    const radius = input.radius ?? this.cfg.hitRadius;
    if (input.swingT < CFG.hitWindowStart - this.cfg.timingPad || input.swingT > CFG.hitWindowEnd + this.cfg.timingPad) {
      return { valid: false, reason: "timing" };
    }
    if (input.ballPosition.y < CFG.tableY + 0.055 || input.ballPosition.y > CFG.tableY + 0.66) {
      return { valid: false, reason: "height" };
    }

    const toBall = input.ballPosition.clone().sub(input.paddlePosition);
    const closing = input.ballVelocity.clone().normalize().dot(input.paddleNormal.clone().normalize());
    const faceDot = toBall.clone().normalize().dot(input.paddleNormal.clone().normalize());
    if (toBall.length() > radius) return { valid: false, reason: "distance" };
    if (closing > -this.cfg.minDot && faceDot < -0.35) return { valid: false, reason: "angle" };

    const shotType = this.resolveShotType(input);
    const velocity = this.resolveShotVelocity(input, shotType);
    const dirZ = input.side === "near" ? -1 : 1;
    const spin = new THREE.Vector3(
      -dirZ * (shotType === "push" ? 34 : shotType === "lob" ? 44 : 68 + input.topSpin * 104),
      input.sideSpin * (shotType === "push" ? 54 : 118),
      input.sideSpin * 14
    );
    return { valid: true, shotType, velocity, spin, label: shotType };
  }

  resolveShotVelocity(input: PaddleHitInput, shotType: ShotType) {
    const target = input.target.clone();
    target.x = clamp(target.x, -TABLE_HALF_W + 0.1, TABLE_HALF_W - 0.1);
    target.z = input.side === "near" ? clamp(target.z, -TABLE_HALF_L + 0.12, -0.18) : clamp(target.z, 0.18, TABLE_HALF_L - 0.12);
    target.y = BALL_SURFACE_Y;

    const dist = Math.hypot(target.x - input.ballPosition.x, target.z - input.ballPosition.z);
    const shotLift = shotType === "lob" ? 0.19 : shotType === "push" ? -0.015 : shotType === "brush/topspin" ? 0.06 : 0.025;
    const speedBias = shotType === "push" ? 3.4 : shotType === "lob" ? 3.0 : shotType === "brush/topspin" ? 6.8 : 6.1;
    const flight = clamp(dist / (speedBias + input.power * 3.1), shotType === "lob" ? 0.32 : 0.15, shotType === "lob" ? 0.58 : 0.42);
    const from = input.ballPosition.clone();
    from.y = clamp(from.y + shotLift, CFG.tableY + 0.08, CFG.tableY + (shotType === "lob" ? 0.72 : 0.5));
    const velocity = ballisticVelocity(from, target, flight);
    const speed = velocity.length();
    const min = shotType === "push" ? 2.7 : CFG.minShotSpeed;
    const max = shotType === "lob" ? 7.2 : CFG.maxShotSpeed;
    if (speed < min) velocity.multiplyScalar(min / Math.max(speed, 0.0001));
    if (speed > max) velocity.multiplyScalar(max / speed);
    if (input.accuracy !== undefined && input.accuracy < 0.999) {
      velocity.x += (Math.random() - 0.5) * (1 - input.accuracy) * 1.6;
      velocity.z += (Math.random() - 0.5) * (1 - input.accuracy) * 1.1;
    }
    return velocity;
  }

  private resolveShotType(input: PaddleHitInput): ShotType {
    if (input.action === "backhand") return input.topSpin < 0 ? "push" : "backhand drive";
    if (input.power < 0.45 || input.topSpin < 0) return "push";
    if (input.ballPosition.y > CFG.tableY + 0.44) return "lob";
    if (input.topSpin > 0.9) return "brush/topspin";
    return "forehand drive";
  }
}
