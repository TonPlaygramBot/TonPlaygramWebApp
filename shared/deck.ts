import type { Card } from './pokerTypes';

const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const;
const SUITS = ['h','d','c','s'] as const;

export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (const r of RANKS) {
    for (const s of SUITS) {
      deck.push(`${r}${s}` as Card);
    }
  }
  return deck;
}

export function shuffle<T>(a: T[], rng: () => number = Math.random): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
