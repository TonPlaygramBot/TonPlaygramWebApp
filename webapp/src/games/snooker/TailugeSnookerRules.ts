/*! @license GPL-3.0-only — controller/rules/snooker.ts adapted from tailuge/billiards.
 * Browser Session/Controller side effects are replaced by Royal's serializable FrameState.
 * See vendor/tailuge/NOTICE.md for source and local rule corrections.
 */
import { Vector3 } from 'three';
import type {
  BallColor,
  FrameState,
  ShotContext,
  ShotEvent
} from '../../../../src/types';
import { Ball, State } from './vendor/tailuge/model/ball';
import { Table } from './vendor/tailuge/model/table';
import { Outcome } from './vendor/tailuge/model/outcome';
import { SnookerUtils } from './vendor/tailuge/controller/rules/snookerutils';
import { ballColour, COLOURS } from './TailugePhysics';
const ORDER: BallColor[] = [
  'YELLOW',
  'GREEN',
  'BROWN',
  'BLUE',
  'PINK',
  'BLACK'
];
const value = (c: string) =>
  c === 'CUE'
    ? 0
    : c === 'RED'
      ? 1
      : Math.max(0, COLOURS.indexOf(c as (typeof COLOURS)[number]) + 1);

function finish(
  state: FrameState,
  inHand: boolean,
  respottedBlack = false
): FrameState {
  const colours = ORDER.filter((c) =>
    state.balls.some((b) => b.color === c && b.onTable)
  );
  state.redsRemaining = state.balls.filter(
    (b) => b.color === 'RED' && b.onTable
  ).length;
  state.phase =
    state.redsRemaining || state.colorOnAfterRed
      ? 'REDS_AND_COLORS'
      : 'COLORS_ORDER';
  state.ballOn = state.frameOver
    ? []
    : state.colorOnAfterRed
      ? colours
      : state.redsRemaining
        ? ['RED']
        : colours.slice(0, 1);
  state.meta = {
    ...state.meta,
    variant: 'snooker',
    engine: 'tailuge-b446544',
    colorsRemaining: colours,
    respottedBlack: respottedBlack || Boolean(state.meta?.respottedBlack),
    freeBall: Boolean(state.freeBall),
    state: { ballInHand: inHand },
    hud: {
      next: state.frameOver
        ? 'frame over'
        : state.ballOn.map((c) => c.toLowerCase()).join(' / '),
      phase: state.phase === 'COLORS_ORDER' ? 'colors' : 'reds',
      scores: { A: state.players.A.score, B: state.players.B.score }
    }
  };
  return state;
}

export class TailugeSnookerRules {
  constructor(_variant?: string) {}
  getInitialFrame(playerA: string, playerB: string): FrameState {
    return finish(
      {
        balls: [
          ...Array.from({ length: 15 }, (_, i) => ({
            id: `RED_${i + 1}`,
            color: 'RED' as BallColor,
            onTable: true,
            potted: false
          })),
          ...ORDER.map((color) => ({
            id: color,
            color,
            onTable: true,
            potted: false
          })),
          { id: 'CUE', color: 'CUE', onTable: true, potted: false }
        ],
        players: {
          A: { id: 'A', name: playerA, score: 0 },
          B: { id: 'B', name: playerB, score: 0 }
        },
        activePlayer: 'A',
        currentBreak: 0,
        phase: 'REDS_AND_COLORS',
        redsRemaining: 15,
        colorOnAfterRed: false,
        freeBall: false,
        ballOn: ['RED'],
        frameOver: false
      },
      false
    );
  }
  applyShot(
    state: FrameState,
    events: ShotEvent[],
    context: ShotContext = {}
  ): FrameState {
    if (state.frameOver) return state;
    const next: FrameState = {
      ...state,
      balls: state.balls.map((b) => ({ ...b })),
      players: { A: { ...state.players.A }, B: { ...state.players.B } },
      foul: undefined,
      winner: undefined
    };
    const shooter = state.activePlayer,
      opponent = shooter === 'A' ? 'B' : 'A';
    const ordered = [...next.balls].sort(
      (a, b) =>
        (a.color === 'RED' ? 7 : COLOURS.indexOf(a.color)) -
        (b.color === 'RED' ? 7 : COLOURS.indexOf(b.color))
    );
    const model = ordered.map((b, i) => {
      const ball = new Ball(new Vector3(), undefined, undefined, undefined, i);
      ball.state = b.onTable ? State.Stationary : State.InPocket;
      return ball;
    });
    const table = new Table(model);
    const hit = events.find(
      (e): e is Extract<ShotEvent, { type: 'HIT' }> => e.type === 'HIT'
    );
    const first = hit?.firstContact
      ? ballColour(String(hit.firstContact))
      : hit?.ballId
        ? ballColour(String(hit.ballId))
        : null;
    const nominationRaw = context.declaredBall ?? context.nominatedBall;
    const nomination = nominationRaw ? ballColour(nominationRaw) : null;
    const onRed = state.redsRemaining > 0 && !state.colorOnAfterRed;
    const colours = ORDER.filter((c) =>
      state.balls.some((b) => b.color === c && b.onTable)
    );
    const target = onRed
      ? 'RED'
      : state.colorOnAfterRed
        ? (nomination ?? first)
        : colours[0];
    const freeBall = Boolean(state.freeBall || context.freeBall);
    const firstIndex = ordered.findIndex((b) => b.color === first && b.onTable);
    const outcomes: Outcome[] =
      firstIndex >= 0
        ? [Outcome.collision(model[0], model[firstIndex], 0, 0)]
        : [];
    const potted = new Set<number>();
    for (const event of events) {
      if (event.type !== 'POTTED') continue;
      const colour = ballColour(String(event.ball));
      const exact = ordered.findIndex(
        (b) => b.id.toLowerCase() === String(event.ballId).toLowerCase()
      );
      const index =
        exact >= 0
          ? exact
          : ordered.findIndex(
              (b, i) => b.color === colour && b.onTable && !potted.has(i)
            );
      if (index < 0 || !ordered[index].onTable || potted.has(index)) continue;
      potted.add(index);
      outcomes.push(Outcome.pot(model[index], 0, 0));
    }
    if (context.cueBallPotted && !potted.has(0)) {
      potted.add(0);
      outcomes.push(Outcome.pot(model[0], 0, 0));
    }
    // Upstream checks colour order against table state; retain the PRE-shot table
    // here so a legally potted yellow is still the first colour for first contact.
    const info = SnookerUtils.shotInfo(
      table,
      outcomes,
      onRed,
      Boolean(state.colorOnAfterRed)
    );
    const foul = SnookerUtils.calculateFoul(
      outcomes,
      info,
      value(target ?? '') || 4
    );
    const pots = [...potted].filter((i) => i !== 0);
    const explicit = events.find(
      (e): e is Extract<ShotEvent, { type: 'FOUL' }> => e.type === 'FOUL'
    );
    let reason = explicit?.reason ?? null;
    if (!reason && potted.has(0)) reason = 'White potted';
    if (!reason && (!first || context.contactMade === false))
      reason = 'No ball hit';
    if (!reason && freeBall && (!nomination || nomination === target))
      reason = 'Invalid free-ball nomination';
    if (
      !reason &&
      (freeBall ? first !== nomination : !info.legalFirstCollision)
    )
      reason = 'Wrong first ball';
    if (
      !reason &&
      !freeBall &&
      state.colorOnAfterRed &&
      nomination &&
      first !== nomination
    )
      reason = 'Wrong nominated colour';
    const allowed = freeBall ? [nomination, target] : [target];
    if (!reason && pots.some((i) => !allowed.includes(ordered[i].color)))
      reason = 'Wrong ball potted';
    if (!reason && !onRed && pots.length > (freeBall ? 2 : 1))
      reason = 'Multiple colours potted';
    for (const i of potted) {
      ordered[i].onTable = false;
      ordered[i].potted = true;
    }
    let points = 0;
    if (reason) {
      const penalty = Math.min(
        7,
        Math.max(
          foul.points,
          value(target ?? ''),
          value(nomination ?? ''),
          value(explicit?.ball ?? '')
        )
      );
      next.players[opponent].score += penalty;
      next.foul = {
        points: penalty,
        reason: explicit?.reason ?? foul.reason ?? reason
      };
      next.activePlayer = opponent;
      next.currentBreak = 0;
      next.colorOnAfterRed = false;
    } else if (!pots.length) {
      next.activePlayer = opponent;
      next.currentBreak = 0;
      next.colorOnAfterRed = false;
    } else {
      points = onRed
        ? pots.length
        : pots.reduce(
            (sum, i) =>
              sum + (freeBall ? value(target ?? '') : value(ordered[i].color)),
            0
          );
      next.players[shooter].score += points;
      next.currentBreak = (state.currentBreak ?? 0) + points;
      next.colorOnAfterRed = onRed;
    }
    // Colours return after a red or any foul. Reds always remain off the table.
    for (const i of pots) {
      if (
        ordered[i].color !== 'RED' &&
        (reason ||
          state.colorOnAfterRed ||
          onRed ||
          (freeBall && ordered[i].color === nomination))
      ) {
        ordered[i].onTable = true;
        ordered[i].potted = false;
      }
    }
    const cue = ordered[0];
    cue.onTable = true;
    cue.potted = false;
    next.freeBall = Boolean(reason && context.snookered);
    next.players[shooter].highestBreak = Math.max(
      state.players[shooter].highestBreak ?? 0,
      (state.currentBreak ?? 0) + points
    );
    const onlyBlack =
      !state.redsRemaining &&
      !state.colorOnAfterRed &&
      colours.length === 1 &&
      colours[0] === 'BLACK';
    const blackDecided =
      onlyBlack &&
      (Boolean(reason) || pots.some((i) => ordered[i].color === 'BLACK'));
    let inHand = potted.has(0),
      decidingBlack = false;
    if (blackDecided) {
      if (next.players.A.score === next.players.B.score) {
        const black = ordered.find((b) => b.color === 'BLACK')!;
        black.onTable = true;
        black.potted = false;
        next.activePlayer = context.respottedBlackStarter ?? opponent;
        next.currentBreak = 0;
        next.freeBall = false;
        inHand = true;
        decidingBlack = true;
      } else {
        next.frameOver = true;
        next.winner = next.players.A.score > next.players.B.score ? 'A' : 'B';
      }
    }
    return finish(next, inHand, decidingBlack);
  }
}
