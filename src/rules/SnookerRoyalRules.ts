import { FrameState, Player, ShotContext, ShotEvent } from '../types';

type SnookerBall = 'RED' | 'YELLOW' | 'GREEN' | 'BROWN' | 'BLUE' | 'PINK' | 'BLACK' | 'CUE';

type HudInfo = {
  next: string;
  phase: string;
  scores: { A: number; B: number };
};

type SnookerState = {
  redsRemaining: number;
  colorsRemaining: SnookerBall[];
  colorOnAfterRed: boolean;
  ballInHand: boolean;
};

type SnookerMeta = {
  variant: 'snooker';
  state: SnookerState;
  hud: HudInfo;
};

const COLOR_VALUES: Record<SnookerBall, number> = {
  RED: 1,
  YELLOW: 2,
  GREEN: 3,
  BROWN: 4,
  BLUE: 5,
  PINK: 6,
  BLACK: 7,
  CUE: 0
};

const COLOR_ORDER: SnookerBall[] = ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'];

function basePlayers(playerA: string, playerB: string): { A: Player; B: Player } {
  return {
    A: { id: 'A', name: playerA, score: 0 },
    B: { id: 'B', name: playerB, score: 0 }
  };
}

function parseBallColor(value: unknown): SnookerBall | null {
  if (typeof value === 'number') {
    if (value === 0) return 'CUE';
    if (value <= 1) return 'RED';
    if (value === 2) return 'YELLOW';
    if (value === 3) return 'GREEN';
    if (value === 4) return 'BROWN';
    if (value === 5) return 'BLUE';
    if (value === 6) return 'PINK';
    if (value === 7) return 'BLACK';
    if (value <= 15) return 'RED';
    return null;
  }
  if (typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  if (lower.includes('cue')) return 'CUE';
  if (lower.includes('yellow')) return 'YELLOW';
  if (lower.includes('green')) return 'GREEN';
  if (lower.includes('brown')) return 'BROWN';
  if (lower.includes('blue')) return 'BLUE';
  if (lower.includes('pink')) return 'PINK';
  if (lower.includes('black')) return 'BLACK';
  if (lower.includes('red')) return 'RED';
  return null;
}

function buildHud(state: SnookerState, scores: { A: number; B: number }): HudInfo {
  const phase = state.redsRemaining > 0 ? 'reds' : 'colors';
  const nextTargets = resolveBallOn(state);
  const nextLabel = nextTargets.length
    ? nextTargets.map((ball) => ball.toLowerCase()).join(' / ')
    : 'frame over';
  return {
    next: nextLabel,
    phase,
    scores
  };
}

function resolveBallOn(state: SnookerState): SnookerBall[] {
  if (state.redsRemaining <= 0) {
    return state.colorsRemaining.length ? [state.colorsRemaining[0]] : [];
  }
  if (state.colorOnAfterRed) {
    return state.colorsRemaining.length ? [...state.colorsRemaining] : [];
  }
  return ['RED'];
}

function resolveBallOnValue(state: SnookerState): number {
  const targets = resolveBallOn(state);
  if (!targets.length) return 0;
  return Math.max(...targets.map((ball) => COLOR_VALUES[ball] || 0));
}

function computeFoulPoints({
  ballOnValue,
  firstContact,
  potted
}: {
  ballOnValue: number;
  firstContact: SnookerBall | null;
  potted: SnookerBall[];
}): number {
  const foulValues = [ballOnValue];
  if (firstContact) foulValues.push(COLOR_VALUES[firstContact] || 0);
  potted.forEach((ball) => foulValues.push(COLOR_VALUES[ball] || 0));
  return Math.max(4, ...foulValues);
}

export class SnookerRoyalRules {
  getInitialFrame(playerA: string, playerB: string): FrameState {
    const initialState: SnookerState = {
      redsRemaining: 15,
      colorsRemaining: [...COLOR_ORDER],
      colorOnAfterRed: false,
      ballInHand: true
    };
    return {
      balls: [],
      activePlayer: 'A',
      players: basePlayers(playerA, playerB),
      currentBreak: 0,
      phase: 'REDS_AND_COLORS',
      redsRemaining: initialState.redsRemaining,
      colorOnAfterRed: initialState.colorOnAfterRed,
      ballOn: resolveBallOn(initialState),
      frameOver: false,
      meta: {
        variant: 'snooker',
        state: initialState,
        hud: buildHud(initialState, { A: 0, B: 0 })
      } satisfies SnookerMeta
    };
  }

  applyShot(state: FrameState, events: ShotEvent[], context: ShotContext = {}): FrameState {
    const meta = state.meta as SnookerMeta | undefined;
    const previousState: SnookerState = meta?.state
      ? { ...meta.state }
      : {
          redsRemaining: state.redsRemaining ?? 15,
          colorsRemaining: [...COLOR_ORDER],
          colorOnAfterRed: Boolean(state.colorOnAfterRed),
          ballInHand: false
        };
    const redsRemaining = Math.max(0, previousState.redsRemaining);
    let colorsRemaining = previousState.colorsRemaining.length
      ? [...previousState.colorsRemaining]
      : [...COLOR_ORDER];
    const ballOnList = resolveBallOn(previousState);
    const ballOnValue = resolveBallOnValue(previousState);

    let firstContact: SnookerBall | null = null;
    for (const ev of events) {
      if (ev.type !== 'HIT') continue;
      const contact = parseBallColor(ev.ballId ?? ev.firstContact);
      if (contact) {
        firstContact = contact;
        break;
      }
    }

    const potted: SnookerBall[] = [];
    let cueBallPotted = Boolean(context.cueBallPotted);
    for (const ev of events) {
      if (ev.type !== 'POTTED') continue;
      const ball = parseBallColor(ev.ballId ?? ev.ball);
      if (!ball) continue;
      if (ball === 'CUE') {
        cueBallPotted = true;
      } else {
        potted.push(ball);
      }
    }

    const onRed = redsRemaining > 0 && !previousState.colorOnAfterRed;
    const onColor = redsRemaining > 0 && previousState.colorOnAfterRed;
    const onOrder = redsRemaining === 0;
    const allowedTargets = onOrder
      ? (colorsRemaining.length ? [colorsRemaining[0]] : [])
      : onRed
        ? ['RED']
        : colorsRemaining.length
          ? [...colorsRemaining]
          : [];

    let foulReason: string | null = null;
    if (!firstContact && context.contactMade === false) {
      foulReason = 'no contact';
    } else if (firstContact && !allowedTargets.includes(firstContact)) {
      foulReason = 'wrong ball hit';
    } else if (cueBallPotted) {
      foulReason = 'cue ball potted';
    } else if (potted.some((ball) => !allowedTargets.includes(ball))) {
      foulReason = 'wrong ball potted';
    } else if (context.noCushionAfterContact) {
      foulReason = 'no cushion';
    }

    const nextPlayers = {
      A: { ...state.players.A },
      B: { ...state.players.B }
    };
    let activePlayer = state.activePlayer;
    let currentBreak = state.currentBreak ?? 0;
    let colorOnAfterRed = previousState.colorOnAfterRed;
    let nextReds = redsRemaining;
    let frameOver = false;
    let winner: FrameState['winner'] = undefined;
    let foul: FrameState['foul'] = undefined;
    let ballInHand = false;

    if (foulReason) {
      const foulPoints = computeFoulPoints({
        ballOnValue,
        firstContact,
        potted
      });
      const opponent = activePlayer === 'A' ? 'B' : 'A';
      nextPlayers[opponent] = {
        ...nextPlayers[opponent],
        score: (nextPlayers[opponent]?.score ?? 0) + foulPoints
      };
      activePlayer = opponent;
      currentBreak = 0;
      foul = { points: foulPoints, reason: foulReason };
      ballInHand = cueBallPotted;
    } else {
      const points = potted.reduce((sum, ball) => sum + (COLOR_VALUES[ball] || 0), 0);
      if (points > 0) {
        nextPlayers[activePlayer] = {
          ...nextPlayers[activePlayer],
          score: (nextPlayers[activePlayer]?.score ?? 0) + points
        };
        currentBreak += points;
      }

      if (onRed) {
        const redsPotted = potted.filter((ball) => ball === 'RED').length;
        if (redsPotted > 0) {
          nextReds = Math.max(0, nextReds - redsPotted);
          colorOnAfterRed = true;
        } else {
          activePlayer = activePlayer === 'A' ? 'B' : 'A';
          currentBreak = 0;
          colorOnAfterRed = false;
        }
      } else if (onColor) {
        const colorPotted = potted.length > 0;
        if (colorPotted) {
          colorOnAfterRed = false;
        } else {
          activePlayer = activePlayer === 'A' ? 'B' : 'A';
          currentBreak = 0;
        }
      } else if (onOrder) {
        const nextColor = colorsRemaining[0];
        if (nextColor && potted.includes(nextColor)) {
          colorsRemaining = colorsRemaining.filter((ball) => ball !== nextColor);
        } else {
          activePlayer = activePlayer === 'A' ? 'B' : 'A';
          currentBreak = 0;
        }
      }
    }

    if (nextReds === 0 && !colorsRemaining.length) {
      frameOver = true;
      const scoreA = nextPlayers.A.score ?? 0;
      const scoreB = nextPlayers.B.score ?? 0;
      if (scoreA === scoreB) {
        winner = 'TIE';
      } else {
        winner = scoreA > scoreB ? 'A' : 'B';
      }
    }

    const nextState: SnookerState = {
      redsRemaining: nextReds,
      colorsRemaining,
      colorOnAfterRed: nextReds > 0 ? colorOnAfterRed : false,
      ballInHand
    };
    const scores = {
      A: nextPlayers.A.score ?? 0,
      B: nextPlayers.B.score ?? 0
    };
    return {
      ...state,
      activePlayer,
      players: nextPlayers,
      currentBreak,
      phase: nextReds > 0 ? 'REDS_AND_COLORS' : 'COLORS_ORDER',
      redsRemaining: nextReds,
      colorOnAfterRed: nextState.colorOnAfterRed,
      ballOn: resolveBallOn(nextState),
      foul,
      frameOver,
      winner,
      meta: {
        variant: 'snooker',
        state: nextState,
        hud: buildHud(nextState, scores)
      } satisfies SnookerMeta
    };
  }
}
