import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoxes, spin } from '../lib/luckyCard.js';

test('box 3 contains all four threes', () => {
  const boxes = createBoxes();
  const box = boxes[3];
  assert.equal(box.cards.length, 4);
  assert.ok(box.cards.every(card => card.startsWith('3')));
});

test('spinning returns result within range', () => {
  const boxes = createBoxes();
  const { result, cards } = spin(boxes);
  assert.ok(result >= 1 && result <= 12);
  assert.equal(cards.length, 4);
});
