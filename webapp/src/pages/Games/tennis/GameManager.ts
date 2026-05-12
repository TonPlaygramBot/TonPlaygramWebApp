import { BallController } from "./BallController";
import { CourtRules } from "./CourtRules";
import { ScoreManager } from "./ScoreManager";
import { ServeController } from "./ServeController";
import { AIController } from "./AIController";
import { CameraController } from "./CameraController";
import { AudioVFXManager } from "./AudioVFXManager";

export class GameManager {
  readonly courtRules = new CourtRules();
  readonly ballController = new BallController(this.courtRules);
  readonly scoreManager = new ScoreManager();
  readonly serveController = new ServeController();
  readonly aiController = new AIController();
  readonly cameraController = new CameraController();
  readonly audioVfx = new AudioVFXManager();
}
