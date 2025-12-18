export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SUITS = ['H', 'D', 'C', 'S'];

export function createDeck() {
  const deck = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

export function shuffle(deck) {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function dealInitial(deck, players) {
  const copy = [...deck];
  const hands = Array.from({ length: players }, () => []);
  for (let r = 0; r < 2; r += 1) {
    for (let p = 0; p < players; p += 1) {
      hands[p].push(copy.pop());
    }
  }
  return { hands, deck: copy };
}

export function hitCard(deck) {
  const copy = [...deck];
  const card = copy.pop();
  return { card, deck: copy };
}

function cardValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J' || rank === 'T') return 10;
  return Number.parseInt(rank, 10);
}

export function handValue(hand) {
  let total = 0;
  let aces = 0;
  hand.forEach((card) => {
    total += cardValue(card.rank);
    if (card.rank === 'A') aces += 1;
  });
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export function isBust(hand) {
  return handValue(hand) > 21;
}

export function evaluateWinners(players) {
  let best = 0;
  const winners = [];
  players.forEach((player, index) => {
    if (player.bust) return;
    const value = handValue(player.hand);
    if (value > 21) return;
    if (value > best) {
      best = value;
      winners.splice(0, winners.length, index);
    } else if (value === best) {
      winners.push(index);
    }
  });
  return winners;
}

export function aiAction(hand) {
  return handValue(hand) < 17 ? 'hit' : 'stand';
}

export function aiBetAction(hand) {
  const value = handValue(hand);
  const bluff = Math.random() < 0.1;
  if (value >= 19) return 'raise';
  if (value >= 15) return bluff ? 'raise' : 'call';
  if (value >= 12) {
    if (bluff) return 'raise';
    return Math.random() < 0.5 ? 'call' : 'fold';
  }
  return bluff ? 'raise' : 'fold';
}
