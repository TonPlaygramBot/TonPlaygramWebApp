import { BallColor, FrameState, Player, ShotContext, ShotEvent } from '../types';

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
  return Math.max(4, ballOnValue, involvedValue);
}

export class SnookerRoyalRules {
  constructor(_variant?: string | null) {}

  getInitialFrame(playerA: string, playerB: string): FrameState {
    const base: FrameState = {
      balls: [],
      activePlayer: 'A',
      players: basePlayers(playerA, playerB),
      currentBreak: 0,
      phase: 'REDS_AND_COLORS',
      redsRemaining: 15,
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
    const declaredBall = nominatedBall ?? firstContact;
    const potted = events
      .filter((event) => event.type === 'POTTED')
      .map((event) => normalizeColor((event as { ball?: unknown; ballId?: unknown }).ball ?? (event as { ballId?: unknown }).ballId))
      .filter(Boolean) as BallColor[];
    const explicitFoul = events.find((event) => event.type === 'FOUL') as
      | { type: 'FOUL'; reason?: string; ball?: BallColor }
      | undefined;

    const cuePotted = Boolean(context.cueBallPotted) || potted.includes('CUE');
    const pottedNonCue = potted.filter((color) => color !== 'CUE');
    const pottedReds = pottedNonCue.filter((color) => color === 'RED');
    const pottedColors = pottedNonCue.filter((color) => color !== 'RED');

    const freeBallActive = Boolean(state.freeBall || context.freeBall);
    const nominatedFreeBall = freeBallActive ? nominatedBall ?? firstContact : null;
    const freeBallPotted =
      freeBallActive &&
      nominatedFreeBall &&
      pottedNonCue.some((color) => color === nominatedFreeBall);
    const pottedColorsExcludingFreeBall = freeBallPotted && nominatedFreeBall
      ? pottedColors.filter((color) => color !== nominatedFreeBall)
      : pottedColors;

    let foulReason: string | null = null;
    if (explicitFoul?.reason) {
      foulReason = explicitFoul.reason;
    } else if (cuePotted) {
      foulReason = 'cue ball potted';
    } else if (context.contactMade === false || !firstContact) {
      foulReason = 'no contact';
    } else if (ballOn.length && firstContact) {
      const requiresNomination = state.phase === 'REDS_AND_COLORS' && state.colorOnAfterRed;
      const targetBall = state.phase === 'COLORS_ORDER' ? ballOn[0] : null;
      const requiredFirstContact =
        (freeBallActive && nominatedFreeBall) ||
        targetBall ||
        (requiresNomination ? declaredBall : ballOn[0]);
      if (requiredFirstContact && firstContact !== requiredFirstContact) {
        foulReason = 'wrong ball';
      }
    }

    if (!foulReason && state.phase === 'REDS_AND_COLORS' && !state.colorOnAfterRed) {
      if (pottedColorsExcludingFreeBall.length) foulReason = 'potted color on red';
    }

    if (!foulReason && state.phase === 'REDS_AND_COLORS' && state.colorOnAfterRed) {
      if (pottedReds.length) foulReason = 'potted red on color';
      const colorPotCount = pottedColorsExcludingFreeBall.length + (freeBallPotted ? 1 : 0);
      if (colorPotCount > 1) foulReason = 'multiple colors potted';
      if (
        !foulReason &&
        pottedColorsExcludingFreeBall.length &&
        declaredBall &&
        !pottedColorsExcludingFreeBall.includes(declaredBall)
      ) {
        foulReason = 'wrong color';
      }
    }

    if (!foulReason && state.phase === 'COLORS_ORDER') {
      const target = ballOn[0];
      const colorPotCount = pottedColorsExcludingFreeBall.length + (freeBallPotted ? 1 : 0);
      const targetPotted = Boolean(target && pottedNonCue.includes(target));
      if (colorPotCount > 1) {
        foulReason = 'multiple colors potted';
      }
      if (!foulReason && pottedNonCue.length && (!target || (!targetPotted && !freeBallPotted))) {
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
      const foulPoints = calculateFoulPoints(ballOn, [firstContact, ...pottedNonCue].filter(Boolean) as BallColor[]);
      const opponent = state.activePlayer === 'A' ? 'B' : 'A';
      scores[opponent] += foulPoints;
      nextActivePlayer = opponent;
      nextBreak = 0;
      nextFreeBall = Boolean(context.snookered);
    } else if (pottedNonCue.length === 0) {
      nextActivePlayer = state.activePlayer === 'A' ? 'B' : 'A';
      nextBreak = 0;
    } else {
      if (state.phase === 'REDS_AND_COLORS' && !state.colorOnAfterRed) {
        const freeBallScore = freeBallPotted ? COLOR_VALUES.RED : 0;
        const scored = pottedReds.length * COLOR_VALUES.RED + freeBallScore;
        redsRemaining = Math.max(0, redsRemaining - pottedReds.length);
        scores[state.activePlayer] += scored;
        nextBreak = (state.currentBreak ?? 0) + scored;
        if (pottedReds.length > 0 || freeBallPotted) {
          colorOnAfterRed = true;
        }
      } else if (state.phase === 'REDS_AND_COLORS' && state.colorOnAfterRed) {
        const color = declaredBall ?? pottedColors[0] ?? nominatedFreeBall;
        if (color) {
          const scored = COLOR_VALUES[color] || 0;
          scores[state.activePlayer] += scored;
          nextBreak = (state.currentBreak ?? 0) + scored;
        }
        colorOnAfterRed = false;
        if (redsRemaining === 0) {
          nextPhase = 'COLORS_ORDER';
        }
      } else if (state.phase === 'COLORS_ORDER') {
        const target = ballOn[0];
        const targetPotted = Boolean(target && pottedNonCue.includes(target));
        const scored = target && targetPotted ? COLOR_VALUES[target] || 0 : 0;
        const freeBallScore = freeBallPotted && target && !targetPotted ? COLOR_VALUES[target] || 0 : 0;
        if (scored || freeBallScore) {
          scores[state.activePlayer] += scored + freeBallScore;
          nextBreak = (state.currentBreak ?? 0) + scored + freeBallScore;
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

    if (!foulReason && pottedNonCue.length) {
      nextActivePlayer = state.activePlayer;
    }

    const nextState: FrameState = {
      ...state,
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
      ballOn: resolveBallOn({ ...state, phase: nextPhase, colorOnAfterRed }, colorsRemaining),
      frameOver,
      winner,
      foul: foulReason
        ? {
            points: calculateFoulPoints(ballOn, [firstContact, ...pottedNonCue].filter(Boolean) as BallColor[]),
            reason: foulReason
          }
        : undefined,
      meta: {
        variant: 'snooker',
        colorsRemaining,
        freeBall: nextFreeBall,
        hud: buildHud(
          { ...state, phase: nextPhase, colorOnAfterRed, ballOn, redsRemaining, freeBall: nextFreeBall },
          scores,
          resolveBallOn({ ...state, phase: nextPhase, colorOnAfterRed }, colorsRemaining)
        )
      } satisfies SnookerMeta
    };

    return nextState;
  }
}
