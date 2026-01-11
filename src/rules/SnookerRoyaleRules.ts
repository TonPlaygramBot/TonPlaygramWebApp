import { BallColor, FrameState, Player, ShotContext, ShotEvent } from '../types';

type HudInfo = {
  next: string;
  phase: string;
  scores: { A: number; B: number };
};

type SnookerMeta = {
  variant: 'snooker';
  redsRemaining: number;
  colorsRemaining: BallColor[];
  awaitingFinalColor: boolean;
  hud: HudInfo;
};

const COLORS_ORDER: BallColor[] = ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'];

const BALL_VALUES: Record<BallColor, number> = {
  RED: 1,
  YELLOW: 2,
  GREEN: 3,
  BROWN: 4,
  BLUE: 5,
  PINK: 6,
  BLACK: 7,
  CUE: 4
};

const DEFAULT_REDS = 15;

function normalizeBallColor(value: unknown): BallColor | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    return value === 0 ? 'CUE' : null;
  }
  if (typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  if (lower === 'cue' || lower === 'cue_ball') return 'CUE';
  if (lower.startsWith('red')) return 'RED';
  if (lower.startsWith('yellow')) return 'YELLOW';
  if (lower.startsWith('green')) return 'GREEN';
  if (lower.startsWith('brown')) return 'BROWN';
  if (lower.startsWith('blue')) return 'BLUE';
  if (lower.startsWith('pink')) return 'PINK';
  if (lower.startsWith('black')) return 'BLACK';
  const upper = lower.toUpperCase();
  if (COLORS_ORDER.includes(upper as BallColor) || upper === 'RED' || upper === 'CUE') {
    return upper as BallColor;
  }
  return null;
}

function resolveBallValue(value: BallColor | null): number {
  if (!value) return 0;
  return BALL_VALUES[value] ?? 0;
}

function basePlayers(playerA: string, playerB: string): { A: Player; B: Player } {
  return {
    A: { id: 'A', name: playerA, score: 0 },
    B: { id: 'B', name: playerB, score: 0 }
  };
}

function computeHud(ballOn: BallColor[], phase: FrameState['phase'], scores: { A: number; B: number }): HudInfo {
  const next = ballOn.length ? ballOn.map((entry) => entry.toLowerCase()).join(' / ') : 'frame over';
  return {
    next,
    phase: phase === 'COLORS_ORDER' ? 'colors' : 'reds',
    scores
  };
}

function normalizeBallOn(ballOn: FrameState['ballOn']): BallColor[] {
  if (!Array.isArray(ballOn)) return ['RED'];
  return ballOn
    .map((entry) => normalizeBallColor(entry))
    .filter((entry): entry is BallColor => Boolean(entry));
}

export class SnookerRoyaleRules {
  getInitialFrame(playerA: string, playerB: string): FrameState {
    const redsRemaining = DEFAULT_REDS;
    const ballOn: BallColor[] = ['RED'];
    const scores = { A: 0, B: 0 };
    return {
      balls: [],
      activePlayer: 'A',
      players: basePlayers(playerA, playerB),
      currentBreak: 0,
      phase: 'REDS_AND_COLORS',
      redsRemaining,
      ballOn,
      frameOver: false,
      meta: {
        variant: 'snooker',
        redsRemaining,
        colorsRemaining: [...COLORS_ORDER],
        awaitingFinalColor: false,
        hud: computeHud(ballOn, 'REDS_AND_COLORS', scores)
      } satisfies SnookerMeta
    };
  }

  applyShot(state: FrameState, events: ShotEvent[], context: ShotContext = {}): FrameState {
    const meta = state.meta as SnookerMeta | undefined;
    const previousReds = meta?.redsRemaining ?? state.redsRemaining ?? DEFAULT_REDS;
    const colorsRemaining = Array.isArray(meta?.colorsRemaining)
      ? [...meta.colorsRemaining]
      : [...COLORS_ORDER];
    const awaitingFinalColor = Boolean(meta?.awaitingFinalColor);
    const activePlayer = state.activePlayer ?? 'A';
    const opponent = activePlayer === 'A' ? 'B' : 'A';
    const scores = {
      A: state.players.A.score ?? 0,
      B: state.players.B.score ?? 0
    };
    const ballOn = normalizeBallOn(state.ballOn);

    let firstContact: BallColor | null = null;
    for (const ev of events) {
      if (ev.type !== 'HIT') continue;
      firstContact = normalizeBallColor(ev.ballId ?? ev.firstContact);
      if (firstContact) break;
    }

    const potted: BallColor[] = [];
    for (const ev of events) {
      if (ev.type !== 'POTTED') continue;
      const color = normalizeBallColor(ev.ballId ?? ev.ball);
      if (color) potted.push(color);
    }

    const cueBallPotted = Boolean(context.cueBallPotted) || potted.includes('CUE');
    const scoredBalls = potted.filter((ball) => ball !== 'CUE');
    const scoredReds = scoredBalls.filter((ball) => ball === 'RED');
    const scoredColors = scoredBalls.filter((ball) => ball !== 'RED');

    const contactMade = context.contactMade ?? Boolean(firstContact);

    let foulReason: string | null = null;
    if (!contactMade || !firstContact) {
      foulReason = 'no contact';
    } else if (ballOn.length && !ballOn.includes(firstContact)) {
      foulReason = 'wrong ball';
    } else if (cueBallPotted) {
      foulReason = 'cue ball potted';
    } else if (!scoredBalls.length && context.noCushionAfterContact) {
      foulReason = 'no cushion';
    } else if (ballOn.includes('RED') && scoredColors.length) {
      foulReason = 'potted wrong color';
    } else if (!ballOn.includes('RED') && scoredReds.length) {
      foulReason = 'potted red';
    }

    let redsRemaining = Math.max(0, previousReds - scoredReds.length);
    let nextBallOn: BallColor[] = ballOn.length ? [...ballOn] : ['RED'];
    let nextPhase: FrameState['phase'] = state.phase ?? 'REDS_AND_COLORS';
    let nextAwaitingFinalColor = awaitingFinalColor;
    let frameOver = false;
    let winner: FrameState['winner'];
    let currentBreak = 0;
    let foulPoints = 0;

    if (foulReason) {
      const ballOnValue = ballOn.length ? Math.max(...ballOn.map((ball) => resolveBallValue(ball))) : 0;
      const foulBallValues = [firstContact, ...scoredBalls]
        .filter(Boolean)
        .map((ball) => resolveBallValue(ball as BallColor));
      foulPoints = Math.max(4, ballOnValue, ...foulBallValues);
      scores[opponent] += foulPoints;
      currentBreak = 0;
      nextBallOn = redsRemaining > 0 ? ['RED'] : colorsRemaining.length ? [colorsRemaining[0]] : [];
      if (redsRemaining === 0 && nextPhase !== 'COLORS_ORDER' && !nextAwaitingFinalColor) {
        nextPhase = 'COLORS_ORDER';
      }
    } else {
      const scoredPoints = scoredBalls.reduce((sum, ball) => sum + resolveBallValue(ball), 0);
      if (scoredPoints > 0) {
        scores[activePlayer] += scoredPoints;
        currentBreak = (state.currentBreak ?? 0) + scoredPoints;
      } else {
        currentBreak = 0;
      }

      if (redsRemaining > 0) {
        nextPhase = 'REDS_AND_COLORS';
        if (scoredReds.length > 0) {
          nextBallOn = [...COLORS_ORDER];
          if (redsRemaining === 0) {
            nextAwaitingFinalColor = true;
          }
        } else if (scoredColors.length > 0) {
          nextBallOn = redsRemaining > 0 ? ['RED'] : [...COLORS_ORDER];
        } else {
          nextBallOn = ['RED'];
        }
      } else {
        if (awaitingFinalColor) {
          nextAwaitingFinalColor = false;
          nextPhase = 'COLORS_ORDER';
          nextBallOn = colorsRemaining.length ? [colorsRemaining[0]] : [];
        } else {
          nextPhase = 'COLORS_ORDER';
          if (scoredColors.length > 0) {
            const toRemove = new Set(scoredColors);
            const filtered = colorsRemaining.filter((color) => !toRemove.has(color));
            colorsRemaining.length = 0;
            colorsRemaining.push(...filtered);
            nextBallOn = colorsRemaining.length ? [colorsRemaining[0]] : [];
          }
        }
      }

      const scoredSomething = scoredBalls.length > 0;
      if (!scoredSomething) {
        // Switch turn on no score.
        nextBallOn = nextBallOn.length ? nextBallOn : redsRemaining > 0 ? ['RED'] : colorsRemaining.slice(0, 1);
      }
    }

    if (redsRemaining === 0 && !nextAwaitingFinalColor && colorsRemaining.length === 0) {
      frameOver = true;
      if (scores.A > scores.B) winner = 'A';
      else if (scores.B > scores.A) winner = 'B';
      else winner = 'TIE';
      nextBallOn = [];
    }

    const nextActive = foulReason || scoredBalls.length === 0 ? opponent : activePlayer;
    const updatedBallOn = nextBallOn.length
      ? nextBallOn
      : redsRemaining > 0
        ? ['RED']
        : colorsRemaining.slice(0, 1);
    const updatedPhase = nextPhase;
    const hud = computeHud(updatedBallOn, updatedPhase, scores);

    return {
      ...state,
      activePlayer: nextActive,
      players: {
        A: { ...state.players.A, score: scores.A },
        B: { ...state.players.B, score: scores.B }
      },
      currentBreak,
      phase: updatedPhase,
      redsRemaining,
      ballOn: updatedBallOn,
      foul: foulReason
        ? {
            points: foulPoints,
            reason: foulReason
          }
        : undefined,
      frameOver,
      winner,
      meta: {
        variant: 'snooker',
        redsRemaining,
        colorsRemaining: [...colorsRemaining],
        awaitingFinalColor: nextAwaitingFinalColor,
        hud
      } satisfies SnookerMeta
    };
  }
}
