import { BallPhysics } from "./BallPhysics";
import { ScoreManager } from "./ScoreManager";
import { ReplayManager } from "./ReplayManager";
import { PaddleHitDetector } from "./PaddleHitDetector";
import { AIController } from "./AIController";
import { CameraController } from "./CameraController";
import { PlayerController } from "./PlayerController";

export class GameManager {
  readonly physics = new BallPhysics();
  readonly score = new ScoreManager();
  readonly replay = new ReplayManager();
  readonly hitDetector = new PaddleHitDetector();
  readonly ai = new AIController();
  readonly camera = new CameraController();
  readonly nearPlayer = new PlayerController("near");
  readonly farPlayer = new PlayerController("far");
}
