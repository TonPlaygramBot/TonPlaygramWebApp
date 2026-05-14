import * as THREE from "three";
import { clamp, FootworkState, gameConfig, PlayerSide } from "./gameConfig";

export class PlayerController {
  static clampMovement(pos: THREE.Vector3, side: PlayerSide) {
    pos.x = clamp(pos.x, -gameConfig.courtW / 2 + 0.35, gameConfig.courtW / 2 - 0.35);
    const baselineRunoff = 1.35 * gameConfig.worldScale;
    pos.z = side === "near"
      ? clamp(pos.z, 0.76, gameConfig.courtL / 2 + baselineRunoff)
      : clamp(pos.z, -gameConfig.courtL / 2 - baselineRunoff, -0.76);
    return pos;
  }

  static footworkFromDelta(dx: number, dz: number, side: PlayerSide, swinging: "forehand" | "backhand" | "serve" | null): FootworkState {
    if (swinging === "serve") return "Serve";
    if (swinging === "forehand") return "Forehand";
    if (swinging === "backhand") return "Backhand";
    if (Math.abs(dx) > Math.abs(dz) && Math.abs(dx) > 0.03) return dx > 0 ? "MoveRight" : "MoveLeft";
    if (Math.abs(dz) > 0.03) return (side === "near" ? dz < 0 : dz > 0) ? "MoveForward" : "MoveBack";
    return "IdleReady";
  }
}
