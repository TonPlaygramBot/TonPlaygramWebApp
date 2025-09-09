import { FrameState, ShotEvent, BallColor, Ball } from '../types';
import { SnookerRules } from '../rules/SnookerRules';

export class Referee {
  constructor(private rules: SnookerRules = new SnookerRules()) {}

  snapshot(state: FrameState): FrameState {
    return JSON.parse(JSON.stringify(state));
  }

  restore(snapshot: FrameState): FrameState {
    return JSON.parse(JSON.stringify(snapshot));
  }

  applyShot(state: FrameState, events: ShotEvent[]): FrameState {
    let newState: FrameState = this.snapshot(state);
    newState.foul = undefined;
    let scored = 0;

    const hit = events.find((e) => e.type === 'HIT') as
      | { type: 'HIT'; firstContact: BallColor | null }
      | undefined;
    const first = hit ? hit.firstContact : null;

    const values = this.rules.getBallValues();

    if (!this.rules.isBallOn(newState, first)) {
      const valOn = Math.max(...newState.ballOn.map((c: BallColor) => values[c]));
      const valFirst = first ? values[first] : 0;
      const pts = Math.max(4, valOn, valFirst);
      return this.awardFoul(newState, pts, 'wrong ball first');
    }

    for (const ev of events) {
      if (ev.type === 'POTTED') {
        if (newState.freeBall) {
          scored += values[newState.ballOn[0] as BallColor];
          const ball = newState.balls.find((b: Ball) => b.color === ev.ball);
          if (ball) {
            ball.onTable = true;
            ball.potted = false;
          }
          newState.freeBall = false;
          newState.colorOnAfterRed = true;
          continue;
        }
        if (!newState.ballOn.includes(ev.ball)) {
          const valOn = Math.max(...newState.ballOn.map((c: BallColor) => values[c]));
          const valPot = values[ev.ball];
          const pts = Math.max(4, valOn, valPot);
          return this.awardFoul(newState, pts, 'wrong ball potted');
        }
        scored += values[ev.ball];
        const ball = newState.balls.find((b: Ball) => b.color === ev.ball && b.onTable);
        if (ev.ball === 'RED') {
          if (ball) {
            ball.onTable = false;
            ball.potted = true;
          }
          newState.redsRemaining -= 1;
          newState.colorOnAfterRed = true;
        } else {
          if (newState.phase === 'REDS_AND_COLORS' && newState.redsRemaining > 0) {
            if (ball) {
              ball.onTable = true;
              ball.potted = false;
            }
            newState.colorOnAfterRed = false;
          } else if (newState.phase === 'REDS_AND_COLORS' && newState.redsRemaining === 0) {
            if (ball) {
              ball.onTable = true;
              ball.potted = false;
            }
            newState.phase = 'COLORS_ORDER';
            newState.colorOnAfterRed = false;
          } else {
            if (ball) {
              ball.onTable = false;
              ball.potted = true;
            }
          }
        }
      }
    }

    newState.players[newState.activePlayer].score += scored;

    // update next balls
    newState.ballOn = this.rules.computeLegalNext(newState);

    if (scored === 0) {
      // turn over
      newState.activePlayer = newState.activePlayer === 'A' ? 'B' : 'A';
      if (newState.phase === 'REDS_AND_COLORS') {
        newState.colorOnAfterRed = false;
        newState.ballOn = this.rules.computeLegalNext(newState);
      }
    }

    if (newState.phase === 'COLORS_ORDER') {
      const colourSeq: BallColor[] = ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'];
      const remaining = colourSeq.some((c: BallColor) =>
        newState.balls.find((b: Ball) => b.color === c && b.onTable)
      );
      if (!remaining) {
        newState.frameOver = true;
        const a = newState.players.A.score;
        const b = newState.players.B.score;
        newState.winner = a > b ? 'A' : b > a ? 'B' : 'TIE';
      }
    }

    return newState;
  }

  awardFoul(state: FrameState, points: number, reason: string): FrameState {
    const newState = this.snapshot(state);
    newState.foul = { points, reason };
    const opponent = newState.activePlayer === 'A' ? 'B' : 'A';
    newState.players[opponent].score += points;
    newState.activePlayer = opponent;
    newState.freeBall = false;
    if (newState.phase === 'REDS_AND_COLORS') newState.colorOnAfterRed = false;
    newState.ballOn = this.rules.computeLegalNext(newState);
    return newState;
  }

  declareMissAndOfferReplay(_state: FrameState, prevSnapshot: any): FrameState {
    return this.restore(prevSnapshot);
  }

  setFreeBall(state: FrameState, enabled: boolean): FrameState {
    const newState = this.snapshot(state);
    newState.freeBall = enabled;
    return newState;
  }
}
