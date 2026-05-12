import * as THREE from "three";
import { BALL_SURFACE_Y, CFG, TABLE_HALF_L, TABLE_HALF_W, type BallState, type DesiredHit, type PlayerSide, clamp } from "./gameConfig";

export type ShotType = "forehand drive" | "backhand drive" | "push" | "brush/topspin" | "lob";

export type PaddleHitInput = {
  side: PlayerSide;
  paddleWorldPosition: THREE.Vector3;
  paddleForwardNormal: THREE.Vector3;
  ball: BallState;
  swingT: number;
  desiredHit: DesiredHit;
  action: "forehand" | "backhand" | "serve" | "ready";
  hitRadius?: number;
  power?: number;
  spin?: number;
  accuracy?: number;
};

export type PaddleHitResult = {
  valid: boolean;
  reason?: "cooldown" | "timing" | "distance" | "angle" | "wrong-direction" | "not-in-play";
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
  detect(input: PaddleHitInput): PaddleHitResult {
    const { ball, side } = input;
    if (ball.lastHitBy === side && input.action !== "serve") return { valid: false, reason: "not-in-play" };
    const radius = input.hitRadius ?? CFG.paddleHitRadius;
    const distance = input.paddleWorldPosition.distanceTo(ball.pos);
    if (distance > radius) return { valid: false, reason: "distance" };
    if (input.action !== "serve" && (input.swingT < CFG.hitWindowStart - CFG.paddleTimingGrace || input.swingT > CFG.hitWindowEnd + CFG.paddleTimingGrace)) {
      return { valid: false, reason: "timing" };
    }

    if (input.action !== "serve") {
      const travellingTowardPlayer = side === "near" ? ball.vel.z > 0.05 : ball.vel.z < -0.05;
      if (!travellingTowardPlayer) return { valid: false, reason: "wrong-direction" };
    }
    const incoming = ball.vel.lengthSq() > 0.001 ? ball.vel.clone().normalize().negate() : new THREE.Vector3(0, 0, side === "near" ? 1 : -1);
    const face = input.paddleForwardNormal.clone().normalize();
    // Avatar hand rigs can expose either blade face as the visual normal, so use the
    // absolute facing angle while still requiring distance, timing, and incoming travel.
    const faceDot = Math.abs(face.dot(incoming));
    if (input.action !== "serve" && faceDot < CFG.paddleMaxFaceAngle) return { valid: false, reason: "angle" };

    const shotType = this.classifyShot(input, distance);
    const velocity = this.velocityForShot(input, shotType);
    const spin = this.spinForShot(input, shotType);
    return { valid: true, shotType, velocity, spin, label: this.labelForShot(input.side, shotType) };
  }

  private classifyShot(input: PaddleHitInput, distance: number): ShotType {
    if (input.desiredHit.power < 0.42 || input.desiredHit.topSpin < -0.05) return "push";
    if (input.desiredHit.power > 0.9 && input.desiredHit.topSpin < 0.45) return "lob";
    if (input.desiredHit.topSpin > 0.88 || distance < (input.hitRadius ?? CFG.paddleHitRadius) * 0.62) return "brush/topspin";
    return input.action === "backhand" ? "backhand drive" : "forehand drive";
  }

  private velocityForShot(input: PaddleHitInput, shotType: ShotType) {
    const side = input.side;
    const target = input.desiredHit.target.clone();
    target.x = clamp(target.x, -TABLE_HALF_W + 0.1, TABLE_HALF_W - 0.1);
    target.z = side === "near" ? clamp(target.z, -TABLE_HALF_L + 0.12, -0.18) : clamp(target.z, 0.18, TABLE_HALF_L - 0.12);
    target.y = BALL_SURFACE_Y;

    const powerScale = input.power ?? 1;
    const accuracy = input.accuracy ?? 1;
    const error = (1 - accuracy) * 0.28;
    target.x = clamp(target.x + (Math.random() - 0.5) * error, -TABLE_HALF_W + 0.1, TABLE_HALF_W - 0.1);
    target.z += (Math.random() - 0.5) * error * 0.7;

    const dist = Math.hypot(target.x - input.ball.pos.x, target.z - input.ball.pos.z);
    const basePower = input.desiredHit.power * powerScale;
    const lobExtra = shotType === "lob" ? 0.16 : 0;
    const pushSlow = shotType === "push" ? 0.7 : 1;
    const flight = clamp(dist / ((4.25 + basePower * 4.3) * pushSlow), 0.15 + lobExtra, 0.48 + lobExtra);
    const velocity = ballisticVelocity(input.ball.pos, target, flight);
    if (shotType === "lob") velocity.y += 1.0;
    const speed = velocity.length();
    if (speed < CFG.minShotSpeed) velocity.multiplyScalar(CFG.minShotSpeed / Math.max(speed, 0.0001));
    if (speed > CFG.maxShotSpeed) velocity.multiplyScalar(CFG.maxShotSpeed / speed);
    return velocity;
  }

  private spinForShot(input: PaddleHitInput, shotType: ShotType) {
    const dirZ = input.side === "near" ? -1 : 1;
    const spinPower = input.spin ?? 1;
    const topSpin = shotType === "push" ? -0.22 : shotType === "lob" ? 0.28 : input.desiredHit.topSpin;
    return new THREE.Vector3(
      -dirZ * (58 + topSpin * 104) * spinPower,
      input.desiredHit.sideSpin * 116 * spinPower,
      input.desiredHit.sideSpin * 14 * spinPower
    );
  }

  private labelForShot(side: PlayerSide, shotType: ShotType) {
    const prefix = side === "near" ? "" : "AI ";
    return `${prefix}${shotType}`;
  }
}
