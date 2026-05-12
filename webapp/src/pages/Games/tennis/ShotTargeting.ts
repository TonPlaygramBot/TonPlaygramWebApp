import { clamp, gameConfig, type PlayerSide, type ShotType } from "./gameConfig";
import type { Vec3Like } from "./CourtRules";

export class ShotTargeting {
  clampTarget(target: Vec3Like, hitter: PlayerSide, shotType: ShotType = "flat") {
    const margin = shotType === "drop" ? 0.9 : 0.45;
    return {
      x: clamp(target.x, -gameConfig.courtW / 2 + margin, gameConfig.courtW / 2 - margin),
      y: gameConfig.ballRadius,
      z: hitter === "near"
        ? clamp(target.z, -gameConfig.courtL / 2 + margin, -0.65)
        : clamp(target.z, 0.65, gameConfig.courtL / 2 - margin),
    };
  }
}
