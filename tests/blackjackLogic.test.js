import { expect, test } from '@jest/globals';
import { handValue } from '../webapp/src/utils/blackjackLogic.js';

test('handValue handles missing or invalid cards without throwing', () => {
  expect(handValue([{ rank: 'A', suit: 'S' }, null, undefined])).toBe(11);
  expect(handValue([{ rank: '10', suit: 'H' }])).toBe(10);
});
