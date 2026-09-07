export type ArcheryCareer = {
  level: number;
  xp: number;
  coins: number;
  wins: number;
  losses: number;
  tournament: number;
  accuracy: number;
  stability: number;
};

const KEY = 'tonplaygram.archeryroyal.career.v1';
const initial: ArcheryCareer = {
  level: 1, xp: 0, coins: 500, wins: 0, losses: 0, tournament: 0, accuracy: 0, stability: 0
};

export const EVENTS = ['Royal Grounds Open', 'Alpine Masters', 'Neon Night Cup', 'Continental Crown', 'World Royal Final'];

export function loadCareer(): ArcheryCareer {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    return value && typeof value === 'object' ? { ...initial, ...value } : { ...initial };
  } catch { return { ...initial }; }
}

export function saveCareer(career: ArcheryCareer) {
  try { localStorage.setItem(KEY, JSON.stringify(career)); } catch {}
}

export function finishCareerMatch(career: ArcheryCareer, won: boolean, score: number) {
  const xp = career.xp + 90 + score * 2 + (won ? 140 : 0);
  const next = {
    ...career,
    xp,
    level: 1 + Math.floor(xp / 500),
    coins: career.coins + 80 + score * 3 + (won ? 300 : 0),
    wins: career.wins + (won ? 1 : 0),
    losses: career.losses + (won ? 0 : 1),
    tournament: won ? (career.tournament + 1) % EVENTS.length : career.tournament
  };
  saveCareer(next);
  return next;
}

export function buyUpgrade(career: ArcheryCareer, kind: 'accuracy' | 'stability') {
  const price = 450 + career[kind] * 300;
  if (career.coins < price || career[kind] >= 5) return career;
  const next = { ...career, coins: career.coins - price, [kind]: career[kind] + 1 };
  saveCareer(next);
  return next;
}
