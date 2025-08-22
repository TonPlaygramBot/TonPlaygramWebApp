export const SUITS = ['hearts', 'spades', 'clubs', 'diamonds'];

/**
 * Calculate reward for a card based on its suit and rank.
 * @param {string} suit - Card suit or joker type
 * @param {number} [rank] - Card rank from 1-12
 * @returns {number}
 */
export function calculateCardReward (suit, rank = 0) {
  if (suit === 'joker_black') return 5000;
  if (suit === 'joker_red') return 1000;
  const base = rank;
  switch (suit) {
    case 'hearts':
      return base * 2;
    case 'spades':
      return Math.round(base * 0.75);
    case 'clubs':
      return Math.round(base * 0.5);
    case 'diamonds':
      return Math.round(base * 1.5);
    default:
      return base;
  }
}

function shuffle (arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Build a deck of cards with rewards and random specials.
 * Each suit has ranks 1-12. Two jokers are added. Five cards
 * are marked as FREE_SPIN and five as BONUS_X3.
 * @returns {Array}
 */
export function buildDeck () {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 12; rank++) {
      deck.push({
        suit,
        rank,
        reward: calculateCardReward(suit, rank)
      });
    }
  }
  deck.push({ suit: 'joker_black', rank: null, reward: 5000 });
  deck.push({ suit: 'joker_red', rank: null, reward: 1000 });

  // assign specials
  const indices = deck.map((_, i) => i);
  shuffle(indices);
  const specials = indices.filter(i => deck[i].suit !== 'joker_black' && deck[i].suit !== 'joker_red');

  for (let i = 0; i < 5 && i < specials.length; i++) {
    deck[specials[i]].special = 'FREE_SPIN';
  }
  for (let i = 5; i < 10 && i < specials.length; i++) {
    deck[specials[i]].special = 'BONUS_X3';
  }

  return deck;
}
