import * as THREE from "three";
import { gameConfig, opposite, PlayerSide, ServeSide, sideOfZ } from "./gameConfig";

export type CourtRuleEvent =
  | { type: "serveIn"; side: PlayerSide; landing: THREE.Vector3 }
  | { type: "serveFault"; reason: "serviceBox" | "net"; side: PlayerSide; landing?: THREE.Vector3 }
  | { type: "rallyIn"; side: PlayerSide; landing: THREE.Vector3 }
  | { type: "out"; side: PlayerSide; landing: THREE.Vector3 }
  | { type: "net"; hitter: PlayerSide }
  | { type: "doubleBounce"; side: PlayerSide };

export class CourtRules {
  readonly cfg = gameConfig;

  serviceSideFromPoints(totalPoints: number): ServeSide {
    return totalPoints % 2 === 0 ? "deuce" : "ad";
  }

  isInsideSingles(pos: THREE.Vector3) {
    return Math.abs(pos.x) <= this.cfg.courtW / 2 && Math.abs(pos.z) <= this.cfg.courtL / 2;
  }

  isInsideServiceBox(pos: THREE.Vector3, hitter: PlayerSide, serveSide: ServeSide) {
    const targetSide = opposite(hitter);
    const targetRight = serveSide === "deuce";
    const xOk = targetRight ? pos.x >= this.cfg.serviceBuffer : pos.x <= -this.cfg.serviceBuffer;
    const xInCourt = Math.abs(pos.x) <= this.cfg.courtW / 2;
    const zOk = targetSide === "far"
      ? pos.z <= -this.cfg.serviceBuffer && pos.z >= -this.cfg.serviceLineZ
      : pos.z >= this.cfg.serviceBuffer && pos.z <= this.cfg.serviceLineZ;
    return xOk && xInCourt && zOk;
  }

  evaluateBounce(pos: THREE.Vector3, hitter: PlayerSide | null, serveSide: ServeSide, awaitingServe: boolean, bounceCountOnSide: number): CourtRuleEvent | null {
    const landing = pos.clone();
    const landingSide = sideOfZ(pos.z);
    if (!hitter) return null;
    if (awaitingServe) {
      return this.isInsideServiceBox(pos, hitter, serveSide)
        ? { type: "serveIn", side: landingSide, landing }
        : { type: "serveFault", reason: "serviceBox", side: landingSide, landing };
    }
    if (!this.isInsideSingles(pos)) return { type: "out", side: landingSide, landing };
    if (bounceCountOnSide > 1) return { type: "doubleBounce", side: landingSide };
    return { type: "rallyIn", side: landingSide, landing };
  }

  crossesNet(prevZ: number, nextZ: number) {
    return (prevZ > 0 && nextZ <= 0) || (prevZ < 0 && nextZ >= 0) || Math.abs(nextZ) < 0.055;
  }

  isNetCollision(pos: THREE.Vector3, prevZ: number) {
    return this.crossesNet(prevZ, pos.z) && Math.abs(pos.x) <= this.cfg.doublesW / 2 + 0.1 && pos.y < this.cfg.netH + this.cfg.ballR * 0.6;
  }
}

export const courtRules = new CourtRules();
