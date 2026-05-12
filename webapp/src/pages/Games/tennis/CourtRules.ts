import * as THREE from "three";
import { gameConfig, PlayerSide, ServeCourtSide } from "./gameConfig";

export type RuleEventType = "none" | "validServeBounce" | "serveFault" | "rallyBounce" | "out" | "net" | "doubleBounce";
export type RuleEvent = { type: RuleEventType; winner?: PlayerSide; reason?: string; bounceSide?: PlayerSide; landingPoint?: THREE.Vector3 };

export const oppositeSide = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");
export const sideOfZ = (z: number): PlayerSide => (z >= 0 ? "near" : "far");

export class CourtRules {
  constructor(private cfg = gameConfig) {}

  get singlesHalfWidth() { return this.cfg.courtW / 2; }
  get doublesHalfWidth() { return this.cfg.doublesW / 2; }
  get halfLength() { return this.cfg.courtL / 2; }

  serviceSideFromPoints(nearPoints: number, farPoints: number): ServeCourtSide {
    return (nearPoints + farPoints) % 2 === 0 ? "deuce" : "ad";
  }

  serveXForSide(player: PlayerSide, side: ServeCourtSide) {
    const outsideSingles = this.cfg.courtW / 2 + 0.42;
    const laneMax = this.cfg.doublesW / 2 - 0.2;
    const xAbs = THREE.MathUtils.clamp(outsideSingles, this.cfg.courtW / 2 + 0.12, laneMax);
    const sign = side === "deuce" ? 1 : -1;
    return (player === "near" ? sign : -sign) * xAbs;
  }

  serveLaneBoundsX(side: ServeCourtSide) {
    const laneMinAbs = this.cfg.courtW / 2 + 0.12;
    const laneMaxAbs = this.cfg.doublesW / 2 - 0.12;
    return side === "deuce" ? { min: laneMinAbs, max: laneMaxAbs } : { min: -laneMaxAbs, max: -laneMinAbs };
  }

  isInsideSingles(point: THREE.Vector3) {
    return Math.abs(point.x) <= this.singlesHalfWidth && Math.abs(point.z) <= this.halfLength;
  }

  isInsideServiceBox(point: THREE.Vector3, server: PlayerSide, side: ServeCourtSide) {
    const targetSide = oppositeSide(server);
    const targetRight = side === "deuce";
    const xOk = targetRight ? point.x >= this.cfg.serviceBuffer : point.x <= -this.cfg.serviceBuffer;
    const xInCourt = Math.abs(point.x) <= this.singlesHalfWidth;
    const zOk = targetSide === "far"
      ? point.z <= -this.cfg.serviceBuffer && point.z >= -this.cfg.serviceLineZ
      : point.z >= this.cfg.serviceBuffer && point.z <= this.cfg.serviceLineZ;
    return xOk && xInCourt && zOk;
  }

  checkNetCross(prev: THREE.Vector3, next: THREE.Vector3, lastHitBy: PlayerSide | null): RuleEvent {
    if (!lastHitBy) return { type: "none" };
    const crosses = (prev.z > 0 && next.z <= 0) || (prev.z < 0 && next.z >= 0) || Math.abs(next.z) < 0.055;
    if (crosses && Math.abs(next.x) <= this.doublesHalfWidth + 0.1 && next.y < this.cfg.netH + this.cfg.ballR * 0.6) {
      return { type: "net", winner: oppositeSide(lastHitBy), reason: "Net", landingPoint: next.clone() };
    }
    return { type: "none" };
  }

  checkBounce(point: THREE.Vector3, lastHitBy: PlayerSide | null, bounceCountOnSide: number, serveSide: ServeCourtSide, serving: boolean): RuleEvent {
    const bounceSide = sideOfZ(point.z);
    if (!lastHitBy) return { type: "rallyBounce", bounceSide, landingPoint: point.clone() };
    if (serving) {
      return this.isInsideServiceBox(point, lastHitBy, serveSide)
        ? { type: "validServeBounce", bounceSide, landingPoint: point.clone() }
        : { type: "serveFault", winner: oppositeSide(lastHitBy), reason: "Fault", bounceSide, landingPoint: point.clone() };
    }
    if (!this.isInsideSingles(point)) {
      return { type: "out", winner: oppositeSide(lastHitBy), reason: "Out", bounceSide, landingPoint: point.clone() };
    }
    if (bounceCountOnSide > 1) {
      return { type: "doubleBounce", winner: oppositeSide(bounceSide), reason: "Double bounce", bounceSide, landingPoint: point.clone() };
    }
    return { type: "rallyBounce", bounceSide, landingPoint: point.clone() };
  }

  checkBeyondReadableOut(point: THREE.Vector3, lastHitBy: PlayerSide | null): RuleEvent {
    if (!lastHitBy) return { type: "none" };
    const generousX = this.singlesHalfWidth + 2.2;
    const generousZ = this.halfLength + 1.8;
    if (Math.abs(point.x) > generousX || Math.abs(point.z) > generousZ || point.y < -1.2) {
      return { type: "out", winner: oppositeSide(lastHitBy), reason: "Out", landingPoint: point.clone() };
    }
    return { type: "none" };
  }
}
