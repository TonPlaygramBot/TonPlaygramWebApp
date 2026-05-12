import { CourtRules } from "./CourtRules";
import { ScoreManager } from "./ScoreManager";
import { ServeController } from "./ServeController";
export class GameManager {
  readonly courtRules = new CourtRules();
  readonly score = new ScoreManager();
  readonly serve = new ServeController();
}
