import { tennisPointLabel, type PlayerSide } from "./gameConfig";

export type ScoreSnapshot = {
  nearPoints: number;
  farPoints: number;
  nearGames: number;
  farGames: number;
  nearLabel: string;
  farLabel: string;
  scoreText: string;
  totalPoints: number;
  server: PlayerSide;
  message: string;
};

export class ScoreManager {
  private nearPoints = 0;
  private farPoints = 0;
  private nearGames = 0;
  private farGames = 0;
  private totalPoints = 0;
  private server: PlayerSide = "near";
  private message = "Swipe up to serve";

  awardPoint(winner: PlayerSide, reason = "Point") {
    if (winner === "near") this.nearPoints += 1;
    else this.farPoints += 1;
    this.totalPoints += 1;
    this.message = `${reason}: ${winner === "near" ? "You" : "AI"} scores`;
    if (this.hasGameWinner()) this.awardGame(winner);
    return this.snapshot();
  }

  private hasGameWinner() {
    const high = Math.max(this.nearPoints, this.farPoints);
    const diff = Math.abs(this.nearPoints - this.farPoints);
    return high >= 4 && diff >= 2;
  }

  private awardGame(winner: PlayerSide) {
    if (winner === "near") this.nearGames += 1;
    else this.farGames += 1;
    this.nearPoints = 0;
    this.farPoints = 0;
    this.server = this.server === "near" ? "far" : "near";
    this.message += " — Game";
  }

  snapshot(): ScoreSnapshot {
    let nearLabel = tennisPointLabel(this.nearPoints);
    let farLabel = tennisPointLabel(this.farPoints);
    if (this.nearPoints >= 3 && this.farPoints >= 3) {
      if (this.nearPoints === this.farPoints) nearLabel = farLabel = "40";
      else if (this.nearPoints > this.farPoints) { nearLabel = "Ad"; farLabel = "40"; }
      else { nearLabel = "40"; farLabel = "Ad"; }
    }
    return {
      nearPoints: this.nearPoints,
      farPoints: this.farPoints,
      nearGames: this.nearGames,
      farGames: this.farGames,
      nearLabel,
      farLabel,
      scoreText: `${nearLabel} : ${farLabel}`,
      totalPoints: this.totalPoints,
      server: this.server,
      message: this.message,
    };
  }
}
