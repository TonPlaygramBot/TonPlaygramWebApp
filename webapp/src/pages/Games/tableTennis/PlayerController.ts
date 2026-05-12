import * as THREE from "three";
import { clamp, PlayerSide, TABLE_HALF_L, TABLE_HALF_W, TT } from "./gameConfig";

export type PlayerMotionTarget = { pos: THREE.Vector3; target: THREE.Vector3; yaw: number; speed?: number; cooldown?: number; action?: string };

export class PlayerController {
  constructor(private side: PlayerSide) {}

  update(player: PlayerMotionTarget, ballPos: THREE.Vector3, dt: number) {
    const to = player.target.clone().sub(player.pos);
    const dist = to.length();
    const maxStep = (player.speed ?? TT.player.speed) * dt;
    if (dist > 0.0001) player.pos.addScaledVector(to.normalize(), Math.min(maxStep, dist));
    player.pos.x = clamp(player.pos.x, -TABLE_HALF_W * TT.player.safeXRatio, TABLE_HALF_W * TT.player.safeXRatio);
    if (this.side === "near") player.pos.z = clamp(player.pos.z, TABLE_HALF_L + TT.player.nearZMinExtra, TABLE_HALF_L + TT.player.nearZMaxExtra);
    else player.pos.z = clamp(player.pos.z, -TABLE_HALF_L - TT.player.nearZMaxExtra, -TABLE_HALF_L - TT.player.nearZMinExtra);

    const face = ballPos.clone().sub(player.pos).setY(0);
    if (face.lengthSq() < 0.001) face.set(0, 0, this.side === "near" ? -1 : 1);
    face.normalize();
    const targetYaw = Math.atan2(-face.x, -face.z);
    let delta = targetYaw - player.yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    player.yaw += delta * (1 - Math.exp(-10 * dt));
    if (player.cooldown !== undefined) player.cooldown = Math.max(0, player.cooldown - dt);
  }

  shotAction(ballX: number, playerX: number): "forehand" | "backhand" {
    return ballX - playerX < -0.12 ? "backhand" : "forehand";
  }
}
