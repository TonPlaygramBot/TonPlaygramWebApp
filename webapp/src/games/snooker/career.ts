import type { FrameState } from '../../../../src/types';

export type Tier = 'club' | 'qualifying' | 'professional';
export type Rival = { id: string; name: string; rating: number; style: string };
export type Pairing = {
  a: string;
  b: string;
  winner?: string;
  score?: [number, number];
};
export type CareerEvent = {
  name: string;
  venue: string;
  rounds: number[];
  purse: number;
};
export type CareerMatch = {
  id: string;
  round: number;
  opponent: string;
  bestOf: number;
  frames: [number, number];
  frameNumber: number;
  checkpoint?: { frame: FrameState; layout: unknown[] };
};
export type Career = {
  version: 1;
  name: string;
  season: number;
  tier: Tier;
  eventIndex: number;
  titles: number;
  matchesWon: number;
  framesWon: number;
  framesPlayed: number;
  highestBreak: number;
  ledger: { season: number; event: string; points: number; finish: string }[];
  draw?: Pairing[][];
  match?: CareerMatch;
  completedFrames: string[];
  lastResult?: {
    event: string;
    finish: string;
    points: number;
    champion: string;
  };
};
export const CAREER_STORAGE_KEY = 'snookerRoyalCareer.v1';
export const RIVALS: Rival[] = [
  { id: 'ellis', name: 'Tom Ellis', rating: 0.32, style: 'Steady club player' },
  { id: 'chen', name: 'Leo Chen', rating: 0.42, style: 'Attacking potter' },
  { id: 'owen', name: 'Rhys Owen', rating: 0.48, style: 'Safety specialist' },
  { id: 'khan', name: 'Amir Khan', rating: 0.56, style: 'Long-pot specialist' },
  { id: 'novak', name: 'Luka Novak', rating: 0.64, style: 'Patient tactician' },
  { id: 'reid', name: 'Jack Reid', rating: 0.72, style: 'Break builder' },
  { id: 'liu', name: 'Daniel Liu', rating: 0.8, style: 'All-round contender' },
  { id: 'price', name: 'Oliver Price', rating: 0.89, style: 'Tour champion' }
];
const venues = [
  'The Royal Club',
  'North Hall',
  'Riverside Arena',
  'Crown Theatre'
];
export function calendar(tier: Tier): CareerEvent[] {
  const names =
    tier === 'club'
      ? [
          'Club Open',
          'County Challenge',
          'Regional Cup',
          'Amateur Championship'
        ]
      : tier === 'qualifying'
        ? ['Q Series One', 'Q Series Two', 'Q Series Three', 'Tour Card Final']
        : [
            'Tour Open',
            'Players Trophy',
            'Royal Masters',
            'World Championship'
          ];
  return names.map((name, i) => ({
    name,
    venue: venues[i],
    rounds:
      tier === 'club'
        ? [3, 3, 5]
        : tier === 'qualifying'
          ? [5, 5, 7]
          : i === 3
            ? [9, 11, 19]
            : [5, 7, 9],
    purse:
      (tier === 'club' ? 1000 : tier === 'qualifying' ? 5000 : 25000) * (i + 1)
  }));
}
export function createCareer(name = 'Player'): Career {
  return {
    version: 1,
    name: name.trim().slice(0, 32) || 'Player',
    season: 1,
    tier: 'club',
    eventIndex: 0,
    titles: 0,
    matchesWon: 0,
    framesWon: 0,
    framesPlayed: 0,
    highestBreak: 0,
    ledger: [],
    completedFrames: []
  };
}
export function loadCareer(storage?: Pick<Storage, 'getItem'>): Career {
  try {
    const raw = (storage ?? window.localStorage).getItem(CAREER_STORAGE_KEY);
    if (!raw) return createCareer();
    const c = JSON.parse(raw);
    if (
      c.version !== 1 ||
      !['club', 'qualifying', 'professional'].includes(c.tier) ||
      !Number.isInteger(c.season) ||
      c.season < 1 ||
      !Number.isInteger(c.eventIndex) ||
      c.eventIndex < 0 ||
      c.eventIndex > 4 ||
      !Array.isArray(c.ledger) ||
      !Array.isArray(c.completedFrames) ||
      typeof c.name !== 'string'
    )
      return createCareer();
    if (
      [
        'titles',
        'matchesWon',
        'framesWon',
        'framesPlayed',
        'highestBreak'
      ].some((key) => !Number.isFinite(c[key]) || c[key] < 0) ||
      c.ledger.some(
        (e: any) =>
          !Number.isInteger(e.season) ||
          !Number.isFinite(e.points) ||
          e.points < 0
      )
    )
      return createCareer();
    if (
      c.match &&
      (!c.draw ||
        !RIVALS.some((r) => r.id === c.match.opponent) ||
        !Array.isArray(c.match.frames) ||
        c.match.frames.length !== 2 ||
        c.match.frames.some((n: number) => !Number.isInteger(n) || n < 0) ||
        ![3, 5, 7, 9, 11, 19].includes(c.match.bestOf) ||
        !Number.isInteger(c.match.frameNumber) ||
        c.match.frameNumber < 1 ||
        !Array.isArray(c.draw[c.match.round]))
    )
      return createCareer();
    return c;
  } catch {
    return createCareer();
  }
}
export function saveCareer(
  career: Career,
  storage?: Pick<Storage, 'setItem'>
): boolean {
  try {
    (storage ?? window.localStorage).setItem(
      CAREER_STORAGE_KEY,
      JSON.stringify(career)
    );
    return true;
  } catch {
    return false;
  }
}
export function rankingPoints(c: Career): number {
  return c.ledger
    .filter((e) => e.season >= c.season - 1)
    .reduce((sum, e) => sum + e.points, 0);
}
export function ranking(c: Career) {
  const points = rankingPoints(c);
  return [
    { id: 'player', name: c.name, points },
    ...RIVALS.map((r) => ({
      id: r.id,
      name: r.name,
      points: Math.round(
        r.rating *
          r.rating *
          (c.tier === 'professional'
            ? 400000
            : c.tier === 'qualifying'
              ? 80000
              : 16000)
      )
    }))
  ].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}
export function currentEvent(c: Career) {
  return calendar(c.tier)[c.eventIndex];
}
export function frameId(c: Career) {
  return c.match ? `${c.match.id}:f${c.match.frameNumber}` : '';
}
export function roundName(round: number) {
  return ['Quarter-final', 'Semi-final', 'Final'][round] ?? 'Final';
}
function makeMatch(c: Career, round: number, pair: Pairing): CareerMatch {
  return {
    id: `s${c.season}:e${c.eventIndex}:r${round}`,
    round,
    opponent: pair.a === 'player' ? pair.b : pair.a,
    bestOf: currentEvent(c).rounds[round],
    frames: [0, 0],
    frameNumber: 1
  };
}
export function enterEvent(c: Career): Career {
  if (c.match || c.eventIndex >= 4) return c;
  const next: Career = structuredClone(c);
  const offset = (c.season + c.eventIndex) % RIVALS.length;
  const entrants = [
    'player',
    ...Array.from(
      { length: 7 },
      (_, i) => RIVALS[(offset + i) % RIVALS.length].id
    )
  ];
  next.draw = [
    Array.from({ length: 4 }, (_, i) => ({
      a: entrants[i * 2],
      b: entrants[i * 2 + 1]
    }))
  ];
  next.match = makeMatch(next, 0, next.draw[0][0]);
  delete next.lastResult;
  return next;
}
function simulationWinner(pair: Pairing, seed: number): string {
  const rating = (id: string) => RIVALS.find((r) => r.id === id)?.rating ?? 0.5;
  const roll = (((Math.sin(seed * 9301 + 49297) * 10000) % 1) + 1) % 1;
  return roll < rating(pair.a) / (rating(pair.a) + rating(pair.b))
    ? pair.a
    : pair.b;
}
function finishRound(c: Career, round: number): string | undefined {
  const pairs = c.draw![round];
  const winners = pairs.map((p, i) => {
    if (!p.winner)
      p.winner = simulationWinner(
        p,
        c.season * 100 + c.eventIndex * 10 + round * 4 + i
      );
    return p.winner;
  });
  if (winners.length === 1) return winners[0];
  c.draw![round + 1] = Array.from({ length: winners.length / 2 }, (_, i) => ({
    a: winners[i * 2],
    b: winners[i * 2 + 1]
  }));
}
export function completeCareerFrame(
  c: Career,
  id: string,
  frame: FrameState
): Career {
  if (
    !c.match ||
    id !== frameId(c) ||
    c.completedFrames.includes(id) ||
    !frame.frameOver ||
    !['A', 'B'].includes(frame.winner ?? '')
  )
    return c;
  const next: Career = structuredClone(c),
    m = next.match!;
  next.completedFrames.push(id);
  next.completedFrames = next.completedFrames.slice(-256);
  next.framesPlayed++;
  const win = frame.winner === 'A';
  m.frames[win ? 0 : 1]++;
  if (win) next.framesWon++;
  next.highestBreak = Math.max(
    next.highestBreak,
    frame.players.A.highestBreak ?? 0
  );
  delete m.checkpoint;
  m.frameNumber++;
  if (Math.max(...m.frames) < Math.ceil(m.bestOf / 2)) return next;
  const won = m.frames[0] > m.frames[1];
  const pair = next.draw![m.round].find(
    (p) => p.a === 'player' || p.b === 'player'
  )!;
  pair.winner = won ? 'player' : m.opponent;
  pair.score = pair.a === 'player' ? [...m.frames] : [m.frames[1], m.frames[0]];
  if (won) next.matchesWon++;
  let champion = finishRound(next, m.round);
  if (won && !champion) {
    const round = m.round + 1;
    next.match = makeMatch(
      next,
      round,
      next.draw![round].find((p) => p.a === 'player' || p.b === 'player')!
    );
    return next;
  }
  for (let r = m.round + 1; !champion; r++) champion = finishRound(next, r);
  const event = currentEvent(next);
  const finish = won
    ? 'Champion'
    : ['Quarter-final', 'Semi-final', 'Runner-up'][m.round];
  const points = Math.round(
    event.purse * (won ? 1 : [0.1, 0.25, 0.5][m.round])
  );
  if (won) next.titles++;
  next.ledger.push({ season: next.season, event: event.name, points, finish });
  next.lastResult = { event: event.name, finish, points, champion };
  next.eventIndex++;
  delete next.match;
  return next;
}
export function nextSeason(c: Career): Career {
  if (c.eventIndex < 4 || c.match) return c;
  const next = structuredClone(c);
  const titlesThisSeason = c.ledger.filter(
    (e) => e.season === c.season && e.finish === 'Champion'
  ).length;
  if (titlesThisSeason >= 1 && c.tier === 'club') next.tier = 'qualifying';
  if (titlesThisSeason >= 2 && c.tier === 'qualifying')
    next.tier = 'professional';
  next.season++;
  next.eventIndex = 0;
  delete next.draw;
  delete next.lastResult;
  next.ledger = next.ledger.filter((e) => e.season >= next.season - 1);
  return next;
}
export function saveCheckpoint(
  c: Career,
  id: string,
  frame: FrameState,
  layout: unknown[]
): Career {
  if (
    !c.match ||
    id !== frameId(c) ||
    frame.frameOver ||
    !Array.isArray(layout)
  )
    return c;
  const next = structuredClone(c);
  next.match!.checkpoint = {
    frame: structuredClone(frame),
    layout: structuredClone(layout)
  };
  next.highestBreak = Math.max(
    next.highestBreak,
    frame.players.A.highestBreak ?? 0
  );
  return next;
}
/** Progression affects execution accuracy, never ball physics or pot acceptance. */
export function careerAimError(c: Career, random = Math.random): number {
  const rival = RIVALS.find((r) => r.id === c.match?.opponent);
  const skill = Math.min(
    0.98,
    (rival?.rating ?? 0.5) *
      (c.tier === 'club' ? 0.6 : c.tier === 'qualifying' ? 0.82 : 1)
  );
  return (random() - 0.5) * (1 - skill) * 0.035;
}
