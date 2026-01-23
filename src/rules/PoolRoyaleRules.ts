import { FrameState, Player, ShotContext, ShotEvent } from '../types';
import { UkPool } from '../../lib/poolUk8Ball.js';
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
  ballInHand: boolean;
  isOpenTable: boolean;
  lastEvent: string | null;
  frameOver: boolean;
  winner: 'A' | 'B' | null;
};

type AmericanGroup = 'solid' | 'stripe';

type AmericanSerializedState = {
  ballsOnTable: {
    solids: number[];
    stripes: number[];
    black8: boolean;
    cueInPocket: boolean;
  };
  assignments: { A: AmericanGroup | null; B: AmericanGroup | null };
  currentPlayer: 'A' | 'B';
  ballInHand: boolean;
  isOpenTable: boolean;
  frameOver: boolean;
  winner: 'A' | 'B' | null;
  scores: { A: number; B: number };
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
    ballInHand: state.ballInHand,
    isOpenTable: state.isOpenTable,
    lastEvent: state.lastEvent,
    frameOver: state.frameOver,
    winner: state.winner
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
    ballInHand: snapshot.ballInHand,
    isOpenTable: snapshot.isOpenTable,
    lastEvent: snapshot.lastEvent,
    frameOver: snapshot.frameOver,
    winner: snapshot.winner
  };
}

function createAmericanState(): AmericanSerializedState {
  return {
    ballsOnTable: {
      solids: [1, 2, 3, 4, 5, 6, 7],
      stripes: [9, 10, 11, 12, 13, 14, 15],
      black8: true,
      cueInPocket: false
    },
    assignments: { A: null, B: null },
    currentPlayer: 'A',
    ballInHand: true,
    isOpenTable: true,
    frameOver: false,
    winner: null,
    scores: { A: 0, B: 0 }
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
    if (value === 0) return 'cue';
    if (value === 8) return 'black';
    if (value >= 1 && value <= 7) return 'blue';
    if (value >= 9 && value <= 15) return 'red';
  }
  if (typeof value !== 'string') return null;
  const lower = value.toLowerCase();
  if (lower === 'cue' || lower === 'cue_ball') return 'cue';
  if (lower.startsWith('yellow') || lower.startsWith('blue')) return 'blue';
  if (lower.startsWith('red')) return 'red';
  if (lower.startsWith('black')) return 'black';
  const numericMatch = lower.match(/ball_(\d+)/) ?? lower.match(/(\d+)/);
  if (!numericMatch) return null;
  const num = Number.parseInt(numericMatch[1], 10);
  if (num === 0) return 'cue';
  if (num === 8) return 'black';
  if (num >= 1 && num <= 7) return 'blue';
  if (num >= 9 && num <= 15) return 'red';
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
    const previous = meta && meta.variant === 'american' && meta.state ? meta.state : null;
    const snapshot: AmericanSerializedState = previous
      ? {
          ...previous,
          ballsOnTable: {
            solids: [...previous.ballsOnTable.solids],
            stripes: [...previous.ballsOnTable.stripes],
            black8: previous.ballsOnTable.black8,
            cueInPocket: previous.ballsOnTable.cueInPocket
          },
          assignments: { ...previous.assignments },
          scores: { ...previous.scores }
        }
      : createAmericanState();

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

    const current = snapshot.currentPlayer;
    const opp = current === 'A' ? 'B' : 'A';
    const solids = new Set(snapshot.ballsOnTable.solids);
    const stripes = new Set(snapshot.ballsOnTable.stripes);
    let black8 = snapshot.ballsOnTable.black8;
    let foul = false;
    let reason = '';
    const scratched = potted.includes(0) || Boolean(context.cueBallPotted);
    const firstContact = contactOrder[0] ?? null;
    const groupFromNumber = (num: number | null): AmericanGroup | 'black' | null => {
      if (num == null) return null;
      if (num === 8) return 'black';
      if (num >= 1 && num <= 7) return 'solid';
      if (num >= 9 && num <= 15) return 'stripe';
      return null;
    };
    const firstGroup = groupFromNumber(firstContact);
    const ownGroup = snapshot.assignments[current];
    const ownRemaining =
      ownGroup === 'solid' ? solids.size : ownGroup === 'stripe' ? stripes.size : 0;
    const hasSolids = solids.size > 0;
    const hasStripes = stripes.size > 0;
    const pottedGroups = potted
      .filter((id) => id !== 0)
      .map((id) => groupFromNumber(id));
    const pottedSolids = pottedGroups.filter((entry) => entry === 'solid').length;
    const pottedStripes = pottedGroups.filter((entry) => entry === 'stripe').length;
    const blackPotted = pottedGroups.some((entry) => entry === 'black');

    if (!firstContact) {
      foul = true;
      reason = 'no contact';
    }
    if (!foul && scratched) {
      foul = true;
      reason = 'scratch';
    }
    if (!foul) {
      if (snapshot.isOpenTable) {
        if (firstGroup === 'black' && hasSolids && hasStripes) {
          foul = true;
          reason = 'contacted black early';
        }
      } else if (ownGroup) {
        if (firstGroup !== ownGroup) {
          if (firstGroup === 'black' && ownRemaining === 0) {
            // legal: cleared own group
          } else {
            foul = true;
            reason = 'wrong first contact';
          }
        }
      } else if (firstGroup === 'black') {
        foul = true;
        reason = 'contacted black early';
      }
    }

    if (!foul && blackPotted) {
      const openIllegal = snapshot.isOpenTable && hasSolids && hasStripes;
      if (openIllegal || (ownGroup && ownRemaining > 0)) {
        foul = true;
        reason = 'potted black early';
      }
    }

    // apply pot removals (balls stay down even on foul)
    potted.forEach((id) => {
      if (id === 0) {
        snapshot.ballsOnTable.cueInPocket = true;
        return;
      }
      const group = groupFromNumber(id);
      if (group === 'solid') solids.delete(id);
      if (group === 'stripe') stripes.delete(id);
      if (group === 'black') black8 = false;
    });

    // assign groups on open table
    if (!foul && snapshot.isOpenTable) {
      if (pottedSolids > 0 && pottedStripes === 0) {
        snapshot.assignments[current] = 'solid';
        snapshot.assignments[opp] = 'stripe';
        snapshot.isOpenTable = false;
      } else if (pottedStripes > 0 && pottedSolids === 0) {
        snapshot.assignments[current] = 'stripe';
        snapshot.assignments[opp] = 'solid';
        snapshot.isOpenTable = false;
      }
    }

    let nextPlayer = current;
    let winner: FrameState['winner'];
    let frameOver = snapshot.frameOver;
    let ballInHand = false;

    if (foul) {
      nextPlayer = opp;
      ballInHand = true;
      if (blackPotted) {
        frameOver = true;
        winner = opp;
      }
    } else if (blackPotted) {
      frameOver = true;
      winner = current;
    } else {
      const objectPotted = pottedSolids + pottedStripes > 0;
      const assignedGroup = snapshot.assignments[current];
      const potOwn =
        assignedGroup === 'solid'
          ? pottedSolids > 0
          : assignedGroup === 'stripe'
            ? pottedStripes > 0
            : false;
      if (!(objectPotted && (snapshot.isOpenTable || potOwn))) {
        nextPlayer = opp;
      }
    }

    if (!foul) {
      const pottedCount = pottedSolids + pottedStripes + (blackPotted ? 1 : 0);
      if (pottedCount > 0) {
        snapshot.scores[current] = (snapshot.scores[current] ?? 0) + pottedCount;
      }
    }

    snapshot.currentPlayer = nextPlayer;
    snapshot.ballInHand = ballInHand;
    snapshot.frameOver = frameOver;
    snapshot.winner = winner ?? null;
    snapshot.ballsOnTable = {
      solids: Array.from(solids.values()),
      stripes: Array.from(stripes.values()),
      black8,
      cueInPocket: snapshot.ballsOnTable.cueInPocket
    };

    const ballOn = (() => {
      if (frameOver) return [];
      const activeSolids = snapshot.ballsOnTable.solids.length > 0;
      const activeStripes = snapshot.ballsOnTable.stripes.length > 0;
      const assignment = snapshot.assignments[nextPlayer];
      if (snapshot.isOpenTable || !assignment) {
        const options = [];
        if (activeSolids) options.push('SOLID');
        if (activeStripes) options.push('STRIPE');
        if (options.length === 0 && snapshot.ballsOnTable.black8) options.push('BLACK');
        return options;
      }
      if (assignment === 'solid' && activeSolids) return ['SOLID'];
      if (assignment === 'stripe' && activeStripes) return ['STRIPE'];
      if (snapshot.ballsOnTable.black8) return ['BLACK'];
      return [];
    })();

    const hud: HudInfo = {
      next: ballOn.length === 0 ? 'black' : ballOn.map((entry) => entry.toLowerCase()).join(' / '),
      phase: frameOver ? 'complete' : snapshot.isOpenTable ? 'open' : 'groups',
      scores: { ...snapshot.scores }
    };

    const nextState: FrameState = {
      ...state,
      activePlayer: nextPlayer,
      players: {
        A: { ...state.players.A, score: snapshot.scores.A },
        B: { ...state.players.B, score: snapshot.scores.B }
      },
      currentBreak:
        !foul && nextPlayer === state.activePlayer && potted.length > 0
          ? (state.currentBreak ?? 0) + potted.length
          : 0,
      ballOn,
      frameOver,
      winner,
      foul: foul
        ? {
            points: 0,
            reason: reason || 'foul'
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
