export type TableTennisSide = "near" | "far";

export type TableTennisScore = Readonly<{
  near: number;
  far: number;
}>;

export const OFFICIAL_TABLE_TENNIS = Object.freeze({
  tableLengthM: 2.74,
  tableWidthM: 1.525,
  tableHeightM: 0.76,
  netHeightM: 0.1525,
  ballDiameterM: 0.04,
  minimumServeTossM: 0.16,
  pointsToWin: 11,
  winBy: 2,
  servesPerTurn: 2,
});

export const otherTableTennisSide = (side: TableTennisSide): TableTennisSide =>
  side === "near" ? "far" : "near";

/** Singles service order: two serves each, changing every point once both players reach 10. */
export function serverForScore(score: TableTennisScore, firstServer: TableTennisSide): TableTennisSide {
  const total = score.near + score.far;
  const deuce = score.near >= 10 && score.far >= 10;
  const serviceTurn = deuce ? total : Math.floor(total / OFFICIAL_TABLE_TENNIS.servesPerTurn);
  return serviceTurn % 2 === 0 ? firstServer : otherTableTennisSide(firstServer);
}

export function gameWinner(score: TableTennisScore): TableTennisSide | null {
  const leader: TableTennisSide = score.near > score.far ? "near" : "far";
  const leaderScore = score[leader];
  const trailerScore = score[otherTableTennisSide(leader)];
  return leaderScore >= OFFICIAL_TABLE_TENNIS.pointsToWin && leaderScore - trailerScore >= OFFICIAL_TABLE_TENNIS.winBy
    ? leader
    : null;
}

export function scorePoint(score: TableTennisScore, winner: TableTennisSide) {
  const next = { near: score.near + (winner === "near" ? 1 : 0), far: score.far + (winner === "far" ? 1 : 0) };
  return { score: next, winner: gameWinner(next) } as const;
}

