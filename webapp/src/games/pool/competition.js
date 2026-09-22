import { CAREER_STAGES } from '../../utils/poolRoyaleCareerProgress.js';

export const COMPETITION_VERSION = 1;
const RIVALS = [
  ['Mira Dervishi', 'Position player'], ['Leo Chen', 'Attacking potter'],
  ['Arben Hoxha', 'Safety specialist'], ['Sofia Rossi', 'Bank-shot specialist'],
  ['Amir Khan', 'Long-pot specialist'], ['Eva Novak', 'Patient tactician'],
  ['Jack Reid', 'Break builder'], ['Nora Price', 'All-round contender']
];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const copy = (value) => structuredClone(value);
const isInt = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
export const poolCompetitionKey = (scope = 'guest', stageId = '', variant = 'american') =>
  `poolRoyalCompetition.v1:${encodeURIComponent(scope || 'guest')}:${stageId || `tournament-${variant}`}`;
export function poolCompetitionScope(telegramId, accountId) {
  try { return String(telegramId || accountId || globalThis.localStorage?.getItem('accountId') || 'guest'); }
  catch { return String(telegramId || accountId || 'guest'); }
}

export function poolStageFormat(stage) {
  const raceTo = stage?.type === 'showdown' ? 5 : stage?.type === 'league' ? 3 : 2;
  return { raceTo, label: stage?.type === 'training' ? 'Guided drill' : `Race to ${raceTo}` };
}

export function createPoolCompetition({ stageId = '', players = 8, variant = 'american', name = 'Player', options = {}, id = `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` } = {}) {
  const stage = CAREER_STAGES.find((entry) => entry.id === stageId);
  if (stageId && (!stage || stage.type === 'training')) throw new Error('Choose a playable match stage.');
  const count = stage ? (stage.type === 'tournament' ? stage.players : 2) : ([8, 16, 32].includes(Number(players)) ? Number(players) : 8);
  const rounds = Math.log2(count);
  const baseSkill = stage ? clamp(0.3 + stage.level * 0.0065, 0.3, 0.92) : 0.6;
  const entrants = [
    { id: 'you', name: String(name).slice(0, 32) || 'Player', rating: 0.65, style: 'Your game' },
    ...Array.from({ length: count - 1 }, (_, index) => {
      const [rivalName, style] = RIVALS[index % RIVALS.length];
      return { id: `rival-${index + 1}`, name: `${rivalName}${index >= RIVALS.length ? ` ${Math.floor(index / RIVALS.length) + 1}` : ''}`, rating: clamp(baseSkill + (index / Math.max(1, count - 2) - 0.5) * 0.22, 0.2, 0.98), style };
    })
  ];
  const draw = [Array.from({ length: count / 2 }, (_, index) => ({ a: entrants[index * 2].id, b: entrants[index * 2 + 1].id }))];
  return {
    version: COMPETITION_VERSION, id, stageId, variant, title: stage?.title || 'Royal Open',
    name: entrants[0].name, options: { ...options, variantKey: variant }, entrants, draw,
    totalRounds: rounds, baseRaceTo: poolStageFormat(stage).raceTo, round: 0,
    frames: [0, 0], frameNumber: 1, opponent: entrants[1].id, status: 'active',
    completedFrames: [], framesPlayed: 0, framesWon: 0, matchesWon: 0, revision: 0, updatedAt: Date.now()
  };
}

export const poolFrameId = (event) => event?.status === 'active' ? `${event.id}:r${event.round}:f${event.frameNumber}` : '';
export const poolRaceTo = (event) => event.baseRaceTo + (event.totalRounds > 1 && event.round === event.totalRounds - 1 ? 1 : 0);
export function poolRoundName(event, round = event.round) {
  if (event.totalRounds === 1) return 'Match';
  const remaining = event.totalRounds - round;
  return remaining === 1 ? 'Final' : remaining === 2 ? 'Semi-final' : remaining === 3 ? 'Quarter-final' : `Round of ${2 ** remaining}`;
}
export const poolOpponent = (event) => event?.entrants.find((entrant) => entrant.id === event.opponent);

function simulatedWinner(event, pair, round, index) {
  const a = event.entrants.find((entrant) => entrant.id === pair.a);
  const b = event.entrants.find((entrant) => entrant.id === pair.b);
  // The saved draw determines every simulated result; reloading never rerolls it.
  let seed = round * 131 + index * 17;
  for (const letter of event.id) seed = (Math.imul(seed, 31) + letter.charCodeAt(0)) >>> 0;
  const roll = ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  return roll < a.rating / (a.rating + b.rating) ? a.id : b.id;
}
function finishRound(event, round) {
  const raceTo = event.baseRaceTo + (round === event.totalRounds - 1 && event.totalRounds > 1 ? 1 : 0);
  const winners = event.draw[round].map((pair, index) => {
    if (!pair.winner) {
      pair.winner = simulatedWinner(event, pair, round, index);
      const loserScore = Math.min(raceTo - 1, (index + round) % raceTo);
      pair.score = pair.winner === pair.a ? [raceTo, loserScore] : [loserScore, raceTo];
    }
    return pair.winner;
  });
  if (winners.length === 1) return winners[0];
  event.draw[round + 1] = Array.from({ length: winners.length / 2 }, (_, index) => ({ a: winners[index * 2], b: winners[index * 2 + 1] }));
  return null;
}

export function completePoolFrame(event, id, frame) {
  if (!event || event.status !== 'active' || id !== poolFrameId(event) || event.completedFrames.includes(id) || !frame?.frameOver || !['A', 'B'].includes(frame.winner)) return event;
  const next = copy(event);
  const won = frame.winner === 'A';
  next.completedFrames.push(id);
  next.framesPlayed++;
  if (won) next.framesWon++;
  next.frames[won ? 0 : 1]++;
  next.frameNumber++;
  next.updatedAt = Date.now();
  next.revision = (event.revision || 0) + 1;
  delete next.checkpoint;
  if (Math.max(...next.frames) < poolRaceTo(next)) return next;
  const matchWon = next.frames[0] > next.frames[1];
  const pair = next.draw[next.round].find((p) => p.a === 'you' || p.b === 'you');
  pair.winner = matchWon ? 'you' : next.opponent;
  pair.score = pair.a === 'you' ? [...next.frames] : [...next.frames].reverse();
  next.lastMatch = { round: next.round, opponent: next.opponent, frames: [...next.frames], won: matchWon };
  if (matchWon) next.matchesWon++;
  let champion = finishRound(next, next.round);
  if (matchWon && !champion) {
    next.round++;
    const nextPair = next.draw[next.round].find((p) => p.a === 'you' || p.b === 'you');
    next.opponent = nextPair.a === 'you' ? nextPair.b : nextPair.a;
    next.frames = [0, 0];
    next.frameNumber = 1;
    return next;
  }
  for (let round = next.round + 1; !champion && round < next.totalRounds; round++) champion = finishRound(next, round);
  next.champion = champion;
  next.status = matchWon ? 'champion' : 'eliminated';
  return next;
}

export function checkpointPoolFrame(event, id, frame, layout) {
  if (!event || id !== poolFrameId(event) || event.status !== 'active' || frame?.frameOver || !frame?.players?.A || !frame?.players?.B || !Array.isArray(layout) || !layout.length) return event;
  const next = copy(event);
  next.checkpoint = { frame: copy(frame), layout: copy(layout) };
  next.updatedAt = Date.now();
  next.revision = (event.revision || 0) + 1;
  return next;
}

export function validPoolCompetition(event) {
  if (!event || event.version !== COMPETITION_VERSION || typeof event.id !== 'string' || !event.id || !['active', 'champion', 'eliminated'].includes(event.status) || !Array.isArray(event.entrants) || ![2, 8, 16, 32].includes(event.entrants.length) || event.totalRounds !== Math.log2(event.entrants.length) || !isInt(event.round, 0, event.totalRounds - 1) || !isInt(event.baseRaceTo, 1, 9) || !isInt(event.frameNumber, 1, 19) || !Array.isArray(event.frames) || event.frames.length !== 2 || event.frames.some((n) => !isInt(n, 0, 10)) || !Array.isArray(event.completedFrames) || event.completedFrames.some((id) => typeof id !== 'string') || !Array.isArray(event.draw)) return false;
  const ids = new Set(event.entrants.map((entrant) => entrant?.id));
  if (typeof event.name !== 'string' || event.name.length > 32 || typeof event.title !== 'string' || typeof event.stageId !== 'string' || !['american', '9ball', 'uk'].includes(event.variant) || !event.options || typeof event.options !== 'object' || Array.isArray(event.options) || event.completedFrames.length > 256) return false;
  if (['framesPlayed', 'framesWon', 'matchesWon'].some((key) => !isInt(event[key], 0, 10000)) || event.framesWon > event.framesPlayed || (event.revision !== undefined && !isInt(event.revision, 0, Number.MAX_SAFE_INTEGER))) return false;
  if (ids.size !== event.entrants.length || !ids.has('you') || !ids.has(event.opponent) || event.entrants.some((entrant) => typeof entrant?.id !== 'string' || typeof entrant?.name !== 'string' || typeof entrant?.style !== 'string' || !Number.isFinite(entrant.rating) || entrant.rating <= 0 || entrant.rating > 1)) return false;
  if (event.draw.length > event.totalRounds || event.draw.some((round, index) => !Array.isArray(round) || round.length !== event.entrants.length / 2 ** (index + 1) || round.some((pair) => !pair || !ids.has(pair.a) || !ids.has(pair.b) || pair.a === pair.b || (pair.winner && ![pair.a, pair.b].includes(pair.winner))))) return false;
  if (event.draw.some((round) => new Set(round.flatMap((pair) => [pair.a, pair.b])).size !== round.length * 2)) return false;
  if (event.draw.some((round) => round.some((pair) => pair.score && (!Array.isArray(pair.score) || pair.score.length !== 2 || pair.score.some((value) => !isInt(value, 0, 10)))))) return false;
  for (let round = 1; round < event.draw.length; round++) {
    if (event.draw[round].some((pair, index) => event.draw[round - 1][index * 2].winner !== pair.a || event.draw[round - 1][index * 2 + 1].winner !== pair.b)) return false;
  }
  if (event.checkpoint && (!event.checkpoint.frame?.players?.A || !event.checkpoint.frame?.players?.B || event.checkpoint.frame.frameOver || !Array.isArray(event.checkpoint.layout) || !event.checkpoint.layout.length || event.checkpoint.layout.some((ball) => !ball || !['string', 'number'].includes(typeof ball.id) || !Number.isFinite(ball.pos?.x) || !Number.isFinite(ball.pos?.y) || (ball.mesh && ['position', 'scale', 'quaternion'].some((key) => ball.mesh[key] && Object.values(ball.mesh[key]).some((value) => !Number.isFinite(value))))))) return false;
  const currentPair = event.draw[event.round]?.find((pair) => pair.a === 'you' || pair.b === 'you');
  if (!currentPair || ![currentPair.a, currentPair.b].includes(event.opponent)) return false;
  if (event.status === 'active' && (currentPair.winner || Math.max(...event.frames) >= poolRaceTo(event) || event.frameNumber !== event.frames[0] + event.frames[1] + 1)) return false;
  if (event.status !== 'active' && (!ids.has(event.champion) || event.draw.length !== event.totalRounds || event.draw.at(-1)?.[0]?.winner !== event.champion)) return false;
  return true;
}

export function loadPoolCompetition(key, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const event = JSON.parse(target?.getItem(key) || 'null');
    return validPoolCompetition(event) ? event : null;
  } catch { return null; }
}
export function savePoolCompetition(key, event, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    if (!validPoolCompetition(event) || !target) return false;
    target.setItem(key, JSON.stringify(event));
    return true;
  } catch { return false; }
}
