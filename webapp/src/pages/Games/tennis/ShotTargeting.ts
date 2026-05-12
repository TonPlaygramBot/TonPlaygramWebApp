import * as THREE from "three";
import { gameConfig, PlayerSide, ShotType } from "./gameConfig";

export class ShotTargeting {
  constructor(private cfg = gameConfig) {}
  clampTarget(target: THREE.Vector3, hitter: PlayerSide, serve = false) {
    const out = target.clone();
    out.y = this.cfg.ballR;
    out.x = THREE.MathUtils.clamp(out.x, -this.cfg.courtW / 2 + 0.14, this.cfg.courtW / 2 - 0.14);
    if (serve) out.z = THREE.MathUtils.clamp(out.z, hitter === "near" ? -this.cfg.serviceLineZ : this.cfg.serviceBuffer, hitter === "near" ? -this.cfg.serviceBuffer : this.cfg.serviceLineZ);
    else out.z = THREE.MathUtils.clamp(out.z, hitter === "near" ? -this.cfg.courtL / 2 + 0.34 : this.cfg.serviceBuffer, hitter === "near" ? -this.cfg.serviceBuffer : this.cfg.courtL / 2 - 0.34);
    return out;
  }
  classifyFromSwipe(dx: number, dy: number, speed: number): ShotType {
    if (dy > 80 && speed < 0.7) return "lob";
    if (dy < -120 && speed < 0.55) return "drop";
    if (Math.abs(dx) > Math.abs(dy) * 1.5) return "slice";
    if (speed < 0.22) return "block";
    return dy < -20 ? "topspin" : "flat";
  }
}
