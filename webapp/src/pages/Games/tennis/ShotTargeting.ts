import * as THREE from "three";
import { clamp, clamp01, gameConfig, PlayerSide, ShotTechnique } from "./gameConfig";

export type DesiredShot = { target: THREE.Vector3; power: number; technique: ShotTechnique; timingQuality?: number };

export class ShotTargeting {
  static clampTarget(target: THREE.Vector3, hitter: PlayerSide, serve = false) {
    const out = target.clone();
    out.x = clamp(out.x, -gameConfig.courtW / 2 + 0.28, gameConfig.courtW / 2 - 0.28);
    out.z = hitter === "near"
      ? clamp(out.z, -gameConfig.courtL / 2 + 0.6, serve ? -0.4 : -0.65)
      : clamp(out.z, serve ? 0.4 : 0.65, gameConfig.courtL / 2 - 0.6);
    out.y = gameConfig.ballR;
    return out;
  }

  static techniqueFromSwipe(dx: number, dy: number, isUnderPressure = false): ShotTechnique {
    if (dy > 120) return "drop";
    if (dy < -210) return "lob";
    if (Math.abs(dx) > 115) return "slice";
    if (isUnderPressure) return "block";
    return dy < -70 ? "topspin" : "flat";
  }

  static accuracyJitter(power: number, timingQuality = 1, movementPressure = 0, difficulty = 1) {
    const miss = (1 - timingQuality) * 0.75 + movementPressure * 0.45 + power * 0.08 + (1 - difficulty) * 0.5;
    return clamp01(miss) * gameConfig.courtW * 0.16;
  }
}
