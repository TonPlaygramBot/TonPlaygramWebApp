import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCardReward, buildDeck } from '../webapp/src/utils/cardRewards.js';

test('calculates suit-based rewards', () => {
  assert.equal(calculateCardReward('hearts', 10), 20);
  assert.equal(calculateCardReward('spades', 8), 6); // 8 * 0.75 = 6
  assert.equal(calculateCardReward('clubs', 8), 4); // 8 * 0.5 = 4
  assert.equal(calculateCardReward('diamonds', 8), 12); // 8 * 1.5 = 12
  assert.equal(calculateCardReward('joker_black'), 5000);
  assert.equal(calculateCardReward('joker_red'), 1000);
});

test('deck contains specials', () => {
  const deck = buildDeck();
  assert.equal(deck.length, 50);
  const freeSpins = deck.filter(c => c.special === 'FREE_SPIN').length;
  const bonuses = deck.filter(c => c.special === 'BONUS_X3').length;
  assert.equal(freeSpins, 5);
  assert.equal(bonuses, 5);
});
