import * as THREE from 'three';
import { GAME_CONFIG, ShotCommand, ShotType } from './gameConfig';

export interface PlayerVisuals {
  root: THREE.Group;
  torso: THREE.Object3D;
  head: THREE.Object3D;
  hand: THREE.Object3D;
  paddle: THREE.Object3D;
}

const DEFAULT_SHOT: ShotCommand = { aimX: 0, power: 0.58, lift: 0.45, curve: 0, spin: 0.25 };

export class PlayerController {
  readonly targetX = { value: 0 };
  currentShot: ShotType = 'forehand drive';
  isRecovering = false;
  private recoveryTimer = 0;
  private queuedShot: ShotCommand | null = null;
  private queuedShotAge = 0;
  private readonly maxQueuedShotAge = 1.6;

  constructor(private visuals: PlayerVisuals) {}

  queueShot(command: ShotCommand) {
    this.queuedShot = {
      aimX: THREE.MathUtils.clamp(command.aimX, -1, 1),
      power: THREE.MathUtils.clamp(command.power, 0, 1),
      lift: THREE.MathUtils.clamp(command.lift, 0, 1),
      curve: THREE.MathUtils.clamp(command.curve, -1, 1),
      spin: THREE.MathUtils.clamp(command.spin, -1, 1),
    };
    this.queuedShotAge = 0;
  }

  peekShotCommand(): ShotCommand {
    return this.queuedShot ?? DEFAULT_SHOT;
  }

  consumeShotCommand(): ShotCommand {
    const shot = this.peekShotCommand();
    this.queuedShot = null;
    return shot;
  }

  update(dt: number, ballPosition: THREE.Vector3, predictedLanding: THREE.Vector3 | null) {
    if (this.queuedShot) {
      this.queuedShotAge += dt;
      if (this.queuedShotAge > this.maxQueuedShotAge) this.queuedShot = null;
    }

    const root = this.visuals.root;
    const isIncoming = ballPosition.z > 0.12;
    const trackX = predictedLanding && predictedLanding.z > 0
      ? predictedLanding.x
      : ballPosition.x + THREE.MathUtils.clamp(ballPosition.x - root.position.x, -GAME_CONFIG.player.autoTrackLead, GAME_CONFIG.player.autoTrackLead);
    this.targetX.value = THREE.MathUtils.clamp(isIncoming ? trackX : ballPosition.x * 0.42, GAME_CONFIG.player.minX, GAME_CONFIG.player.maxX);
    root.position.x = THREE.MathUtils.damp(root.position.x, this.targetX.value, GAME_CONFIG.player.moveSpeed, dt);
    root.position.x = THREE.MathUtils.clamp(root.position.x, GAME_CONFIG.player.minX, GAME_CONFIG.player.maxX);
    root.position.z = GAME_CONFIG.player.z;

    const command = this.peekShotCommand();
    const acrossBody = ballPosition.x < root.position.x - 0.05;
    this.currentShot = this.chooseShotVariant(ballPosition, acrossBody, command);

    const lookYaw = THREE.MathUtils.clamp((ballPosition.x - root.position.x) * 0.45 + command.curve * 0.1, -0.52, 0.52);
    this.visuals.torso.rotation.y = THREE.MathUtils.damp(this.visuals.torso.rotation.y, lookYaw, 9, dt);
    this.visuals.head.rotation.y = THREE.MathUtils.damp(this.visuals.head.rotation.y, lookYaw * 0.8, 10, dt);

    if (this.isRecovering) {
      this.recoveryTimer -= dt;
      if (this.recoveryTimer <= 0) this.isRecovering = false;
    }
    this.updatePaddleAttachment(dt, ballPosition, command);
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

  private chooseShotVariant(ballPosition: THREE.Vector3, acrossBody: boolean, command: ShotCommand): ShotType {
    if (command.power > 0.82 && Math.abs(command.curve) > 0.34) return 'swerve power';
    if (command.lift > 0.76 || ballPosition.y > GAME_CONFIG.table.topY + 0.55) return 'lob';
    if (command.power < 0.34 || ballPosition.y < GAME_CONFIG.table.topY + 0.18) return 'push';
    if (command.spin > 0.45 || Math.abs(command.curve) > 0.22) return 'brush/topspin';
    return acrossBody ? 'backhand drive' : 'forehand drive';
  }

  private updatePaddleAttachment(dt: number, ballPosition: THREE.Vector3, command: ShotCommand) {
    const hand = this.visuals.hand;
    const paddle = this.visuals.paddle;
    const side = this.currentShot === 'backhand drive' ? -1 : 1;
    const reach = this.isRecovering ? 0.34 : THREE.MathUtils.clamp((GAME_CONFIG.player.z - ballPosition.z) * 0.28, 0.12, 0.48);
    const powerLoad = THREE.MathUtils.lerp(-0.08, -0.2, command.power);
    hand.position.set((0.16 + Math.abs(command.curve) * 0.05) * side, 0.92 + command.lift * 0.08, powerLoad - reach);
    hand.rotation.y = THREE.MathUtils.damp(hand.rotation.y, side * (0.22 + Math.abs(command.curve) * 0.28), 12, dt);
    hand.rotation.x = THREE.MathUtils.damp(hand.rotation.x, this.isRecovering ? -0.48 : -0.16 - command.lift * 0.24, 12, dt);
    paddle.position.set(0, -0.02, -0.12);
    paddle.rotation.set(-0.25 - command.lift * 0.18, command.curve * 0.22, side * (0.12 + command.power * 0.1));
  }
}
