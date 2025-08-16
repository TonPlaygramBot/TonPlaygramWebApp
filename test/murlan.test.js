import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ComboType,
  DEFAULT_CONFIG,
  detectCombo,
  canBeat,
  playTurn,
  aiChooseAction
} from '../lib/murlan.js';

const card = (rank, suit = '') => ({ rank, suit });

test('detect single/joker', () => {
  const singleJB = detectCombo([card('JB')], DEFAULT_CONFIG);
  const singleJR = detectCombo([card('JR')], DEFAULT_CONFIG);
  const single2 = detectCombo([card('2')], DEFAULT_CONFIG);
  assert.equal(singleJB.type, ComboType.SINGLE);
  assert(singleJB.strength > singleJR.strength);
  assert(singleJR.strength > single2.strength);
});

test('detect pair/trips', () => {
  const pair7 = detectCombo([card('7', '♣'), card('7', '♦')], DEFAULT_CONFIG);
  assert.equal(pair7.type, ComboType.PAIR);
  assert.equal(pair7.keyRank, '7');
  const tripsQ = detectCombo([card('Q', '♠'), card('Q', '♥'), card('Q', '♦')], DEFAULT_CONFIG);
  assert.equal(tripsQ.type, ComboType.TRIPS);
  assert.equal(tripsQ.keyRank, 'Q');
});

test('bomb wins over pair', () => {
  const table = detectCombo([card('9', '♣'), card('9', '♦')], DEFAULT_CONFIG);
  const bomb = detectCombo([
    card('K', '♣'), card('K', '♦'), card('K', '♥'), card('K', '♠')
  ], DEFAULT_CONFIG);
  assert.equal(canBeat(bomb, table, DEFAULT_CONFIG), true);
});

test('straight rules', () => {
  const config = { ...DEFAULT_CONFIG, enableFiveCard: true };
  const straight = detectCombo([
    card('6', '♣'),
    card('7', '♦'),
    card('8', '♥'),
    card('9', '♠'),
    card('10', '♣')
  ], config);
  assert.equal(straight.type, ComboType.STRAIGHT);
  const wrap = detectCombo([
    card('Q', '♣'),
    card('K', '♦'),
    card('A', '♥'),
    card('2', '♠'),
    card('3', '♣')
  ], config);
  assert.equal(wrap, null);
});

test('compare same type/size', () => {
  const table = detectCombo([card('10', '♠'), card('10', '♣')], DEFAULT_CONFIG);
  const cand1 = detectCombo([card('J', '♠'), card('J', '♦')], DEFAULT_CONFIG);
  const cand2 = detectCombo([card('9', '♠'), card('9', '♦')], DEFAULT_CONFIG);
  assert.equal(canBeat(cand1, table, DEFAULT_CONFIG), true);
  assert.equal(canBeat(cand2, table, DEFAULT_CONFIG), false);
});

test('round closes after passes', () => {
  const state = {
    players: [
      { hand: [card('3', '♣'), card('7', '♣')], finished: false },
      { hand: [card('4', '♣')], finished: false },
      { hand: [card('5', '♣')], finished: false },
      { hand: [card('6', '♣')], finished: false }
    ],
    turn: { activePlayer: 0, currentCombo: null, passesInRow: 0 },
    config: DEFAULT_CONFIG,
    lastWinner: 0
  };
  playTurn(state, { type: 'PLAY', cards: [card('3', '♣')] });
  playTurn(state, { type: 'PASS' });
  playTurn(state, { type: 'PASS' });
  playTurn(state, { type: 'PASS' });
  assert.equal(state.turn.currentCombo, null);
  assert.equal(state.turn.activePlayer, state.lastWinner);
});

test('aiChooseAction avoids breaking bomb', () => {
  const hand = [
    card('3', '♣'),
    card('4', '♦'),
    card('5', '♥'),
    card('9', '♣'),
    card('9', '♦'),
    card('9', '♥'),
    card('9', '♠')
  ];
  const action = aiChooseAction(hand, null, DEFAULT_CONFIG);
  assert.equal(action.type, 'PLAY');
  const ranks = action.cards.map((c) => c.rank);
  if (ranks.includes('9')) {
    assert.equal(action.cards.length, 4);
  }
});

test('bomb closes round immediately', () => {
  const state = {
    players: [
      {
        hand: [
          card('K', '♣'),
          card('K', '♦'),
          card('K', '♥'),
          card('K', '♠'),
          card('3', '♣')
        ],
        finished: false
      },
      { hand: [card('4', '♦')], finished: false },
      { hand: [card('5', '♥')], finished: false }
    ],
    turn: { activePlayer: 0, currentCombo: null, passesInRow: 0 },
    config: DEFAULT_CONFIG,
    lastWinner: 0
  };
  const bomb = state.players[0].hand.slice(0, 4);
  playTurn(state, { type: 'PLAY', cards: bomb });
  assert.equal(state.turn.currentCombo, null);
  assert.equal(state.turn.activePlayer, 0);
});

test('bomb finishing hand passes lead', () => {
  const state = {
    players: [
      {
        hand: [
          card('Q', '♣'),
          card('Q', '♦'),
          card('Q', '♥'),
          card('Q', '♠')
        ],
        finished: false
      },
      { hand: [card('4', '♦')], finished: false },
      { hand: [card('5', '♥')], finished: false }
    ],
    turn: { activePlayer: 0, currentCombo: null, passesInRow: 0 },
    config: DEFAULT_CONFIG,
    lastWinner: 0
  };
  const bomb = state.players[0].hand.slice();
  playTurn(state, { type: 'PLAY', cards: bomb });
  assert.equal(state.players[0].finished, true);
  assert.equal(state.turn.activePlayer, 1);
});

