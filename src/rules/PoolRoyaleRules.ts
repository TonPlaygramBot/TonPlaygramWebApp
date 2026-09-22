import { FrameState, Player, ShotContext, ShotEvent } from '../types';
import { UkPool } from '../../lib/poolUk8Ball.js';
import { NineBall } from '../../lib/nineBall.js';
import { BcaEightBall } from '../../lib/bcaEightBall.js';
import { normalizePoolBallId, poolShotHasNoCushion, PoolRuleProfile } from '../../lib/poolShotInput.js';

type PoolVariantId = '8ball' | 'uk' | '9ball';

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
  ballInHand: boolean;
};

type EightBallSerializedState = {
  ballsOnTable: number[];
  currentPlayer: 'A' | 'B';
  assignments: { A: 'SOLID' | 'STRIPE' | null; B: 'SOLID' | 'STRIPE' | null };
  ballInHand: boolean;
  mustPlayFromBaulk?: boolean;
  frameOver: boolean;
  winner: 'A' | 'B' | null;
  breakInProgress: boolean;
};

type NineSerializedState = {
  ballsOnTable: number[];
  currentPlayer: 'A' | 'B';
  ballInHand: boolean;
  foulStreak: { A: number; B: number };
  gameOver: boolean;
  winner: 'A' | 'B' | null;
  breakInProgress: boolean;
  pushOutAvailable?: boolean;
  pushOutPending?: { shooter: 'A' | 'B'; chooser: 'A' | 'B' } | null;
};

type PoolMeta =
  | {
      variant: 'uk';
      state: UkSerializedState;
      totals: { blue: number; red: number };
      hud: HudInfo;
    }
  | {
      variant: '8ball';
      ruleProfile: PoolRuleProfile;
      state: EightBallSerializedState;
      hud: HudInfo;
      breakInProgress?: boolean;
    }
  | {
      variant: '9ball';
      ruleProfile: PoolRuleProfile;
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
    mustPlayFromBaulk: state.mustPlayFromBaulk,
    ballInHand: Boolean(state.ballInHand)
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
    mustPlayFromBaulk: snapshot.mustPlayFromBaulk,
    ballInHand: Boolean(snapshot.ballInHand ?? snapshot.mustPlayFromBaulk)
  };
}

function serializeEightBallState(state: BcaEightBall['state']): EightBallSerializedState {
  return {
    ballsOnTable: Array.from(state.ballsOnTable.values()),
    currentPlayer: state.currentPlayer,
    assignments: {
      A: state.assignments?.A ?? null,
      B: state.assignments?.B ?? null
    },
    ballInHand: state.ballInHand,
    mustPlayFromBaulk: Boolean(state.mustPlayFromBaulk),
    frameOver: state.frameOver,
    winner: state.winner,
    breakInProgress: state.breakInProgress
  };
}

function applyEightBallState(game: BcaEightBall, snapshot: EightBallSerializedState) {
  game.state = {
    ballsOnTable: new Set(snapshot.ballsOnTable),
    currentPlayer: snapshot.currentPlayer,
    assignments: {
      A: snapshot.assignments?.A ?? null,
      B: snapshot.assignments?.B ?? null
    },
    ballInHand: snapshot.ballInHand,
    mustPlayFromBaulk: Boolean(snapshot.mustPlayFromBaulk),
    frameOver: snapshot.frameOver,
    winner: snapshot.winner,
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
    winner: state.winner,
    breakInProgress: state.breakInProgress,
    pushOutAvailable: Boolean(state.pushOutAvailable),
    pushOutPending: state.pushOutPending ? { ...state.pushOutPending } : null
  };
}

function applyNineState(game: NineBall, snapshot: NineSerializedState) {
  game.state = {
    ballsOnTable: new Set(snapshot.ballsOnTable),
    currentPlayer: snapshot.currentPlayer,
    ballInHand: snapshot.ballInHand,
    foulStreak: { ...snapshot.foulStreak },
    gameOver: snapshot.gameOver,
    winner: snapshot.winner,
    breakInProgress: snapshot.breakInProgress,
    pushOutAvailable: Boolean(snapshot.pushOutAvailable),
    pushOutPending: snapshot.pushOutPending ? { ...snapshot.pushOutPending } : null
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


function lowestBall(balls: Iterable<number>): number | null {
  let lowest: number | null = null;
  for (const value of balls) {
    if (lowest == null || value < lowest) {
      lowest = value;
    }
  }
  return lowest;
}

export class PoolRoyaleRules {
  private readonly variant: PoolVariantId;
  private readonly ruleProfile: PoolRuleProfile;

  constructor(variantKey: string | null | undefined, ruleProfile: PoolRuleProfile = 'standard') {
    this.ruleProfile = ruleProfile;
    const normalized = normalizeVariantId(variantKey);
    if (normalized === 'uk' || normalized === '8balluk' || normalized === 'eightballuk' || normalized === 'uk8') {
      this.variant = 'uk';
    } else if (
      normalized === '8ball' ||
      normalized === '8ballus' ||
      normalized === 'eightball' ||
      normalized === 'eightballus' ||
      normalized === 'american8ball' ||
      normalized === 'bca8ball'
    ) {
      this.variant = '8ball';
    } else if (normalized === '9ball' || normalized === 'nineball' || normalized === '9') {
      this.variant = '9ball';
    } else {
      this.variant = '8ball';
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
        const game = new NineBall({ profile: this.ruleProfile });
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
          ruleProfile: this.ruleProfile,
          state: snapshot,
          hud,
          breakInProgress: true
        } satisfies PoolMeta;
        return base;
      }
      case '8ball':
      default: {
        const game = new BcaEightBall({ profile: this.ruleProfile });
        game.state.ballInHand = true;
        const snapshot = serializeEightBallState(game.state);
        const ballOn = this.computeEightBallBallOn(snapshot);
        const base: FrameState = {
          balls: [],
          activePlayer: 'A',
          players: basePlayers(playerA, playerB),
          currentBreak: 0,
          phase: 'REDS_AND_COLORS',
          redsRemaining: 15,
          ballOn,
          frameOver: false
        };
        const hud: HudInfo = {
          next: 'open table',
          phase: 'groups',
          scores: { A: 0, B: 0 }
        };
        base.meta = {
          variant: '8ball',
          ruleProfile: this.ruleProfile,
          state: snapshot,
          hud,
          breakInProgress: true
        } satisfies PoolMeta;
        return base;
      }
    }
  }

  applyShot(state: FrameState, events: ShotEvent[], context: ShotContext = {}): FrameState {
    if (state.frameOver) return state;
    const meta = state.meta as PoolMeta | undefined;
    if (meta?.variant === '9ball' && meta.state?.pushOutPending) return state;
    switch (this.variant) {
      case 'uk':
        return this.applyUkShot(state, events, context);
      case '9ball':
        return this.applyNineBallShot(state, events, context);
      case '8ball':
      default:
        return this.applyEightBallShot(state, events, context);
    }
  }

  resolvePushOut(state: FrameState, choice: 'accept' | 'return'): FrameState {
    const meta = state.meta as PoolMeta | undefined;
    if (state.frameOver || meta?.variant !== '9ball') return state;
    const game = new NineBall({ profile: meta.ruleProfile });
    applyNineState(game, meta.state);
    if (!game.resolvePushOut(choice)) return state;
    const snapshot = serializeNineState(game.state);
    const warning = meta.ruleProfile === 'standard' && snapshot.foulStreak[snapshot.currentPlayer] === 2
      ? ' · 2 fouls: next foul loses' : '';
    return {
      ...state,
      activePlayer: snapshot.currentPlayer,
      currentBreak: 0,
      meta: { ...meta, state: snapshot, hud: { ...meta.hud, next: `ball ${lowestBall(snapshot.ballsOnTable) ?? 9}${warning}` } }
    };
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

  private applyEightBallShot(state: FrameState, events: ShotEvent[], context: ShotContext): FrameState {
    const meta = state.meta as PoolMeta | undefined;
    const previous = meta && meta.variant === '8ball' && meta.state ? meta : null;
    const ruleProfile = previous?.ruleProfile ?? this.ruleProfile;
    const game = new BcaEightBall({ profile: ruleProfile });
    if (previous) {
      applyEightBallState(game, previous.state);
    } else {
      game.state.ballInHand = true;
    }
    const contactOrder: number[] = [];
    for (const ev of events) {
      if (ev.type !== 'HIT') continue;
      const id = normalizePoolBallId(ev.ballId ?? ev.firstContact);
      contactOrder.push(id ?? 0);
    }
    const potted: number[] = [];
    for (const ev of events) {
      if (ev.type !== 'POTTED') continue;
      if (isCueBallId(ev.ballId ?? ev.ball)) {
        potted.push(0);
      } else {
        const id = normalizePoolBallId(ev.ballId ?? ev.ball);
        if (id != null) potted.push(id);
      }
    }
    const result = game.shotTaken({
      contactOrder: context.contactMade === false ? [] : contactOrder,
      foulReason: events.find((event) => event.type === 'FOUL')?.reason,
      potted,
      offTable: context.offTableBallIds,
      calledBallId: context.calledBallId,
      calledPocket: context.calledPocket,
      safety: context.safety,
      pottedPockets: Object.fromEntries(events.filter((event): event is Extract<ShotEvent, { type: 'POTTED' }> =>
        event.type === 'POTTED').map(event => [normalizePoolBallId(event.ballId ?? event.ball), event.pocket])),
      cueOffTable: Boolean(context.cueBallPotted),
      placedFromHand: Boolean(context.placedFromHand),
      noCushionAfterContact: poolShotHasNoCushion(context),
      objectBallsToRailAfterContact: context.objectBallsToRailAfterContact,
      railContactsAfterFirstHit: Number(context.railContactCountAfterContact ?? 0)
    });
    const pottedCount = result.potted.filter((id) => id !== 0).length;
    const snapshot = serializeEightBallState(game.state);
    const ballOn = this.computeEightBallBallOn(snapshot, ruleProfile);
    const scores = this.computeEightBallScores(snapshot);
    const frameOver = snapshot.frameOver;
    const nextLabel =
      ballOn.length === 0
        ? 'frame over'
        : ballOn.map((entry) => entry.toLowerCase().replace('_', ' ')).join(' / ');
    const hud: HudInfo = {
      next: frameOver ? 'frame over' : nextLabel,
      phase:
        frameOver
          ? 'complete'
          : 'groups',
      scores
    };
    const breakInProgress = Boolean(snapshot.breakInProgress);
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
        variant: '8ball',
        ruleProfile,
        state: snapshot,
        hud,
        breakInProgress
      } satisfies PoolMeta
    };
    return nextState;
  }

  private computeEightBallScores(state: EightBallSerializedState): { A: number; B: number } {
    const pottedSolids = 7 - state.ballsOnTable.filter((id) => id >= 1 && id <= 7).length;
    const pottedStripes = 7 - state.ballsOnTable.filter((id) => id >= 9 && id <= 15).length;
    return {
      A: state.assignments.A === 'SOLID' ? pottedSolids : state.assignments.A === 'STRIPE' ? pottedStripes : 0,
      B: state.assignments.B === 'SOLID' ? pottedSolids : state.assignments.B === 'STRIPE' ? pottedStripes : 0
    };
  }

  private computeEightBallBallOn(state: EightBallSerializedState, profile = this.ruleProfile): string[] {
    if (state.frameOver) return [];
    const seat = state.currentPlayer;
    const assignment = state.assignments?.[seat] ?? null;
    if (!assignment) {
      const hasSolid = state.ballsOnTable.some((id) => id >= 1 && id <= 7);
      const hasStripe = state.ballsOnTable.some((id) => id >= 9 && id <= 15);
      if (hasSolid && hasStripe) return ['SOLID', 'STRIPE'];
      const canClaimClearedGroup = profile === 'standard' && !state.breakInProgress && state.ballsOnTable.includes(8);
      if (hasSolid) return canClaimClearedGroup ? ['SOLID', 'BLACK'] : ['SOLID'];
      if (hasStripe) return canClaimClearedGroup ? ['STRIPE', 'BLACK'] : ['STRIPE'];
      return state.ballsOnTable.includes(8) ? ['BLACK'] : [];
    }
    if (assignment === 'SOLID') {
      const hasSolid = state.ballsOnTable.some((id) => id >= 1 && id <= 7);
      return hasSolid ? ['SOLID'] : state.ballsOnTable.includes(8) ? ['BLACK'] : [];
    }
    const hasStripe = state.ballsOnTable.some((id) => id >= 9 && id <= 15);
    return hasStripe ? ['STRIPE'] : state.ballsOnTable.includes(8) ? ['BLACK'] : [];
  }

  private applyNineBallShot(state: FrameState, events: ShotEvent[], context: ShotContext): FrameState {
    const meta = state.meta as PoolMeta | undefined;
    const previous = meta && meta.variant === '9ball' && meta.state ? meta : null;
    const ruleProfile = previous?.ruleProfile ?? this.ruleProfile;
    const game = new NineBall({ profile: ruleProfile });
    if (previous) {
      applyNineState(game, previous.state);
    } else {
      game.state.ballInHand = true;
    }
    const contactOrder: number[] = [];
    for (const ev of events) {
      if (ev.type !== 'HIT') continue;
      const id = normalizePoolBallId(ev.ballId ?? ev.firstContact);
      contactOrder.push(id ?? 0);
    }
    const potted: number[] = [];
    for (const ev of events) {
      if (ev.type !== 'POTTED') continue;
      if (isCueBallId(ev.ballId ?? ev.ball)) {
        potted.push(0);
      } else {
        const id = normalizePoolBallId(ev.ballId ?? ev.ball);
        if (id != null) potted.push(id);
      }
    }
    const result = game.shotTaken({
      contactOrder: context.contactMade === false ? [] : contactOrder,
      foulReason: events.find((event) => event.type === 'FOUL')?.reason,
      potted,
      offTable: context.offTableBallIds,
      pushOut: context.pushOut,
      cueOffTable: Boolean(context.cueBallPotted),
      placedFromHand: Boolean(context.placedFromHand),
      noCushionAfterContact: poolShotHasNoCushion(context),
      railContactsAfterFirstHit: Number(context.railContactCountAfterContact ?? 0),
      objectBallsToRailAfterContact: context.objectBallsToRailAfterContact
    });
    const pottedCount = result.potted.filter((id) => id !== 0).length;
    const snapshot = serializeNineState(game.state);
    const lowest = lowestBall(snapshot.ballsOnTable);
    const foulWarning = ruleProfile === 'standard' && !snapshot.gameOver && snapshot.foulStreak[snapshot.currentPlayer] === 2
      ? ' · 2 fouls: next foul loses' : '';
    const hud: HudInfo = {
      next: snapshot.gameOver ? 'frame over' : snapshot.pushOutPending ? 'push out · accept or return'
        : (lowest != null ? `ball ${lowest}` : 'nine') + foulWarning,
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
        ruleProfile,
        state: snapshot,
        hud,
        breakInProgress: Boolean(snapshot.breakInProgress)
      } satisfies PoolMeta
    };
    return nextState;
  }
}

export default PoolRoyaleRules;
