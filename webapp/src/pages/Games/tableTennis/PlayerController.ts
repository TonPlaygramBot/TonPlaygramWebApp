import * as THREE from "three";
import { TABLE_HALF_L, TABLE_HALF_W, TABLE_TENNIS_CONFIG as CFG, clamp, clamp01, PlayerSide } from "./gameConfig";

export type PlayerRigMotion = { side: PlayerSide; pos: THREE.Vector3; target: THREE.Vector3; yaw: number; speed: number; action: "ready" | "forehand" | "backhand" | "serve"; swingT: number; cooldown: number; model?: THREE.Object3D | null; root: THREE.Object3D; modelRoot: THREE.Object3D };

export function yawFromForward(forward: THREE.Vector3) { return Math.atan2(-forward.x, -forward.z); }

export class PlayerController {
  update(player: PlayerRigMotion, ballPos: THREE.Vector3, dt: number) {
    const to = player.target.clone().sub(player.pos);
    const dist = to.length();
    const maxStep = player.speed * dt;
    if (dist > 0.0001) player.pos.addScaledVector(to.normalize(), Math.min(maxStep, dist));
    player.pos.x = clamp(player.pos.x, -TABLE_HALF_W * CFG.playerSafeX, TABLE_HALF_W * CFG.playerSafeX);
    if (player.side === "near") player.pos.z = clamp(player.pos.z, TABLE_HALF_L + CFG.playerNearZMin, TABLE_HALF_L + CFG.playerNearZMax);
    else player.pos.z = clamp(player.pos.z, -TABLE_HALF_L - CFG.playerNearZMax, -TABLE_HALF_L - CFG.playerNearZMin);

    const face = ballPos.clone().sub(player.pos).setY(0);
    if (face.lengthSq() < 0.001) face.set(0, 0, player.side === "near" ? -1 : 1);
    const targetYaw = yawFromForward(face.normalize());
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
        player.swingT = 0; player.action = "ready"; player.cooldown = Math.max(player.cooldown, 0.08);
      }
    }
  }
}
