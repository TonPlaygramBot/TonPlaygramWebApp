import { chooseServerAfterScore, PlayerSide, PointReason } from "./gameConfig";

export type ScoreState = { nearScore: number; farScore: number; server: PlayerSide };

export class ScoreManager {
  private state: ScoreState;
  constructor(initial: ScoreState = { nearScore: 0, farScore: 0, server: "near" }) {
    this.state = { ...initial };
  }
  get snapshot() { return { ...this.state }; }
  awardPoint(winner: PlayerSide) {
    if (winner === "near") this.state.nearScore += 1;
    else this.state.farScore += 1;
    this.state.server = chooseServerAfterScore(this.state.nearScore, this.state.farScore);
    return this.snapshot;
  }
  describe(reason: PointReason, winner: PlayerSide) {
    const reasonText = reason === "out" ? "Out" : reason === "doubleBounce" ? "Second bounce" : reason === "net" ? "Net" : reason === "wrongSide" ? "Wrong side" : "Missed return";
    return `${reasonText}: ${winner === "near" ? "You" : "AI"} scores`;
  }
}
