import { CUPS } from './simulation.mjs';
export interface Career {
  version: 1;
  cups: number[];
  best: Record<string, number>;
  credits: number;
  races: number;
  wins: number;
}
const key = 'tonplaygram.kartroyale.career.v1';
export function loadCareer(): Career {
  try {
    const d = JSON.parse(localStorage.getItem(key) || '{}');
    if (d.version === 1)
      return {
        version: 1,
        cups: CUPS.map((_, i) =>
          Math.max(0, Math.min(3, Number(d.cups?.[i]) || 0))
        ),
        best: Object.fromEntries(
          Object.entries(d.best || {}).filter(
            (e): e is [string, number] =>
              typeof e[1] === 'number' && Number.isFinite(e[1]) && e[1] > 0
          )
        ),
        credits: Math.max(0, Number(d.credits) || 0),
        races: Math.max(0, Number(d.races) || 0),
        wins: Math.max(0, Number(d.wins) || 0)
      };
  } catch {}
  return {
    version: 1,
    cups: [0, 0, 0],
    best: {},
    credits: 0,
    races: 0,
    wins: 0
  };
}
export function recordRace(
  c: Career,
  track: string,
  place: number,
  time: number,
  cup: number | null
) {
  const next = {
    ...c,
    cups: [...c.cups],
    best: { ...c.best },
    races: c.races + 1,
    wins: c.wins + Number(place === 1)
  };
  if (time > 0) next.best[track] = Math.min(next.best[track] || Infinity, time);
  let reward = 0;
  if (cup !== null && CUPS[cup] && place <= CUPS[cup].target) {
    if (!next.cups[cup]) reward = CUPS[cup].reward;
    next.cups[cup] = Math.max(next.cups[cup], Math.max(1, 4 - place));
    next.credits += reward;
  }
  let saved = true;
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    saved = false;
  }
  return { career: next, reward, saved };
}
export const formatTime = (s: number) =>
  `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
