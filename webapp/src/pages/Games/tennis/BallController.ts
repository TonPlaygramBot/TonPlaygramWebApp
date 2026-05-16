import * as THREE from "three";
import { clamp, gameConfig, PlayerSide, sideOfZ, TennisBallState } from "./gameConfig";
import { CourtRules, courtRules, CourtRuleEvent } from "./CourtRules";

export type BallLike = {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: number;
  lastHitBy: PlayerSide | null;
  bounceSide: PlayerSide | null;
  bounceCount: number;
  state?: TennisBallState;
  mesh?: THREE.Mesh;
};

export class BallController {
  accumulator = 0;
  constructor(private readonly rules: CourtRules = courtRules) {}

  stepFixed(ball: BallLike, dt: number, opts: { awaitingServe: boolean; serveSide: "deuce" | "ad"; onRuleEvent?: (event: CourtRuleEvent) => void; onBounce?: () => void; onNet?: () => void }) {
    const prevZ = ball.pos.z;
    const spinDip = Math.max(0, ball.spin) * 0.18;
    const spinLift = Math.max(0, -ball.spin) * 0.07;
    ball.vel.y -= gameConfig.gravity * (1 + spinDip - spinLift) * dt;
    if (ball.lastHitBy && Math.abs(ball.vel.z) > 0.001) {
      const forwardSign = ball.lastHitBy === "near" ? -1 : 1;
      const horizontalSpeed = Math.hypot(ball.vel.x, ball.vel.z);
      ball.vel.z += forwardSign * ball.spin * 0.16 * gameConfig.worldScale * dt;
      ball.vel.x += Math.sin(ball.spin * 0.72) * (0.018 + horizontalSpeed * 0.0007) * gameConfig.worldScale * dt;
    }
    ball.vel.multiplyScalar(Math.exp(-gameConfig.airDrag * dt));
    ball.pos.addScaledVector(ball.vel, dt);
    ball.spin *= Math.exp(-1.05 * dt);

    if (ball.lastHitBy && this.rules.isNetCollision(ball.pos, prevZ)) {
      ball.state = TennisBallState.NetHit;
      ball.vel.multiplyScalar(0.2);
      ball.vel.z = Math.sign(ball.vel.z || (ball.lastHitBy === "near" ? -1 : 1)) * Math.max(0.4, Math.abs(ball.vel.z));
      ball.vel.y = Math.max(0.45, Math.abs(ball.vel.y) + 0.2);
      ball.pos.z = ball.lastHitBy === "near" ? -0.12 : 0.12;
      opts.onNet?.();
      opts.onRuleEvent?.({ type: opts.awaitingServe ? "serveFault" : "net", reason: "net", hitter: ball.lastHitBy, side: sideOfZ(ball.pos.z) } as CourtRuleEvent);
      return;
    }

    if (ball.pos.y <= gameConfig.ballR) {
      ball.pos.y = gameConfig.ballR;
      if (ball.vel.y < 0) {
        ball.state = TennisBallState.CourtBounce;
        const incomingZ = ball.vel.z;
        const forwardSign = ball.lastHitBy === "near" ? -1 : ball.lastHitBy === "far" ? 1 : Math.sign(ball.vel.z || 1);
        const incomingY = Math.abs(ball.vel.y);
        const pace = Math.hypot(ball.vel.x, ball.vel.z);
        const paceDamp = clamp(1 - pace / (42 * gameConfig.worldScale), 0.82, 1);
        ball.vel.y = incomingY * gameConfig.bounceRestitution * paceDamp;
        ball.vel.x *= gameConfig.groundFriction;
        ball.vel.z *= gameConfig.groundFriction;
        ball.vel.z += forwardSign * ball.spin * 0.39 * gameConfig.worldScale;
        ball.vel.x += Math.sign(ball.vel.x || Math.sin(ball.spin)) * Math.abs(ball.spin) * 0.052 * gameConfig.worldScale;
        ball.vel.y *= clamp(1 - Math.max(0, ball.spin) * 0.06 + Math.max(0, -ball.spin) * 0.035, 0.76, 1.11);
        if (Math.sign(incomingZ) !== Math.sign(ball.vel.z) && Math.abs(incomingZ) > 0.01) ball.vel.z *= 0.65;
        ball.spin = -ball.spin * 0.42 + pace * 0.006 * Math.sign(forwardSign);
        const bounceSide = sideOfZ(ball.pos.z);
        ball.bounceCount = ball.bounceSide === bounceSide ? ball.bounceCount + 1 : 1;
        ball.bounceSide = bounceSide;
        opts.onBounce?.();
        const event = this.rules.evaluateBounce(ball.pos, ball.lastHitBy, opts.serveSide, opts.awaitingServe, ball.bounceCount);
        if (event) opts.onRuleEvent?.(event);
      }
    }

    if ((Math.abs(ball.pos.x) > gameConfig.courtW / 2 + 3.2 || Math.abs(ball.pos.z) > gameConfig.courtL / 2 + 3.2 || ball.pos.y < -1.2) && ball.lastHitBy) {
      ball.state = TennisBallState.Out;
      opts.onRuleEvent?.({ type: "out", side: sideOfZ(ball.pos.z), landing: ball.pos.clone() });
    }
  }
}
