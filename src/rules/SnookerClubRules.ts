import { FrameState, Player, ShotContext, ShotEvent, BallColor } from '../types';

type SnookerMeta = {
  colorsRemaining: BallColor[];
};

const INITIAL_REDS = 15;
const COLOUR_ORDER: BallColor[] = [
  'YELLOW',
  'GREEN',
  'BROWN',
  'BLUE',
  'PINK',
  'BLACK'
];
const BALL_VALUES: Record<BallColor, number> = {
  RED: 1,
  YELLOW: 2,
  GREEN: 3,
  BROWN: 4,
  BLUE: 5,
  PINK: 6,
  BLACK: 7,
  CUE: 0
};

function clonePlayers(players: FrameState['players']): FrameState['players'] {
  return {
    A: { ...players.A },
    B: { ...players.B }
  };
}

function normalizeBallId(value: unknown): BallColor | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return 'RED';
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower.includes('cue')) return 'CUE';
    if (lower.includes('red') || /^(ball_)?\d+$/i.test(lower)) return 'RED';
    if (lower.startsWith('yel')) return 'YELLOW';
    if (lower.startsWith('gre')) return 'GREEN';
    if (lower.startsWith('bro')) return 'BROWN';
    if (lower.startsWith('blu')) return 'BLUE';
    if (lower.startsWith('pin')) return 'PINK';
    if (lower.startsWith('bla')) return 'BLACK';
  }
  return null;
}

function ballValue(ball: BallColor | null | undefined): number {
  if (!ball) return 0;
  return BALL_VALUES[ball] ?? 0;
}

function highestBallValue(values: Array<BallColor | number | null | undefined>): number {
  return values.reduce((max, val) => {
    if (typeof val === 'number') return Math.max(max, val);
    return Math.max(max, ballValue(val));
  }, 4);
}

export class SnookerClubRules {
  private basePlayers(playerA: string, playerB: string): { A: Player; B: Player } {
    return {
      A: { id: 'A', name: playerA, score: 0 },
      B: { id: 'B', name: playerB, score: 0 }
    };
  }

  getInitialFrame(playerA: string, playerB: string): FrameState {
    const players = this.basePlayers(playerA, playerB);
    return {
      balls: [],
      activePlayer: 'A',
      players,
      currentBreak: 0,
      phase: 'REDS_AND_COLORS',
      redsRemaining: INITIAL_REDS,
      colorOnAfterRed: false,
      ballOn: ['RED'],
      frameOver: false,
      meta: {
        colorsRemaining: [...COLOUR_ORDER],
        variant: 'snooker'
      }
    } satisfies FrameState;
  }

  applyShot(state: FrameState, events: ShotEvent[], context: ShotContext = {}): FrameState {
    const meta = (state.meta as SnookerMeta | undefined) ?? { colorsRemaining: [...COLOUR_ORDER] };
    const colorsRemaining = Array.isArray(meta.colorsRemaining)
      ? [...meta.colorsRemaining]
      : [...COLOUR_ORDER];

    const players = clonePlayers(state.players);
    const active = state.activePlayer;
    const other = active === 'A' ? 'B' : 'A';
    let activePlayer = active;
    let phase: FrameState['phase'] = state.phase ?? 'REDS_AND_COLORS';
    let colorOnAfterRed = Boolean(state.colorOnAfterRed);
    let redsRemaining = Number.isFinite(state.redsRemaining) ? state.redsRemaining : INITIAL_REDS;
    let ballOn = Array.isArray(state.ballOn) && state.ballOn.length > 0 ? [...state.ballOn] : ['RED'];
    let currentBreak = state.currentBreak ?? 0;
    let foul: FrameState['foul'];

    const firstContact = events.find((ev) => ev.type === 'HIT') ?? null;
    const firstBall = normalizeBallId(firstContact?.ballId ?? firstContact?.firstContact ?? null);
    const pottedBalls = events
      .filter((ev) => ev.type === 'POTTED')
      .map((ev) => normalizeBallId(ev.ball ?? ev.ballId))
      .filter((c): c is BallColor => Boolean(c));

    const redsPotted = pottedBalls.filter((b) => b === 'RED').length;
    if (redsPotted > 0) {
      redsRemaining = Math.max(0, redsRemaining - redsPotted);
    }

    const cueBallPotted = context.cueBallPotted || pottedBalls.includes('CUE');
    const fouls: { reason: string; value: number }[] = [];
    const registerFoul = (reason: string, valueFrom?: BallColor | null) => {
      fouls.push({ reason, value: ballValue(valueFrom) });
    };

    const requireBallOn = (expected: BallColor[]) => expected.includes(firstBall as BallColor);

    if (cueBallPotted) {
      registerFoul('Cue ball potted', 'BLUE');
    }

    if (phase === 'COLORS_ORDER') {
      const targetColor = colorsRemaining[0] ?? 'BLACK';
      ballOn = targetColor ? [targetColor] : [];

      if (!firstBall) {
        registerFoul('Failed to contact a ball', targetColor);
      } else if (firstBall !== targetColor) {
        registerFoul(`Hit ${firstBall} first when ${targetColor} was on`, firstBall);
      }

      const wrongPot = pottedBalls.some((b) => b !== targetColor && b !== 'CUE');
      const targetPotted = pottedBalls.includes(targetColor);
      if (wrongPot) {
        const highestWrong = pottedBalls.find((b) => b !== targetColor && b !== 'CUE');
        registerFoul('Potted a ball that was not on', highestWrong);
      }

      if (fouls.length === 0) {
        if (targetPotted) {
          players[active].score += ballValue(targetColor);
          currentBreak += ballValue(targetColor);
          colorsRemaining.shift();
          if (colorsRemaining.length === 0) {
            phase = 'COLORS_ORDER';
            ballOn = [];
          } else {
            ballOn = [colorsRemaining[0]];
          }
        } else {
          activePlayer = other;
          currentBreak = 0;
        }
      }
    } else {
      const onRed = !colorOnAfterRed;
      if (onRed) {
        if (!requireBallOn(['RED'])) {
          registerFoul('Failed to hit a red first', firstBall ?? 'RED');
        }
        const colourPotted = pottedBalls.find((b) => b !== 'RED' && b !== 'CUE');
        if (colourPotted) {
          registerFoul('Potted a colour when red was on', colourPotted);
        }

        if (fouls.length === 0) {
          if (redsPotted > 0) {
            const delta = redsPotted * BALL_VALUES.RED;
            players[active].score += delta;
            currentBreak += delta;
            colorOnAfterRed = true;
            ballOn = COLOUR_ORDER.slice();
            if (redsRemaining === 0) {
              phase = 'COLORS_ORDER';
              ballOn = [colorsRemaining[0]];
              colorOnAfterRed = false;
            }
          } else {
            activePlayer = other;
            currentBreak = 0;
          }
        }
      } else {
        if (!firstBall || firstBall === 'RED') {
          registerFoul('Failed to strike a colour first', firstBall ?? 'RED');
        }
        const redDuringColour = pottedBalls.includes('RED');
        if (redDuringColour) {
          registerFoul('Potted a red when a colour was on', 'RED');
        }

        if (fouls.length === 0) {
          const colourPots = pottedBalls.filter((b) => b !== 'RED' && b !== 'CUE');
          if (colourPots.length > 0) {
            const delta = colourPots.reduce((sum, b) => sum + ballValue(b), 0);
            players[active].score += delta;
            currentBreak += delta;
            colorOnAfterRed = false;
            if (redsRemaining > 0) {
              ballOn = ['RED'];
            } else {
              phase = 'COLORS_ORDER';
              ballOn = [colorsRemaining[0]];
            }
          } else {
            activePlayer = other;
            currentBreak = 0;
            colorOnAfterRed = false;
            ballOn = redsRemaining > 0 ? ['RED'] : [colorsRemaining[0]];
          }
        }
      }
    }

    if (fouls.length > 0) {
      const foulValue = highestBallValue([
        ballOn[0],
        firstBall,
        ...fouls.map((entry) => (entry.value >= 4 ? (entry as { value: number }).value : null))
      ]);
      const penalize = Math.max(4, foulValue);
      players[other].score += penalize;
      activePlayer = other;
      currentBreak = 0;
      foul = {
        points: penalize,
        reason: fouls[0]?.reason ?? 'foul'
      };
    }

    const frameOver = phase === 'COLORS_ORDER' && colorsRemaining.length === 0;
    let winner: FrameState['winner'] = state.winner;
    if (frameOver) {
      if (players.A.score > players.B.score) winner = 'A';
      else if (players.B.score > players.A.score) winner = 'B';
      else winner = 'TIE';
    }

    return {
      ...state,
      players,
      activePlayer,
      ballOn,
      redsRemaining,
      colorOnAfterRed,
      phase,
      currentBreak,
      frameOver,
      winner,
      foul,
      meta: {
        colorsRemaining,
        variant: 'snooker'
      }
    } satisfies FrameState;
  }
}

export default SnookerClubRules;
export { SnookerClubRules };
