import * as THREE from 'three';
import { GAME_CONFIG, ShotType, Side, TABLE_BOUNDS } from './gameConfig';

export interface PaddleHitInput {
  side: Side;
  paddlePosition: THREE.Vector3;
  paddleForward: THREE.Vector3;
  ballPosition: THREE.Vector3;
  ballVelocity: THREE.Vector3;
  ballSpin: THREE.Vector3;
  requestedShot: ShotType;
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

const shotProfiles: Record<
  ShotType,
  { lift: number; speed: number; spin: number; arc: number }
> = {
  'forehand drive': {
    lift: 1.55,
    speed: GAME_CONFIG.paddle.drivePower,
    spin: 2.2,
    arc: 0.18
  },
  'backhand drive': {
    lift: 1.45,
    speed: GAME_CONFIG.paddle.drivePower * 0.95,
    spin: 1.9,
    arc: 0.12
  },
  push: {
    lift: 1.15,
    speed: GAME_CONFIG.paddle.pushPower,
    spin: -1.6,
    arc: 0.24
  },
  'brush/topspin': {
    lift: 1.75,
    speed: GAME_CONFIG.paddle.drivePower * 0.92,
    spin: GAME_CONFIG.paddle.spin,
    arc: 0.04
  },
  lob: { lift: 2.75, speed: GAME_CONFIG.paddle.lobPower, spin: 0.7, arc: 0.42 }
};

export class PaddleHitDetector {
  detect(input: PaddleHitInput): PaddleHitResult {
    const distance = input.paddlePosition.distanceTo(input.ballPosition);
    if (distance > GAME_CONFIG.paddle.hitRadius)
      return { valid: false, reason: 'outside hit radius' };

    const incoming = input.ballVelocity.clone().normalize();
    const facingDot = input.paddleForward
      .clone()
      .normalize()
      .dot(incoming.clone().multiplyScalar(-1));
    if (facingDot < GAME_CONFIG.paddle.minFacingDot)
      return { valid: false, reason: 'paddle face angle' };

    const ballComingToPaddle =
      input.side === 'player'
        ? input.ballVelocity.z > 0.4
        : input.ballVelocity.z < -0.4;
    if (!ballComingToPaddle)
      return { valid: false, reason: 'ball moving away' };

    const profile = shotProfiles[input.requestedShot];
    const targetZ =
      input.side === 'player'
        ? THREE.MathUtils.randFloat(
            TABLE_BOUNDS.minZ * 0.7,
            TABLE_BOUNDS.minZ * 0.28
          )
        : THREE.MathUtils.randFloat(
            TABLE_BOUNDS.maxZ * 0.28,
            TABLE_BOUNDS.maxZ * 0.7
          );
    const targetXBase = THREE.MathUtils.clamp(
      -input.ballPosition.x * 0.55,
      TABLE_BOUNDS.minX + 0.12,
      TABLE_BOUNDS.maxX - 0.12
    );
    const error = (1 - (input.accuracy ?? GAME_CONFIG.paddle.accuracy)) * 0.42;
    const target = new THREE.Vector3(
      targetXBase + THREE.MathUtils.randFloatSpread(error),
      GAME_CONFIG.table.topY + profile.arc,
      targetZ
    );
    const direction = target.sub(input.ballPosition).normalize();
    const power = profile.speed * (input.powerScale ?? 1);
    const velocity = direction.multiplyScalar(power);
    velocity.y = Math.max(
      velocity.y + profile.lift,
      input.requestedShot === 'lob' ? 2.2 : 1.05
    );

    const sideSign = input.side === 'player' ? -1 : 1;
    const spin = new THREE.Vector3(
      profile.spin * sideSign,
      0,
      -input.paddleForward.x * 1.2
    );
    return { valid: true, shotType: input.requestedShot, velocity, spin };
  }
}
