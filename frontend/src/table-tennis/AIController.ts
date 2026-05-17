import * as THREE from 'three';
import { BallPhysics } from './BallPhysics';
import { GAME_CONFIG, ShotCommand, ShotType, TABLE_BOUNDS } from './gameConfig';

const BASE_TABLE_WIDTH = 61.651044 * 0.045;
const BASE_TABLE_LENGTH = 90.4215312 * 0.045;
const TABLE_AI_REACH_MAX_Z = TABLE_BOUNDS.minZ + GAME_CONFIG.table.length * (0.34 / BASE_TABLE_LENGTH);
const TABLE_AI_REACH_MIN_Z = GAME_CONFIG.ai.z - GAME_CONFIG.table.length * (0.27 / BASE_TABLE_LENGTH);

export class AIController {
  readonly targetX = { value: 0 };
  currentShot: ShotType = 'forehand drive';
  private reactionTimer = 0;
  private committedLanding: THREE.Vector3 | null = null;
  private readonly shotCommand: ShotCommand = { aimX: 0, power: 0.76, lift: 0.42, curve: 0, spin: 0.34 };

  constructor(private root: THREE.Group, private hand: THREE.Object3D, private paddle: THREE.Object3D) {}

  update(dt: number, ball: BallPhysics) {
    const cfg = GAME_CONFIG.ai.difficulty;
    this.reactionTimer -= dt;
    if (this.reactionTimer <= 0) {
      this.committedLanding = ball.predictLandingPoint('ai');
      if (this.committedLanding) {
        const noise = (1 - cfg.accuracy) * THREE.MathUtils.randFloatSpread(GAME_CONFIG.table.width * (0.38 / BASE_TABLE_WIDTH));
        this.targetX.value = THREE.MathUtils.clamp(this.committedLanding.x + noise, GAME_CONFIG.ai.minX, GAME_CONFIG.ai.maxX);
        this.prepareShotCommand(ball);
      }
      const speedRead = THREE.MathUtils.clamp(ball.velocity.length() / 7, 0, 0.055);
      this.reactionTimer = Math.max(0.075, cfg.reactionTime - speedRead);
    }

    this.root.position.x = THREE.MathUtils.damp(this.root.position.x, this.targetX.value, cfg.moveSpeed, dt);
    this.root.position.z = GAME_CONFIG.ai.z;
    this.currentShot = ball.position.x > this.root.position.x ? 'forehand drive' : 'backhand drive';
    const yaw = THREE.MathUtils.clamp((ball.position.x - this.root.position.x) * 0.4, -0.5, 0.5);
    this.root.rotation.y = Math.PI + yaw;
    this.hand.position.set(this.currentShot === 'forehand drive' ? -0.16 : 0.16, 0.92, -0.28);
    this.paddle.position.set(0, -0.02, -0.12);
    this.paddle.rotation.set(-0.25, 0, this.currentShot === 'forehand drive' ? -0.16 : 0.16);
  }

  private prepareShotCommand(ball: BallPhysics) {
    const pressure = THREE.MathUtils.clamp(ball.velocity.length() / 6, 0, 1);
    const openCourtAim = THREE.MathUtils.clamp(-this.root.position.x / (GAME_CONFIG.table.width * 0.5), -0.82, 0.82);
    this.shotCommand.aimX = THREE.MathUtils.clamp(openCourtAim + THREE.MathUtils.randFloatSpread(0.34), -1, 1);
    this.shotCommand.power = THREE.MathUtils.clamp(0.68 + pressure * 0.24 + THREE.MathUtils.randFloatSpread(0.08), 0.62, 0.95);
    this.shotCommand.lift = THREE.MathUtils.clamp(0.34 + pressure * 0.18 + THREE.MathUtils.randFloatSpread(0.1), 0.26, 0.66);
    this.shotCommand.curve = THREE.MathUtils.clamp(THREE.MathUtils.randFloatSpread(0.34), -0.5, 0.5);
    this.shotCommand.spin = THREE.MathUtils.clamp(0.28 + pressure * 0.28, 0.22, 0.72);
  }

  canReach(ballPosition: THREE.Vector3) {
    return (
      Math.abs(ballPosition.x - this.root.position.x) <= GAME_CONFIG.ai.maxReach &&
      ballPosition.z < TABLE_AI_REACH_MAX_Z &&
      ballPosition.z > TABLE_AI_REACH_MIN_Z
    );
  }

  shouldMiss() {
    return Math.random() < GAME_CONFIG.ai.difficulty.mistakeChance;
  }

  getShotCommand() {
    return this.shotCommand;
  }

  getPaddleWorldPosition() {
    return this.paddle.getWorldPosition(new THREE.Vector3());
  }

  getPaddleForward() {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(this.paddle.getWorldQuaternion(new THREE.Quaternion())).normalize();
  }

}
