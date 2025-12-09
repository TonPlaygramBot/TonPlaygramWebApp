import { FrameState, Player, ShotContext, ShotEvent } from '../types';
import { UkPool } from '../../lib/poolUk8Ball.js';
import { AmericanBilliards } from '../../lib/americanBilliards.js';
import { NineBall } from '../../lib/nineBall.js';

type PoolVariantId = 'american' | 'uk' | '9ball';

type UkColour = 'blue' | 'red' | 'black' | 'cue';

type HudInfo = {
  next: string;
  phase: string;
  scores: { A: number; B: number };
};

type UkSerializedState = {
  ballsOnTable: {
    blue: number[];
    red: number[];
    black8: boolean;
    cueInPocket: boolean;
  };
  assignments: { A: UkColour | null; B: UkColour | null };
  currentPlayer: 'A' | 'B';
  shotsRemaining: number;
  isOpenTable: boolean;
  lastEvent: string | null;
  frameOver: boolean;
  winner: 'A' | 'B' | null;
  mustPlayFromBaulk: boolean;
};

type AmericanSerializedState = {
  ballsOnTable: number[];
  currentPlayer: 'A' | 'B';
  scores: { A: number; B: number };
  ballInHand: boolean;
  foulStreak: { A: number; B: number };
  frameOver: boolean;
  winner: 'A' | 'B' | 'TIE' | null;
};

type NineSerializedState = {
  ballsOnTable: number[];
  currentPlayer: 'A' | 'B';
  ballInHand: boolean;
  foulStreak: { A: number; B: number };
  gameOver: boolean;
  winner: 'A' | 'B' | null;
};

type PoolMeta =
  | {
      variant: 'uk';
      state: UkSerializedState;
      totals: { blue: number; red: number };
      hud: HudInfo;
    }
  | {
      variant: 'american';
      state: AmericanSerializedState;
      hud: HudInfo;
      breakInProgress?: boolean;
    }
  | {
      variant: '9ball';
      state: NineSerializedState;
      hud: HudInfo;
      breakInProgress?: boolean;
    };

const UK_TOTAL_PER_COLOUR = 7;

function normalizeVariantId(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[_\s-]+/g, '')
    .trim();
}

function basePlayers(playerA: string, playerB: string): { A: Player; B: Player } {
  return {
    A: { id: 'A', name: playerA, score: 0 },
    B: { id: 'B', name: playerB, score: 0 }
  };
}

function serializeUkState(state: UkPool['state']): UkSerializedState {
  return {
    ballsOnTable: {
      blue: Array.from(state.ballsOnTable.blue.values()),
      red: Array.from(state.ballsOnTable.red.values()),
      black8: state.ballsOnTable.black8,
      cueInPocket: state.ballsOnTable.cueInPocket
    },
    assignments: { ...state.assignments },
    currentPlayer: state.currentPlayer,
    shotsRemaining: state.shotsRemaining,
    isOpenTable: state.isOpenTable,
    lastEvent: state.lastEvent,
    frameOver: state.frameOver,
    winner: state.winner,
    mustPlayFromBaulk: state.mustPlayFromBaulk
  };
}

function applyUkState(game: UkPool, snapshot: UkSerializedState) {
  game.state = {
    ballsOnTable: {
      blue: new Set(snapshot.ballsOnTable.blue),
      red: new Set(snapshot.ballsOnTable.red),
      black8: snapshot.ballsOnTable.black8,
      cueInPocket: snapshot.ballsOnTable.cueInPocket
    },
    assignments: { ...snapshot.assignments },
    currentPlayer: snapshot.currentPlayer,
    shotsRemaining: snapshot.shotsRemaining,
    isOpenTable: snapshot.isOpenTable,
    lastEvent: snapshot.lastEvent,
    frameOver: snapshot.frameOver,
    winner: snapshot.winner,
    mustPlayFromBaulk: snapshot.mustPlayFromBaulk
  };
}

function serializeAmericanState(state: AmericanBilliards['state']): AmericanSerializedState {
  return {
    ballsOnTable: Array.from(state.ballsOnTable.values()),
    currentPlayer: state.currentPlayer,
    scores: { ...state.scores },
    ballInHand: state.ballInHand,
    foulStreak: { ...state.foulStreak },
    frameOver: state.frameOver,
    winner: state.winner
  };
}

function applyAmericanState(game: AmericanBilliards, snapshot: AmericanSerializedState) {
  game.state = {
    ballsOnTable: new Set(snapshot.ballsOnTable),
    currentPlayer: snapshot.currentPlayer,
    scores: { ...snapshot.scores },
    ballInHand: snapshot.ballInHand,
    foulStreak: { ...snapshot.foulStreak },
    frameOver: snapshot.frameOver,
    winner: snapshot.winner
  };
}

function serializeNineState(state: NineBall['state']): NineSerializedState {
  return {
    ballsOnTable: Array.from(state.ballsOnTable.values()),
    currentPlayer: state.currentPlayer,
    ballInHand: state.ballInHand,
    foulStreak: { ...state.foulStreak },
    gameOver: state.gameOver,
    winner: state.winner
  };
}

function applyNineState(game: NineBall, snapshot: NineSerializedState) {
  game.state = {
    ballsOnTable: new Set(snapshot.ballsOnTable),
    currentPlayer: snapshot.currentPlayer,
    ballInHand: snapshot.ballInHand,
    foulStreak: { ...snapshot.foulStreak },
    gameOver: snapshot.gameOver,
    winner: snapshot.winner
  };
}

function parseUkColour(value: unknown): UkColour | null {
  if (typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  if (lower.startsWith('yellow')) return 'blue';
  if (lower.startsWith('blue')) return 'blue';
  if (lower.startsWith('red')) return 'red';
  if (lower.startsWith('black')) return 'black';
  if (lower === 'cue') return 'cue';
  return null;
}

function isCueBallId(value: unknown): boolean {
  if (value === 0) return true;
  if (typeof value !== 'string') return false;
  return value.toLowerCase() === 'cue' || value.toLowerCase() === 'cue_ball';
}

function parseNumericId(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const match = value.match(/(\d+)/);
    if (match) return Number.parseInt(match[1], 10);
  }
  return null;
}

function lowestBall(balls: Iterable<number>): number | null {
  let lowest: number | null = null;
  for (const value of balls) {
    if (lowest == null || value < lowest) {
      lowest = value;
    }
  }
  return lowest;
}

export class SnookerClubRules {
  private readonly variant: PoolVariantId;

  constructor(variantKey: string | null | undefined) {
    const normalized = normalizeVariantId(variantKey);
    if (normalized === 'uk' || normalized === '8balluk' || normalized === 'eightballuk' || normalized === 'uk8') {
      this.variant = 'uk';
    } else if (normalized === '9ball' || normalized === 'nineball' || normalized === '9') {
      this.variant = '9ball';
    } else {
      this.variant = 'american';
    }
  }

  getInitialFrame(playerA: string, playerB: string): FrameState {
    switch (this.variant) {
      case 'uk': {
        const game = new UkPool();
        game.startBreak();
        const snapshot = serializeUkState(game.state);
        const base: FrameState = {
          balls: [],
          activePlayer: 'A',
          players: basePlayers(playerA, playerB),
          currentBreak: 0,
          phase: 'REDS_AND_COLORS',
          redsRemaining: UK_TOTAL_PER_COLOUR * 2,
          ballOn: ['RED', 'YELLOW'],
          frameOver: false
        };
        const hud: HudInfo = {
          next: 'open table',
          phase: 'open',
          scores: { A: 0, B: 0 }
        };
        base.meta = {
          variant: 'uk',
          state: snapshot,
          totals: { blue: UK_TOTAL_PER_COLOUR, red: UK_TOTAL_PER_COLOUR },
          hud
        } satisfies PoolMeta;
        return base;
      }
      case '9ball': {
        const game = new NineBall();
        game.state.ballInHand = true;
        const snapshot = serializeNineState(game.state);
        const lowest = lowestBall(snapshot.ballsOnTable) ?? 1;
        const base: FrameState = {
          balls: [],
          activePlayer: 'A',
          players: basePlayers(playerA, playerB),
          currentBreak: 0,
          phase: 'REDS_AND_COLORS',
          redsRemaining: 9,
          ballOn: [`BALL_${lowest}`],
          frameOver: false
        };
        const hud: HudInfo = {
          next: `ball ${lowest}`,
          phase: 'rack',
          scores: { A: 0, B: 0 }
        };
        base.meta = {
          variant: '9ball',
          state: snapshot,
          hud,
          breakInProgress: true
        } satisfies PoolMeta;
        return base;
      }
      default: {
        const game = new AmericanBilliards();
        game.state.ballInHand = true;
        const snapshot = serializeAmericanState(game.state);
        const lowest = lowestBall(snapshot.ballsOnTable) ?? 1;
        const base: FrameState = {
          balls: [],
          activePlayer: 'A',
          players: basePlayers(playerA, playerB),
          currentBreak: 0,
          phase: 'REDS_AND_COLORS',
          redsRemaining: snapshot.ballsOnTable.length,
          ballOn: [`BALL_${lowest}`],
          frameOver: false
        };
        const hud: HudInfo = {
          next: `ball ${lowest}`,
          phase: 'rotation',
          scores: { A: 0, B: 0 }
        };
        base.meta = {
          variant: 'american',
          state: snapshot,
          hud,
          breakInProgress: true
        } satisfies PoolMeta;
        return base;
      }
    }
  }

  applyShot(state: FrameState, events: ShotEvent[], context: ShotContext = {}): FrameState {
    switch (this.variant) {
      case 'uk':
        return this.applyUkShot(state, events, context);
      case '9ball':
        return this.applyNineBallShot(state, events, context);
      default:
        return this.applyAmericanShot(state, events, context);
    }
  }

  private applyUkShot(state: FrameState, events: ShotEvent[], context: ShotContext): FrameState {
    const meta = state.meta as PoolMeta | undefined;
    const previous = meta && meta.variant === 'uk' && meta.state ? meta : null;
    const game = new UkPool();
    if (previous) {
      applyUkState(game, previous.state);
    } else {
      game.startBreak();
    }
    const contactOrder: UkColour[] = [];
    for (const ev of events) {
      if (ev.type !== 'HIT') continue;
      const colour = parseUkColour(ev.ballId ?? ev.firstContact);
      if (colour && colour !== 'cue') {
        contactOrder.push(colour);
      }
    }
    const potted: UkColour[] = [];
    for (const ev of events) {
      if (ev.type !== 'POTTED') continue;
      if (isCueBallId(ev.ballId ?? ev.ball)) {
        potted.push('cue');
      } else {
        const colour = parseUkColour(ev.ballId ?? ev.ball);
        if (colour && colour !== 'cue') {
          potted.push(colour);
        }
      }
    }
    const shotResult = game.shotTaken({
      contactOrder,
      potted,
      cueOffTable: Boolean(context.cueBallPotted),
      noCushionAfterContact: Boolean(context.noCushionAfterContact),
      placedFromHand: Boolean(context.placedFromHand)
    });
    const snapshot = serializeUkState(game.state);
    const totals = previous ? previous.totals : { blue: UK_TOTAL_PER_COLOUR, red: UK_TOTAL_PER_COLOUR };
    const playerScores = this.computeUkScores(snapshot, totals);
    const ballOn = this.computeUkBallOn(snapshot);
    const hud: HudInfo = {
      next: ballOn.length === 0 ? 'black' : ballOn.map((entry) => entry.toLowerCase()).join(' / '),
      phase: snapshot.isOpenTable ? 'open' : 'groups',
      scores: playerScores
    };
    const nextState: FrameState = {
      ...state,
      activePlayer: game.state.currentPlayer,
      players: {
        A: { ...state.players.A, score: playerScores.A },
        B: { ...state.players.B, score: playerScores.B }
      },
      ballOn,
      frameOver: game.state.frameOver,
      winner: game.state.winner ?? undefined,
      foul: shotResult.foul
        ? {
            points: 0,
            reason: shotResult.reason ?? 'foul'
          }
        : undefined,
      meta: {
        variant: 'uk',
        state: snapshot,
        totals,
        hud
      } satisfies PoolMeta
    };
    return nextState;
  }

  private computeUkScores(state: UkSerializedState, totals: { blue: number; red: number }): { A: number; B: number } {
    const remainingBlue = state.ballsOnTable.blue.length;
    const remainingRed = state.ballsOnTable.red.length;
    const pottedBlue = totals.blue - remainingBlue;
    const pottedRed = totals.red - remainingRed;
    const assignA = state.assignments.A;
    const assignB = state.assignments.B;
    return {
      A: assignA === 'blue' ? pottedBlue : assignA === 'red' ? pottedRed : 0,
      B: assignB === 'blue' ? pottedBlue : assignB === 'red' ? pottedRed : 0
    };
  }

  private computeUkBallOn(state: UkSerializedState): string[] {
    if (state.frameOver) return [];
    const current = state.currentPlayer;
    const assignment = state.assignments[current];
    const available: string[] = [];
    if (state.isOpenTable || !assignment) {
      if (state.ballsOnTable.red.length > 0) available.push('RED');
      if (state.ballsOnTable.blue.length > 0) available.push('YELLOW');
      if (available.length === 0 && state.ballsOnTable.black8) available.push('BLACK');
      return available;
    }
    if (assignment === 'red') {
      if (state.ballsOnTable.red.length > 0) return ['RED'];
    } else if (assignment === 'blue') {
      if (state.ballsOnTable.blue.length > 0) return ['YELLOW'];
    }
    if (state.ballsOnTable.black8) return ['BLACK'];
    return [];
  }

  private applyAmericanShot(state: FrameState, events: ShotEvent[], context: ShotContext): FrameState {
    const meta = state.meta as PoolMeta | undefined;
    const previous = meta && meta.variant === 'american' && meta.state ? meta : null;
    const game = new AmericanBilliards();
    if (previous) {
      applyAmericanState(game, previous.state);
    } else {
      game.state.ballInHand = true;
    }
    const contactOrder: number[] = [];
    for (const ev of events) {
      if (ev.type !== 'HIT') continue;
      const id = parseNumericId(ev.ballId ?? ev.firstContact);
      if (id != null) contactOrder.push(id);
    }
    const potted: number[] = [];
    for (const ev of events) {
      if (ev.type !== 'POTTED') continue;
      if (isCueBallId(ev.ballId ?? ev.ball)) {
        potted.push(0);
      } else {
        const id = parseNumericId(ev.ballId ?? ev.ball);
        if (id != null) potted.push(id);
      }
    }
    const result = game.shotTaken({
      contactOrder,
      potted,
      cueOffTable: Boolean(context.cueBallPotted),
      placedFromHand: Boolean(context.placedFromHand),
      noCushionAfterContact: Boolean(context.noCushionAfterContact)
    });
    const snapshot = serializeAmericanState(game.state);
    const lowest = lowestBall(snapshot.ballsOnTable);
    const tableClear = snapshot.ballsOnTable.length === 0;
    const frameOver = snapshot.frameOver || tableClear;
    const hud: HudInfo = {
      next:
        frameOver && snapshot.winner
          ? 'frame over'
          : lowest != null
            ? `ball ${lowest}`
            : tableClear
              ? 'frame over'
              : 'rack clear',
      phase: frameOver ? 'complete' : 'rotation',
      scores: { ...snapshot.scores }
    };
    let winner: FrameState['winner'];
    if (frameOver) {
      if (snapshot.winner === 'A' || snapshot.winner === 'B' || snapshot.winner === 'TIE') {
        winner = snapshot.winner;
      } else if (snapshot.scores.A > snapshot.scores.B) winner = 'A';
      else if (snapshot.scores.B > snapshot.scores.A) winner = 'B';
      else winner = 'TIE';
    }
    const nextState: FrameState = {
      ...state,
      activePlayer: game.state.currentPlayer,
      players: {
        A: { ...state.players.A, score: snapshot.scores.A },
        B: { ...state.players.B, score: snapshot.scores.B }
      },
      ballOn: lowest != null && !frameOver ? [`BALL_${lowest}`] : [],
      frameOver,
      winner,
      foul: result.foul
        ? {
            points: 0,
            reason: result.reason ?? 'foul'
          }
        : undefined,
      meta: {
        variant: 'american',
        state: snapshot,
        hud,
        breakInProgress: false
      } satisfies PoolMeta
    };
    return nextState;
  }

  private applyNineBallShot(state: FrameState, events: ShotEvent[], context: ShotContext): FrameState {
    const meta = state.meta as PoolMeta | undefined;
    const previous = meta && meta.variant === '9ball' && meta.state ? meta : null;
    const game = new NineBall();
    if (previous) {
      applyNineState(game, previous.state);
    } else {
      game.state.ballInHand = true;
    }
    const contactOrder: number[] = [];
    for (const ev of events) {
      if (ev.type !== 'HIT') continue;
      const id = parseNumericId(ev.ballId ?? ev.firstContact);
      if (id != null) contactOrder.push(id);
    }
    const potted: number[] = [];
    for (const ev of events) {
      if (ev.type !== 'POTTED') continue;
      if (isCueBallId(ev.ballId ?? ev.ball)) {
        potted.push(0);
      } else {
        const id = parseNumericId(ev.ballId ?? ev.ball);
        if (id != null) potted.push(id);
      }
    }
    const result = game.shotTaken({
      contactOrder,
      potted,
      cueOffTable: Boolean(context.cueBallPotted),
      placedFromHand: Boolean(context.placedFromHand),
      noCushionAfterContact: Boolean(context.noCushionAfterContact)
    });
    const snapshot = serializeNineState(game.state);
    const lowest = lowestBall(snapshot.ballsOnTable);
    const hud: HudInfo = {
      next: snapshot.gameOver ? 'frame over' : lowest != null ? `ball ${lowest}` : 'nine',
      phase: snapshot.gameOver ? 'complete' : 'run',
      scores: { A: 0, B: 0 }
    };
    const nextState: FrameState = {
      ...state,
      activePlayer: game.state.currentPlayer,
      players: {
        A: { ...state.players.A, score: 0 },
        B: { ...state.players.B, score: 0 }
      },
      ballOn: lowest != null && !snapshot.gameOver ? [`BALL_${lowest}`] : [],
      frameOver: game.state.gameOver,
      winner: game.state.winner ?? undefined,
      foul: result.foul
        ? {
            points: 0,
            reason: result.reason ?? 'foul'
          }
        : undefined,
      meta: {
        variant: '9ball',
        state: snapshot,
        hud,
        breakInProgress: false
      } satisfies PoolMeta
    };
    return nextState;
  }
}

export default SnookerClubRules;
