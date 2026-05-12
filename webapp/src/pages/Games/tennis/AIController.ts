import { clamp, gameConfig } from "./gameConfig";
import type { Vec3Like } from "./CourtRules";

export class AIController {
  difficulty = gameConfig.ai;
  chooseReturnPosition(landing: Vec3Like) {
    return {
      x: clamp(landing.x, -gameConfig.courtW / 2 + 0.35, gameConfig.courtW / 2 - 0.35),
      y: 0,
      z: clamp(Math.min(-0.72, landing.z + 0.42), -gameConfig.courtL / 2 + 0.42, -0.64),
    };
  }

  canReach(aiPos: Vec3Like, ballPos: Vec3Like) {
    return Math.hypot(aiPos.x - ballPos.x, aiPos.z - ballPos.z) <= this.difficulty.reachRadius && ballPos.y >= 0.25 && ballPos.y <= 1.85;
  }
}
