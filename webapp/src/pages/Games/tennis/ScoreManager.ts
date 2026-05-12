import { PlayerSide, ServeSide } from "./gameConfig";

export type ScoreSnapshot = {
  points: Record<PlayerSide, number>;
  games: Record<PlayerSide, number>;
  sets: Record<PlayerSide, number>;
  server: PlayerSide;
  serveSide: ServeSide;
  pointTotal: number;
  label: Record<PlayerSide, string>;
  gameWonBy?: PlayerSide;
};

export class ScoreManager {
  private points: Record<PlayerSide, number> = { near: 0, far: 0 };
  private games: Record<PlayerSide, number> = { near: 0, far: 0 };
  private sets: Record<PlayerSide, number> = { near: 0, far: 0 };
  private pointTotal = 0;
  server: PlayerSide = "near";

  awardPoint(winner: PlayerSide): ScoreSnapshot {
    this.points[winner] += 1;
    this.pointTotal += 1;
    let gameWonBy: PlayerSide | undefined;
    if (this.hasWonGame(winner)) {
      gameWonBy = winner;
      this.games[winner] += 1;
      this.points = { near: 0, far: 0 };
      this.server = this.server === "near" ? "far" : "near";
    }
    return { ...this.snapshot(), gameWonBy };
  }

  snapshot(): ScoreSnapshot {
    return {
      points: { ...this.points },
      games: { ...this.games },
      sets: { ...this.sets },
      server: this.server,
      serveSide: this.serveSide,
      pointTotal: this.pointTotal,
      label: this.pointLabels(),
    };
  }

  get serveSide(): ServeSide {
    return this.pointTotal % 2 === 0 ? "deuce" : "ad";
  }

  private hasWonGame(side: PlayerSide) {
    const other = side === "near" ? "far" : "near";
    return this.points[side] >= 4 && this.points[side] - this.points[other] >= 2;
  }

  private pointLabels(): Record<PlayerSide, string> {
    const near = this.points.near;
    const far = this.points.far;
    if (near >= 3 && far >= 3) {
      if (near === far) return { near: "40", far: "40" };
      return near > far ? { near: "Ad", far: "40" } : { near: "40", far: "Ad" };
    }
    const label = ["0", "15", "30", "40"];
    return { near: label[Math.min(near, 3)], far: label[Math.min(far, 3)] };
  }
}
