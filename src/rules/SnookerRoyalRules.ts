import { Ball, BallColor, FrameState, Player, ShotContext, ShotEvent } from '../types';

type HudInfo = {
  next: string;
  phase: string;
  scores: { A: number; B: number };
};

type SnookerMeta = {
  variant: 'snooker';
  respottedBlack?: boolean;
  colorsRemaining: BallColor[];
  freeBall: boolean;
  hud: HudInfo;
  state: {
    ballInHand: boolean;
  };
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
const RED_COUNT = 15;

function buildInitialBalls(): Ball[] {
  const reds = Array.from({ length: RED_COUNT }, (_, index) => ({
    id: `RED_${index + 1}`,
    color: 'RED' as BallColor,
    onTable: true,
    potted: false
  }));
  const colors = COLOR_ORDER.map((color) => ({
    id: color,
    color,
    onTable: true,
    potted: false
  }));
  return [
    ...reds,
    ...colors,
    {
      id: 'CUE',
      color: 'CUE',
      onTable: true,
      potted: false
    }
  ];
}

function basePlayers(playerA: string, playerB: string): { A: Player; B: Player } {
  return {
    A: { id: 'A', name: playerA, score: 0 },
    B: { id: 'B', name: playerB, score: 0 }
  };
}

function normalizeColor(value: unknown): BallColor | null {
  if (typeof value !== 'string') return null;
  const id = value.trim().toUpperCase();
  if (/^RED(?:_\d+)?$/.test(id)) return 'RED';
  if (id === 'CUE_BALL' || id === 'WHITE') return 'CUE';
  return Object.prototype.hasOwnProperty.call(COLOR_VALUES, id) ? id as BallColor : null;
}

function resolveBallOn(state: FrameState, colorsRemaining: BallColor[]): BallColor[] {
  if (state.phase === 'COLORS_ORDER') {
    return colorsRemaining.length ? [colorsRemaining[0]] : [];
  }
  if (state.colorOnAfterRed) {
    return colorsRemaining.length ? [...colorsRemaining] : [...COLOR_ORDER];
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
  return Math.min(7, Math.max(4, ballOnValue, involvedValue));
}

function isBallState(value: unknown): value is Ball {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Ball>;
  return typeof candidate.id === 'string' && typeof candidate.color === 'string';
}

export class SnookerRoyalRules {
  constructor(_variant?: string | null) {}

  getInitialFrame(playerA: string, playerB: string): FrameState {
    const base: FrameState = {
      balls: buildInitialBalls(),
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
      hud: buildHud(base, scores, base.ballOn),
      state: {
        ballInHand: true
      }
    } satisfies SnookerMeta;
    return base;
  }

  applyShot(state: FrameState, events: ShotEvent[], context: ShotContext = {}): FrameState {
    if (state.frameOver) return state;
    const meta = state.meta as SnookerMeta | undefined;
    const savedBalls = Array.isArray(state.balls) ? state.balls.filter(isBallState) : [];
    const balls = (savedBalls.length ? savedBalls : buildInitialBalls()).map(ball => ({ ...ball }));
    // A placed cue ball is back in play before this shot's events are evaluated.
    if (context.placedFromHand || meta?.state?.ballInHand) {
      const cue = balls.find(ball => ball.color === 'CUE');
      if (cue) { cue.onTable = true; cue.potted = false; }
    }
    const colorsRemaining = COLOR_ORDER.filter(color =>
      Array.isArray(meta?.colorsRemaining)
        ? meta.colorsRemaining.includes(color)
        : balls.some(ball => ball.color === color && ball.onTable)
    );
    const snapshot = new Map(balls.map(ball => [ball.id, { ...ball }]));
    const byId = new Map(balls.map(ball => [ball.id.toUpperCase(), ball]));
    const findBall = (id: unknown): Ball | undefined => {
      if (typeof id !== 'string') return undefined;
      const key = id.trim().toUpperCase();
      return byId.get(key === 'CUE_BALL' || key === 'WHITE' ? 'CUE' : key);
    };
    const onTableColor = (color: BallColor | null) =>
      color !== null && balls.some(ball => ball.color === color && snapshot.get(ball.id)?.onTable);

    const hit = events.find(event => event.type === 'HIT');
    const hitHasId = hit?.type === 'HIT' && hit.ballId != null;
    const hitBall = hit?.type === 'HIT' ? findBall(hitHasId ? hit.ballId : hit.firstContact) : undefined;
    const contactColor = hitBall?.color ??
      (hit?.type === 'HIT' && !hitHasId ? normalizeColor(hit.firstContact) : null);
    const firstContact = hitBall && !snapshot.get(hitBall.id)?.onTable
      ? null
      : onTableColor(contactColor) ? contactColor : null;

    // Ball IDs are authoritative. Ignore repeated and already-removed balls;
    // a stale RED_1 event must never remove a different red still on the table.
    const potted: Ball[] = [];
    const seen = new Set<string>();
    for (const event of events) {
      if (event.type !== 'POTTED') continue;
      const hasId = event.ballId != null;
      let ball = findBall(hasId ? event.ballId : event.ball);
      if (!ball && !hasId) {
        const color = normalizeColor(event.ball);
        const genericColor = typeof event.ball === 'string' &&
          ['RED', ...COLOR_ORDER, 'CUE', 'CUE_BALL', 'WHITE'].includes(event.ball.trim().toUpperCase());
        if (genericColor) ball = balls.find(entry => entry.color === color && entry.onTable);
      }
      if (!ball || !snapshot.get(ball.id)?.onTable || seen.has(ball.id)) continue;
      seen.add(ball.id);
      potted.push(ball);
      ball.onTable = false;
      ball.potted = true;
    }
    const pottedObjects = potted.filter(ball => ball.color !== 'CUE');
    const pottedReds = pottedObjects.filter(ball => ball.color === 'RED');
    const pottedColors = pottedObjects.filter(ball => ball.color !== 'RED');
    const cuePotted = Boolean(context.cueBallPotted) || potted.some(ball => ball.color === 'CUE');
    if (cuePotted) {
      const cue = balls.find(ball => ball.color === 'CUE');
      if (cue) { cue.onTable = false; cue.potted = true; }
    }

    const inColorsOrder = state.phase === 'COLORS_ORDER';
    const onColorAfterRed = !inColorsOrder && Boolean(state.colorOnAfterRed);
    const onRed = !inColorsOrder && !onColorAfterRed;
    const freeBallAvailable = Boolean(state.freeBall || context.freeBall);
    const nominationInput = freeBallAvailable
      ? context.nominatedBall ?? context.declaredBall
      : null;
    const nominatedFreeBall = normalizeColor(nominationInput);
    const hasFreeBallNomination = nominationInput != null;
    const declarationInput = freeBallAvailable
      ? context.declaredBall
      : context.declaredBall ?? context.nominatedBall;
    const declaredColor = normalizeColor(declarationInput);
    // The first colour contacted is the implicit nomination when no colour
    // was declared, matching the reference game's automatic nomination.
    const ballOnColor: BallColor | null = inColorsOrder
      ? colorsRemaining[0] ?? null
      : onRed ? 'RED'
      : declarationInput != null ? declaredColor
      : firstContact && colorsRemaining.includes(firstContact) ? firstContact : null;
    const validFreeBall = hasFreeBallNomination && nominatedFreeBall !== null &&
      nominatedFreeBall !== 'CUE' && onTableColor(nominatedFreeBall) &&
      !resolveBallOn(state, colorsRemaining).includes(nominatedFreeBall);
    const freeBallColor = validFreeBall ? nominatedFreeBall : null;
    const requiredContact = freeBallColor ?? ballOnColor;
    const explicitFouls = events.filter((event): event is Extract<ShotEvent, { type: 'FOUL' }> =>
      event.type === 'FOUL');
    let foulReason: string | null = explicitFouls.length
      ? explicitFouls.find(event => event.reason)?.reason || 'foul'
      : null;
    if (!foulReason && cuePotted) foulReason = 'cue ball potted';
    if (!foulReason && hasFreeBallNomination && !validFreeBall) foulReason = 'invalid nomination';
    if (!foulReason && onColorAfterRed && declarationInput != null &&
        (!declaredColor || !colorsRemaining.includes(declaredColor) || !onTableColor(declaredColor))) {
      foulReason = 'invalid nomination';
    }
    if (!foulReason && (context.contactMade === false || !firstContact)) foulReason = 'no contact';
    if (!foulReason && (!requiredContact || firstContact !== requiredContact)) foulReason = 'wrong ball';

    const permittedPots = new Set<BallColor>();
    if (ballOnColor) permittedPots.add(ballOnColor);
    if (freeBallColor) permittedPots.add(freeBallColor);
    if (!foulReason && pottedObjects.some(ball => !permittedPots.has(ball.color))) {
      foulReason = onRed ? 'potted color on red'
        : pottedReds.length ? 'potted red on color'
        : inColorsOrder ? 'wrong color order' : 'wrong color';
    }
    // With a free ball, its pot together with the actual ball on is legal.
    if (!foulReason && onColorAfterRed && pottedColors.length > 1) {
      foulReason = 'multiple colors potted';
    }

    // A nominated free ball takes the value of the actual ball on, including
    // for fouls. Without a post-red nomination/contact, the minimum is four;
    // the list of all selectable colours must not turn every miss into seven.
    const foulValueColor = (color: BallColor | null | undefined) =>
      color === freeBallColor && ballOnColor ? ballOnColor : color;
    const involved = [firstContact, ...explicitFouls.map(event => normalizeColor(event.ball)),
      ...pottedObjects.map(ball => ball.color)].map(foulValueColor).filter(Boolean) as BallColor[];
    const foulPoints = foulReason
      ? calculateFoulPoints(ballOnColor ? [ballOnColor] : [], involved)
      : 0;
    const freeBallPotted = freeBallColor !== null && pottedObjects.some(ball => ball.color === freeBallColor);
    const targetPotted = ballOnColor !== null && pottedObjects.some(ball => ball.color === ballOnColor);
    const pointsScored = foulReason ? 0 : onRed
      ? pottedReds.length + (freeBallPotted ? 1 : 0)
      : (targetPotted || freeBallPotted) && ballOnColor ? COLOR_VALUES[ballOnColor] : 0;
    const opponent = state.activePlayer === 'A' ? 'B' : 'A';
    const scores = { A: state.players.A.score, B: state.players.B.score };
    scores[state.activePlayer] += pointsScored;
    scores[opponent] += foulPoints;
    const redsRemaining = Math.max(0, (state.redsRemaining ?? RED_COUNT) - pottedReds.length);
    let nextActivePlayer = pointsScored ? state.activePlayer : opponent;
    const completedVisitBreak = (state.currentBreak ?? 0) + pointsScored;
    let nextBreak = pointsScored ? completedVisitBreak : 0;
    const colorOnAfterRed = onRed && pointsScored > 0;
    const nextPhase = inColorsOrder || (redsRemaining === 0 && !colorOnAfterRed)
      ? 'COLORS_ORDER' : 'REDS_AND_COLORS';
    let nextFreeBall = Boolean(foulReason && context.snookered);
    let nextBallInHand = cuePotted;

    // Restore every potted colour except the legally cleared target. The
    // caller places these balls on collision-free spots in its scene.
    for (const ball of pottedColors) {
      const clearedTarget = !foulReason && inColorsOrder && ball.color === ballOnColor;
      if (!clearedTarget) {
        ball.onTable = true;
        ball.potted = false;
      }
    }
    if (!foulReason && inColorsOrder && targetPotted) colorsRemaining.shift();

    const finalBlackShot = inColorsOrder && ballOnColor === 'BLACK' &&
      (Boolean(foulReason) || targetPotted);
    let frameOver = finalBlackShot || (inColorsOrder && colorsRemaining.length === 0);
    let winner: 'A' | 'B' | undefined = frameOver ? scores.A > scores.B ? 'A' : 'B' : undefined;
    const tiedFinalBlack = finalBlackShot && scores.A === scores.B;
    if (tiedFinalBlack) {
      frameOver = false;
      winner = undefined;
      colorsRemaining.splice(0, colorsRemaining.length, 'BLACK');
      const black = balls.find(ball => ball.color === 'BLACK');
      if (black) { black.onTable = true; black.potted = false; }
      nextBallInHand = true;
      nextFreeBall = false;
      nextBreak = 0;
      nextActivePlayer = context.respottedBlackStarter ?? opponent;
    }
    if (frameOver) { nextFreeBall = false; nextBallInHand = false; }
    const highestBreak = Math.max(state.players[state.activePlayer].highestBreak ?? 0,
      state.currentBreak ?? 0, completedVisitBreak);
    const nextBallOn = frameOver ? [] : resolveBallOn({ ...state, phase: nextPhase, colorOnAfterRed }, colorsRemaining);
    const nextState: FrameState = {
      ...state,
      activePlayer: nextActivePlayer,
      players: {
        A: { ...state.players.A, score: scores.A, highestBreak: state.activePlayer === 'A' ? highestBreak : state.players.A.highestBreak ?? 0 },
        B: { ...state.players.B, score: scores.B, highestBreak: state.activePlayer === 'B' ? highestBreak : state.players.B.highestBreak ?? 0 }
      },
      currentBreak: nextBreak,
      phase: nextPhase,
      redsRemaining,
      colorOnAfterRed,
      freeBall: nextFreeBall,
      ballOn: nextBallOn,
      frameOver,
      winner,
      foul: foulReason ? { points: foulPoints, reason: foulReason } : undefined,
      balls,
      meta: {
        ...meta,
        variant: 'snooker',
        respottedBlack: tiedFinalBlack || Boolean(meta?.respottedBlack),
        colorsRemaining,
        freeBall: nextFreeBall,
        hud: buildHud({ ...state, phase: nextPhase, freeBall: nextFreeBall }, scores, nextBallOn),
        state: { ballInHand: nextBallInHand }
      } satisfies SnookerMeta
    };
    return nextState;
  }
}
