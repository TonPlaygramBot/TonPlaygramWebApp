import { PlayerSide, ServeCourtSide } from "./gameConfig";

export type TennisPointLabel = "0" | "15" | "30" | "40" | "Ad";
export type ScoreSnapshot = { nearPoints: number; farPoints: number; nearGames: number; farGames: number; server: PlayerSide; serveSide: ServeCourtSide; firstServe: boolean; message: string };

export class ScoreManager {
  private nearPoints = 0;
  private farPoints = 0;
  private nearGames = 0;
  private farGames = 0;
  private server: PlayerSide = "near";
  private firstServe = true;

  snapshot(message = "Swipe up to serve"): ScoreSnapshot {
    return { nearPoints: this.nearPoints, farPoints: this.farPoints, nearGames: this.nearGames, farGames: this.farGames, server: this.server, serveSide: this.serveSide(), firstServe: this.firstServe, message };
  }

  pointLabel(side: PlayerSide): TennisPointLabel | "Deuce" {
    const p = side === "near" ? this.nearPoints : this.farPoints;
    const o = side === "near" ? this.farPoints : this.nearPoints;
    if (p >= 3 && o >= 3) {
      if (p === o) return "Deuce";
      return p > o ? "Ad" : "40";
    }
    return (["0", "15", "30", "40"] as TennisPointLabel[])[Math.min(3, p)];
  }

  uiLabel(side: PlayerSide) { return this.pointLabel(side); }
  serveSide(): ServeCourtSide { return (this.nearPoints + this.farPoints) % 2 === 0 ? "deuce" : "ad"; }
  isFirstServe() { return this.firstServe; }
  setSecondServe() { this.firstServe = false; }
  resetFirstServe() { this.firstServe = true; }

  addPoint(winner: PlayerSide) {
    if (winner === "near") this.nearPoints += 1;
    else this.farPoints += 1;

    const n = this.nearPoints;
    const f = this.farPoints;
    let gameWon: PlayerSide | null = null;
    if ((n >= 4 || f >= 4) && Math.abs(n - f) >= 2) gameWon = n > f ? "near" : "far";
    if (gameWon) {
      if (gameWon === "near") this.nearGames += 1;
      else this.farGames += 1;
      this.nearPoints = 0;
      this.farPoints = 0;
      this.server = this.server === "near" ? "far" : "near";
    }
    this.firstServe = true;
    return { gameWon, snapshot: this.snapshot() };
  }
}
