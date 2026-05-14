import * as THREE from 'three';
import { GAME_CONFIG, ShotType } from './gameConfig';

export interface PlayerVisuals {
  root: THREE.Group;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  hand: THREE.Object3D;
  paddle: THREE.Object3D;
}

export class PlayerController {
  readonly targetX = { value: 0 };
  currentShot: ShotType = 'forehand drive';
  isRecovering = false;
  private recoveryTimer = 0;
  private pointerX = 0;

  constructor(private visuals: PlayerVisuals) {}

  setInput(normalizedX: number) {
    this.pointerX = THREE.MathUtils.clamp(normalizedX, -1, 1);
    this.targetX.value = THREE.MathUtils.lerp(GAME_CONFIG.player.minX, GAME_CONFIG.player.maxX, (this.pointerX + 1) / 2);
  }

  update(dt: number, ballPosition: THREE.Vector3) {
    const root = this.visuals.root;
    root.position.x = THREE.MathUtils.damp(root.position.x, this.targetX.value, GAME_CONFIG.player.moveSpeed, dt);
    root.position.x = THREE.MathUtils.clamp(root.position.x, GAME_CONFIG.player.minX, GAME_CONFIG.player.maxX);
    root.position.z = GAME_CONFIG.player.z;

    const acrossBody = ballPosition.x < root.position.x - 0.05;
    this.currentShot = acrossBody ? 'backhand drive' : this.chooseForehandVariant(ballPosition);

    const lookYaw = THREE.MathUtils.clamp((ballPosition.x - root.position.x) * 0.45, -0.45, 0.45);
    this.visuals.torso.rotation.y = THREE.MathUtils.damp(this.visuals.torso.rotation.y, lookYaw, 9, dt);
    this.visuals.head.rotation.y = THREE.MathUtils.damp(this.visuals.head.rotation.y, lookYaw * 0.8, 10, dt);

    if (this.isRecovering) {
      this.recoveryTimer -= dt;
      if (this.recoveryTimer <= 0) this.isRecovering = false;
    }
    this.updatePaddleAttachment(dt, ballPosition);
  }

  triggerHit() {
    this.isRecovering = true;
    this.recoveryTimer = GAME_CONFIG.player.recoveryTime;
  }

  getPaddleWorldPosition() {
    return this.visuals.paddle.getWorldPosition(new THREE.Vector3());
  }

  getPaddleForward() {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.visuals.paddle.getWorldQuaternion(new THREE.Quaternion())).normalize();
  }

  private chooseForehandVariant(ballPosition: THREE.Vector3): ShotType {
    if (ballPosition.y > GAME_CONFIG.table.topY + 0.55) return 'lob';
    if (ballPosition.y < GAME_CONFIG.table.topY + 0.18) return 'push';
    if (Math.abs(ballPosition.x - this.visuals.root.position.x) > 0.32) return 'brush/topspin';
    return 'forehand drive';
  }

  private updatePaddleAttachment(dt: number, ballPosition: THREE.Vector3) {
    const hand = this.visuals.hand;
    const paddle = this.visuals.paddle;
    const side = this.currentShot === 'backhand drive' ? -1 : 1;
    const reach = this.isRecovering
      ? GAME_CONFIG.player.reach * 0.65
      : THREE.MathUtils.clamp((GAME_CONFIG.player.z - ballPosition.z) * 0.24, 0.08, GAME_CONFIG.player.reach * 0.73);
    hand.position.set(0.16 * side, 0.92, -0.12 - reach);
    hand.rotation.y = THREE.MathUtils.damp(hand.rotation.y, side * 0.28, 12, dt);
    hand.rotation.x = THREE.MathUtils.damp(hand.rotation.x, this.isRecovering ? -0.45 : -0.2, 12, dt);
    paddle.position.set(0, -0.02, -0.12);
    paddle.rotation.set(-0.25, 0, side * 0.16);
  }
}
