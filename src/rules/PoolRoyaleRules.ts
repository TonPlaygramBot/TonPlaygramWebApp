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
  ballInHand: boolean;
  foulStreak: { A: number; B: number };
  frameOver: boolean;
  winner: 'A' | 'B' | 'TIE' | null;
  assignments: { A: 'SOLIDS' | 'STRIPES' | null; B: 'SOLIDS' | 'STRIPES' | null };
  isOpenTable: boolean;
  breakInProgress: boolean;
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
    ballInHand: state.ballInHand,
    foulStreak: { ...state.foulStreak },
    frameOver: state.frameOver,
    winner: state.winner,
    assignments: { ...state.assignments },
    isOpenTable: state.isOpenTable,
    breakInProgress: state.breakInProgress
  };
}

function applyAmericanState(game: AmericanBilliards, snapshot: AmericanSerializedState) {
  game.state = {
    ballsOnTable: new Set(snapshot.ballsOnTable),
    currentPlayer: snapshot.currentPlayer,
    ballInHand: snapshot.ballInHand,
    foulStreak: { ...snapshot.foulStreak },
    frameOver: snapshot.frameOver,
    winner: snapshot.winner,
    assignments: { ...snapshot.assignments },
    isOpenTable: snapshot.isOpenTable,
    breakInProgress: snapshot.breakInProgress
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
  if (typeof value === 'number') {
    if (value === 8) return 'black';
    return null;
  }
  if (typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  if (lower === 'cue') return 'cue';
  if (lower.startsWith('ball_')) {
    const numeric = Number.parseInt(lower.replace('ball_', ''), 10);
    if (numeric === 8) return 'black';
  }
  if (lower === '8') return 'black';
  if (lower.startsWith('yellow')) return 'blue';
  if (lower.startsWith('blue')) return 'blue';
  if (lower.startsWith('red')) return 'red';
  if (lower.startsWith('black')) return 'black';
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

function countAmericanGroup(balls: Iterable<number>, group: 'SOLIDS' | 'STRIPES'): number {
  let count = 0;
  for (const value of balls) {
    if (group === 'SOLIDS' && value >= 1 && value <= 7) count += 1;
    if (group === 'STRIPES' && value >= 9 && value <= 15) count += 1;
  }
  return count;
}

export class PoolRoyaleRules {
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
        const ballOn = this.computeAmericanBallOn(snapshot);
        const scores = this.computeAmericanScores(snapshot);
        const base: FrameState = {
          balls: [],
          activePlayer: 'A',
          players: basePlayers(playerA, playerB),
          currentBreak: 0,
          phase: 'REDS_AND_COLORS',
          redsRemaining: snapshot.ballsOnTable.length,
          ballOn,
          frameOver: false
        };
        const hud: HudInfo = {
          next: snapshot.isOpenTable ? 'open table' : ballOn.map((entry) => entry.toLowerCase()).join(' / '),
          phase: snapshot.isOpenTable ? 'open' : 'groups',
          scores
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
    const pottedCount = potted.filter((colour) => colour !== 'cue').length;
    const snapshot = serializeUkState(game.state);
    const totals = previous ? previous.totals : { blue: UK_TOTAL_PER_COLOUR, red: UK_TOTAL_PER_COLOUR };
    const playerScores = this.computeUkScores(snapshot, totals);
    const ballOn = this.computeUkBallOn(snapshot);
    const hud: HudInfo = {
      next: ballOn.length === 0 ? 'black' : ballOn.map((entry) => entry.toLowerCase()).join(' / '),
      phase: snapshot.isOpenTable ? 'open' : 'groups',
      scores: playerScores
    };
    const isFoul = Boolean(shotResult.foul);
    const shooter = state.activePlayer ?? game.state.currentPlayer;
    const sameShooter = shooter === game.state.currentPlayer;
    const currentBreak =
      !isFoul && sameShooter && pottedCount > 0 ? (state.currentBreak ?? 0) + pottedCount : 0;
    const nextState: FrameState = {
      ...state,
      activePlayer: game.state.currentPlayer,
      players: {
        A: { ...state.players.A, score: playerScores.A },
        B: { ...state.players.B, score: playerScores.B }
      },
      currentBreak,
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
    const pottedCount = potted.filter((id) => id !== 0 && id !== 8).length;
    const snapshot = serializeAmericanState(game.state);
    const ballOn = this.computeAmericanBallOn(snapshot);
    const scores = this.computeAmericanScores(snapshot);
    const frameOver = snapshot.frameOver;
    const nextLabel = snapshot.isOpenTable
      ? 'open table'
      : ballOn.length === 0
        ? '8 ball'
        : ballOn.map((entry) => entry.toLowerCase()).join(' / ');
    const hud: HudInfo = {
      next: frameOver ? 'frame over' : nextLabel,
      phase: frameOver ? 'complete' : snapshot.isOpenTable ? 'open' : 'groups',
      scores
    };
    const breakInProgress =
      Boolean(previous?.state?.breakInProgress) && Boolean(result.foul)
        ? true
        : Boolean(snapshot.breakInProgress);
    const nextState: FrameState = {
      ...state,
      activePlayer: game.state.currentPlayer,
      players: {
        A: { ...state.players.A, score: scores.A },
        B: { ...state.players.B, score: scores.B }
      },
      currentBreak:
        !result.foul && game.state.currentPlayer === state.activePlayer && pottedCount > 0
          ? (state.currentBreak ?? 0) + pottedCount
          : 0,
      ballOn: frameOver ? [] : ballOn,
      frameOver,
      winner: snapshot.winner ?? undefined,
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
        breakInProgress
      } satisfies PoolMeta
    };
    return nextState;
  }

  private computeAmericanScores(state: AmericanSerializedState): { A: number; B: number } {
    const solidsRemaining = countAmericanGroup(state.ballsOnTable, 'SOLIDS');
    const stripesRemaining = countAmericanGroup(state.ballsOnTable, 'STRIPES');
    const total = 7;
    return {
      A:
        state.assignments.A === 'SOLIDS'
          ? total - solidsRemaining
          : state.assignments.A === 'STRIPES'
            ? total - stripesRemaining
            : 0,
      B:
        state.assignments.B === 'SOLIDS'
          ? total - solidsRemaining
          : state.assignments.B === 'STRIPES'
            ? total - stripesRemaining
            : 0
    };
  }

  private computeAmericanBallOn(state: AmericanSerializedState): string[] {
    if (state.frameOver) return [];
    const solidsRemaining = countAmericanGroup(state.ballsOnTable, 'SOLIDS');
    const stripesRemaining = countAmericanGroup(state.ballsOnTable, 'STRIPES');
    const current = state.currentPlayer;
    const assignment = state.assignments[current];
    if (state.isOpenTable || !assignment) {
      const available: string[] = [];
      if (solidsRemaining > 0) available.push('SOLID');
      if (stripesRemaining > 0) available.push('STRIPE');
      if (available.length === 0 && state.ballsOnTable.includes(8)) available.push('BLACK');
      return available;
    }
    if (assignment === 'SOLIDS') {
      if (solidsRemaining > 0) return ['SOLID'];
    } else if (assignment === 'STRIPES') {
      if (stripesRemaining > 0) return ['STRIPE'];
    }
    if (state.ballsOnTable.includes(8)) return ['BLACK'];
    return [];
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
    const pottedCount = potted.filter((id) => id !== 0).length;
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
      currentBreak:
        !result.foul && game.state.currentPlayer === state.activePlayer && pottedCount > 0
          ? (state.currentBreak ?? 0) + pottedCount
          : 0,
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

export default PoolRoyaleRules;
