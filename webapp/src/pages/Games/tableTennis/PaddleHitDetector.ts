import * as THREE from "three";
import { BALL_SURFACE_Y, PlayerSide, ShotType, TABLE_HALF_L, TABLE_HALF_W, ballisticVelocity, clamp, gameConfig } from "./gameConfig";
import type { BallData } from "./BallPhysics";

export type HitInput = {
  side: PlayerSide;
  paddlePosition: THREE.Vector3;
  paddleForward: THREE.Vector3;
  ball: BallData;
  shotType: ShotType;
  target: THREE.Vector3;
  power: number;
  spin: number;
  accuracy: number;
  timing: number;
};

export type HitResult = { valid: true; velocity: THREE.Vector3; spin: THREE.Vector3; label: string } | { valid: false; reason: string };

export class PaddleHitDetector {
  detect(input: HitInput): HitResult {
    const { side, paddlePosition, paddleForward, ball } = input;
    if (ball.lastHitBy === side) return { valid: false, reason: "already hit by this player" };
    if (ball.bounceSide !== side || ball.bounceCountOnSide !== 1) return { valid: false, reason: "wait for one bounce" };

    const toBall = ball.position.clone().sub(paddlePosition);
    const distance = toBall.length();
    const radius = gameConfig.paddle.radius;
    if (distance > radius) return { valid: false, reason: "outside paddle radius" };

    const closing = ball.velocity.dot(paddleForward);
    const angleOk = toBall.lengthSq() < 0.0001 || Math.abs(toBall.normalize().dot(paddleForward)) >= gameConfig.paddle.hitAngleCos;
    if (closing > 1.2 || !angleOk) return { valid: false, reason: "bad contact angle" };
    if (Math.abs(input.timing) > gameConfig.paddle.timingWindow) return { valid: false, reason: "mistimed swing" };

    const target = input.target.clone();
    target.x = clamp(target.x, -TABLE_HALF_W + 0.11, TABLE_HALF_W - 0.11);
    target.z = side === "near" ? clamp(target.z, -TABLE_HALF_L + 0.13, -0.16) : clamp(target.z, 0.16, TABLE_HALF_L - 0.13);
    target.y = BALL_SURFACE_Y;

    const miss = (1 - input.accuracy) * 0.34;
    target.x += (Math.random() - 0.5) * miss;
    target.z += (Math.random() - 0.5) * miss;

    const dist = Math.hypot(target.x - ball.position.x, target.z - ball.position.z);
    const type = input.shotType;
    const powerBias = type === "lob" ? -0.18 : type === "push" ? -0.25 : type === "brush/topspin" ? 0.08 : 0;
    const flight = clamp(dist / (4.5 + (input.power + powerBias) * 4.0), type === "lob" ? 0.42 : 0.17, type === "lob" ? 0.72 : 0.43);
    const strikePoint = ball.position.clone();
    strikePoint.y = clamp(strikePoint.y, BALL_SURFACE_Y + 0.035, BALL_SURFACE_Y + 0.58);
    const velocity = ballisticVelocity(strikePoint, target, flight);
    const dirZ = side === "near" ? -1 : 1;
    const topSpin = type === "push" ? -45 : type === "lob" ? 32 : type === "brush/topspin" ? 175 : 105;
    const sideSpin = input.spin * 110;
    const spin = new THREE.Vector3(-dirZ * topSpin, sideSpin, input.spin * 18);
    return { valid: true, velocity, spin, label: type };
  }
}
