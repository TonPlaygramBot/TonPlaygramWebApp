import * as THREE from "three";
import { BALL_SURFACE_Y, clamp, opposite, PlayerSide, ShotType, TABLE_HALF_L, TABLE_HALF_W, TT } from "./gameConfig";

export type PaddleHitInput = {
  side: PlayerSide;
  paddleWorldPosition: THREE.Vector3;
  paddleForwardNormal: THREE.Vector3;
  ballPosition: THREE.Vector3;
  ballVelocity: THREE.Vector3;
  desiredTarget: THREE.Vector3;
  requestedShot: ShotType;
  swingT: number;
  windowStart: number;
  windowEnd: number;
  accuracy?: number;
  power?: number;
  spinScale?: number;
};

export type PaddleHitResult = { valid: boolean; reason?: string; velocity?: THREE.Vector3; spin?: THREE.Vector3; shot: ShotType; contactPoint?: THREE.Vector3 };

export class PaddleHitDetector {
  constructor(private config = TT.paddle) {}

  detect(input: PaddleHitInput): PaddleHitResult {
    if (input.swingT < input.windowStart || input.swingT > input.windowEnd) return { valid: false, reason: "outside timing window", shot: input.requestedShot };
    const toBall = input.ballPosition.clone().sub(input.paddleWorldPosition);
    const distance = toBall.length();
    if (distance > this.config.hitRadius) return { valid: false, reason: "ball outside paddle radius", shot: input.requestedShot };
    const incoming = input.ballVelocity.clone().normalize();
    const normal = input.paddleForwardNormal.clone().normalize();
    const closing = -incoming.dot(normal);
    if (closing < this.config.angleDotMin && input.ballVelocity.length() > this.config.minIncomingSpeed) return { valid: false, reason: "paddle face angle mismatch", shot: input.requestedShot };

    const sideSign = input.side === "near" ? -1 : 1;
    const target = input.desiredTarget.clone();
    target.x = clamp(target.x, -TABLE_HALF_W + 0.1, TABLE_HALF_W - 0.1);
    target.z = input.side === "near" ? clamp(target.z, -TABLE_HALF_L + 0.12, -0.18) : clamp(target.z, 0.18, TABLE_HALF_L - 0.12);
    target.y = BALL_SURFACE_Y;

    const dist = Math.max(0.35, target.distanceTo(input.ballPosition));
    const power = clamp((input.power ?? 1) * this.config.power, 0.25, 1.4);
    const shot = input.requestedShot;
    const baseFlight = shot === "lob" ? 0.62 : shot === "push" ? 0.46 : shot === "brush/topspin" ? 0.32 : 0.38;
    const flight = clamp(baseFlight - power * 0.12 + dist * 0.015, 0.18, shot === "lob" ? 0.78 : 0.52);
    const velocity = new THREE.Vector3(
      (target.x - input.ballPosition.x) / flight,
      (target.y - input.ballPosition.y + 0.5 * TT.ball.gravity * flight * flight) / flight,
      (target.z - input.ballPosition.z) / flight,
    );

    const accuracy = clamp(input.accuracy ?? this.config.accuracy, 0, 1);
    const miss = (1 - accuracy) * 0.75;
    velocity.x += (Math.random() - 0.5) * miss;
    velocity.z += (Math.random() - 0.5) * miss * 0.65;

    let topSpin = 78;
    let sideSpin = clamp(toBall.x * 3.2, -1, 1) * 70;
    if (shot === "push") topSpin = -35;
    if (shot === "brush/topspin") topSpin = 155;
    if (shot === "lob") { topSpin = 32; velocity.y += 1.2; }
    if (shot === "backhand drive") sideSpin *= -0.55;
    const spinScale = clamp(input.spinScale ?? this.config.spin, 0.2, 1.6);
    const spin = new THREE.Vector3(-sideSign * topSpin * spinScale, sideSpin * spinScale, sideSpin * 0.12 * spinScale);

    return { valid: true, velocity, spin, shot, contactPoint: input.ballPosition.clone() };
  }
}

export const shotForPlayerSide = (playerSide: PlayerSide, ballX: number, playerX: number, explicit?: ShotType): ShotType => {
  if (explicit) return explicit;
  const acrossBody = ballX - playerX < -0.12;
  return acrossBody ? "backhand drive" : "forehand drive";
};
