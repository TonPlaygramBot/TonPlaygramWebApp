import { opposite, PlayerSide, PointReason } from "./gameConfig";

export type ScoreEvent = { winner: PlayerSide; reason: PointReason; nearScore: number; farScore: number; server: PlayerSide };

export class ScoreManager {
  nearScore = 0;
  farScore = 0;
  server: PlayerSide = "near";
  pointComplete = false;

  resetPoint() { this.pointComplete = false; }

  awardPoint(winner: PlayerSide, reason: PointReason): ScoreEvent | null {
    if (this.pointComplete) return null;
    this.pointComplete = true;
    if (winner === "near") this.nearScore += 1;
    else this.farScore += 1;
    this.server = this.chooseServer();
    return { winner, reason, nearScore: this.nearScore, farScore: this.farScore, server: this.server };
  }

  chooseServer(): PlayerSide {
    const total = this.nearScore + this.farScore;
    // Simplified modern table-tennis service rotation: every two points.
    return Math.floor(total / 2) % 2 === 0 ? "near" : "far";
  }

  winnerForOut(lastHitBy: PlayerSide, ballLandedOnOpponent: boolean) {
    return ballLandedOnOpponent ? lastHitBy : opposite(lastHitBy);
  }

  snapshot() { return { nearScore: this.nearScore, farScore: this.farScore, server: this.server }; }
}
