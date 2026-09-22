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
  checkpoint?: { frame: FrameState; layout: unknown[]; revision?: number };
};
export type Career = {
  version: 1;
  runId?: string;
  competition?: { bestOf: number };
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
export const TOURNAMENT_STORAGE_KEY = 'snookerRoyalTournament.v1';
export const TOURNAMENT_FORMATS = [1, 3, 5, 7, 9] as const;
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
    runId:
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
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
const integer = (value: unknown, min = 0) =>
  Number.isSafeInteger(value) && Number(value) >= min;
const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const participant = (id: unknown) =>
  id === 'player' || RIVALS.some((r) => r.id === id);
const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);

function validFrame(frame: unknown): frame is FrameState {
  if (
    !isRecord(frame) ||
    !isRecord(frame.players) ||
    !['A', 'B'].includes(frame.activePlayer) ||
    !['OPENING', 'REDS_AND_COLORS', 'COLORS_ORDER'].includes(frame.phase) ||
    !integer(frame.redsRemaining) ||
    frame.redsRemaining > 15 ||
    typeof frame.frameOver !== 'boolean' ||
    !Array.isArray(frame.ballOn) ||
    frame.ballOn.length > 22 ||
    frame.ballOn.some((ball: unknown) => typeof ball !== 'string') ||
    (frame.currentBreak !== undefined && !integer(frame.currentBreak)) ||
    (frame.meta !== undefined && !isRecord(frame.meta)) ||
    !Array.isArray(frame.balls) ||
    frame.balls.length === 0 ||
    new Set(frame.balls.map((ball: any) => ball?.id)).size !==
      frame.balls.length ||
    frame.balls.length > 22
  )
    return false;
  return (
    ['A', 'B'].every(
      (seat) =>
        isRecord(frame.players[seat]) &&
        typeof frame.players[seat].name === 'string' &&
        typeof frame.players[seat].id === 'string' &&
        integer(frame.players[seat].score) &&
        (frame.players[seat].highestBreak === undefined ||
          integer(frame.players[seat].highestBreak))
    ) &&
    frame.balls.every(
      (ball: any) =>
        isRecord(ball) &&
        typeof ball.id === 'string' &&
        [
          'RED',
          'YELLOW',
          'GREEN',
          'BROWN',
          'BLUE',
          'PINK',
          'BLACK',
          'CUE'
        ].includes(ball.color) &&
        typeof ball.onTable === 'boolean' &&
        typeof ball.potted === 'boolean'
    )
  );
}
function validLayout(layout: unknown): layout is unknown[] {
  return (
    Array.isArray(layout) &&
    layout.length > 0 &&
    layout.length <= 22 &&
    new Set(layout.map((ball) => (isRecord(ball) ? ball.id : undefined)))
      .size === layout.length &&
    layout.every(
      (ball) =>
        isRecord(ball) &&
        (typeof ball.id === 'string' || finite(ball.id)) &&
        typeof ball.active === 'boolean' &&
        isRecord(ball.pos) &&
        finite(ball.pos.x) &&
        finite(ball.pos.y) &&
        (ball.mesh == null ||
          (isRecord(ball.mesh) &&
            ['position', 'scale', 'quaternion'].every(
              (key) =>
                ball.mesh[key] === undefined ||
                (isRecord(ball.mesh[key]) &&
                  (key === 'quaternion'
                    ? ['x', 'y', 'z', 'w']
                    : ['x', 'y', 'z']
                  ).every((axis) => finite(ball.mesh[key][axis])))
            )))
    )
  );
}

/** Reject malformed brackets before a save can feed match/renderer state. */
export function validCareer(
  value: unknown,
  tournament = false
): value is Career {
  if (!isRecord(value)) return false;
  const c = value as Career;
  if (
    c.version !== 1 ||
    !['club', 'qualifying', 'professional'].includes(c.tier) ||
    !integer(c.season, 1) ||
    !integer(c.eventIndex) ||
    c.eventIndex > (tournament ? 1 : 4) ||
    typeof c.name !== 'string' ||
    c.name.length > 32 ||
    (c.runId !== undefined &&
      (typeof c.runId !== 'string' || c.runId.length > 100)) ||
    Boolean(c.competition) !== tournament ||
    (tournament &&
      !TOURNAMENT_FORMATS.includes(c.competition!.bestOf as any)) ||
    !Array.isArray(c.ledger) ||
    c.ledger.length > 100 ||
    !Array.isArray(c.completedFrames) ||
    c.completedFrames.length > 256 ||
    c.completedFrames.some((id) => typeof id !== 'string') ||
    new Set(c.completedFrames).size !== c.completedFrames.length ||
    ['titles', 'matchesWon', 'framesWon', 'framesPlayed', 'highestBreak'].some(
      (key) => !integer((c as any)[key])
    ) ||
    c.framesWon > c.framesPlayed ||
    c.ledger.some(
      (entry) =>
        !isRecord(entry) ||
        !integer(entry.season, 1) ||
        !integer(entry.points) ||
        typeof entry.event !== 'string' ||
        typeof entry.finish !== 'string'
    )
  )
    return false;
  if (
    c.lastResult &&
    (!isRecord(c.lastResult) ||
      typeof c.lastResult.event !== 'string' ||
      typeof c.lastResult.finish !== 'string' ||
      !integer(c.lastResult.points) ||
      !participant(c.lastResult.champion))
  )
    return false;
  if (c.match && (!c.draw || c.eventIndex >= (tournament ? 1 : 4)))
    return false;
  if (!c.draw) return !c.match;
  if (!Array.isArray(c.draw) || c.draw.length < 1 || c.draw.length > 3)
    return false;
  const event = tournament
    ? currentEvent(c)
    : calendar(c.tier)[c.match ? c.eventIndex : Math.max(0, c.eventIndex - 1)];
  for (let r = 0; r < c.draw.length; r++) {
    const round = c.draw[r];
    if (!Array.isArray(round) || round.length !== 4 / 2 ** r) return false;
    const entrants = round.flatMap((p) => (isRecord(p) ? [p.a, p.b] : []));
    if (
      entrants.length !== round.length * 2 ||
      new Set(entrants).size !== entrants.length ||
      !entrants.every(participant)
    )
      return false;
    if (r === 0 && !entrants.includes('player')) return false;
    for (let i = 0; i < round.length; i++) {
      const p = round[i];
      if (p.winner !== undefined && p.winner !== p.a && p.winner !== p.b)
        return false;
      if (
        r > 0 &&
        (p.a !== c.draw[r - 1][i * 2].winner ||
          p.b !== c.draw[r - 1][i * 2 + 1].winner)
      )
        return false;
      if (p.score !== undefined) {
        const target = Math.ceil(event.rounds[r] / 2);
        if (
          !Array.isArray(p.score) ||
          p.score.length !== 2 ||
          !p.score.every((n) => integer(n)) ||
          !p.winner ||
          Math.max(...p.score) !== target ||
          Math.min(...p.score) >= target ||
          p.winner !== (p.score[0] > p.score[1] ? p.a : p.b)
        )
          return false;
      }
      if ((r < c.draw.length - 1 || !c.match) && !p.winner) return false;
    }
  }
  if (!c.match)
    return (
      c.draw.length === 3 && c.draw[2][0].winner === c.lastResult?.champion
    );
  const m = c.match;
  if (
    !isRecord(m) ||
    !integer(m.round) ||
    m.round !== c.draw.length - 1 ||
    typeof m.id !== 'string' ||
    m.id.length > 160 ||
    !RIVALS.some((r) => r.id === m.opponent) ||
    m.bestOf !== event.rounds[m.round] ||
    !Array.isArray(m.frames) ||
    m.frames.length !== 2 ||
    !m.frames.every((n) => integer(n)) ||
    Math.max(...m.frames) >= Math.ceil(m.bestOf / 2) ||
    m.frameNumber !== m.frames[0] + m.frames[1] + 1 ||
    c.completedFrames.includes(frameId(c))
  )
    return false;
  const p = c.draw[m.round].find(
    (pair) => pair.a === 'player' || pair.b === 'player'
  );
  if (!p || p.winner || (p.a === 'player' ? p.b : p.a) !== m.opponent)
    return false;
  // Invalid checkpoints are safely discarded by the loader; bracket history survives.
  return true;
}

function readProgress(
  storage: Pick<Storage, 'getItem'> | undefined,
  tournament: boolean
): Career {
  const fallback = () => (tournament ? createTournament() : createCareer());
  try {
    const raw = (storage ?? window.localStorage).getItem(
      tournament ? TOURNAMENT_STORAGE_KEY : CAREER_STORAGE_KEY
    );
    if (!raw || raw.length > 500000) return fallback();
    const c = JSON.parse(raw);
    if (!validCareer(c, tournament)) return fallback();
    const checkpoint = c.match?.checkpoint;
    if (
      checkpoint &&
      (!isRecord(checkpoint) ||
        !validFrame(checkpoint.frame) ||
        checkpoint.frame.frameOver ||
        !validLayout(checkpoint.layout) ||
        (checkpoint.revision !== undefined && !integer(checkpoint.revision)))
    )
      delete c.match!.checkpoint;
    return c;
  } catch {
    return fallback();
  }
}
export function loadCareer(storage?: Pick<Storage, 'getItem'>): Career {
  return readProgress(storage, false);
}
export function loadTournament(storage?: Pick<Storage, 'getItem'>): Career {
  return readProgress(storage, true);
}
export function createTournament(
  name = 'Player',
  bestOf = 3,
  tier: Tier = 'qualifying'
): Career {
  return {
    ...createCareer(name),
    tier,
    competition: {
      bestOf: TOURNAMENT_FORMATS.includes(bestOf as any) ? bestOf : 3
    }
  };
}
export function saveTournament(
  career: Career,
  storage?: Pick<Storage, 'setItem'>
): boolean {
  return saveProgress(career, TOURNAMENT_STORAGE_KEY, storage);
}
function saveProgress(
  career: Career,
  key: string,
  storage?: Pick<Storage, 'setItem'>
): boolean {
  if (!validCareer(career, key === TOURNAMENT_STORAGE_KEY)) return false;
  try {
    (storage ?? window.localStorage).setItem(key, JSON.stringify(career));
    return true;
  } catch {
    return false;
  }
}
export function saveCareer(
  career: Career,
  storage?: Pick<Storage, 'setItem'>
): boolean {
  return saveProgress(career, CAREER_STORAGE_KEY, storage);
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
  return c.competition
    ? {
        name: 'Royal Invitational',
        venue: 'Crown Theatre',
        rounds: Array(3).fill(c.competition.bestOf),
        purse: 0
      }
    : calendar(c.tier)[c.eventIndex];
}
export function frameId(c: Career) {
  return c.match ? `${c.match.id}:f${c.match.frameNumber}` : '';
}
export function roundName(round: number) {
  return ['Quarter-final', 'Semi-final', 'Final'][round] ?? 'Final';
}
function makeMatch(c: Career, round: number, pair: Pairing): CareerMatch {
  return {
    id: `${c.runId ? `${c.runId}:` : ''}s${c.season}:e${c.eventIndex}:r${round}`,
    round,
    opponent: pair.a === 'player' ? pair.b : pair.a,
    bestOf: currentEvent(c).rounds[round],
    frames: [0, 0],
    frameNumber: 1
  };
}
export function enterEvent(c: Career): Career {
  if (c.match || c.eventIndex >= (c.competition ? 1 : 4)) return c;
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
    if (!p.score) {
      const target = Math.ceil(currentEvent(c).rounds[round] / 2);
      const loser = Math.min(
        target - 1,
        Math.floor((((i + round + c.season) % 5) / 5) * target)
      );
      p.score = p.winner === p.a ? [target, loser] : [loser, target];
    }
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
    !validCareer(c, Boolean(c.competition)) ||
    !c.match ||
    id !== frameId(c) ||
    c.completedFrames.includes(id) ||
    !validFrame(frame) ||
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
  if (c.competition || c.eventIndex < 4 || c.match) return c;
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
  layout: unknown[],
  revision?: number
): Career {
  if (
    !c.match ||
    id !== frameId(c) ||
    c.completedFrames.includes(id) ||
    !validFrame(frame) ||
    frame.frameOver ||
    !validLayout(layout) ||
    (revision !== undefined &&
      (!integer(revision) || revision <= (c.match.checkpoint?.revision ?? -1)))
  )
    return c;
  const next = structuredClone(c);
  next.match!.checkpoint = {
    frame: structuredClone(frame),
    layout: structuredClone(layout),
    revision: revision ?? (c.match!.checkpoint?.revision ?? 0) + 1
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
