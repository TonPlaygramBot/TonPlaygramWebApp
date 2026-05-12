import { type PlayerSide, type PointReason } from "./gameConfig";

export type ScoreState = { nearScore: number; farScore: number; server: PlayerSide; gameOver: boolean };

export class ScoreManager {
  private state: ScoreState = { nearScore: 0, farScore: 0, server: "near", gameOver: false };

  get snapshot() { return { ...this.state }; }

  reset() { this.state = { nearScore: 0, farScore: 0, server: "near", gameOver: false }; }

  scorePoint(winner: PlayerSide, _reason: PointReason) {
    if (winner === "near") this.state.nearScore += 1;
    else this.state.farScore += 1;
    this.state.server = this.chooseServer();
    this.state.gameOver = (this.state.nearScore >= 11 || this.state.farScore >= 11) && Math.abs(this.state.nearScore - this.state.farScore) >= 2;
    return this.snapshot;
  }

  private chooseServer(): PlayerSide {
    const total = this.state.nearScore + this.state.farScore;
    const deuce = this.state.nearScore >= 10 && this.state.farScore >= 10;
    const block = deuce ? 1 : 2;
    return Math.floor(total / block) % 2 === 0 ? "near" : "far";
  }
}
