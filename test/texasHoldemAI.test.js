import test from 'node:test';
import assert from 'node:assert/strict';
import { potOdds, preflopAction, postflopDecision } from '../bot/logic/texasHoldemAI.js';

test('pot odds calculation', () => {
  assert.equal(potOdds(10, 30), 0.25);
});

test('preflop action follows frequencies', () => {
  assert.equal(preflopAction('A', 0.5), 'raise');
  assert.equal(preflopAction('B', 0.65), 'call');
  assert.equal(preflopAction('C', 0.95), 'fold');
});

test('postflop decision uses equity and position', () => {
  assert.equal(postflopDecision({ equity: 0.4, potOdds: 0.5 }), 'fold');
  assert.equal(postflopDecision({ equity: 0.52, potOdds: 0.5, free: true }), 'check');
  assert.equal(postflopDecision({ equity: 0.7, potOdds: 0.5, position: 'IP' }), 'raise');
});
