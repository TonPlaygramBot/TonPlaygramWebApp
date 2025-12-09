import { Ball, BallColor, FrameState, Player, ShotContext, ShotEvent } from '../types';

const BALL_VALUES: Record<BallColor, number> = Object.freeze({
  RED: 1,
  YELLOW: 2,
  GREEN: 3,
  BROWN: 4,
  BLUE: 5,
  PINK: 6,
  BLACK: 7,
  CUE: 0
});

const COLOR_ORDER: BallColor[] = ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'];

export type SerializedSnookerState = {
  balls: Ball[];
  activePlayer: 'A' | 'B';
  players: { A: Player; B: Player };
  currentBreak: number;
  phase: FrameState['phase'];
  redsRemaining: number;
  colorOnAfterRed: boolean;
  ballOn: (BallColor | string)[];
  frameOver: boolean;
  winner: 'A' | 'B' | 'TIE' | null;
  foul?: FrameState['foul'];
};

function basePlayers(playerA: string, playerB: string): { A: Player; B: Player } {
  return {
    A: { id: 'A', name: playerA, score: 0, highestBreak: 0 },
    B: { id: 'B', name: playerB, score: 0, highestBreak: 0 }
  };
}

function createBalls(): Ball[] {
  const reds: Ball[] = Array.from({ length: 15 }).map((_, idx) => ({
    id: `R${idx + 1}`,
    color: 'RED',
    onTable: true,
    potted: false
  }));

  const colours: Ball[] = [
    { id: 'Y', color: 'YELLOW', onTable: true, potted: false },
    { id: 'G', color: 'GREEN', onTable: true, potted: false },
    { id: 'BR', color: 'BROWN', onTable: true, potted: false },
    { id: 'BL', color: 'BLUE', onTable: true, potted: false },
    { id: 'P', color: 'PINK', onTable: true, potted: false },
    { id: 'BK', color: 'BLACK', onTable: true, potted: false },
    { id: 'CUE', color: 'CUE', onTable: true, potted: false }
  ];

  return [...reds, ...colours];
}

export function createSnookerFrame(playerA: string, playerB: string): FrameState {
  return {
    balls: createBalls(),
    activePlayer: 'A',
    players: basePlayers(playerA, playerB),
    currentBreak: 0,
    phase: 'REDS_AND_COLORS',
    redsRemaining: 15,
    colorOnAfterRed: false,
    ballOn: ['RED'],
    frameOver: false
  };
}

function ballValue(color: BallColor): number {
  return BALL_VALUES[color] ?? 0;
}

function ballsOn(state: FrameState): (BallColor | string)[] {
  if (state.phase === 'COLORS_ORDER') {
    const next = COLOR_ORDER.find((color) => state.balls.some((b) => b.color === color && b.onTable));
    return next ? [next] : [];
  }

  if (state.colorOnAfterRed) {
    return COLOR_ORDER.filter((color) => state.balls.some((b) => b.color === color && b.onTable));
  }

  return ['RED'];
}

function markPotted(state: FrameState, colour: BallColor, ballId?: string | number | null) {
  const target = state.balls.find(
    (b) => b.color === colour && !b.potted && b.onTable && (!ballId || b.id === ballId)
  );
  if (target) {
    target.onTable = false;
    target.potted = true;
    if (colour === 'RED') {
      state.redsRemaining = Math.max(0, state.redsRemaining - 1);
    }
  }
}

function respotColours(state: FrameState) {
  for (const ball of state.balls) {
    if (ball.color === 'RED' || ball.color === 'CUE') continue;
    if (!ball.potted) continue;
    ball.onTable = true;
    ball.potted = false;
  }
}

function switchPlayer(state: FrameState) {
  state.activePlayer = state.activePlayer === 'A' ? 'B' : 'A';
  state.currentBreak = 0;
}

function awardPoints(state: FrameState, points: number) {
  const player = state.players[state.activePlayer];
  player.score += points;
  state.currentBreak = (state.currentBreak || 0) + points;
  if (!player.highestBreak || state.currentBreak > player.highestBreak) {
    player.highestBreak = state.currentBreak;
  }
}

function registerFoul(state: FrameState, points: number, reason: string) {
  const opponent = state.activePlayer === 'A' ? 'B' : 'A';
  const value = Math.max(4, points);
  state.players[opponent].score += value;
  state.foul = { points: value, reason };
  switchPlayer(state);
}

function validateFirstContact(event: ShotEvent | undefined, legalBalls: (BallColor | string)[]): string | null {
  if (!event || event.type !== 'HIT') return null;
  const hit = typeof event.firstContact === 'string' ? event.firstContact.toUpperCase() : '';
  if (!hit) return null;
  if (!legalBalls.includes(hit)) return hit;
  return null;
}

function updatePhaseAfterPot(state: FrameState) {
  if (state.phase === 'REDS_AND_COLORS' && state.redsRemaining <= 0 && !state.colorOnAfterRed) {
    state.phase = 'COLORS_ORDER';
  }
}

export function applySnookerEvents(events: ShotEvent[], ctx: ShotContext, state: FrameState): FrameState {
  if (state.frameOver) return state;
  const legalBalls = ballsOn(state);
  const wrongContact = validateFirstContact(events.find((e) => e.type === 'HIT'), legalBalls);

  let foulPoints = 0;
  let foulReason: string | null = wrongContact ? `Hit wrong ball: ${wrongContact}` : null;
  let pottedAny = false;

  for (const evt of events) {
    if (evt.type === 'FOUL') {
      foulPoints = Math.max(foulPoints, evt.ball ? ballValue(evt.ball as BallColor) : 4);
      foulReason = evt.reason || 'Foul';
      continue;
    }
    if (evt.type !== 'POTTED') continue;

    const color = typeof evt.ball === 'string' ? (evt.ball.toUpperCase() as BallColor) : null;
    if (!color) continue;
    const isLegal = legalBalls.includes(color);
    if (!isLegal) {
      foulPoints = Math.max(foulPoints, ballValue(color));
      foulReason = `Potted wrong ball (${color})`;
      continue;
    }

    pottedAny = true;
    awardPoints(state, ballValue(color));
    markPotted(state, color, evt.ballId);

    if (state.phase === 'REDS_AND_COLORS') {
      if (color === 'RED') {
        state.colorOnAfterRed = true;
      } else {
        state.colorOnAfterRed = false;
        respotColours(state);
      }
    } else if (state.phase === 'COLORS_ORDER') {
      // Colours stay potted in the final phase.
    }

    updatePhaseAfterPot(state);
  }

  if (ctx?.cueBallPotted) {
    foulPoints = Math.max(foulPoints, 4);
    foulReason = foulReason || 'Cue ball potted';
  }

  if (foulPoints > 0) {
    registerFoul(state, foulPoints, foulReason || 'Foul');
    return state;
  }

  state.ballOn = ballsOn(state);

  if (!pottedAny || ctx?.placedFromHand) {
    switchPlayer(state);
  }

  const coloursCleared = COLOR_ORDER.every(
    (color) => !state.balls.some((ball) => ball.color === color && ball.onTable)
  );
  if (state.phase === 'COLORS_ORDER' && coloursCleared) {
    state.frameOver = true;
    const { A, B } = state.players;
    state.winner = A.score === B.score ? 'TIE' : A.score > B.score ? 'A' : 'B';
  }

  return state;
}

export function serializeSnookerState(state: FrameState): SerializedSnookerState {
  return {
    balls: state.balls.map((b) => ({ ...b })),
    activePlayer: state.activePlayer,
    players: { A: { ...state.players.A }, B: { ...state.players.B } },
    currentBreak: state.currentBreak || 0,
    phase: state.phase,
    redsRemaining: state.redsRemaining,
    colorOnAfterRed: !!state.colorOnAfterRed,
    ballOn: [...(state.ballOn || [])],
    frameOver: state.frameOver,
    winner: (state.winner as SerializedSnookerState['winner']) || null,
    foul: state.foul ? { ...state.foul } : undefined
  };
}

export function applySerializedSnookerState(snapshot: SerializedSnookerState): FrameState {
  return {
    balls: snapshot.balls.map((b) => ({ ...b })),
    activePlayer: snapshot.activePlayer,
    players: { A: { ...snapshot.players.A }, B: { ...snapshot.players.B } },
    currentBreak: snapshot.currentBreak,
    phase: snapshot.phase,
    redsRemaining: snapshot.redsRemaining,
    colorOnAfterRed: snapshot.colorOnAfterRed,
    ballOn: [...snapshot.ballOn],
    frameOver: snapshot.frameOver,
    winner: snapshot.winner ?? undefined,
    foul: snapshot.foul
  };
}
