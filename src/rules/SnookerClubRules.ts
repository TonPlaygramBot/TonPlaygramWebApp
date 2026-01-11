import { BallColor, FrameState, Player, ShotContext, ShotEvent } from '../types';

type SnookerSerializedState = {
  redsRemaining: number;
  colorsOnTable: BallColor[];
  colorOnAfterRed: boolean;
  currentPlayer: 'A' | 'B';
  frameOver: boolean;
  winner: 'A' | 'B' | null | 'TIE';
};

type SnookerMeta = {
  variant: 'snooker';
  state: SnookerSerializedState;
};

const DEFAULT_COLORS: BallColor[] = ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'];

function basePlayers(playerA: string, playerB: string): { A: Player; B: Player } {
  return {
    A: { id: 'A', name: playerA, score: 0 },
    B: { id: 'B', name: playerB, score: 0 }
  };
}

export class SnookerClubRules {
  getInitialFrame(playerA: string, playerB: string): FrameState {
    const base: FrameState = {
      balls: [],
      activePlayer: 'A',
      players: basePlayers(playerA, playerB),
      currentBreak: 0,
      phase: 'REDS_AND_COLORS',
      redsRemaining: 15,
      colorOnAfterRed: false,
      ballOn: ['RED'],
      frameOver: false
    };

    const meta: SnookerMeta = {
      variant: 'snooker',
      state: {
        redsRemaining: 15,
        colorsOnTable: [...DEFAULT_COLORS],
        colorOnAfterRed: false,
        currentPlayer: 'A',
        frameOver: false,
        winner: null
      }
    };

    base.meta = meta;
    return base;
  }

  applyShot(state: FrameState, events: ShotEvent[], context: ShotContext = {}): FrameState {
    return this.applySnookerShot(state, events, context);
  }

  private resolveBallColor(value: unknown): BallColor | null {
    if (typeof value === 'string') {
      const norm = value.toLowerCase();
      if (norm.startsWith('red')) return 'RED';
      if (norm.startsWith('yellow')) return 'YELLOW';
      if (norm.startsWith('green')) return 'GREEN';
      if (norm.startsWith('brown')) return 'BROWN';
      if (norm.startsWith('blue')) return 'BLUE';
      if (norm.startsWith('pink')) return 'PINK';
      if (norm.startsWith('black')) return 'BLACK';
      if (norm.startsWith('cue')) return 'CUE';
    }
    return null;
  }

  private ballValue(color: BallColor | null | undefined): number {
    switch (color) {
      case 'RED':
        return 1;
      case 'YELLOW':
        return 2;
      case 'GREEN':
        return 3;
      case 'BROWN':
        return 4;
      case 'BLUE':
        return 5;
      case 'PINK':
        return 6;
      case 'BLACK':
        return 7;
      default:
        return 0;
    }
  }

  private computeSnookerBallOn(
    phase: FrameState['phase'],
    redsRemaining: number,
    colorOnAfterRed: boolean,
    colorsOnTable: Set<BallColor>
  ): string[] {
    if (phase === 'COLORS_ORDER') {
      const next = DEFAULT_COLORS.find((c) => colorsOnTable.has(c));
      return next ? [next] : [];
    }
    if (colorOnAfterRed) {
      const remaining = DEFAULT_COLORS.filter((c) => colorsOnTable.has(c));
      return remaining.length > 0 ? remaining : DEFAULT_COLORS;
    }
    if (redsRemaining > 0) return ['RED'];
    const next = DEFAULT_COLORS.find((c) => colorsOnTable.has(c));
    return next ? [next] : [];
  }

  private applySnookerShot(state: FrameState, events: ShotEvent[], context: ShotContext): FrameState {
    const meta = (state.meta ?? {}) as SnookerMeta | Record<string, unknown>;
    const previous = meta.variant === 'snooker' ? meta.state : null;

    let redsRemaining = Number.isFinite(state.redsRemaining) ? state.redsRemaining : 15;
    let colorOnAfterRed = Boolean(state.colorOnAfterRed);
    let phase: FrameState['phase'] = state.phase === 'COLORS_ORDER' ? 'COLORS_ORDER' : 'REDS_AND_COLORS';
    const colorsOnTable = new Set<BallColor>(previous?.colorsOnTable ?? DEFAULT_COLORS);
    let activePlayer: 'A' | 'B' = state.activePlayer ?? 'A';
    const opponent: 'A' | 'B' = activePlayer === 'A' ? 'B' : 'A';
    const players: { A: Player; B: Player } = {
      A: { ...state.players.A },
      B: { ...state.players.B }
    };
    let currentBreak = state.currentBreak ?? 0;

    const ballOn = this.computeSnookerBallOn(phase, redsRemaining, colorOnAfterRed, colorsOnTable);
    const ballOnSet = new Set(ballOn);

    let firstContact: BallColor | null = null;
    for (const ev of events) {
      if (ev.type !== 'HIT') continue;
      firstContact = this.resolveBallColor(ev.ballId ?? ev.firstContact);
      if (firstContact) break;
    }

    const potted: BallColor[] = [];
    let cueBallPotted = Boolean(context.cueBallPotted);
    for (const ev of events) {
      if (ev.type !== 'POTTED') continue;
      const colour = this.resolveBallColor(ev.ballId ?? ev.ball);
      if (!colour) continue;
      if (colour === 'CUE') {
        cueBallPotted = true;
      } else {
        potted.push(colour);
      }
    }

    const ballOnValue = Math.max(...Array.from(ballOnSet).map((b) => this.ballValue(b)), 0);
    let foulReason: string | null = null;
    let foulValue = ballOnValue;

    if (!context.contactMade) {
      foulReason = 'No ball struck';
    } else if (!firstContact) {
      foulReason = 'No legal contact';
    } else if (!ballOnSet.has(firstContact)) {
      foulReason = `Incorrect first contact (${firstContact.toLowerCase()})`;
      foulValue = Math.max(foulValue, this.ballValue(firstContact));
    }

    const illegalPot = potted.find((c) => !ballOnSet.has(c));
    if (!foulReason && illegalPot) {
      foulReason = `Illegal pot (${illegalPot.toLowerCase()})`;
      foulValue = Math.max(foulValue, this.ballValue(illegalPot));
    }

    if (!foulReason && context.noCushionAfterContact && potted.length === 0) {
      foulReason = 'No cushion after contact';
    }

    if (!foulReason && cueBallPotted) {
      foulReason = 'Cue ball potted';
      foulValue = Math.max(foulValue, 4);
    }

    const redPots = potted.filter((c) => c === 'RED').length;
    redsRemaining = Math.max(0, redsRemaining - redPots);

    if (foulReason) {
      const foulPoints = Math.max(4, foulValue || 4);
      players[opponent].score = (players[opponent].score ?? 0) + foulPoints;
      activePlayer = opponent;
      currentBreak = 0;
      if (redsRemaining === 0 && phase === 'REDS_AND_COLORS' && !colorOnAfterRed) {
        phase = 'COLORS_ORDER';
      }
      const ballOnNext = this.computeSnookerBallOn(phase, redsRemaining, colorOnAfterRed, colorsOnTable);
      const frameOver = ballOnNext.length === 0 && phase === 'COLORS_ORDER';
      const winner = frameOver
        ? players.A.score === players.B.score
          ? 'TIE'
          : players.A.score > players.B.score
            ? 'A'
            : 'B'
        : undefined;
      return {
        ...state,
        activePlayer,
        players,
        currentBreak,
        phase,
        redsRemaining,
        colorOnAfterRed,
        ballOn: ballOnNext,
        frameOver,
        winner,
        foul: {
          points: foulPoints,
          reason: foulReason
        },
        meta: {
          variant: 'snooker',
          state: {
            redsRemaining,
            colorsOnTable: Array.from(colorsOnTable),
            colorOnAfterRed,
            currentPlayer: activePlayer,
            frameOver,
            winner: (winner ?? null) as SnookerSerializedState['winner']
          }
        }
      };
    }

    let scored = 0;
    potted.forEach((colour) => {
      scored += this.ballValue(colour);
      if (colour === 'RED') return;
      if (phase === 'COLORS_ORDER') {
        colorsOnTable.delete(colour);
      }
    });

    if (phase === 'REDS_AND_COLORS') {
      if (!colorOnAfterRed && redPots > 0) {
        colorOnAfterRed = true;
      }
      if (colorOnAfterRed && potted.some((c) => c !== 'RED')) {
        colorOnAfterRed = false;
        if (redsRemaining === 0) {
          phase = 'COLORS_ORDER';
        }
      }
      if (redsRemaining === 0 && !colorOnAfterRed) {
        phase = 'COLORS_ORDER';
      }
    }

    const frameOver = phase === 'COLORS_ORDER' && colorsOnTable.size === 0;
    const ballOnNext = frameOver
      ? []
      : this.computeSnookerBallOn(phase, redsRemaining, colorOnAfterRed, colorsOnTable);

    if (scored > 0) {
      players[activePlayer].score = (players[activePlayer].score ?? 0) + scored;
      currentBreak = currentBreak + scored;
    } else {
      activePlayer = opponent;
      currentBreak = 0;
    }

    const winner = frameOver
      ? players.A.score === players.B.score
        ? 'TIE'
        : players.A.score > players.B.score
          ? 'A'
          : 'B'
      : undefined;

    return {
      ...state,
      activePlayer,
      players,
      currentBreak,
      phase,
      redsRemaining,
      colorOnAfterRed,
      ballOn: ballOnNext,
      frameOver,
      winner,
      foul: undefined,
      meta: {
        variant: 'snooker',
        state: {
          redsRemaining,
          colorsOnTable: Array.from(colorsOnTable),
          colorOnAfterRed,
          currentPlayer: activePlayer,
          frameOver,
          winner: (winner ?? null) as SnookerSerializedState['winner']
        }
      }
    };
  }
}

export default SnookerClubRules;
