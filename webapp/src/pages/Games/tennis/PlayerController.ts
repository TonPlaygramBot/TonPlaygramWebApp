import * as THREE from "three";
import { gameConfig, PlayerSide } from "./gameConfig";

export type FootworkState = "IdleReady" | "SplitStep" | "MoveLeft" | "MoveRight" | "MoveForward" | "MoveBack" | "Forehand" | "Backhand" | "Serve" | "Recover";

export class PlayerController {
  public state: FootworkState = "IdleReady";
  private velocity = new THREE.Vector3();
  constructor(public side: PlayerSide, private cfg = gameConfig) {}

  clampTarget(target: THREE.Vector3) {
    const b = this.cfg.playerBounds;
    target.x = THREE.MathUtils.clamp(target.x, -this.cfg.courtW / 2 + b.sideInset, this.cfg.courtW / 2 - b.sideInset);
    target.z = this.side === "near" ? THREE.MathUtils.clamp(target.z, b.nearMinZ, b.nearMaxZ) : THREE.MathUtils.clamp(target.z, b.farMinZ, b.farMaxZ);
    return target;
  }

  move(current: THREE.Vector3, target: THREE.Vector3, dt: number, speed: number) {
    this.clampTarget(target);
    const desired = target.clone().sub(current);
    const dist = desired.length();
    const desiredVelocity = dist > 0.001 ? desired.multiplyScalar(Math.min(speed, dist / Math.max(dt, 0.0001)) / dist) : desired.set(0, 0, 0);
    const accel = 1 - Math.exp(-12 * dt);
    this.velocity.lerp(desiredVelocity, accel);
    current.addScaledVector(this.velocity, dt);
    this.clampTarget(current);
    this.updateStateFromVelocity();
    return current;
  }

  recover(target: THREE.Vector3) {
    const homeZ = this.side === "near" ? this.cfg.courtL / 2 - 1.05 : -this.cfg.courtL / 2 + 1.05;
    target.lerp(new THREE.Vector3(0, 0, homeZ), 0.035);
    this.state = "Recover";
  }

  private updateStateFromVelocity() {
    if (this.velocity.lengthSq() < 0.01) { this.state = "IdleReady"; return; }
    if (Math.abs(this.velocity.x) > Math.abs(this.velocity.z)) this.state = this.velocity.x < 0 ? "MoveLeft" : "MoveRight";
    else this.state = (this.side === "near" ? this.velocity.z < 0 : this.velocity.z > 0) ? "MoveForward" : "MoveBack";
  }
}
