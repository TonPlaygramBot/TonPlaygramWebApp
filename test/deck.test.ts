import { describe, it, expect } from 'vitest';
import { newDeck, shuffle } from '../shared/deck';

describe('deck', () => {
  it('builds 52 unique cards', () => {
    const deck = newDeck();
    expect(deck.length).toBe(52);
    expect(new Set(deck).size).toBe(52);
  });

  it('shuffle keeps all cards', () => {
    const deck = newDeck();
    const shuffled = shuffle(deck, () => 0.42);
    expect(shuffled.length).toBe(52);
    expect(new Set(shuffled).size).toBe(52);
  });
});
