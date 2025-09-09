import { Ball, BallColor, FrameState, Player } from '../types';

export class SnookerRules {
  constructor(private opts: { simplified?: boolean } = {}) {}

  getBallValues(): Record<BallColor, number> {
    return {
      RED: 1,
      YELLOW: 2,
      GREEN: 3,
      BROWN: 4,
      BLUE: 5,
      PINK: 6,
      BLACK: 7,
      CUE: 0,
    };
  }

  getInitialFrame(pA: string, pB: string): FrameState {
    const balls: Ball[] = [];
    // 15 reds
    for (let i = 0; i < 15; i++) {
      balls.push({ id: `R${i + 1}`, color: 'RED', onTable: true, potted: false });
    }
    const colors: BallColor[] = ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK', 'CUE'];
    for (const c of colors) {
      balls.push({ id: c, color: c, onTable: true, potted: false });
    }
    const players: { A: Player; B: Player } = {
      A: { id: 'A', name: pA, score: 0 },
      B: { id: 'B', name: pB, score: 0 },
    };
    return {
      balls,
      activePlayer: 'A',
      players,
      phase: 'REDS_AND_COLORS',
      redsRemaining: 15,
      colorOnAfterRed: false,
      ballOn: ['RED'],
      freeBall: false,
      frameOver: false,
    };
  }

  isBallOn(state: FrameState, firstContact: BallColor | null): boolean {
    if (!firstContact) return false;
    if (state.freeBall) return firstContact !== 'CUE';
    return state.ballOn.includes(firstContact);
  }

  computeLegalNext(state: FrameState): BallColor[] {
    if (state.phase === 'REDS_AND_COLORS') {
      if (state.colorOnAfterRed) {
        return ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'];
      }
      return ['RED'];
    }
    // COLORS_ORDER
    const order: BallColor[] = ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'];
    for (const c of order) {
      const ball = state.balls.find((b) => b.color === c);
      if (ball && ball.onTable) return [c];
    }
    return [];
  }
}
