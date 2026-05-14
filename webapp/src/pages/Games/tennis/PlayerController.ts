import * as THREE from "three";
import { clamp, FootworkState, gameConfig, PlayerSide } from "./gameConfig";

export class PlayerController {
  static clampMovement(pos: THREE.Vector3, side: PlayerSide, serving = false) {
    if (serving) {
      const lanePad = 0.18;
      pos.x = clamp(pos.x, -gameConfig.doublesW / 2 + lanePad, gameConfig.doublesW / 2 - lanePad);
      const baseline = gameConfig.courtL / 2;
      const depth = 1.38 * gameConfig.worldScale;
      pos.z = side === "near" ? clamp(pos.z, baseline + 0.35, baseline + depth) : clamp(pos.z, -baseline - depth, -baseline - 0.35);
      return pos;
    }
    pos.x = clamp(pos.x, -gameConfig.courtW / 2 + 0.35, gameConfig.courtW / 2 - 0.35);
    pos.z = side === "near" ? clamp(pos.z, 0.76, gameConfig.courtL / 2 - 0.42) : clamp(pos.z, -gameConfig.courtL / 2 + 0.42, -0.76);
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
