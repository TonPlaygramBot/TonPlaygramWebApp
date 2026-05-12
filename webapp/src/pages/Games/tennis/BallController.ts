import { gameConfig, sideOfZ, type BallPhysicsState, type PlayerSide } from "./gameConfig";

export type MutableBall = {
  pos: { x: number; y: number; z: number; addScaledVector(v: { x: number; y: number; z: number }, s: number): unknown };
  vel: { x: number; y: number; z: number; multiplyScalar(s: number): unknown; length(): number };
  spin: number;
  lastHitBy: PlayerSide | null;
};

export class BallController {
  state: BallPhysicsState = "Idle";
  accumulator = 0;

  stepFixed(ball: MutableBall, dt = gameConfig.fixedTimeStep) {
    ball.vel.y -= gameConfig.gravity * (1 + ball.spin * 0.18) * dt;
    ball.vel.multiplyScalar(Math.exp(-gameConfig.airDrag * dt));
    ball.pos.addScaledVector(ball.vel, dt);
    ball.spin *= Math.exp(-0.95 * dt);
    this.state = ball.lastHitBy ? "InFlight" : "ServeReady";
    if (ball.pos.y <= gameConfig.courtPlaneY + gameConfig.ballRadius) {
      ball.pos.y = gameConfig.courtPlaneY + gameConfig.ballRadius;
      if (ball.vel.y < 0) {
        ball.vel.y = -ball.vel.y * gameConfig.bounceDamping;
        ball.vel.x *= gameConfig.courtFriction;
        ball.vel.z *= gameConfig.courtFriction;
        this.state = "CourtBounce";
      }
    }
    return sideOfZ(ball.pos.z);
  }
}
