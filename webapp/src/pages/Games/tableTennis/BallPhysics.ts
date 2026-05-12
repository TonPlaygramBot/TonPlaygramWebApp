import * as THREE from "three";
import { BALL_SURFACE_Y, BallStateName, PointReason, PlayerSide, TABLE_HALF_L, TABLE_HALF_W, gameConfig, isInsideTableTop, opponent, sideForZ } from "./gameConfig";

export type BallData = {
  position: THREE.Vector3;
  previous: THREE.Vector3;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  state: BallStateName;
  lastHitBy: PlayerSide | null;
  bounceSide: PlayerSide | null;
  bounceCountOnSide: number;
  totalBouncesSinceHit: number;
  serveStage: "own" | "opponent" | null;
};

export type PhysicsEvent =
  | { type: "bounce"; side: PlayerSide; position: THREE.Vector3 }
  | { type: "net"; position: THREE.Vector3 }
  | { type: "point"; winner: PlayerSide; reason: PointReason };

export class BallPhysics {
  readonly ball: BallData;
  private accumulator = 0;

  constructor() {
    this.ball = {
      position: new THREE.Vector3(0, BALL_SURFACE_Y + 0.2, TABLE_HALF_L + 0.35),
      previous: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      state: "idle",
      lastHitBy: null,
      bounceSide: null,
      bounceCountOnSide: 0,
      totalBouncesSinceHit: 0,
      serveStage: null,
    };
  }

  resetForServe(server: PlayerSide) {
    const z = server === "near" ? TABLE_HALF_L + 0.34 : -TABLE_HALF_L - 0.34;
    this.ball.position.set(0, BALL_SURFACE_Y + 0.21, z);
    this.ball.previous.copy(this.ball.position);
    this.ball.velocity.set(0, 0, 0);
    this.ball.spin.set(0, 0, 0);
    this.ball.state = "serve";
    this.ball.lastHitBy = null;
    this.ball.bounceSide = null;
    this.ball.bounceCountOnSide = 0;
    this.ball.totalBouncesSinceHit = 0;
    this.ball.serveStage = "own";
    this.accumulator = 0;
  }

  applyHit(side: PlayerSide, velocity: THREE.Vector3, spin: THREE.Vector3, serve = false) {
    const speed = velocity.length();
    if (speed > gameConfig.ball.maxSpeed) velocity.multiplyScalar(gameConfig.ball.maxSpeed / speed);
    if (speed > 0 && speed < gameConfig.ball.minSpeed) velocity.multiplyScalar(gameConfig.ball.minSpeed / speed);
    this.ball.velocity.copy(velocity);
    this.ball.spin.copy(spin);
    this.ball.lastHitBy = side;
    this.ball.bounceSide = null;
    this.ball.bounceCountOnSide = 0;
    this.ball.totalBouncesSinceHit = 0;
    this.ball.serveStage = serve ? "own" : null;
    this.ball.state = side === "near" ? "paddleHitPlayer" : "paddleHitAI";
    if (serve) this.ball.state = "serve";
  }

  update(dt: number): PhysicsEvent[] {
    const events: PhysicsEvent[] = [];
    this.accumulator += Math.min(0.08, dt);
    let steps = 0;
    while (this.accumulator >= gameConfig.fixedDt && steps < gameConfig.maxSubSteps) {
      events.push(...this.step(gameConfig.fixedDt));
      this.accumulator -= gameConfig.fixedDt;
      steps += 1;
    }
    return events;
  }

  private step(dt: number): PhysicsEvent[] {
    const events: PhysicsEvent[] = [];
    const b = this.ball;
    b.previous.copy(b.position);

    const magnus = b.spin.clone().cross(b.velocity).multiplyScalar(gameConfig.ball.magnus);
    b.velocity.x += (magnus.x - b.velocity.x * gameConfig.ball.drag) * dt;
    b.velocity.y += (-gameConfig.ball.gravity + magnus.y - b.velocity.y * gameConfig.ball.drag * 0.42) * dt;
    b.velocity.z += (magnus.z - b.velocity.z * gameConfig.ball.drag) * dt;
    b.position.addScaledVector(b.velocity, dt);
    b.spin.multiplyScalar(Math.exp(-gameConfig.ball.spinDecay * dt));

    const netEvent = this.resolveNetCrossing();
    if (netEvent) events.push(netEvent);

    const bounceEvent = this.resolveTableSweep();
    if (bounceEvent) events.push(bounceEvent);

    const point = this.checkOutOrMiss();
    if (point) events.push(point);

    return events;
  }

  private resolveTableSweep(): PhysicsEvent | null {
    const b = this.ball;
    if (!(b.previous.y > BALL_SURFACE_Y && b.position.y <= BALL_SURFACE_Y && b.velocity.y < 0)) return null;
    const t = (b.previous.y - BALL_SURFACE_Y) / Math.max(0.0001, b.previous.y - b.position.y);
    const x = THREE.MathUtils.lerp(b.previous.x, b.position.x, t);
    const z = THREE.MathUtils.lerp(b.previous.z, b.position.z, t);
    if (!isInsideTableTop(x, z, 0)) return null;

    b.position.set(x, BALL_SURFACE_Y, z);
    b.velocity.y = -b.velocity.y * gameConfig.table.restitution;
    b.velocity.x = b.velocity.x * gameConfig.table.friction + b.spin.y * 0.0011;
    b.velocity.z = b.velocity.z * gameConfig.table.friction + b.spin.x * 0.00145;
    b.spin.x *= 0.82;
    b.spin.y *= 0.86;

    const side = sideForZ(z);
    b.state = side === "near" ? "tableBouncePlayer" : "tableBounceAI";
    if (b.bounceSide === side) b.bounceCountOnSide += 1;
    else {
      b.bounceSide = side;
      b.bounceCountOnSide = 1;
    }
    b.totalBouncesSinceHit += 1;
    return { type: "bounce", side, position: b.position.clone() };
  }

  private resolveNetCrossing(): PhysicsEvent | null {
    const b = this.ball;
    if (!b.lastHitBy) return null;
    const crossed = (b.previous.z > 0 && b.position.z <= 0) || (b.previous.z < 0 && b.position.z >= 0);
    if (!crossed) return null;
    const t = Math.abs(b.previous.z) / Math.max(0.0001, Math.abs(b.previous.z) + Math.abs(b.position.z));
    const x = THREE.MathUtils.lerp(b.previous.x, b.position.x, t);
    const y = THREE.MathUtils.lerp(b.previous.y, b.position.y, t);
    const inNetX = Math.abs(x) <= TABLE_HALF_W + gameConfig.net.postOutside;
    const inNetY = y - gameConfig.ball.radius <= gameConfig.table.topY + gameConfig.net.height;
    if (!inNetX || !inNetY) return null;

    b.position.set(x, Math.max(BALL_SURFACE_Y, y), b.previous.z > 0 ? 0.026 : -0.026);
    b.velocity.z *= -gameConfig.net.restitution;
    b.velocity.y = Math.max(0.05, Math.abs(b.velocity.y) * 0.22);
    b.velocity.x += THREE.MathUtils.clamp(x * 0.38, -0.34, 0.34);
    b.velocity.multiplyScalar(0.35);
    b.state = "netHit";
    return { type: "net", position: b.position.clone() };
  }

  private checkOutOrMiss(): PhysicsEvent | null {
    const b = this.ball;
    if (!b.lastHitBy || b.state === "pointEnded") return null;
    const hitter = b.lastHitBy;
    const receiver = opponent(hitter);

    if (b.serveStage === "own" && b.totalBouncesSinceHit > 0) {
      if (b.bounceSide !== hitter) {
        b.state = "pointEnded";
        return { type: "point", winner: receiver, reason: "wrongSide" };
      }
      b.serveStage = "opponent";
      return null;
    }
    if (b.serveStage === "opponent" && b.totalBouncesSinceHit > 1) {
      if (b.bounceSide !== receiver) {
        b.state = "pointEnded";
        return { type: "point", winner: receiver, reason: "wrongSide" };
      }
      b.serveStage = null;
      return null;
    }
    if (!b.serveStage && b.totalBouncesSinceHit > 0 && b.bounceSide === hitter) {
      b.state = "pointEnded";
      return { type: "point", winner: receiver, reason: "wrongSide" };
    }
    if (!b.serveStage && b.bounceSide === receiver && b.bounceCountOnSide > 1) {
      b.state = "pointEnded";
      return { type: "point", winner: hitter, reason: "doubleBounce" };
    }
    const escaped = Math.abs(b.position.x) > TABLE_HALF_W + 1.15 || Math.abs(b.position.z) > TABLE_HALF_L + 1.65 || b.position.y < -0.45;
    if (escaped) {
      b.state = "pointEnded";
      const legalBounce = b.bounceSide === receiver && b.bounceCountOnSide >= 1;
      return { type: "point", winner: legalBounce ? hitter : receiver, reason: legalBounce ? "missedReturn" : "out" };
    }
    return null;
  }

  predictLandingPoint(maxTime = 1.8): THREE.Vector3 {
    const p = this.ball.position.clone();
    const v = this.ball.velocity.clone();
    const spin = this.ball.spin.clone();
    const dt = 1 / 90;
    for (let t = 0; t < maxTime; t += dt) {
      const prev = p.clone();
      const magnus = spin.clone().cross(v).multiplyScalar(gameConfig.ball.magnus);
      v.x += (magnus.x - v.x * gameConfig.ball.drag) * dt;
      v.y += (-gameConfig.ball.gravity + magnus.y - v.y * gameConfig.ball.drag * 0.42) * dt;
      v.z += (magnus.z - v.z * gameConfig.ball.drag) * dt;
      p.addScaledVector(v, dt);
      spin.multiplyScalar(Math.exp(-gameConfig.ball.spinDecay * dt));
      if (prev.y > BALL_SURFACE_Y && p.y <= BALL_SURFACE_Y) {
        const k = (prev.y - BALL_SURFACE_Y) / Math.max(0.0001, prev.y - p.y);
        return new THREE.Vector3(THREE.MathUtils.lerp(prev.x, p.x, k), BALL_SURFACE_Y, THREE.MathUtils.lerp(prev.z, p.z, k));
      }
    }
    return p;
  }
}
