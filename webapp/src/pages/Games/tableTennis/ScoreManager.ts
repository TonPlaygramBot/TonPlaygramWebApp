import { PlayerSide, PointReason } from "./gameConfig";

export type ScoreState = { near: number; far: number; server: PlayerSide; gameOver: boolean; status: string };

export class ScoreManager {
  state: ScoreState = { near: 0, far: 0, server: "near", gameOver: false, status: "Swipe up to serve" };

  awardPoint(winner: PlayerSide, reason: PointReason) {
    if (this.state.gameOver) return this.state;
    this.state[winner] += 1;
    const total = this.state.near + this.state.far;
    this.state.server = Math.floor(total / 2) % 2 === 0 ? "near" : "far";
    const lead = Math.abs(this.state.near - this.state.far);
    if ((this.state.near >= 11 || this.state.far >= 11) && lead >= 2) this.state.gameOver = true;
    const label = reason === "doubleBounce" ? "Second bounce" : reason === "missedReturn" ? "Missed return" : reason === "netFault" ? "Net fault" : reason === "wrongSide" ? "Wrong side" : "Out";
    this.state.status = this.state.gameOver ? `${winner === "near" ? "You win" : "AI wins"} ${this.state.near}-${this.state.far}` : `${label}: ${winner === "near" ? "You" : "AI"} scores`;
    return this.state;
  }
}
