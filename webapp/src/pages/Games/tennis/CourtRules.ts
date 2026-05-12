import { gameConfig, oppositeSide, sideOfZ, type PlayerSide, type ServeCourtSide } from "./gameConfig";

export type Vec3Like = { x: number; y: number; z: number };
export type RuleEventType = "serveIn" | "fault" | "out" | "doubleBounce" | "net" | "validBounce";
export type RuleEvent = { type: RuleEventType; winner?: PlayerSide; landingSide?: PlayerSide; reason: string };

export class CourtRules {
  readonly cfg = gameConfig;
  readonly halfSinglesW = this.cfg.courtW / 2;
  readonly halfDoublesW = this.cfg.doublesW / 2;
  readonly halfL = this.cfg.courtL / 2;

  getServeSide(totalPoints: number): ServeCourtSide {
    return totalPoints % 2 === 0 ? "deuce" : "ad";
  }

  serveLaneBoundsX(side: ServeCourtSide) {
    const laneMinAbs = this.halfSinglesW + 0.12;
    const laneMaxAbs = this.halfDoublesW - 0.12;
    return side === "deuce" ? { min: laneMinAbs, max: laneMaxAbs } : { min: -laneMaxAbs, max: -laneMinAbs };
  }

  serveXForSide(player: PlayerSide, side: ServeCourtSide) {
    const xAbs = Math.max(this.halfSinglesW + 0.12, Math.min(this.halfDoublesW - 0.2, this.halfSinglesW + 0.42));
    const sign = side === "deuce" ? 1 : -1;
    return (player === "near" ? sign : -sign) * xAbs;
  }

  isInsideSingles(pos: Vec3Like) {
    return Math.abs(pos.x) <= this.halfSinglesW && Math.abs(pos.z) <= this.halfL;
  }

  isInsideServiceBox(pos: Vec3Like, server: PlayerSide, side: ServeCourtSide) {
    const targetSide = oppositeSide(server);
    const xOk = side === "deuce" ? pos.x >= this.cfg.serviceBuffer : pos.x <= -this.cfg.serviceBuffer;
    const xInCourt = Math.abs(pos.x) <= this.halfSinglesW;
    const zOk = targetSide === "far"
      ? pos.z <= -this.cfg.serviceBuffer && pos.z >= -this.cfg.serviceLineZ
      : pos.z >= this.cfg.serviceBuffer && pos.z <= this.cfg.serviceLineZ;
    return xOk && xInCourt && zOk;
  }

  checkNet(prevZ: number, pos: Vec3Like, hitter: PlayerSide | null): RuleEvent | null {
    if (!hitter) return null;
    const crossed = (prevZ > 0 && pos.z <= 0) || (prevZ < 0 && pos.z >= 0) || Math.abs(pos.z) < 0.055;
    if (crossed && Math.abs(pos.x) <= this.halfDoublesW + 0.1 && pos.y < this.cfg.netHeight + this.cfg.ballRadius * 0.6) {
      return { type: "net", winner: oppositeSide(hitter), reason: "Net" };
    }
    return null;
  }

  checkBounce(pos: Vec3Like, hitter: PlayerSide | null, bounceCountOnSide: number, serveActive: boolean, serveSide: ServeCourtSide): RuleEvent | null {
    if (!hitter) return null;
    const landingSide = sideOfZ(pos.z);
    if (serveActive) {
      if (landingSide !== oppositeSide(hitter) || !this.isInsideServiceBox(pos, hitter, serveSide)) {
        return { type: "fault", winner: oppositeSide(hitter), landingSide, reason: "Fault" };
      }
      return { type: "serveIn", landingSide, reason: "Serve In" };
    }
    if (!this.isInsideSingles(pos)) return { type: "out", winner: oppositeSide(hitter), landingSide, reason: "Out" };
    if (bounceCountOnSide > 1) return { type: "doubleBounce", winner: oppositeSide(landingSide), landingSide, reason: "Double Bounce" };
    return { type: "validBounce", landingSide, reason: "Valid Bounce" };
  }
}

export const courtRules = new CourtRules();
