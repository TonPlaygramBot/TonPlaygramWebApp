import { Ball, BallColor, FrameState, Player, ShotContext, ShotEvent } from '../types';
import { BilardoShqipRules } from './BilardoShqipRules';

type BilardoMeta = {
  variant: 'bilardo-shqip';
  hud: {
    next: string;
    phase: string;
    scores: { A: number; B: number };
  };
  state: {
    ballInHand: boolean;
  };
  bilardoSnapshot?: ReturnType<BilardoShqipRules['getSnapshot']>;
};

const COLOR_TO_NUMBER: Partial<Record<BallColor, number>> = {
  RED: 1,
  YELLOW: 2,
  GREEN: 3,
  BROWN: 4,
  BLUE: 5,
  PINK: 6,
  BLACK: 7
};

function buildInitialBalls(): Ball[] {
  const reds = Array.from({ length: 15 }, (_, index) => ({
    id: `RED_${index + 1}`,
    color: 'RED' as BallColor,
    onTable: true,
    potted: false
  }));
  const colors: Ball[] = ['YELLOW', 'GREEN', 'BROWN', 'BLUE', 'PINK', 'BLACK'].map((color) => ({
    id: color,
    color: color as BallColor,
    onTable: true,
    potted: false
  }));
  return [...reds, ...colors, { id: 'CUE', color: 'CUE', onTable: true, potted: false }];
}

function normalizeNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const rounded = Math.round(raw);
    return rounded >= 1 && rounded <= 15 ? rounded : null;
  }
  if (typeof raw !== 'string') return null;
  const text = raw.trim().toUpperCase();
  const idMatch = text.match(/(?:RED_|BALL_)?(\d{1,2})$/);
  if (idMatch) {
    const parsed = Number(idMatch[1]);
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= 15 ? parsed : null;
  }
  return (COLOR_TO_NUMBER[text as BallColor] as number | undefined) ?? null;
}

function basePlayers(playerA: string, playerB: string): { A: Player; B: Player } {
  return {
    A: { id: 'A', name: playerA, score: 0 },
    B: { id: 'B', name: playerB, score: 0 }
  };
}

export class SnookerRoyalBilardoAdapter {
  constructor(private readonly raceTo = 61) {}

  getInitialFrame(playerA: string, playerB: string): FrameState {
    const rules = new BilardoShqipRules(this.raceTo);
    const snapshot = rules.getSnapshot();
    return {
      balls: buildInitialBalls(),
      activePlayer: snapshot.currentPlayer,
      players: basePlayers(playerA, playerB),
      currentBreak: 0,
      phase: 'OPENING',
      redsRemaining: 15,
      ballOn: [String(snapshot.nextRequiredBall ?? 'open')],
      freeBall: false,
      colorOnAfterRed: false,
      frameOver: false,
      winner: undefined,
      meta: {
        variant: 'bilardo-shqip',
        hud: {
          next: `Ball ${snapshot.nextRequiredBall ?? '-'}`,
          phase: 'bilardo-shqip',
          scores: snapshot.scores
        },
        state: {
          ballInHand: snapshot.cueBallInHand
        },
        bilardoSnapshot: snapshot
      } satisfies BilardoMeta
    };
  }

  applyShot(state: FrameState, events: ShotEvent[], context: ShotContext = {}): FrameState {
    const meta = (state.meta as BilardoMeta | undefined) ?? undefined;
    const snapshot = meta?.bilardoSnapshot;
    const rules = new BilardoShqipRules(snapshot?.raceTo ?? this.raceTo);
    rules.applySnapshot(snapshot);

    const hitEvent = events.find((event) => event.type === 'HIT') as
      | { type: 'HIT'; firstContact?: unknown; ballId?: unknown }
      | undefined;
    const firstContact = normalizeNumber(hitEvent?.firstContact ?? hitEvent?.ballId);

    const potted = events
      .filter((event) => event.type === 'POTTED')
      .map((event) => {
        const pottedEvent = event as { type: 'POTTED'; ball?: unknown; ballId?: unknown };
        return normalizeNumber(pottedEvent.ballId ?? pottedEvent.ball);
      })
      .filter((value): value is number => Number.isFinite(value));

    const cueBallPotted = Boolean(context.cueBallPotted) || events.some((event) => {
      if (event.type !== 'POTTED') return false;
      const pottedEvent = event as { ball?: unknown; ballId?: unknown };
      return String(pottedEvent.ball ?? pottedEvent.ballId ?? '').toUpperCase() === 'CUE';
    });

    const result = rules.resolveShot({
      firstContact,
      potted,
      cueBallPotted
    });

    const nextSnapshot = rules.getSnapshot();
    const nextPlayers = {
      A: { ...(state.players?.A ?? { id: 'A', name: 'A', score: 0 }), score: result.scores.A },
      B: { ...(state.players?.B ?? { id: 'B', name: 'B', score: 0 }), score: result.scores.B }
    };

    return {
      ...state,
      players: nextPlayers,
      activePlayer: result.nextPlayer,
      currentBreak: result.keepTurn ? (state.currentBreak ?? 0) + result.scored : 0,
      ballOn: [String(nextSnapshot.nextRequiredBall ?? 'open')],
      foul: result.foul
        ? {
            points: 4,
            reason: result.reason || 'foul'
          }
        : undefined,
      frameOver: Boolean(result.winner),
      winner: result.winner ?? undefined,
      meta: {
        variant: 'bilardo-shqip',
        hud: {
          next: `Ball ${nextSnapshot.nextRequiredBall ?? '-'}`,
          phase: 'bilardo-shqip',
          scores: result.scores
        },
        state: {
          ballInHand: result.cueBallInHand
        },
        bilardoSnapshot: nextSnapshot
      } satisfies BilardoMeta
    };
  }
}

export default SnookerRoyalBilardoAdapter;
