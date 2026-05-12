import * as THREE from "three";
import { BALL_SURFACE_Y, CFG, type BallPhysicsStateName, type BallState, type PlayerSide, isOverTable, opposite, sideOfZ } from "./gameConfig";

export type BallPhysicsEvent =
  | { type: "tableBounce"; side: PlayerSide; position: THREE.Vector3 }
  | { type: "netHit"; position: THREE.Vector3 }
  | { type: "out"; winner: PlayerSide; reason: "out" | "net" | "doubleBounce" | "wrongSide" | "miss"; position: THREE.Vector3 };

type BallPhysicsOptions = {
  onEvent?: (event: BallPhysicsEvent) => void;
};

function reduceImpactPower(velocity: THREE.Vector3, keepRatio: number, minSpeed = 0.35) {
  const speed = velocity.length();
  if (speed <= 0.0001) return;
  const capped = Math.max(minSpeed, speed * Math.max(0.05, Math.min(1, keepRatio)));
  velocity.multiplyScalar(capped / speed);
}

function segmentCrossingT(a: number, b: number, plane: number) {
  const d = b - a;
  if (Math.abs(d) < 1e-8) return null;
  const t = (plane - a) / d;
  return t >= 0 && t <= 1 ? t : null;
}

export class BallPhysics {
  private accumulator = 0;
  readonly debug = {
    lastState: "idle" as BallPhysicsStateName,
    predictedLanding: new THREE.Vector3(),
    bounceCount: 0,
  };

  constructor(private readonly options: BallPhysicsOptions = {}) {}

  reset(ball: BallState, stateName: BallPhysicsStateName = "serve") {
    this.accumulator = 0;
    ball.stateName = stateName;
    ball.sideBounceCounts = { near: 0, far: 0 };
    this.debug.lastState = stateName;
    this.debug.bounceCount = 0;
    this.debug.predictedLanding.copy(ball.pos);
  }

  update(ball: BallState, dt: number) {
    this.accumulator += Math.min(dt, CFG.fixedDt * CFG.maxSubSteps);
    let steps = 0;
    while (this.accumulator >= CFG.fixedDt && steps < CFG.maxSubSteps) {
      this.step(ball, CFG.fixedDt);
      this.accumulator -= CFG.fixedDt;
      steps += 1;
    }
    this.debug.predictedLanding.copy(this.predictLanding(ball));
  }

  private setState(ball: BallState, state: BallPhysicsStateName) {
    ball.stateName = state;
    this.debug.lastState = state;
  }

  private emit(event: BallPhysicsEvent) {
    this.options.onEvent?.(event);
  }

  private step(ball: BallState, dt: number) {
    if (ball.stateName === "pointEnded") return;
    const prev = ball.pos.clone();
    const magnus = ball.spin.clone().cross(ball.vel).multiplyScalar(CFG.magnus);
    ball.vel.x += (magnus.x - ball.vel.x * CFG.airDrag) * dt;
    ball.vel.y += (-CFG.gravity + magnus.y - ball.vel.y * CFG.airDrag * 0.45) * dt;
    ball.vel.z += (magnus.z - ball.vel.z * CFG.airDrag) * dt;
    ball.pos.addScaledVector(ball.vel, dt);
    ball.spin.multiplyScalar(Math.exp(-CFG.spinDecay * dt));

    this.rotateBall(ball, dt);
    this.resolveNet(ball, prev);
    this.resolveTable(ball, prev);
    this.resolveWorldOut(ball);
    ball.mesh.position.copy(ball.pos);
  }

  private rotateBall(ball: BallState, dt: number) {
    if (ball.spin.length() > 0.01) {
      ball.mesh.rotateOnWorldAxis(ball.spin.clone().normalize(), ball.spin.length() * dt * 0.18);
      return;
    }
    if (ball.vel.length() > 0.02) {
      const rollAxis = new THREE.Vector3(ball.vel.z, 0, -ball.vel.x);
      if (rollAxis.lengthSq() > 0.0001) ball.mesh.rotateOnWorldAxis(rollAxis.normalize(), (ball.vel.length() / CFG.ballR) * dt);
    }
  }

  private resolveNet(ball: BallState, prev: THREE.Vector3) {
    if (!ball.lastHitBy) return;
    const t = segmentCrossingT(prev.z, ball.pos.z, 0);
    if (t === null && Math.abs(ball.pos.z) > CFG.ballR) return;
    const sample = prev.clone().lerp(ball.pos, t ?? 1);
    const withinNetWidth = Math.abs(sample.x) <= CFG.tableW / 2 + CFG.netPostOutside + CFG.ballR;
    const netTop = CFG.tableY + CFG.netH;
    const intersectsNetHeight = sample.y - CFG.ballR <= netTop && sample.y + CFG.ballR >= CFG.tableY;
    if (!withinNetWidth || !intersectsNetHeight) return;

    ball.pos.copy(sample);
    ball.pos.z = Math.sign(prev.z || (ball.lastHitBy === "near" ? 1 : -1)) * CFG.ballR;
    const topGlance = sample.y > netTop - CFG.ballR * 0.7;
    ball.vel.z *= -(topGlance ? CFG.netTopRestitution : CFG.netFaceRestitution);
    ball.vel.y = Math.max(topGlance ? 0.03 : 0.12, Math.abs(ball.vel.y) * (topGlance ? 0.3 : 0.24));
    ball.vel.x += Math.max(-0.5, Math.min(0.5, sample.x * 0.55));
    reduceImpactPower(ball.vel, CFG.netPowerRetention, 0.28);
    this.setState(ball, "netHit");
    this.emit({ type: "netHit", position: ball.pos.clone() });
  }

  private resolveTable(ball: BallState, prev: THREE.Vector3) {
    if (!(prev.y > BALL_SURFACE_Y && ball.pos.y <= BALL_SURFACE_Y && ball.vel.y < 0)) return;
    const t = segmentCrossingT(prev.y, ball.pos.y, BALL_SURFACE_Y) ?? 1;
    const impact = prev.clone().lerp(ball.pos, t);
    if (!isOverTable(impact.x, impact.z, 0)) return;

    ball.pos.copy(impact);
    ball.pos.y = BALL_SURFACE_Y;
    const side = sideOfZ(ball.pos.z);
    ball.vel.y = -ball.vel.y * CFG.tableRestitution;
    ball.vel.x *= CFG.tableFriction;
    ball.vel.z *= CFG.tableFriction;
    ball.vel.z += ball.spin.x * 0.0016;
    ball.vel.x += ball.spin.y * 0.0012;
    ball.spin.x *= 0.82;
    ball.spin.y *= 0.86;
    ball.sideBounceCounts[side] += 1;
    ball.bounceSide = side;
    ball.bounceCount = ball.sideBounceCounts[side];
    this.debug.bounceCount = ball.bounceCount;
    this.setState(ball, side === "near" ? "tableBouncePlayer" : "tableBounceAI");
    this.emit({ type: "tableBounce", side, position: ball.pos.clone() });
  }

  private resolveWorldOut(ball: BallState) {
    if (!ball.lastHitBy) {
      if (ball.pos.y <= CFG.ballR && !isOverTable(ball.pos.x, ball.pos.z, 0.08)) {
        ball.pos.y = CFG.ballR;
        ball.vel.y = Math.abs(ball.vel.y) * CFG.floorRestitution;
        ball.vel.x *= CFG.floorFriction;
        ball.vel.z *= CFG.floorFriction;
      }
      return;
    }

    const hitter = ball.lastHitBy;
    const targetSide = opposite(hitter);
    const hadLegalBounce = ball.sideBounceCounts[targetSide] >= 1;
    if ((ball.pos.y <= CFG.ballR && !isOverTable(ball.pos.x, ball.pos.z, 0.08)) || Math.abs(ball.pos.x) > CFG.tableW / 2 + 1.3 || Math.abs(ball.pos.z) > CFG.tableL / 2 + 1.8 || ball.pos.y < -0.7) {
      const winner = hadLegalBounce ? hitter : targetSide;
      this.setState(ball, "out");
      this.emit({ type: "out", winner, reason: "out", position: ball.pos.clone() });
    }
  }

  predictLanding(ball: BallState, maxSeconds = 1.8) {
    const p = ball.pos.clone();
    const v = ball.vel.clone();
    const spin = ball.spin.clone();
    const dt = CFG.fixedDt;
    for (let elapsed = 0; elapsed < maxSeconds; elapsed += dt) {
      const magnus = spin.clone().cross(v).multiplyScalar(CFG.magnus);
      v.x += (magnus.x - v.x * CFG.airDrag) * dt;
      v.y += (-CFG.gravity + magnus.y - v.y * CFG.airDrag * 0.45) * dt;
      v.z += (magnus.z - v.z * CFG.airDrag) * dt;
      p.addScaledVector(v, dt);
      spin.multiplyScalar(Math.exp(-CFG.spinDecay * dt));
      if (p.y <= BALL_SURFACE_Y && isOverTable(p.x, p.z, 0.02)) return p.clone().setY(BALL_SURFACE_Y);
    }
    return p;
  }
}
