import * as THREE from "three";
import { BALL_SURFACE_Y, BallStateName, isOverVisibleTable, netBounds, opposite, PlayerSide, sideOfZ, TT } from "./gameConfig";

export type BallPhysicsState = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  status: BallStateName;
  lastHitBy: PlayerSide | null;
  bounceSide: PlayerSide | null;
  bounceCountOnSide: Record<PlayerSide, number>;
  alive: boolean;
};

export type BallPhysicsEvent =
  | { type: "tableBounce"; side: PlayerSide; pos: THREE.Vector3 }
  | { type: "netHit"; pos: THREE.Vector3 }
  | { type: "out"; winner: PlayerSide; reason: "out" | "doubleBounce" | "wrongSide"; pos: THREE.Vector3 };

export class BallPhysics {
  readonly state: BallPhysicsState;
  private accumulator = 0;

  constructor(initial?: Partial<BallPhysicsState>) {
    this.state = {
      pos: initial?.pos?.clone() ?? new THREE.Vector3(0, BALL_SURFACE_Y + 0.45, 1.6),
      vel: initial?.vel?.clone() ?? new THREE.Vector3(),
      spin: initial?.spin?.clone() ?? new THREE.Vector3(),
      status: initial?.status ?? "idle",
      lastHitBy: initial?.lastHitBy ?? null,
      bounceSide: initial?.bounceSide ?? null,
      bounceCountOnSide: { near: 0, far: 0 },
      alive: initial?.alive ?? true,
    };
  }

  resetForServe(server: PlayerSide, pos: THREE.Vector3) {
    this.state.pos.copy(pos);
    this.state.vel.set(0, 0, 0);
    this.state.spin.set(0, 0, 0);
    this.state.status = "serve";
    this.state.lastHitBy = null;
    this.state.bounceSide = null;
    this.state.bounceCountOnSide.near = 0;
    this.state.bounceCountOnSide.far = 0;
    this.state.alive = true;
    this.accumulator = 0;
  }

  applyPaddleHit(side: PlayerSide, velocity: THREE.Vector3, spin: THREE.Vector3) {
    this.state.vel.copy(velocity);
    this.state.spin.copy(spin);
    this.state.lastHitBy = side;
    this.state.bounceSide = null;
    this.state.bounceCountOnSide.near = 0;
    this.state.bounceCountOnSide.far = 0;
    this.state.status = side === "near" ? "paddleHitPlayer" : "paddleHitAI";
  }

  update(dt: number): BallPhysicsEvent[] {
    const events: BallPhysicsEvent[] = [];
    this.accumulator += Math.min(dt, 0.05);
    while (this.accumulator >= TT.ball.fixedStep) {
      this.step(TT.ball.fixedStep, events);
      this.accumulator -= TT.ball.fixedStep;
    }
    return events;
  }

  private step(dt: number, events: BallPhysicsEvent[]) {
    if (!this.state.alive || this.state.status === "idle" || this.state.status === "pointEnded") return;
    const prev = this.state.pos.clone();
    const magnus = this.state.spin.clone().cross(this.state.vel).multiplyScalar(TT.ball.magnus);
    this.state.vel.x += (magnus.x - this.state.vel.x * TT.ball.airDrag) * dt;
    this.state.vel.y += (-TT.ball.gravity + magnus.y - this.state.vel.y * TT.ball.airDrag * 0.45) * dt;
    this.state.vel.z += (magnus.z - this.state.vel.z * TT.ball.airDrag) * dt;
    this.state.pos.addScaledVector(this.state.vel, dt);
    this.state.spin.multiplyScalar(Math.exp(-TT.ball.spinDecay * dt));

    this.resolveNet(prev, events);
    this.resolveTable(prev, events);
    this.resolveOut(events);
    if (!this.state.status.includes("Bounce") && this.state.status !== "netHit" && this.state.status !== "out") this.state.status = "flying";
  }

  private resolveNet(prev: THREE.Vector3, events: BallPhysicsEvent[]) {
    const b = netBounds();
    const crossed = (prev.z < b.minZ && this.state.pos.z >= b.minZ) || (prev.z > b.maxZ && this.state.pos.z <= b.maxZ) || (prev.z * this.state.pos.z <= 0 && Math.abs(this.state.pos.z) < TT.ball.radius);
    if (!crossed || !this.state.lastHitBy) return;
    if (this.state.pos.x < b.minX - TT.ball.radius || this.state.pos.x > b.maxX + TT.ball.radius) return;
    if (this.state.pos.y > b.maxY + TT.ball.radius * 0.4 || this.state.pos.y < b.minY - TT.ball.radius) return;
    this.state.pos.z = this.state.pos.z >= 0 ? b.maxZ + TT.ball.radius : b.minZ - TT.ball.radius;
    this.state.vel.z *= -0.18;
    this.state.vel.y = Math.max(0.1, Math.abs(this.state.vel.y) * 0.24);
    this.state.vel.multiplyScalar(0.42);
    this.state.status = "netHit";
    events.push({ type: "netHit", pos: this.state.pos.clone() });
  }

  private resolveTable(prev: THREE.Vector3, events: BallPhysicsEvent[]) {
    const crossedSurface = prev.y > BALL_SURFACE_Y && this.state.pos.y <= BALL_SURFACE_Y && this.state.vel.y < 0;
    if (!crossedSurface || !isOverVisibleTable(this.state.pos.x, this.state.pos.z, 0)) return;
    const side = sideOfZ(this.state.pos.z);
    this.state.pos.y = BALL_SURFACE_Y;
    this.state.vel.y = -this.state.vel.y * TT.ball.tableRestitution;
    this.state.vel.x *= TT.ball.tableFriction;
    this.state.vel.z *= TT.ball.tableFriction;
    this.state.vel.z += this.state.spin.x * 0.0016;
    this.state.vel.x += this.state.spin.y * 0.0012;
    this.state.spin.x *= 0.82;
    this.state.spin.y *= 0.86;
    this.state.bounceSide = side;
    this.state.bounceCountOnSide[side] += 1;
    this.state.status = side === "near" ? "tableBouncePlayer" : "tableBounceAI";
    events.push({ type: "tableBounce", side, pos: this.state.pos.clone() });

    if (this.state.lastHitBy) {
      const expected = opposite(this.state.lastHitBy);
      if (side !== expected) events.push({ type: "out", winner: expected, reason: "wrongSide", pos: this.state.pos.clone() });
      else if (this.state.bounceCountOnSide[side] > 1) events.push({ type: "out", winner: this.state.lastHitBy, reason: "doubleBounce", pos: this.state.pos.clone() });
    }
  }

  private resolveOut(events: BallPhysicsEvent[]) {
    if (!this.state.lastHitBy) return;
    const outside = !isOverVisibleTable(this.state.pos.x, this.state.pos.z, 0.1) && this.state.pos.y <= TT.ball.radius;
    const escaped = Math.abs(this.state.pos.x) > TT.table.width / 2 + 1.3 || Math.abs(this.state.pos.z) > TT.table.length / 2 + 1.8 || this.state.pos.y < -0.7;
    if (!outside && !escaped) return;
    const opponent = opposite(this.state.lastHitBy);
    const legalBounce = this.state.bounceCountOnSide[opponent] >= 1;
    events.push({ type: "out", winner: legalBounce ? this.state.lastHitBy : opponent, reason: "out", pos: this.state.pos.clone() });
    this.state.status = "out";
  }

  predictedLandingPoint(maxSeconds = 2): THREE.Vector3 {
    const p = this.state.pos.clone();
    const v = this.state.vel.clone();
    const spin = this.state.spin.clone();
    const dt = 1 / 90;
    for (let t = 0; t < maxSeconds; t += dt) {
      const magnus = spin.clone().cross(v).multiplyScalar(TT.ball.magnus);
      v.x += (magnus.x - v.x * TT.ball.airDrag) * dt;
      v.y += (-TT.ball.gravity + magnus.y - v.y * TT.ball.airDrag * 0.45) * dt;
      v.z += (magnus.z - v.z * TT.ball.airDrag) * dt;
      p.addScaledVector(v, dt);
      if (p.y <= BALL_SURFACE_Y && isOverVisibleTable(p.x, p.z, 0.02)) return p.setY(BALL_SURFACE_Y);
    }
    return p;
  }
}
