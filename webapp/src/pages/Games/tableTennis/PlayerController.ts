import * as THREE from "three";
import { PlayerSide, TABLE_HALF_L, TABLE_HALF_W, clamp, gameConfig } from "./gameConfig";
import type { BallData } from "./BallPhysics";

export type PlayerAvatar = {
  side: PlayerSide;
  group: THREE.Group;
  body: THREE.Group;
  head: THREE.Mesh;
  paddle: THREE.Group;
  position: THREE.Vector3;
  target: THREE.Vector3;
  yaw: number;
  swing: 0 | 1;
  swingT: number;
  recovery: number;
  stroke: "ready" | "forehand" | "backhand" | "serve";
  paddleWorld: THREE.Vector3;
  paddleForward: THREE.Vector3;
};

export class PlayerController {
  constructor(public readonly avatar: PlayerAvatar, private readonly speed = gameConfig.player.moveSpeed) {}

  setTarget(x: number, z: number) {
    const xLimit = TABLE_HALF_W - gameConfig.player.safeXInset;
    this.avatar.target.x = clamp(x, -xLimit, xLimit);
    if (this.avatar.side === "near") this.avatar.target.z = clamp(z, TABLE_HALF_L + gameConfig.player.nearZMinPad, TABLE_HALF_L + gameConfig.player.nearZMaxPad);
    else this.avatar.target.z = clamp(z, -TABLE_HALF_L - gameConfig.player.nearZMaxPad, -TABLE_HALF_L - gameConfig.player.nearZMinPad);
  }

  startSwing(stroke: PlayerAvatar["stroke"]) {
    if (this.avatar.recovery > 0) return false;
    this.avatar.stroke = stroke;
    this.avatar.swing = 1;
    this.avatar.swingT = 0;
    return true;
  }

  completeHit() {
    this.avatar.recovery = gameConfig.player.hitRecovery;
  }

  update(dt: number, ball: BallData) {
    const a = this.avatar;
    const to = a.target.clone().sub(a.position);
    const step = Math.min(to.length(), this.speed * dt);
    if (step > 0.0001) a.position.addScaledVector(to.normalize(), step);
    this.setTarget(a.target.x, a.target.z);
    a.position.x = clamp(a.position.x, -TABLE_HALF_W + gameConfig.player.safeXInset, TABLE_HALF_W - gameConfig.player.safeXInset);

    const look = ball.position.clone().sub(a.position).setY(0);
    if (look.lengthSq() < 0.001) look.set(0, 0, a.side === "near" ? -1 : 1);
    look.normalize();
    const targetYaw = Math.atan2(look.x, look.z);
    let delta = targetYaw - a.yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    a.yaw += delta * (1 - Math.exp(-10 * dt));

    if (a.swing) {
      a.swingT += dt / (a.stroke === "serve" ? 0.7 : 0.34);
      if (a.swingT >= 1) {
        a.swing = 0;
        a.swingT = 0;
        a.stroke = "ready";
      }
    }
    a.recovery = Math.max(0, a.recovery - dt);
    this.applyVisual(ball);
  }

  chooseStroke(ball: BallData) {
    const acrossBody = ball.position.x - this.avatar.position.x < -0.08;
    return acrossBody ? "backhand" : "forehand";
  }

  private applyVisual(ball: BallData) {
    const a = this.avatar;
    a.group.position.copy(a.position);
    a.group.rotation.y = a.yaw;
    const phase = a.swing ? Math.sin(Math.min(1, a.swingT) * Math.PI) : 0;
    const sideSign = a.stroke === "backhand" ? -1 : 1;
    a.body.rotation.y = sideSign * phase * 0.25;
    a.body.rotation.x = 0.06 + phase * 0.04;
    a.head.lookAt(a.group.worldToLocal(ball.position.clone()).add(new THREE.Vector3(0, 1.35, 0)));

    const forward = new THREE.Vector3(Math.sin(a.yaw), 0, Math.cos(a.yaw)).normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
    const hand = a.position.clone()
      .addScaledVector(right, (a.stroke === "backhand" ? -0.27 : 0.27) + sideSign * phase * 0.12)
      .addScaledVector(forward, a.side === "near" ? -0.23 - phase * 0.18 : 0.23 + phase * 0.18)
      .setY(gameConfig.table.topY + 0.28 + phase * 0.08);
    a.paddle.position.copy(hand);
    const face = a.side === "near" ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 0, 1);
    face.applyAxisAngle(new THREE.Vector3(0, 1, 0), a.yaw * 0.18 + sideSign * phase * 0.25).normalize();
    a.paddle.lookAt(hand.clone().add(face));
    a.paddle.rotateX(Math.PI / 2);
    a.paddleWorld.copy(hand);
    a.paddleForward.copy(face);
  }
}
