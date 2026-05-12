import { BallPhysics, PhysicsBall } from "./BallPhysics";
import { PaddleHitDetector } from "./PaddleHitDetector";
import { ReplayManager } from "./ReplayManager";
import { ScoreManager } from "./ScoreManager";

export class GameManager {
  readonly ballPhysics: BallPhysics;
  readonly hitDetector = new PaddleHitDetector();
  readonly replay = new ReplayManager();
  readonly score = new ScoreManager();
  constructor(ball: PhysicsBall) {
    this.ballPhysics = new BallPhysics(ball);
  }
}
