import * as THREE from "three";
import { BALL_SURFACE_Y, BallMotionState, PlayerSide, PointReason, TABLE_HALF_L, TABLE_HALF_W, TABLE_TENNIS_CONFIG as CFG, isOverTable, opposite, reduceImpactPower, sideOfZ } from "./gameConfig";

export type PhysicsBall = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  lastHitBy: PlayerSide | null;
  bounceSide: PlayerSide | null;
  bounceCount: number;
  state: BallMotionState;
  phase: { kind: "serve"; server: PlayerSide; stage: "own" | "opponent" } | { kind: "rally" };
};

export type BallPhysicsEvent = { type: "bounce" | "net" | "out" | "state"; side?: PlayerSide; state?: BallMotionState };

export class BallPhysics {
  private accumulator = 0;
  constructor(private readonly ball: PhysicsBall) {}
  resetAccumulator() { this.accumulator = 0; }
  setState(state: BallMotionState) { this.ball.state = state; }

  predictLandingPoint(maxTime = 2.2) {
    const p = this.ball.pos.clone();
    const v = this.ball.vel.clone();
    const spin = this.ball.spin.clone();
    const dt = CFG.physicsStep;
    for (let t = 0; t < maxTime; t += dt) {
      this.integrateVectors(p, v, spin, dt);
      if (p.y <= BALL_SURFACE_Y && isOverTable(p.x, p.z, 0.02)) return p.setY(BALL_SURFACE_Y);
    }
    return p;
  }

  update(dt: number, callbacks: { awardPoint: (winner: PlayerSide, reason: PointReason) => void; onBounce?: (side: PlayerSide) => void; onNet?: () => void; onFrame?: () => void; players?: Array<{ side: PlayerSide; pos: THREE.Vector3 }> }) {
    this.accumulator += Math.min(dt, 0.08);
    let steps = 0;
    while (this.accumulator >= CFG.physicsStep && steps < CFG.maxPhysicsSteps) {
      this.fixedStep(CFG.physicsStep, callbacks);
      this.accumulator -= CFG.physicsStep;
      steps += 1;
    }
    if (steps >= CFG.maxPhysicsSteps) this.accumulator = 0;
    this.ball.mesh.position.copy(this.ball.pos);
    callbacks.onFrame?.();
  }

  private integrateVectors(p: THREE.Vector3, v: THREE.Vector3, spin: THREE.Vector3, dt: number) {
    const magnus = spin.clone().cross(v).multiplyScalar(CFG.magnus);
    v.x += (magnus.x - v.x * CFG.airDrag) * dt;
    v.y += (-CFG.gravity + magnus.y - v.y * CFG.airDrag * 0.45) * dt;
    v.z += (magnus.z - v.z * CFG.airDrag) * dt;
    p.addScaledVector(v, dt);
    spin.multiplyScalar(Math.exp(-CFG.spinDecay * dt));
  }

  private fixedStep(dt: number, callbacks: { awardPoint: (winner: PlayerSide, reason: PointReason) => void; onBounce?: (side: PlayerSide) => void; onNet?: () => void; players?: Array<{ side: PlayerSide; pos: THREE.Vector3 }> }) {
    const b = this.ball;
    const prev = b.pos.clone();
    this.integrateVectors(b.pos, b.vel, b.spin, dt);
    this.rotateBall(dt);
    this.resolveNet(prev, callbacks);
    this.resolveBodies(callbacks.players ?? []);
    this.resolveTable(prev, callbacks);
    this.resolveFloorAndOut(callbacks);
  }

  private rotateBall(dt: number) {
    const b = this.ball;
    if (b.spin.length() > 0.01) b.mesh.rotateOnWorldAxis(b.spin.clone().normalize(), b.spin.length() * dt * 0.18);
    else if (b.vel.length() > 0.02) {
      const rollAxis = new THREE.Vector3(b.vel.z, 0, -b.vel.x);
      if (rollAxis.lengthSq() > 0.0001) b.mesh.rotateOnWorldAxis(rollAxis.normalize(), (b.vel.length() / CFG.ballR) * dt);
    }
  }

  private resolveNet(prev: THREE.Vector3, callbacks: { onNet?: () => void }) {
    const b = this.ball;
    if (!b.lastHitBy) return;
    const crossedNet = (prev.z > 0 && b.pos.z <= 0) || (prev.z < 0 && b.pos.z >= 0) || Math.abs(b.pos.z) < CFG.netThickness;
    const withinNetX = Math.abs(b.pos.x) <= TABLE_HALF_W + CFG.netPostOutside;
    if (crossedNet && withinNetX && b.pos.y < CFG.tableY + CFG.netH + CFG.ballR * 0.6) {
      b.state = "netHit";
      b.pos.z = b.pos.z >= 0 ? CFG.netThickness * 1.5 : -CFG.netThickness * 1.5;
      b.vel.z *= -CFG.netFaceRestitution;
      b.vel.y = Math.max(0.12, Math.abs(b.vel.y) * 0.24);
      b.vel.x += Math.max(-0.5, Math.min(0.5, b.pos.x * 0.55));
      reduceImpactPower(b.vel, CFG.netPowerRetention, 0.32);
      callbacks.onNet?.();
    }
  }

  private resolveBodies(players: Array<{ side: PlayerSide; pos: THREE.Vector3 }>) {
    const b = this.ball;
    for (const player of players) {
      const torsoCenter = player.pos.clone().setY(CFG.tableY + 0.34);
      const delta = b.pos.clone().sub(torsoCenter);
      delta.y *= 1.18;
      const collisionRadius = 0.22;
      if (delta.lengthSq() > collisionRadius * collisionRadius) continue;
      const normal = delta.lengthSq() > 0.0001 ? delta.normalize() : new THREE.Vector3(0, 0.4, player.side === "near" ? 1 : -1).normalize();
      b.pos.copy(torsoCenter).addScaledVector(normal, collisionRadius + 0.004);
      const vn = b.vel.dot(normal);
      if (vn < 0) b.vel.addScaledVector(normal, -(1 + 0.18) * vn);
      reduceImpactPower(b.vel, CFG.bodyPowerRetention, 0.26);
      b.vel.y = Math.max(b.vel.y, 0.05);
    }
  }

  private resolveTable(prev: THREE.Vector3, callbacks: { awardPoint: (winner: PlayerSide, reason: PointReason) => void; onBounce?: (side: PlayerSide) => void }) {
    const b = this.ball;
    const descendingThroughSurface = prev.y > BALL_SURFACE_Y && b.pos.y <= BALL_SURFACE_Y && b.vel.y < 0;
    if (!descendingThroughSurface || !isOverTable(b.pos.x, b.pos.z, 0)) return;
    b.pos.y = BALL_SURFACE_Y;
    const side = sideOfZ(b.pos.z);
    b.state = side === "near" ? "tableBouncePlayer" : "tableBounceAI";
    b.vel.y = -b.vel.y * CFG.tableRestitution;
    b.vel.x *= CFG.tableFriction;
    b.vel.z *= CFG.tableFriction;
    b.vel.z += b.spin.x * 0.0016;
    b.vel.x += b.spin.y * 0.0012;
    b.spin.x *= 0.82;
    b.spin.y *= 0.86;
    this.handleTableBounce(side, callbacks.awardPoint);
    callbacks.onBounce?.(side);
  }

  private handleTableBounce(side: PlayerSide, awardPoint: (winner: PlayerSide, reason: PointReason) => void) {
    const b = this.ball;
    const hitter = b.lastHitBy;
    if (!hitter) return;
    if (b.phase.kind === "serve") {
      const server = b.phase.server;
      if (b.phase.stage === "own") {
        if (side !== server) return this.endPoint(opposite(server), "wrongSide", awardPoint);
        b.phase.stage = "opponent"; b.bounceSide = side; b.bounceCount = 1; return;
      }
      if (side !== opposite(server)) return this.endPoint(opposite(server), "wrongSide", awardPoint);
      b.phase = { kind: "rally" }; b.bounceSide = side; b.bounceCount = 1; return;
    }
    const expected = opposite(hitter);
    if (side !== expected) return this.endPoint(expected, "wrongSide", awardPoint);
    if (b.bounceSide === side && b.bounceCount >= 1) return this.endPoint(hitter, "doubleBounce", awardPoint);
    b.bounceSide = side; b.bounceCount = 1;
  }

  private resolveFloorAndOut(callbacks: { awardPoint: (winner: PlayerSide, reason: PointReason) => void }) {
    const b = this.ball;
    if (b.pos.y <= CFG.ballR && !isOverTable(b.pos.x, b.pos.z, 0.08) && b.lastHitBy) {
      const hitter = b.lastHitBy;
      const hadLegalBounce = b.bounceSide === opposite(hitter) && b.bounceCount >= 1;
      return this.endPoint(hadLegalBounce ? hitter : opposite(hitter), "out", callbacks.awardPoint);
    }
    if (b.pos.y <= CFG.ballR && !b.lastHitBy) {
      b.pos.y = CFG.ballR; b.vel.y = Math.abs(b.vel.y) * CFG.floorRestitution; b.vel.x *= CFG.floorFriction; b.vel.z *= CFG.floorFriction;
    }
    if (Math.abs(b.pos.x) > TABLE_HALF_W + 0.68) { b.pos.x = Math.sign(b.pos.x) * (TABLE_HALF_W + 0.68); b.vel.x *= -CFG.railRestitution; b.vel.z *= 0.94; }
    if (Math.abs(b.pos.z) > TABLE_HALF_L + 1.22) { b.pos.z = Math.sign(b.pos.z) * (TABLE_HALF_L + 1.22); b.vel.z *= -CFG.railRestitution; b.vel.x *= 0.94; }
    if ((Math.abs(b.pos.x) > TABLE_HALF_W + 1.3 || Math.abs(b.pos.z) > TABLE_HALF_L + 1.8 || b.pos.y < -0.7) && b.lastHitBy) {
      const hitter = b.lastHitBy;
      const hadLegalBounce = b.bounceSide === opposite(hitter) && b.bounceCount >= 1;
      return this.endPoint(hadLegalBounce ? hitter : opposite(hitter), "out", callbacks.awardPoint);
    }
  }

  private endPoint(winner: PlayerSide, reason: PointReason, awardPoint: (winner: PlayerSide, reason: PointReason) => void) {
    if (this.ball.state === "pointEnded") return;
    this.ball.state = reason === "out" ? "out" : "pointEnded";
    awardPoint(winner, reason);
  }
}
