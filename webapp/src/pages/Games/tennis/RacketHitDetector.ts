import * as THREE from "three";
import { gameConfig, PlayerSide, ShotType } from "./gameConfig";

export type RacketHitInput = { side: PlayerSide; playerPosition: THREE.Vector3; racketPosition: THREE.Vector3; racketNormal: THREE.Vector3; ballPosition: THREE.Vector3; ballVelocity: THREE.Vector3; swingT: number; action: "serve" | "forehand" | "backhand" | string; aimTarget: THREE.Vector3; power: number; shotType?: ShotType; movingPenalty?: number };
export type RacketHitResult = { valid: boolean; reason?: string; timingQuality: number; velocity?: THREE.Vector3; spin?: number; shotType?: ShotType };

export class RacketHitDetector {
  constructor(private cfg = gameConfig) {}

  validate(input: RacketHitInput): RacketHitResult {
    const distance = input.racketPosition.distanceTo(input.ballPosition);
    if (distance > this.cfg.racketHitRadius) return { valid: false, reason: "miss-distance", timingQuality: 0 };
    const toBall = input.ballPosition.clone().sub(input.racketPosition).normalize();
    if (toBall.dot(input.racketNormal.clone().normalize()) < -this.cfg.contactAngleTolerance) return { valid: false, reason: "behind-racket", timingQuality: 0 };
    const contactHeight = input.ballPosition.y;
    if (contactHeight < this.cfg.minContactHeight || contactHeight > this.cfg.maxContactHeight) return { valid: false, reason: "bad-height", timingQuality: 0 };
    if (input.playerPosition.distanceTo(input.ballPosition) > this.cfg.maxReachDistance) return { valid: false, reason: "out-of-reach", timingQuality: 0 };
    const center = input.action === "serve" ? this.cfg.serveContactT : (this.cfg.hitWindowStart + this.cfg.hitWindowEnd) * 0.5;
    const timingQuality = Math.max(0, 1 - Math.abs(input.swingT - center) / this.cfg.timingWindow);
    if (timingQuality <= 0) return { valid: false, reason: "bad-timing", timingQuality: 0 };
    return { valid: true, timingQuality };
  }

  computeVelocity(input: RacketHitInput): RacketHitResult {
    const validation = this.validate(input);
    if (!validation.valid) return validation;
    const shotType = input.shotType || "topspin";
    const target = input.aimTarget.clone();
    const from = input.ballPosition.clone();
    const flatDist = Math.hypot(target.x - from.x, target.z - from.z);
    const serve = input.action === "serve";
    const shotLift = shotType === "lob" ? 0.52 : shotType === "drop" ? -0.16 : shotType === "slice" ? 0.08 : 0.18;
    const speed = (serve ? 21.5 : 15.8) * this.cfg.worldScale * (0.72 + input.power * 0.58) * (0.72 + validation.timingQuality * 0.28);
    const flight = THREE.MathUtils.clamp(flatDist / speed, serve ? 0.42 : 0.56, shotType === "lob" ? 1.55 : serve ? 0.92 : 1.18);
    const velocity = new THREE.Vector3((target.x - from.x) / flight, (target.y - from.y + 0.5 * this.cfg.gravity * flight * flight) / flight + shotLift, (target.z - from.z) / flight);
    const spin = shotType === "topspin" ? this.cfg.spinAmount : shotType === "slice" ? -this.cfg.spinAmount * 0.55 : shotType === "drop" ? -0.25 : 0.15;
    return { ...validation, velocity, spin, shotType };
  }
}
