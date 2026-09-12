import {
  awardPoint,
  reviewActive,
  type MatchState,
  type Seat,
  type Shot
} from './engine';

export const STROKES: { value: Shot; label: string; hint: string }[] = [
  { value: 'flat', label: 'Drive', hint: 'Direct, fast return' },
  { value: 'topspin', label: 'Topspin', hint: 'Higher net clearance' },
  { value: 'slice', label: 'Slice', hint: 'Low, slower bounce' },
  { value: 'lob', label: 'Lob', hint: 'Lift over a net player' }
];

/** Use the scoring engine itself so deuce, short sets and tie-breaks agree. */
export function scoreMoment(state: MatchState, own: Seat): string {
  if (state.phase === 'over') return '';
  for (const seat of [own, (1 - own) as Seat]) {
    const score = structuredClone(state.score);
    const result = awardPoint(
      score,
      seat,
      state.config.gamesToWin,
      state.config.setsToWin
    );
    const who = seat === own ? 'Your' : 'Opponent';
    if (result.winner !== null) return `${who} match point`;
    if (result.set) return `${who} set point`;
    if (result.game)
      return seat !== state.score.server
        ? `${who} break point`
        : `${who} game point`;
  }
  const [a, b] = state.score.points;
  return !state.score.tie && a >= 3 && a === b
    ? 'Deuce · win two in a row'
    : '';
}

export function courtCue(
  state: MatchState,
  own: Seat,
  assist: boolean
): string {
  if (reviewActive(state)) return 'Line review · play resumes automatically';
  if (state.phase === 'over') return '';
  if (state.phase === 'point') return 'Reset and get ready for the next point';
  if (state.phase === 'fault')
    return state.fault
      ? state.score.server === own
        ? 'Reset for your second serve'
        : 'Opponent prepares a second serve'
      : 'Let · replay the serve';
  if (state.phase === 'toss') return 'Serve queued · watch the ball';
  if (state.phase === 'serve')
    return state.score.server === own
      ? 'Tap to serve softly · swipe to the opposite service box'
      : 'Watch the serve · swipe as the ball approaches';
  if (state.players[own].queued > state.time)
    return 'Shot queued · ready at your racket';
  if (state.ball.last === own)
    return assist
      ? 'Recovering · watch your opponent'
      : 'Drag to recover into position';
  return 'Ball incoming · swipe toward the open court';
}

export type MatchStats = {
  lastEvent: number;
  shots: [number, number];
  points: [number, number];
};
export const freshStats = (): MatchStats => ({
  lastEvent: 0,
  shots: [0, 0],
  points: [0, 0]
});
/** Event IDs prevent duplicate counts across repeated online snapshots. */
export function collectStats(stats: MatchStats, state: MatchState) {
  for (const event of state.events) {
    if (event.id <= stats.lastEvent) continue;
    stats.lastEvent = event.id;
    if (event.type === 'hit' || event.type === 'serve')
      stats.shots[event.seat]++;
    if (event.type === 'point' || event.type === 'win')
      stats.points[event.seat]++;
  }
}
