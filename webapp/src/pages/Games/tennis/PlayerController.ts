import { clamp, gameConfig, type FootworkState, type PlayerSide } from "./gameConfig";
import type { Vec3Like } from "./CourtRules";

export class PlayerController {
  footwork: FootworkState = "IdleReady";
  clampMovement(pos: Vec3Like, side: PlayerSide) {
    pos.x = clamp(pos.x, -gameConfig.courtW / 2 + 0.35, gameConfig.courtW / 2 - 0.35);
    pos.z = side === "near" ? clamp(pos.z, 0.76, gameConfig.courtL / 2 - 0.42) : clamp(pos.z, -gameConfig.courtL / 2 + 0.42, -0.76);
    return pos;
  }
}
