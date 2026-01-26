import { Ball, BallColor, FrameState, Player, ShotContext, ShotEvent } from '../types';

type HudInfo = {
  next: string;
  phase: string;
  scores: { A: number; B: number };
};

type SnookerMeta = {
  variant: 'snooker';
  colorsRemaining: BallColor[];
  freeBall: boolean;
  hud: HudInfo;
};

const COLOR_VALUES: Record<BallColor, number> = {
  RED: 1,
  YELLOW: 2,
  GREEN: 3,
  BROWN: 4,
  BLUE: 5,
  PINK: 6,
  BLACK: 7,
  CUE: 0
};

const COLOR_ORDER: BallColor[] = ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'];
const REDS_COUNT = 15;

function createInitialBalls(): Ball[] {
  const reds = Array.from({ length: REDS_COUNT }, (_, index) => ({
    id: `red_${index + 1}`,
    color: 'RED' as BallColor,
    onTable: true,
    potted: false
  }));
  const colors = COLOR_ORDER.map((color) => ({
    id: color.toLowerCase(),
    color,
    onTable: true,
    potted: false
  }));
  const cue = {
    id: 'cue',
    color: 'CUE' as BallColor,
    onTable: true,
    potted: false
  };
  return [...reds, ...colors, cue];
}

function cloneBalls(balls: Ball[] | undefined): Ball[] {
  if (Array.isArray(balls) && balls.length > 0) {
    return balls.map((ball) => ({ ...ball }));
  }
  return createInitialBalls();
}

function findBallForPot(
  balls: Ball[],
  color: BallColor,
  ballId?: unknown
): Ball | undefined {
  if (ballId != null) {
    const id = String(ballId);
    const direct = balls.find((ball) => String(ball.id) === id);
    if (direct) return direct;
  }
  const onTableMatch = balls.find((ball) => ball.color === color && ball.onTable);
  if (onTableMatch) return onTableMatch;
  return balls.find((ball) => ball.color === color);
}

function basePlayers(playerA: string, playerB: string): { A: Player; B: Player } {
  return {
    A: { id: 'A', name: playerA, score: 0 },
    B: { id: 'B', name: playerB, score: 0 }
  };
}

function normalizeColor(value: unknown): BallColor | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower.startsWith('red')) return 'RED';
    if (lower.startsWith('yellow')) return 'YELLOW';
    if (lower.startsWith('green')) return 'GREEN';
    if (lower.startsWith('brown')) return 'BROWN';
    if (lower.startsWith('blue')) return 'BLUE';
    if (lower.startsWith('pink')) return 'PINK';
    if (lower.startsWith('black')) return 'BLACK';
    if (lower === 'cue' || lower === 'cue_ball') return 'CUE';
    if (lower.startsWith('ball_')) return null;
    return lower.toUpperCase() as BallColor;
  }
  return null;
}

function resolveBallOn(state: FrameState, colorsRemaining: BallColor[]): BallColor[] {
  if (state.phase === 'COLORS_ORDER') {
    return colorsRemaining.length ? [colorsRemaining[0]] : [];
  }
  if (state.colorOnAfterRed) {
    return [...COLOR_ORDER];
  }
  return ['RED'];
}

function resolveBallOnValue(
  state: FrameState,
  colorsRemaining: BallColor[],
  declaredBall: BallColor | null
): BallColor | null {
  if (state.phase === 'COLORS_ORDER') {
    return colorsRemaining.length ? colorsRemaining[0] : null;
  }
  if (state.colorOnAfterRed) {
    return declaredBall ?? null;
  }
  return 'RED';
}

function buildHud(
  state: FrameState,
  scores: { A: number; B: number },
  ballOn: Array<BallColor | string>
): HudInfo {
  const nextBall =
    ballOn.length > 0
      ? ballOn.map((entry) => entry.toLowerCase()).join(' / ')
      : 'frame over';
  return {
    next: state.freeBall ? `free ball • ${nextBall}` : nextBall,
    phase: state.phase === 'COLORS_ORDER' ? 'colors' : 'reds',
    scores
  };
}

function calculateFoulPoints(ballOn: BallColor[], involved: BallColor[]): number {
  const ballOnValue = Math.max(0, ...ballOn.map((entry) => COLOR_VALUES[entry] || 0));
  const involvedValue = Math.max(0, ...involved.map((entry) => COLOR_VALUES[entry] || 0));
  return Math.min(7, Math.max(4, ballOnValue, involvedValue));
}

export class SnookerRoyalRules {
  constructor(_variant?: string | null) {}

  getInitialFrame(playerA: string, playerB: string): FrameState {
    const base: FrameState = {
      balls: createInitialBalls(),
      activePlayer: 'A',
      players: basePlayers(playerA, playerB),
      currentBreak: 0,
      phase: 'REDS_AND_COLORS',
      redsRemaining: REDS_COUNT,
      ballOn: ['RED'],
      frameOver: false,
      colorOnAfterRed: false,
      freeBall: false
    };
    const scores = { A: 0, B: 0 };
    base.meta = {
      variant: 'snooker',
      colorsRemaining: [...COLOR_ORDER],
      freeBall: false,
      hud: buildHud(base, scores, base.ballOn)
    } satisfies SnookerMeta;
    return base;
  }

  applyShot(state: FrameState, events: ShotEvent[], context: ShotContext = {}): FrameState {
    const meta = state.meta as SnookerMeta | undefined;
    const colorsRemaining = Array.isArray(meta?.colorsRemaining)
      ? [...meta.colorsRemaining]
      : [...COLOR_ORDER];
    const ballOn = resolveBallOn(state, colorsRemaining);

    const hitEvent = events.find((event) => event.type === 'HIT') as
      | { type: 'HIT'; firstContact?: unknown; ballId?: unknown }
      | undefined;
    const firstContact = normalizeColor(hitEvent?.firstContact ?? hitEvent?.ballId);
    const nominatedBall = normalizeColor(context.declaredBall ?? context.nominatedBall);
    const declaredBall = nominatedBall ?? null;
    const pottedEvents = events.filter((event) => event.type === 'POTTED') as Array<{
      type: 'POTTED';
      ball?: unknown;
      ballId?: unknown;
    }>;
    const potted = pottedEvents
      .map((event) => normalizeColor(event.ball ?? event.ballId))
      .filter(Boolean) as BallColor[];
    const explicitFoul = events.find((event) => event.type === 'FOUL') as
      | { type: 'FOUL'; reason?: string; ball?: BallColor }
      | undefined;
    const nextBalls = cloneBalls(state.balls);
    const setBallState = (ball: Ball | undefined, onTable: boolean) => {
      if (!ball) return;
      ball.onTable = onTable;
      ball.potted = !onTable;
    };

    const cuePotted = Boolean(context.cueBallPotted) || potted.includes('CUE');
    const pottedNonCue = potted.filter((color) => color !== 'CUE');
    const pottedReds = pottedNonCue.filter((color) => color === 'RED');
    const pottedColors = pottedNonCue.filter((color) => color !== 'RED');

    const freeBallActive = Boolean(state.freeBall || context.freeBall);
    const nominatedFreeBall = freeBallActive ? nominatedBall ?? null : null;
    const freeBallPotted =
      freeBallActive &&
      nominatedFreeBall &&
      pottedNonCue.some((color) => color === nominatedFreeBall);
    const pottedColorsExcludingFreeBall = freeBallPotted && nominatedFreeBall
      ? pottedColors.filter((color) => color !== nominatedFreeBall)
      : pottedColors;

    const onRed = state.phase === 'REDS_AND_COLORS' && !state.colorOnAfterRed;
    const onColorAfterRed = state.phase === 'REDS_AND_COLORS' && state.colorOnAfterRed;
    const inColorsOrder = state.phase === 'COLORS_ORDER';
    const ballOnValue = resolveBallOnValue(state, colorsRemaining, declaredBall);
    const requiredFirstContact = freeBallActive
      ? nominatedFreeBall
      : inColorsOrder
        ? colorsRemaining[0] ?? null
        : onColorAfterRed
          ? declaredBall
          : 'RED';
    const foulBallOn = freeBallActive && nominatedFreeBall
      ? [nominatedFreeBall]
      : ballOnValue
        ? [ballOnValue]
        : ballOn;
    let foulReason: string | null = null;
    if (explicitFoul?.reason) {
      foulReason = explicitFoul.reason;
    } else if (cuePotted) {
      foulReason = 'cue ball potted';
    } else if (context.contactMade === false || !firstContact) {
      foulReason = 'no contact';
    } else {
      const requiresNomination = freeBallActive || onColorAfterRed;
      if (requiresNomination && !nominatedBall) {
        foulReason = 'no nomination';
      } else if (freeBallActive && onRed && nominatedBall === 'RED') {
        foulReason = 'invalid nomination';
      } else if (onColorAfterRed && declaredBall === 'RED') {
        foulReason = 'invalid nomination';
      } else if (requiredFirstContact && firstContact !== requiredFirstContact) {
        foulReason = 'wrong ball';
      }
    }

    if (!foulReason && onRed) {
      const illegalColors = pottedColorsExcludingFreeBall.filter(
        (color) => !(freeBallActive && nominatedFreeBall && color === nominatedFreeBall)
      );
      if (illegalColors.length) foulReason = 'potted color on red';
    }

    if (!foulReason && onColorAfterRed) {
      if (pottedReds.length) foulReason = 'potted red on color';
      const legalColor = freeBallActive ? nominatedFreeBall : declaredBall;
      const colorPotCount = pottedColorsExcludingFreeBall.length + (freeBallPotted ? 1 : 0);
      if (colorPotCount > 1) foulReason = 'multiple colors potted';
      if (
        !foulReason &&
        pottedColorsExcludingFreeBall.length &&
        legalColor &&
        !pottedColorsExcludingFreeBall.includes(legalColor)
      ) {
        foulReason = 'wrong color';
      }
    }

    if (!foulReason && inColorsOrder) {
      const legalColor = freeBallActive ? nominatedFreeBall : colorsRemaining[0] ?? null;
      const colorPotCount = pottedColorsExcludingFreeBall.length + (freeBallPotted ? 1 : 0);
      const legalPotted = Boolean(legalColor && pottedNonCue.includes(legalColor));
      if (colorPotCount > 1) {
        foulReason = 'multiple colors potted';
      }
      if (!foulReason && pottedNonCue.length && (!legalColor || !legalPotted)) {
        foulReason = 'wrong color order';
      }
    }

    if (
      !foulReason &&
      !pottedNonCue.length &&
      (context.noCushionAfterContact || context.cushionAfterContact === false)
    ) {
      foulReason = 'no cushion';
    }

    let nextActivePlayer = state.activePlayer;
    let nextBreak = state.currentBreak ?? 0;
    let redsRemaining = state.redsRemaining ?? 15;
    let nextPhase = state.phase;
    let colorOnAfterRed = state.colorOnAfterRed ?? false;
    let nextFreeBall = false;
    let frameOver = false;
    let winner: 'A' | 'B' | 'TIE' | undefined;
    const scores = {
      A: state.players.A.score,
      B: state.players.B.score
    };

    if (foulReason) {
      const foulPoints = calculateFoulPoints(
        foulBallOn,
        [firstContact, explicitFoul?.ball, ...pottedNonCue].filter(Boolean) as BallColor[]
      );
      const opponent = state.activePlayer === 'A' ? 'B' : 'A';
      scores[opponent] += foulPoints;
      nextActivePlayer = opponent;
      nextBreak = 0;
      nextFreeBall = Boolean(context.snookered);
      if (
        state.phase === 'COLORS_ORDER' &&
        colorsRemaining.length === 1 &&
        colorsRemaining[0] === 'BLACK'
      ) {
        if (scores.A !== scores.B) {
          frameOver = true;
          winner = scores.A > scores.B ? 'A' : 'B';
        }
      }
    } else if (pottedNonCue.length === 0) {
      nextActivePlayer = state.activePlayer === 'A' ? 'B' : 'A';
      nextBreak = 0;
      if (state.phase === 'REDS_AND_COLORS') {
        if (redsRemaining === 0 && !state.colorOnAfterRed) {
          nextPhase = 'COLORS_ORDER';
          colorOnAfterRed = false;
        } else {
          colorOnAfterRed = state.colorOnAfterRed ?? false;
        }
      }
    } else {
      if (onRed) {
        const freeBallScore = freeBallPotted && ballOnValue ? COLOR_VALUES[ballOnValue] : 0;
        const scored = pottedReds.length * COLOR_VALUES.RED + freeBallScore;
        redsRemaining = Math.max(0, redsRemaining - pottedReds.length);
        scores[state.activePlayer] += scored;
        nextBreak = (state.currentBreak ?? 0) + scored;
        if (pottedReds.length > 0 || freeBallPotted) {
          colorOnAfterRed = true;
        }
      } else if (onColorAfterRed) {
        const legalColor = freeBallActive ? nominatedFreeBall : declaredBall;
        const scoredColor =
          legalColor &&
          (pottedColorsExcludingFreeBall.includes(legalColor) || freeBallPotted)
            ? legalColor
            : null;
        if (scoredColor) {
          const scored = COLOR_VALUES[ballOnValue ?? scoredColor] || 0;
          scores[state.activePlayer] += scored;
          nextBreak = (state.currentBreak ?? 0) + scored;
        }
        colorOnAfterRed = false;
        if (redsRemaining === 0) {
          nextPhase = 'COLORS_ORDER';
        }
      } else if (inColorsOrder) {
        const target = colorsRemaining[0] ?? null;
        const targetPotted = Boolean(target && pottedNonCue.includes(target));
        const targetScore = target && targetPotted ? COLOR_VALUES[target] || 0 : 0;
        const freeBallScore =
          freeBallPotted && target && nominatedFreeBall !== target
            ? COLOR_VALUES[target] || 0
            : 0;
        const totalScore = targetScore + freeBallScore;
        if (totalScore) {
          scores[state.activePlayer] += totalScore;
          nextBreak = (state.currentBreak ?? 0) + totalScore;
        }
        if (target && targetPotted) {
          colorsRemaining.shift();
          if (!colorsRemaining.length) {
            frameOver = true;
            const aScore = scores.A;
            const bScore = scores.B;
            winner = aScore === bScore ? 'TIE' : aScore > bScore ? 'A' : 'B';
          }
        }
      }
    }

    const shouldRespotColor = (color: BallColor): boolean => {
      if (color === 'RED' || color === 'CUE') return false;
      if (foulReason) return true;
      if (freeBallPotted && nominatedFreeBall === color) return true;
      if (onRed || onColorAfterRed) return true;
      return false;
    };

    pottedEvents.forEach((event) => {
      const color = normalizeColor(event.ball ?? event.ballId);
      if (!color) return;
      if (color === 'CUE') {
        setBallState(findBallForPot(nextBalls, 'CUE', event.ballId), true);
        return;
      }
      if (color === 'RED') {
        setBallState(findBallForPot(nextBalls, 'RED', event.ballId), false);
        return;
      }
      setBallState(findBallForPot(nextBalls, color, event.ballId), shouldRespotColor(color));
    });

    if (cuePotted) {
      setBallState(findBallForPot(nextBalls, 'CUE', 'cue'), true);
    }

    const recalculatedReds = nextBalls.filter(
      (ball) => ball.color === 'RED' && ball.onTable
    ).length;
    redsRemaining = Number.isFinite(recalculatedReds) ? recalculatedReds : redsRemaining;
    const resolvedColorsRemaining = COLOR_ORDER.filter((color) => {
      const ball = nextBalls.find((entry) => entry.color === color);
      return ball ? ball.onTable !== false : true;
    });

    if (!foulReason && pottedNonCue.length) {
      nextActivePlayer = state.activePlayer;
    }

    const nextState: FrameState = {
      ...state,
      balls: nextBalls,
      activePlayer: nextActivePlayer,
      players: {
        A: { ...state.players.A, score: scores.A },
        B: { ...state.players.B, score: scores.B }
      },
      currentBreak: nextBreak,
      phase: nextPhase,
      redsRemaining,
      colorOnAfterRed,
      freeBall: nextFreeBall,
      ballOn: resolveBallOn(
        { ...state, phase: nextPhase, colorOnAfterRed },
        resolvedColorsRemaining
      ),
      frameOver,
      winner,
      foul: foulReason
        ? {
          points: calculateFoulPoints(
              foulBallOn,
              [firstContact, explicitFoul?.ball, ...pottedNonCue].filter(Boolean) as BallColor[]
            ),
            reason: foulReason
          }
        : undefined,
      meta: {
        variant: 'snooker',
        colorsRemaining: resolvedColorsRemaining,
        freeBall: nextFreeBall,
        hud: buildHud(
          { ...state, phase: nextPhase, colorOnAfterRed, ballOn, redsRemaining, freeBall: nextFreeBall },
          scores,
          resolveBallOn({ ...state, phase: nextPhase, colorOnAfterRed }, resolvedColorsRemaining)
        )
      } satisfies SnookerMeta
    };

    return nextState;
  }
}
