export type BilardoPlayer = 'A' | 'B';

export type BilardoShotSummary = {
  firstContact: number | null;
  potted: number[];
  cueBallPotted?: boolean;
};

export type BilardoShotResult = {
  legal: boolean;
  foul: boolean;
  reason?: string;
  scored: number;
  pointsByBall: number[];
  potted: number[];
  nextPlayer: BilardoPlayer;
  keepTurn: boolean;
  cueBallInHand: boolean;
  scores: { A: number; B: number };
  raceTo: number;
  winner: BilardoPlayer | null;
};

const sumNumbers = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

const lowestBall = (ballsOnTable: Set<number>) => {
  let lowest: number | null = null;
  for (const value of ballsOnTable) {
    if (lowest == null || value < lowest) lowest = value;
  }
  return lowest;
};

export class BilardoShqipRules {
  private scores = { A: 0, B: 0 };

  private ballsOnTable = new Set(Array.from({ length: 15 }, (_, index) => index + 1));

  private currentPlayer: BilardoPlayer = 'A';

  private winner: BilardoPlayer | null = null;

  private cueBallInHand = false;

  private readonly raceTo: number;

  constructor(targetScore = 61) {
    this.raceTo = Number.isFinite(targetScore) && targetScore > 0 ? Math.floor(targetScore) : 61;
  }

  getSnapshot() {
    return {
      scores: { ...this.scores },
      currentPlayer: this.currentPlayer,
      winner: this.winner,
      cueBallInHand: this.cueBallInHand,
      ballsRemaining: this.ballsOnTable.size,
      raceTo: this.raceTo,
      nextRequiredBall: lowestBall(this.ballsOnTable)
    };
  }

  resolveShot(summary: BilardoShotSummary): BilardoShotResult {
    const active = this.currentPlayer;
    const opponent: BilardoPlayer = active === 'A' ? 'B' : 'A';
    const potted = Array.isArray(summary.potted)
      ? summary.potted.filter((value) => Number.isFinite(value) && value >= 1 && value <= 15)
      : [];
    const uniquePotted = Array.from(new Set(potted));
    const firstRequired = lowestBall(this.ballsOnTable);

    let foul = false;
    let reason = '';
    if (summary.cueBallPotted) {
      foul = true;
      reason = 'scratch';
    } else if (summary.firstContact == null) {
      foul = true;
      reason = 'no contact';
    } else if (firstRequired != null && summary.firstContact !== firstRequired) {
      foul = true;
      reason = `wrong first contact (needed ${firstRequired})`;
    }

    const legalPots = uniquePotted.filter((ball) => this.ballsOnTable.has(ball));
    legalPots.forEach((ball) => this.ballsOnTable.delete(ball));
    const scored = foul ? 0 : sumNumbers(legalPots);

    if (!foul && scored > 0) {
      this.scores[active] += scored;
    }

    if (!this.winner) {
      if (this.scores[active] >= this.raceTo) {
        this.winner = active;
      } else if (this.scores[opponent] >= this.raceTo) {
        this.winner = opponent;
      }
    }

    const keepTurn = !foul && scored > 0 && !this.winner;
    const nextPlayer = keepTurn ? active : opponent;
    this.currentPlayer = nextPlayer;
    this.cueBallInHand = foul;

    return {
      legal: !foul,
      foul,
      reason: foul ? reason : undefined,
      scored,
      pointsByBall: legalPots,
      potted: uniquePotted,
      nextPlayer,
      keepTurn,
      cueBallInHand: this.cueBallInHand,
      scores: { ...this.scores },
      raceTo: this.raceTo,
      winner: this.winner
    };
  }
}

export default BilardoShqipRules;
