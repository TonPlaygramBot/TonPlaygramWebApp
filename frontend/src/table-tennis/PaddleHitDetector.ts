import * as THREE from 'three';
import { GAME_CONFIG, ShotCommand, ShotType, Side, TABLE_BOUNDS } from './gameConfig';

export interface PaddleHitInput {
  side: Side;
  paddlePosition: THREE.Vector3;
  paddleForward: THREE.Vector3;
  ballPosition: THREE.Vector3;
  ballVelocity: THREE.Vector3;
  ballSpin: THREE.Vector3;
  requestedShot: ShotType;
  shotCommand?: ShotCommand;
  accuracy?: number;
  powerScale?: number;
}

export interface PaddleHitResult {
  valid: boolean;
  shotType?: ShotType;
  velocity?: THREE.Vector3;
  spin?: THREE.Vector3;
  reason?: string;
}

const shotProfiles: Record<ShotType, { lift: number; speed: number; spin: number; arc: number }> = {
  'forehand drive': { lift: 1.68, speed: GAME_CONFIG.paddle.drivePower, spin: 2.35, arc: 0.16 },
  'backhand drive': { lift: 1.58, speed: GAME_CONFIG.paddle.drivePower * 0.96, spin: 2.05, arc: 0.12 },
  push: { lift: 1.12, speed: GAME_CONFIG.paddle.pushPower, spin: -1.85, arc: 0.2 },
  'brush/topspin': { lift: 1.78, speed: GAME_CONFIG.paddle.drivePower * 0.98, spin: GAME_CONFIG.paddle.spin, arc: 0.05 },
  lob: { lift: 2.85, speed: GAME_CONFIG.paddle.lobPower, spin: 0.75, arc: 0.46 },
  'swerve power': { lift: 1.62, speed: GAME_CONFIG.paddle.drivePower * GAME_CONFIG.paddle.powerShotMultiplier, spin: GAME_CONFIG.paddle.spin * 0.9, arc: 0.08 },
};

const DEFAULT_COMMAND: ShotCommand = { aimX: 0, power: 0.58, lift: 0.45, curve: 0, spin: 0.25 };

export class PaddleHitDetector {
  detect(input: PaddleHitInput): PaddleHitResult {
    const distance = input.paddlePosition.distanceTo(input.ballPosition);
    if (distance > GAME_CONFIG.paddle.hitRadius) return { valid: false, reason: 'outside hit radius' };

    const incoming = input.ballVelocity.clone().normalize();
    const facingDot = input.paddleForward.clone().normalize().dot(incoming.clone().multiplyScalar(-1));
    if (facingDot < GAME_CONFIG.paddle.minFacingDot) return { valid: false, reason: 'paddle face angle' };

    const ballComingToPaddle = input.side === 'player' ? input.ballVelocity.z > 0.4 : input.ballVelocity.z < -0.4;
    if (!ballComingToPaddle) return { valid: false, reason: 'ball moving away' };

    const command = input.shotCommand ?? DEFAULT_COMMAND;
    const profile = shotProfiles[input.requestedShot];
    const targetZ = input.side === 'player'
      ? THREE.MathUtils.randFloat(TABLE_BOUNDS.minZ * 0.78, TABLE_BOUNDS.minZ * 0.28)
      : THREE.MathUtils.randFloat(TABLE_BOUNDS.maxZ * 0.28, TABLE_BOUNDS.maxZ * 0.78);
    const screenAim = input.side === 'player' ? command.aimX : -command.aimX;
    const edgeInset = GAME_CONFIG.table.width * 0.065;
    const targetXBase = THREE.MathUtils.lerp(TABLE_BOUNDS.minX + edgeInset, TABLE_BOUNDS.maxX - edgeInset, (screenAim + 1) / 2);
    const error = (1 - (input.accuracy ?? GAME_CONFIG.paddle.accuracy)) * THREE.MathUtils.lerp(0.48, 0.22, command.power);
    const target = new THREE.Vector3(
      THREE.MathUtils.clamp(targetXBase + THREE.MathUtils.randFloatSpread(error), TABLE_BOUNDS.minX + edgeInset, TABLE_BOUNDS.maxX - edgeInset),
      GAME_CONFIG.table.topY + profile.arc + command.lift * 0.32,
      targetZ,
    );
    const direction = target.sub(input.ballPosition).normalize();
    const commandPower = THREE.MathUtils.lerp(0.72, 1.28, command.power);
    const power = profile.speed * commandPower * (input.powerScale ?? 1);
    const velocity = direction.multiplyScalar(power);
    const minLift = input.requestedShot === 'lob' ? 2.18 : THREE.MathUtils.lerp(0.9, 1.24, command.lift);
    velocity.y = Math.max(velocity.y + profile.lift + command.lift * 0.58, minLift);

    const sideSign = input.side === 'player' ? -1 : 1;
    const topOrBackSpin = profile.spin + command.spin * GAME_CONFIG.paddle.spin;
    const sideSpin = command.curve * GAME_CONFIG.paddle.sideSpin;
    const spin = new THREE.Vector3(topOrBackSpin * sideSign, 0, sideSpin * sideSign - input.paddleForward.x * 1.1);
    return { valid: true, shotType: input.requestedShot, velocity, spin };
  }
}
