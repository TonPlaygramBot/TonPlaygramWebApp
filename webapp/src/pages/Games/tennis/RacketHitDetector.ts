import { gameConfig, type PlayerSide } from "./gameConfig";
import type { Vec3Like } from "./CourtRules";

export type HitValidation = { valid: boolean; timingQuality: number; reason: string };

export class RacketHitDetector {
  validate(args: { racketPos: Vec3Like; ballPos: Vec3Like; ballVelocity: Vec3Like; swingT: number; playerPos: Vec3Like; side: PlayerSide }): HitValidation {
    const dx = args.ballPos.x - args.racketPos.x;
    const dy = args.ballPos.y - args.racketPos.y;
    const dz = args.ballPos.z - args.racketPos.z;
    const dist = Math.hypot(dx, dy * 0.7, dz);
    if (dist > gameConfig.racketHitRadius) return { valid: false, timingQuality: 0, reason: "outside hit radius" };
    if (args.swingT < gameConfig.timingWindow.start || args.swingT > gameConfig.timingWindow.end) return { valid: false, timingQuality: 0, reason: "outside timing window" };
    if (args.ballPos.y < gameConfig.minContactHeight || args.ballPos.y > gameConfig.maxContactHeight) return { valid: false, timingQuality: 0, reason: "bad contact height" };
    if (Math.hypot(args.ballPos.x - args.playerPos.x, args.ballPos.z - args.playerPos.z) > gameConfig.maxReachDistance) return { valid: false, timingQuality: 0, reason: "outside reach" };
    const center = (gameConfig.timingWindow.start + gameConfig.timingWindow.end) * 0.5;
    const half = (gameConfig.timingWindow.end - gameConfig.timingWindow.start) * 0.5;
    return { valid: true, timingQuality: Math.max(0, 1 - Math.abs(args.swingT - center) / half), reason: "valid" };
  }
}
