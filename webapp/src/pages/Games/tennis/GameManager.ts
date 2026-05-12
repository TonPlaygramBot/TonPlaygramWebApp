import { courtRules } from "./CourtRules";
import { ScoreManager } from "./ScoreManager";
import { ServeController } from "./ServeController";
import { BallController } from "./BallController";

export class GameManager {
  readonly rules = courtRules;
  readonly score = new ScoreManager();
  readonly serve = new ServeController();
  readonly ball = new BallController();
}
