import { BallEvent, BallPhysics } from './BallPhysics';
import { GAME_CONFIG, Side } from './gameConfig';

export interface ScoreState {
  player: number;
  ai: number;
  server: Side;
  winner: Side | null;
  lastReason: string;
}

export class ScoreManager {
  state: ScoreState = { player: 0, ai: 0, server: 'player', winner: null, lastReason: 'Serve' };
  private ralliesSinceServeSwitch = 0;

  evaluate(events: BallEvent[], ball: BallPhysics): Side | null {
    if (ball.state === 'pointEnded') return null;
    let winner: Side | null = null;
    let reason = '';

    if (events.some((event) => event.type === 'net')) {
      winner = ball.lastTouch === 'player' ? 'ai' : 'player';
      reason = 'net fault';
    } else if (ball.bounces.player > 1) {
      winner = 'ai';
      reason = 'double bounce on player side';
    } else if (ball.bounces.ai > 1) {
      winner = 'player';
      reason = 'double bounce on AI side';
    } else if (events.some((event) => event.type === 'out')) {
      winner = this.scoreOutOrMiss(ball);
      reason = 'missed return / out';
    }

    if (!winner) return null;
    this.awardPoint(winner, reason);
    ball.state = 'pointEnded';
    return winner;
  }

  private scoreOutOrMiss(ball: BallPhysics): Side {
    if (ball.lastTouch === 'player') {
      return ball.bounces.ai === 0 ? 'ai' : 'player';
    }
    return ball.bounces.player === 0 ? 'player' : 'ai';
  }

  private awardPoint(winner: Side, reason: string) {
    this.state[winner] += 1;
    this.ralliesSinceServeSwitch += 1;
    const serveInterval = this.state.player >= 10 && this.state.ai >= 10 ? 1 : 2;
    if (this.ralliesSinceServeSwitch >= serveInterval) {
      this.state.server = this.state.server === 'player' ? 'ai' : 'player';
      this.ralliesSinceServeSwitch = 0;
    }
    this.state.lastReason = reason;
    const leading = this.state.player > this.state.ai ? 'player' : 'ai';
    const high = Math.max(this.state.player, this.state.ai);
    const gap = Math.abs(this.state.player - this.state.ai);
    this.state.winner = high >= GAME_CONFIG.score.gamePoint && gap >= GAME_CONFIG.score.winBy ? leading : null;
  }

  resetMatch() {
    this.state = { player: 0, ai: 0, server: 'player', winner: null, lastReason: 'Serve' };
    this.ralliesSinceServeSwitch = 0;
  }
}
