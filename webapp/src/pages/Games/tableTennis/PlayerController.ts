import * as THREE from "three";
import { CFG, TABLE_HALF_L, TABLE_HALF_W, type BallState, type StrokeAction, clamp, clamp01 } from "./gameConfig";

export type PlayerControllerRig = {
  side: "near" | "far";
  pos: THREE.Vector3;
  target: THREE.Vector3;
  yaw: number;
  speed: number;
  action: StrokeAction;
  swingT: number;
  cooldown: number;
  desiredHit: unknown | null;
  hitThisSwing: boolean;
  root: THREE.Group;
  modelRoot: THREE.Group;
  model: THREE.Object3D | null;
};

export function yawFromForward(forward: THREE.Vector3) {
  return Math.atan2(-forward.x, -forward.z);
}

export function forwardFromYaw(yaw: number) {
  return new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).normalize();
}

export function rightFromForward(forward: THREE.Vector3) {
  return new THREE.Vector3(-forward.z, 0, forward.x).normalize();
}

export class PlayerController {
  update(player: PlayerControllerRig, ball: BallState, dt: number) {
    const to = player.target.clone().sub(player.pos);
    const dist = to.length();
    const maxStep = player.speed * dt;
    if (dist > 0.0001) player.pos.addScaledVector(to.normalize(), Math.min(maxStep, dist));

    player.pos.x = clamp(player.pos.x, -TABLE_HALF_W * 0.82, TABLE_HALF_W * 0.82);
    if (player.side === "near") player.pos.z = clamp(player.pos.z, TABLE_HALF_L + CFG.playerSafeZMargin, TABLE_HALF_L + 0.9);
    else player.pos.z = clamp(player.pos.z, -TABLE_HALF_L - 0.9, -TABLE_HALF_L - CFG.playerSafeZMargin);

    let face = ball.pos.clone().sub(player.pos).setY(0);
    if (face.lengthSq() < 0.001) face.set(0, 0, player.side === "near" ? -1 : 1);
    face.normalize();
    const targetYaw = yawFromForward(face);
    let delta = targetYaw - player.yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    player.yaw += delta * (1 - Math.exp(-10 * dt));

    player.root.position.copy(player.pos);
    player.modelRoot.position.copy(player.pos);
    player.modelRoot.rotation.y = player.yaw;
    if (player.model) {
      const runAmount = clamp01(dist / 0.18);
      player.model.position.y = Math.sin(performance.now() * 0.015) * 0.014 * runAmount - (player.action === "ready" ? 0.012 : 0);
      player.model.rotation.x = 0.025 * runAmount;
    }

    player.cooldown = Math.max(0, player.cooldown - dt);
    if (player.swingT > 0) {
      const duration = player.action === "serve" ? CFG.serveDuration : player.action === "backhand" ? CFG.backhandDuration : CFG.swingDuration;
      player.swingT += dt / duration;
      if (player.swingT >= 1) {
        player.swingT = 0;
        player.action = "ready";
        player.desiredHit = null;
        player.hitThisSwing = false;
      }
    }
  }
}
