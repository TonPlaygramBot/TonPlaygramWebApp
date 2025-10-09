import { Ball, BallColor, FrameState, Player, ShotEvent, ShotContext } from '../types';

type TargetMode = 'RED' | 'COLOUR' | 'SPECIFIC';

interface ShotDescriptor {
  firstContact: BallColor | null;
  pottedBalls: BallColor[];
  cueBallPotted: boolean;
}

const COLOUR_ORDER: BallColor[] = [
  'YELLOW',
  'GREEN',
  'BROWN',
  'BLUE',
  'PINK',
  'BLACK'
];

export class UnitySnookerRules {
  private readonly ballValues: Record<BallColor, number> = {
    RED: 1,
    YELLOW: 2,
    GREEN: 3,
    BROWN: 4,
    BLUE: 5,
    PINK: 6,
    BLACK: 7,
    CUE: 0
  };

  getBallValues(): Record<BallColor, number> {
    return { ...this.ballValues };
  }

  getInitialFrame(playerA: string, playerB: string): FrameState {
    const balls: Ball[] = [];
    for (let i = 0; i < 15; i++) {
      balls.push({
        id: `R${i + 1}`,
        color: 'RED',
        onTable: true,
        potted: false
      });
    }
    const colours: BallColor[] = [
      'YELLOW',
      'GREEN',
      'BROWN',
      'BLUE',
      'PINK',
      'BLACK',
      'CUE'
    ];
    for (const colour of colours) {
      balls.push({
        id: colour,
        color: colour,
        onTable: true,
        potted: false
      });
    }
    const players: { A: Player; B: Player } = {
      A: { id: 'A', name: playerA, score: 0, highestBreak: 0 },
      B: { id: 'B', name: playerB, score: 0, highestBreak: 0 }
    };
    return {
      balls,
      activePlayer: 'A',
      players,
      currentBreak: 0,
      phase: 'REDS_AND_COLORS',
      redsRemaining: 15,
      colorOnAfterRed: false,
      ballOn: ['RED'],
      freeBall: false,
      frameOver: false
    };
  }

  applyShot(state: FrameState, events: ShotEvent[], _context?: ShotContext): FrameState {
    const snapshot = this.cloneState(state);
    const shot = this.describeShot(events);
    const target = this.determineTarget(snapshot);
    const penaltyBase = Math.max(4, this.determineBallOnValue(snapshot, target));

    const foul = this.detectFoul(snapshot, shot, target, penaltyBase);
    if (foul) {
      return this.applyFoul(snapshot, foul.points, foul.reason);
    }

    const result = this.applyLegalShot(snapshot, shot, target);
    return result;
  }

  private cloneState(state: FrameState): FrameState {
    return JSON.parse(JSON.stringify(state));
  }

  private describeShot(events: ShotEvent[]): ShotDescriptor {
    let firstContact: BallColor | null = null;
    const pottedBalls: BallColor[] = [];
    let cueBallPotted = false;
    for (const ev of events) {
      if (ev.type === 'HIT') {
        if (firstContact == null && ev.firstContact != null) {
          const resolved = this.toBallColor(ev.firstContact);
          if (resolved) {
            firstContact = resolved;
          }
        }
      } else if (ev.type === 'POTTED') {
        const resolved = this.toBallColor(ev.ball);
        if (resolved) {
          pottedBalls.push(resolved);
          if (resolved === 'CUE') cueBallPotted = true;
        }
      }
    }
    return { firstContact, pottedBalls, cueBallPotted };
  }

  private toBallColor(value: unknown): BallColor | null {
    if (typeof value !== 'string') return null;
    const upper = value.toUpperCase();
    if ((this.ballValues as Record<string, number>)[upper as BallColor] != null) {
      return upper as BallColor;
    }
    if (upper === 'CUE') return 'CUE';
    return null;
  }

  private determineTarget(state: FrameState): {
    mode: TargetMode;
    specific?: BallColor;
  } {
    if (state.phase === 'COLORS_ORDER') {
      for (const colour of COLOUR_ORDER) {
        const ball = state.balls.find((b) => b.color === colour && b.onTable);
        if (ball) {
          return { mode: 'SPECIFIC', specific: colour };
        }
      }
      return { mode: 'SPECIFIC' };
    }
    if (state.colorOnAfterRed) {
      return { mode: 'COLOUR' };
    }
    return { mode: 'RED' };
  }

  private determineBallOnValue(
    state: FrameState,
    target: { mode: TargetMode; specific?: BallColor }
  ): number {
    if (state.phase === 'COLORS_ORDER') {
      if (target.mode === 'SPECIFIC' && target.specific) {
        return this.ballValues[target.specific];
      }
      return this.ballValues.BLACK;
    }
    if (target.mode === 'COLOUR') {
      let highest = 0;
      for (const colour of COLOUR_ORDER) {
        const ball = state.balls.find((b) => b.color === colour && b.onTable);
        if (ball) {
          highest = Math.max(highest, this.ballValues[colour]);
        }
      }
      return highest || this.ballValues.BLACK;
    }
    return this.ballValues.RED;
  }

  private detectFoul(
    state: FrameState,
    shot: ShotDescriptor,
    target: { mode: TargetMode; specific?: BallColor },
    penaltyBase: number
  ): { points: number; reason: string } | null {
    if (!shot.firstContact) {
      return { points: penaltyBase, reason: 'no ball hit' };
    }

    if (shot.cueBallPotted) {
      return { points: penaltyBase, reason: 'cue ball potted' };
    }

    if (!this.isFirstContactLegal(shot.firstContact, target)) {
      const penalty = Math.max(
        penaltyBase,
        this.ballValues[shot.firstContact] || penaltyBase
      );
      return { points: penalty, reason: 'wrong ball first hit' };
    }

    const illegal = this.illegalPottedBalls(shot.pottedBalls, target);
    if (illegal.length > 0) {
      let maxIllegal = penaltyBase;
      for (const colour of illegal) {
        maxIllegal = Math.max(maxIllegal, this.ballValues[colour] || penaltyBase);
      }
      return { points: maxIllegal, reason: 'ball not on potted' };
    }

    return null;
  }

  private isFirstContactLegal(
    firstContact: BallColor,
    target: { mode: TargetMode; specific?: BallColor }
  ): boolean {
    switch (target.mode) {
      case 'RED':
        return firstContact === 'RED';
      case 'COLOUR':
        return firstContact !== 'RED' && firstContact !== 'CUE';
      case 'SPECIFIC':
        return target.specific ? firstContact === target.specific : false;
      default:
        return false;
    }
  }

  private illegalPottedBalls(
    potted: BallColor[],
    target: { mode: TargetMode; specific?: BallColor }
  ): BallColor[] {
    const illegal: BallColor[] = [];
    for (const colour of potted) {
      if (colour === 'CUE') continue;
      switch (target.mode) {
        case 'RED':
          if (colour !== 'RED') illegal.push(colour);
          break;
        case 'COLOUR':
          if (colour === 'RED') illegal.push(colour);
          break;
        case 'SPECIFIC':
          if (!target.specific || colour !== target.specific) illegal.push(colour);
          break;
      }
    }
    return illegal;
  }

  private applyFoul(state: FrameState, points: number, reason: string): FrameState {
    const next = this.cloneState(state);
    const opponent = next.activePlayer === 'A' ? 'B' : 'A';
    next.players[opponent].score += points;
    next.foul = { points, reason };
    next.activePlayer = opponent;
    next.currentBreak = 0;
    next.freeBall = false;
    if (next.phase === 'REDS_AND_COLORS') {
      next.colorOnAfterRed = false;
    }
    next.ballOn = this.computeBallOn(next);
    return next;
  }

  private applyLegalShot(
    state: FrameState,
    shot: ShotDescriptor,
    target: { mode: TargetMode; specific?: BallColor }
  ): FrameState {
    const next = this.cloneState(state);
    next.foul = undefined;
    let pointsScored = 0;
    let continueTurn = false;

    if (target.mode === 'RED') {
      const redsPotted = shot.pottedBalls.filter((c) => c === 'RED').length;
      if (redsPotted > 0) {
        pointsScored += redsPotted * this.ballValues.RED;
        continueTurn = true;
        this.removeReds(next, redsPotted);
        next.colorOnAfterRed = true;
      }
    } else if (target.mode === 'COLOUR') {
      const colours = shot.pottedBalls.filter((c) => c !== 'RED' && c !== 'CUE');
      for (const colour of colours) {
        pointsScored += this.ballValues[colour] || 0;
        this.reSpotColour(next, colour);
      }
      next.colorOnAfterRed = false;
      continueTurn = colours.length > 0;
      if (next.redsRemaining === 0) {
        next.phase = 'COLORS_ORDER';
      }
    } else if (target.mode === 'SPECIFIC' && target.specific) {
      const madeBall = shot.pottedBalls.includes(target.specific);
      if (madeBall) {
        pointsScored += this.ballValues[target.specific] || 0;
        this.removeColour(next, target.specific);
        continueTurn = true;
      }
    }

    if (pointsScored > 0) {
      const player = next.players[next.activePlayer];
      player.score += pointsScored;
      next.currentBreak = (next.currentBreak || 0) + pointsScored;
      if (!player.highestBreak || player.highestBreak < next.currentBreak) {
        player.highestBreak = next.currentBreak;
      }
    } else {
      next.currentBreak = 0;
    }

    if (!continueTurn || pointsScored === 0) {
      next.activePlayer = next.activePlayer === 'A' ? 'B' : 'A';
      next.currentBreak = 0;
      if (next.phase === 'REDS_AND_COLORS') {
        next.colorOnAfterRed = false;
      }
    }

    if (next.phase === 'COLORS_ORDER') {
      this.updateColourPhase(next);
    }

    next.ballOn = this.computeBallOn(next);
    return next;
  }

  private removeReds(state: FrameState, count: number): void {
    let removed = 0;
    for (const ball of state.balls) {
      if (removed >= count) break;
      if (ball.color === 'RED' && ball.onTable) {
        ball.onTable = false;
        ball.potted = true;
        removed++;
      }
    }
    const remaining = state.balls.filter((b) => b.color === 'RED' && b.onTable).length;
    state.redsRemaining = remaining;
  }

  private reSpotColour(state: FrameState, colour: BallColor): void {
    const ball = state.balls.find((b) => b.color === colour);
    if (ball) {
      ball.onTable = true;
      ball.potted = false;
    }
  }

  private removeColour(state: FrameState, colour: BallColor): void {
    const ball = state.balls.find((b) => b.color === colour);
    if (ball) {
      ball.onTable = false;
      ball.potted = true;
    }
  }

  private updateColourPhase(state: FrameState): void {
    const remaining = COLOUR_ORDER.some((c) =>
      state.balls.some((b) => b.color === c && b.onTable)
    );
    if (!remaining) {
      state.frameOver = true;
      const scoreA = state.players.A.score;
      const scoreB = state.players.B.score;
      state.winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'TIE';
    }
  }

  private computeBallOn(state: FrameState): BallColor[] {
    if (state.frameOver) {
      return [];
    }
    if (state.phase === 'REDS_AND_COLORS') {
      if (state.colorOnAfterRed) {
        return COLOUR_ORDER.filter((colour) =>
          state.balls.some((b) => b.color === colour && b.onTable)
        );
      }
      return ['RED'];
    }
    for (const colour of COLOUR_ORDER) {
      const ball = state.balls.find((b) => b.color === colour && b.onTable);
      if (ball) {
        return [colour];
      }
    }
    return [];
  }
}
