import * as THREE from "three";
import { gameConfig, PlayerSide, ServeCourtSide } from "./gameConfig";
import { CourtRules, RuleEvent, sideOfZ } from "./CourtRules";

export type BallPhysicsState = "Idle" | "ServeReady" | "Toss" | "ServeHit" | "InFlight" | "CourtBounce" | "PlayerHit" | "AIHit" | "NetHit" | "Out" | "DoubleBounce" | "PointEnded";

export type BallBody = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: number;
  lastHitBy: PlayerSide | null;
  bounceSide: PlayerSide | null;
  bounceCount: number;
  state?: BallPhysicsState;
};

export class BallController {
  private accumulator = 0;
  public state: BallPhysicsState = "Idle";
  public lastLandingPoint = new THREE.Vector3();

  constructor(private ball: BallBody, private rules: CourtRules, private cfg = gameConfig) {}

  setState(state: BallPhysicsState) {
    this.state = state;
    this.ball.state = state;
  }

  resetServe(position: THREE.Vector3) {
    this.ball.pos.copy(position);
    this.ball.vel.set(0, 0, 0);
    this.ball.spin = 0;
    this.ball.lastHitBy = null;
    this.ball.bounceSide = null;
    this.ball.bounceCount = 0;
    this.ball.mesh.position.copy(this.ball.pos);
    this.accumulator = 0;
    this.setState("ServeReady");
  }

  lockTo(position: THREE.Vector3, state: BallPhysicsState) {
    this.ball.pos.copy(position);
    this.ball.vel.set(0, 0, 0);
    this.ball.spin = 0;
    this.ball.mesh.position.copy(this.ball.pos);
    this.setState(state);
  }

  hit(by: PlayerSide, velocity: THREE.Vector3, spin: number, serve = false) {
    this.ball.lastHitBy = by;
    this.ball.bounceSide = null;
    this.ball.bounceCount = 0;
    this.ball.vel.copy(velocity);
    this.ball.spin = spin;
    this.setState(serve ? "ServeHit" : by === "near" ? "PlayerHit" : "AIHit");
  }

  update(frameDt: number, serveSide: ServeCourtSide, serving: boolean): RuleEvent[] {
    const events: RuleEvent[] = [];
    this.accumulator += Math.min(0.05, frameDt);
    let steps = 0;
    while (this.accumulator >= this.cfg.fixedTimeStep && steps < this.cfg.maxSubSteps) {
      const event = this.step(this.cfg.fixedTimeStep, serveSide, serving);
      if (event.type !== "none") events.push(event);
      this.accumulator -= this.cfg.fixedTimeStep;
      steps += 1;
      if (event.type === "net" || event.type === "out" || event.type === "doubleBounce") break;
    }
    this.ball.mesh.position.copy(this.ball.pos);
    return events;
  }

  predictLanding(maxSeconds = 2.6) {
    const p = this.ball.pos.clone();
    const v = this.ball.vel.clone();
    const dt = 1 / 90;
    for (let t = 0; t < maxSeconds; t += dt) {
      v.y -= this.cfg.gravity * (1 + this.ball.spin * 0.16) * dt;
      v.multiplyScalar(Math.exp(-this.cfg.airDrag * dt));
      p.addScaledVector(v, dt);
      if (p.y <= this.cfg.ballR) return p.setY(this.cfg.ballR);
    }
    return p;
  }

  private step(dt: number, serveSide: ServeCourtSide, serving: boolean): RuleEvent {
    const prev = this.ball.pos.clone();
    this.ball.vel.y -= this.cfg.gravity * (1 + this.ball.spin * 0.16) * dt;
    this.ball.vel.multiplyScalar(Math.exp(-this.cfg.airDrag * dt));
    this.ball.pos.addScaledVector(this.ball.vel, dt);
    this.ball.spin *= Math.exp(-0.95 * dt);

    const rollAxis = new THREE.Vector3(this.ball.vel.z, 0, -this.ball.vel.x);
    if (rollAxis.lengthSq() > 0.0001) this.ball.mesh.rotateOnWorldAxis(rollAxis.normalize(), (this.ball.vel.length() / this.cfg.ballR) * dt);

    const net = this.rules.checkNetCross(prev, this.ball.pos, this.ball.lastHitBy);
    if (net.type === "net") {
      this.setState("NetHit");
      this.ball.vel.multiplyScalar(0.2);
      this.ball.vel.z = Math.sign(this.ball.vel.z || (this.ball.lastHitBy === "near" ? -1 : 1)) * Math.max(0.4, Math.abs(this.ball.vel.z));
      this.ball.vel.y = Math.max(0.45, Math.abs(this.ball.vel.y) + 0.2);
      this.ball.pos.z = this.ball.lastHitBy === "near" ? -0.12 : 0.12;
      return net;
    }

    if (this.ball.pos.y <= this.cfg.ballR && this.ball.vel.y < 0) {
      this.ball.pos.y = this.cfg.ballR;
      this.ball.vel.y = -this.ball.vel.y * this.cfg.bounceRestitution;
      this.ball.vel.x *= this.cfg.groundFriction;
      this.ball.vel.z *= this.cfg.groundFriction;
      const bounceSide = sideOfZ(this.ball.pos.z);
      if (this.ball.bounceSide === bounceSide) this.ball.bounceCount += 1;
      else {
        this.ball.bounceSide = bounceSide;
        this.ball.bounceCount = 1;
      }
      this.lastLandingPoint.copy(this.ball.pos);
      this.setState("CourtBounce");
      const bounce = this.rules.checkBounce(this.ball.pos, this.ball.lastHitBy, this.ball.bounceCount, serveSide, serving);
      if (bounce.type === "out") this.setState("Out");
      if (bounce.type === "doubleBounce") this.setState("DoubleBounce");
      return bounce;
    }

    const farOut = this.rules.checkBeyondReadableOut(this.ball.pos, this.ball.lastHitBy);
    if (farOut.type !== "none") {
      this.setState("Out");
      return farOut;
    }

    if (this.ball.vel.length() < this.cfg.minBallSpeed && this.ball.pos.y <= this.cfg.ballR + 0.002 && this.ball.lastHitBy) {
      this.setState("DoubleBounce");
      return { type: "doubleBounce", winner: sideOfZ(this.ball.pos.z) === "near" ? "far" : "near", reason: "Double bounce", landingPoint: this.ball.pos.clone() };
    }

    if (this.ball.lastHitBy) this.setState("InFlight");
    return { type: "none" };
  }
}
