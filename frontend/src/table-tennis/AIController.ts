import * as THREE from 'three';
import { BallPhysics } from './BallPhysics';
import { GAME_CONFIG, ShotType, TABLE_BOUNDS } from './gameConfig';

export class AIController {
  readonly targetX = { value: 0 };
  currentShot: ShotType = 'forehand drive';
  private reactionTimer = 0;
  private committedLanding: THREE.Vector3 | null = null;

  constructor(
    private root: THREE.Group,
    private hand: THREE.Object3D,
    private paddle: THREE.Object3D
  ) {}

  update(dt: number, ball: BallPhysics) {
    const cfg = GAME_CONFIG.ai.difficulty;
    this.reactionTimer -= dt;
    if (this.reactionTimer <= 0) {
      this.committedLanding = ball.predictLandingPoint('ai');
      if (this.committedLanding) {
        const noise =
          (1 - cfg.accuracy) * THREE.MathUtils.randFloatSpread(0.55);
        this.targetX.value = THREE.MathUtils.clamp(
          this.committedLanding.x + noise,
          GAME_CONFIG.ai.minX,
          GAME_CONFIG.ai.maxX
        );
      }
      this.reactionTimer = cfg.reactionTime;
    }

    this.root.position.x = THREE.MathUtils.damp(
      this.root.position.x,
      this.targetX.value,
      cfg.moveSpeed,
      dt
    );
    this.root.position.z = GAME_CONFIG.ai.z;
    this.currentShot =
      ball.position.x > this.root.position.x
        ? 'forehand drive'
        : 'backhand drive';
    const yaw = THREE.MathUtils.clamp(
      (ball.position.x - this.root.position.x) * 0.4,
      -0.5,
      0.5
    );
    this.root.rotation.y = Math.PI + yaw;
    this.hand.position.set(
      this.currentShot === 'forehand drive' ? -0.16 : 0.16,
      0.92,
      -0.28
    );
    this.paddle.position.set(0, -0.02, -0.12);
    this.paddle.rotation.set(
      -0.25,
      0,
      this.currentShot === 'forehand drive' ? -0.16 : 0.16
    );
  }

  canReach(ballPosition: THREE.Vector3) {
    return (
      Math.abs(ballPosition.x - this.root.position.x) <=
        GAME_CONFIG.ai.maxReach &&
      ballPosition.z < TABLE_BOUNDS.minZ * 0.7 &&
      ballPosition.z > GAME_CONFIG.ai.z - 0.32
    );
  }

  shouldMiss() {
    return Math.random() < GAME_CONFIG.ai.difficulty.mistakeChance;
  }

  getPaddleWorldPosition() {
    return this.paddle.getWorldPosition(new THREE.Vector3());
  }

  getPaddleForward() {
    return new THREE.Vector3(0, 0, 1)
      .applyQuaternion(this.paddle.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();
  }
}
