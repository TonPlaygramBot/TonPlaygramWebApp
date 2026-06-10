import { gameConfig, PlayerSide, ServeSide } from "./gameConfig";

export type ScoreSnapshot = {
  points: Record<PlayerSide, number>;
  games: Record<PlayerSide, number>;
  sets: Record<PlayerSide, number>;
  server: PlayerSide;
  serveSide: ServeSide;
  pointTotal: number;
  label: Record<PlayerSide, string>;
  gameWonBy?: PlayerSide;
  setWonBy?: PlayerSide;
  inTiebreak: boolean;
};

const otherSide = (side: PlayerSide): PlayerSide => (side === "near" ? "far" : "near");

/**
 * Singles scoring modelled after the standard ITF Rules of Tennis flow:
 * - games use love/15/30/40, deuce, advantage, and two-clear-points game wins;
 * - service starts from the deuce court each game and alternates deuce/ad by the
 *   number of points played in the current game (not by total match points);
 * - sets are first to six games, win by two, with a 7-point tie-break at 6-6;
 * - tie-break service order is first point by the next server, then two points
 *   per player, and tie-break points are won by two from seven.
 */
export class ScoreManager {
  private points: Record<PlayerSide, number> = { near: 0, far: 0 };
  private games: Record<PlayerSide, number> = { near: 0, far: 0 };
  private sets: Record<PlayerSide, number> = { near: 0, far: 0 };
  private pointTotal = 0;
  private inTiebreakGame = false;
  private tiebreakFirstServer: PlayerSide = "near";
  server: PlayerSide = "near";

  awardPoint(winner: PlayerSide): ScoreSnapshot {
    this.points[winner] += 1;
    this.pointTotal += 1;
    let gameWonBy: PlayerSide | undefined;
    let setWonBy: PlayerSide | undefined;

    if (this.inTiebreakGame) {
      if (this.hasWonTiebreak(winner)) {
        gameWonBy = winner;
        setWonBy = winner;
        this.games[winner] += 1;
        this.sets[winner] += 1;
        this.points = { near: 0, far: 0 };
        this.games = { near: 0, far: 0 };
        this.inTiebreakGame = false;
        this.server = otherSide(this.tiebreakFirstServer);
      } else {
        this.server = this.tiebreakServerForPoint(this.points.near + this.points.far);
      }
      return { ...this.snapshot(), gameWonBy, setWonBy };
    }

    if (this.hasWonGame(winner)) {
      gameWonBy = winner;
      this.games[winner] += 1;
      this.points = { near: 0, far: 0 };
      this.server = otherSide(this.server);

      if (this.hasWonSet(winner)) {
        setWonBy = winner;
        this.sets[winner] += 1;
        this.games = { near: 0, far: 0 };
      } else if (this.games.near === 6 && this.games.far === 6) {
        this.inTiebreakGame = true;
        this.tiebreakFirstServer = this.server;
      }
    }

    return { ...this.snapshot(), gameWonBy, setWonBy };
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
      inTiebreak: this.inTiebreakGame,
    };
  }

  get serveSide(): ServeSide {
    return (this.points.near + this.points.far) % 2 === 0 ? "deuce" : "ad";
  }

  private hasWonGame(side: PlayerSide) {
    const other = otherSide(side);
    return this.points[side] >= 4 && this.points[side] - this.points[other] >= 2;
  }

  private hasWonSet(side: PlayerSide) {
    const other = otherSide(side);
    return this.games[side] >= gameConfig.scoring.gamesPerSet && this.games[side] - this.games[other] >= 2;
  }

  private hasWonTiebreak(side: PlayerSide) {
    const other = otherSide(side);
    return this.points[side] >= gameConfig.scoring.tiebreakPoints && this.points[side] - this.points[other] >= 2;
  }

  private tiebreakServerForPoint(pointIndex: number): PlayerSide {
    if (pointIndex === 0) return this.tiebreakFirstServer;
    const pairIndex = Math.floor((pointIndex - 1) / 2);
    return pairIndex % 2 === 0 ? otherSide(this.tiebreakFirstServer) : this.tiebreakFirstServer;
  }

  private pointLabels(): Record<PlayerSide, string> {
    if (this.inTiebreakGame) return { near: String(this.points.near), far: String(this.points.far) };

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
