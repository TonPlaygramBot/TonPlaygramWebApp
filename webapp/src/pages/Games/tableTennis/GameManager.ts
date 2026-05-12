import * as THREE from "three";
import { BallPhysics, PhysicsEvent } from "./BallPhysics";
import { PaddleHitDetector } from "./PaddleHitDetector";
import { PlayerController } from "./PlayerController";
import { AIController } from "./AIController";
import { ScoreManager } from "./ScoreManager";
import { ReplayManager } from "./ReplayManager";
import { BALL_SURFACE_Y, PlayerSide, ShotType, TABLE_HALF_L, TABLE_HALF_W, ballisticVelocity, gameConfig } from "./gameConfig";

export class GameManager {
  readonly physics = new BallPhysics();
  readonly hitDetector = new PaddleHitDetector();
  readonly score = new ScoreManager();
  readonly replay = new ReplayManager();
  readonly ai: AIController;
  private pointCooldown = 0;
  onStatus?: (status: string) => void;
  onScore?: () => void;
  onHit?: (label: string) => void;
  onBounce?: () => void;
  onNet?: () => void;

  constructor(readonly player: PlayerController, readonly opponentPlayer: PlayerController) {
    this.ai = new AIController(opponentPlayer);
    this.physics.resetForServe(this.score.state.server);
  }

  serve(side: PlayerSide, target: THREE.Vector3, power: number, spinAmount: number) {
    const avatar = side === "near" ? this.player.avatar : this.opponentPlayer.avatar;
    const start = avatar.paddleWorld.clone();
    start.y = Math.max(start.y, BALL_SURFACE_Y + 0.18);
    this.physics.ball.position.copy(start);
    const ownBounce = new THREE.Vector3(target.x * 0.36, BALL_SURFACE_Y, side === "near" ? 0.58 : -0.58);
    const velocity = ballisticVelocity(start, ownBounce, 0.22 + (1 - power) * 0.06);
    const dirZ = side === "near" ? -1 : 1;
    this.physics.applyHit(side, velocity, new THREE.Vector3(-dirZ * (70 + power * 58), spinAmount * 95, spinAmount * 10), true);
    this.onHit?.(side === "near" ? "serve" : "AI serve");
  }

  attemptHit(side: PlayerSide, shotType: ShotType, target: THREE.Vector3, power: number, spin: number, timing = 0, accuracy = 0.88) {
    const avatar = side === "near" ? this.player.avatar : this.opponentPlayer.avatar;
    const result = this.hitDetector.detect({ side, paddlePosition: avatar.paddleWorld, paddleForward: avatar.paddleForward, ball: this.physics.ball, shotType, target, power, spin, accuracy, timing });
    if (!result.valid) {
      if (side === "near") this.onStatus?.(result.reason);
      return false;
    }
    this.physics.applyHit(side, result.velocity, result.spin);
    (side === "near" ? this.player : this.opponentPlayer).completeHit();
    this.onHit?.(result.label);
    this.replay.recordEvent(this.physics.ball, { type: "bounce", side, position: this.physics.ball.position.clone() });
    return true;
  }

  update(dt: number) {
    if (this.replay.active) {
      this.replay.update(dt, this.physics.ball);
      this.onStatus?.(this.replay.label);
      return;
    }
    if (this.pointCooldown > 0) {
      this.pointCooldown -= dt;
      if (this.pointCooldown <= 0) {
        this.physics.resetForServe(this.score.state.server);
        this.onStatus?.(this.score.state.server === "near" ? "Your serve: swipe up" : "AI is serving");
      }
      return;
    }

    this.ai.update(dt, this.physics);
    if (this.score.state.server === "far" && this.physics.ball.lastHitBy === null) {
      this.opponentPlayer.startSwing("serve");
      this.serve("far", new THREE.Vector3((Math.random() - 0.5) * 0.6, BALL_SURFACE_Y, TABLE_HALF_L * 0.55), 0.58, (Math.random() - 0.5) * 0.5);
    }
    if (this.ai.canAttempt(this.physics) && this.opponentPlayer.avatar.swing === 0) {
      const plan = this.ai.makeShot();
      this.opponentPlayer.startSwing(plan.shotType === "push" ? "backhand" : "forehand");
      this.attemptHit("far", plan.shotType, plan.target, plan.power, plan.spin, 0, gameConfig.ai.accuracy);
    }

    const events = this.physics.update(dt);
    for (const event of events) this.handleEvent(event);
    this.replay.record(this.physics.ball, events);
  }

  private handleEvent(event: PhysicsEvent) {
    if (event.type === "bounce") {
      this.onBounce?.();
    } else if (event.type === "net") {
      this.onNet?.();
    } else {
      this.endPoint(event.winner, event.reason);
    }
  }

  private endPoint(winner: PlayerSide, reason: Parameters<ScoreManager["awardPoint"]>[1]) {
    if (this.pointCooldown > 0) return;
    this.score.awardPoint(winner, reason);
    this.physics.ball.state = "pointEnded";
    this.pointCooldown = 0.95;
    this.replay.start();
    this.onScore?.();
  }

  makeUserTarget(dx: number, dy: number, isServe: boolean) {
    const x = THREE.MathUtils.clamp(dx * 0.006, -TABLE_HALF_W + 0.15, TABLE_HALF_W - 0.15);
    const depth = isServe ? 0.56 : 0.45 + THREE.MathUtils.clamp(-dy / 260, 0, 1) * (TABLE_HALF_L - 0.68);
    return new THREE.Vector3(x, BALL_SURFACE_Y, -depth);
  }
}
