import * as THREE from 'three';
import { BallPhysics } from './BallPhysics';
import { GAME_CONFIG, ShotCommand, ShotType } from './gameConfig';

export class AIController {
  readonly targetX = { value: 0 };
  currentShot: ShotType = 'forehand drive';
  private reactionTimer = 0;
  private committedLanding: THREE.Vector3 | null = null;
  private shotCommand: ShotCommand = { aimX: 0, power: 0.62, lift: 0.42, curve: 0, spin: 0.2 };

  constructor(private root: THREE.Group, private hand: THREE.Object3D, private paddle: THREE.Object3D) {}

  update(dt: number, ball: BallPhysics) {
    const cfg = GAME_CONFIG.ai.difficulty;
    this.reactionTimer -= dt;
    if (this.reactionTimer <= 0) {
      this.committedLanding = ball.predictLandingPoint('ai');
      if (this.committedLanding) {
        const noise = (1 - cfg.accuracy) * THREE.MathUtils.randFloatSpread(0.55);
        this.targetX.value = THREE.MathUtils.clamp(this.committedLanding.x + noise, GAME_CONFIG.ai.minX, GAME_CONFIG.ai.maxX);
        this.shotCommand = this.planShot(ball, cfg.accuracy);
      }
      this.reactionTimer = cfg.reactionTime;
    }

    this.root.position.x = THREE.MathUtils.damp(this.root.position.x, this.targetX.value, cfg.moveSpeed, dt);
    this.root.position.z = GAME_CONFIG.ai.z;
    this.currentShot = this.chooseShot(ball.position);
    const yaw = THREE.MathUtils.clamp((ball.position.x - this.root.position.x) * 0.4 + this.shotCommand.curve * 0.1, -0.55, 0.55);
    this.root.rotation.y = Math.PI + yaw;
    const side = this.currentShot === 'forehand drive' ? -1 : 1;
    this.hand.position.set(side * (0.16 + Math.abs(this.shotCommand.curve) * 0.05), 0.92 + this.shotCommand.lift * 0.08, -0.22 - this.shotCommand.power * 0.12);
    this.paddle.position.set(0, -0.02, -0.12);
    this.paddle.rotation.set(-0.25 - this.shotCommand.lift * 0.16, this.shotCommand.curve * -0.2, side * (0.12 + this.shotCommand.power * 0.1));
  }

  canReach(ballPosition: THREE.Vector3) {
    return Math.abs(ballPosition.x - this.root.position.x) <= GAME_CONFIG.ai.maxReach && ballPosition.z < -1.3 && ballPosition.z > -2.68;
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

  private planShot(ball: BallPhysics, accuracy: number): ShotCommand {
    const crossCourt = ball.position.x > 0 ? -0.62 : 0.62;
    const openTable = THREE.MathUtils.clamp(crossCourt + THREE.MathUtils.randFloatSpread((1 - accuracy) * 0.5), -1, 1);
    const power = THREE.MathUtils.clamp(THREE.MathUtils.randFloat(0.48, 0.92) * GAME_CONFIG.ai.difficulty.shotPower, 0, 1);
    const lift = THREE.MathUtils.clamp(ball.position.y > GAME_CONFIG.table.topY + 0.42 ? 0.72 : THREE.MathUtils.randFloat(0.22, 0.58), 0, 1);
    const curve = THREE.MathUtils.randFloatSpread(0.9) * accuracy;
    const spin = power > 0.72 ? THREE.MathUtils.randFloat(0.35, 0.85) : THREE.MathUtils.randFloat(-0.28, 0.45);
    return { aimX: openTable, power, lift, curve, spin };
  }

  private chooseShot(ballPosition: THREE.Vector3): ShotType {
    if (this.shotCommand.power > 0.8 && Math.abs(this.shotCommand.curve) > 0.32) return 'swerve power';
    if (this.shotCommand.lift > 0.72 || ballPosition.y > GAME_CONFIG.table.topY + 0.55) return 'lob';
    if (this.shotCommand.power < 0.34 || ballPosition.y < GAME_CONFIG.table.topY + 0.18) return 'push';
    if (this.shotCommand.spin > 0.45 || Math.abs(this.shotCommand.curve) > 0.22) return 'brush/topspin';
    return ballPosition.x > this.root.position.x ? 'forehand drive' : 'backhand drive';
  }
}
