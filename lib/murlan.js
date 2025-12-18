// Murlan Royale core logic implementation
// Based on spec & pseudocode provided.
/* eslint-disable */

export const ComboType = {
  SINGLE: 'SINGLE',
  PAIR: 'PAIR',
  TRIPS: 'TRIPS',
  BOMB_4K: 'BOMB_4K',
  STRAIGHT: 'STRAIGHT',
  FLUSH: 'FLUSH',
  FULL_HOUSE: 'FULL_HOUSE',
  STRAIGHT_FLUSH: 'STRAIGHT_FLUSH'
};

export const DEFAULT_CONFIG = {
  RANK_ORDER: ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2', 'JR', 'JB'],
  USE_JOKER_AS_WILD: false,
  STRAIGHTS_REQUIRE_SAME_SUIT: false,
  MIN_STRAIGHT_LENGTH: 5,
  enableFiveCard: false,
  bombBeatsEverything: true
};

export function rankValue(rank, config = DEFAULT_CONFIG) {
  return config.RANK_ORDER.indexOf(rank);
}

export function sortHand(hand, config = DEFAULT_CONFIG) {
  return [...hand].sort((a, b) => {
    const rv = rankValue(a.rank, config) - rankValue(b.rank, config);
    if (rv !== 0) return rv;
    return a.suit.localeCompare(b.suit);
  });
}

export function sameRank(cards) {
  return cards.every((c) => c.rank === cards[0].rank);
}

function isJoker(card) {
  return card.rank === 'JR' || card.rank === 'JB';
}

export function canMakeSameRankWithJoker(cards, n, config = DEFAULT_CONFIG) {
  if (!config.USE_JOKER_AS_WILD) return false;
  const nonJoker = cards.filter((c) => !isJoker(c));
  const jokerCount = cards.length - nonJoker.length;
  if (cards.length !== n) return false;
  if (nonJoker.length === 0) return jokerCount === n;
  const baseRank = nonJoker[0].rank;
  if (!nonJoker.every((c) => c.rank === baseRank)) return false;
  return nonJoker.length + jokerCount === n;
}

export function resolvedRank(cards, n, config = DEFAULT_CONFIG) {
  const nonJoker = cards.filter((c) => !isJoker(c));
  if (nonJoker.length > 0) return nonJoker[0].rank;
  return config.RANK_ORDER[config.RANK_ORDER.length - 1];
}

export function fourOfKind(cards, config = DEFAULT_CONFIG) {
  if (cards.length !== 4) return false;
  if (sameRank(cards)) return true;
  return canMakeSameRankWithJoker(cards, 4, config);
}

export function isFlush(cards) {
  return cards.every((c) => c.suit === cards[0].suit);
}

export function isStraight(cards, config = DEFAULT_CONFIG) {
  if (cards.length < config.MIN_STRAIGHT_LENGTH) return false;
  if (cards.some((c) => c.rank === '2')) return false;
  const sorted = sortHand(cards, config);
  const ranks = sorted.map((c) => rankValue(c.rank, config));
  const minRank = rankValue('3', config);
  if (ranks[0] < minRank) return false;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i] !== ranks[i - 1] + 1) return false;
  }
  if (config.STRAIGHTS_REQUIRE_SAME_SUIT && !isFlush(cards)) return false;
  return true;
}

export function straightHighCard(cards, config = DEFAULT_CONFIG) {
  if (!isStraight(cards, config)) return null;
  const sorted = sortHand(cards, config);
  return sorted[sorted.length - 1].rank;
}

export function isFullHouse(cards) {
  if (cards.length !== 5) return false;
  const counts = {};
  for (const c of cards) counts[c.rank] = (counts[c.rank] || 0) + 1;
  const values = Object.values(counts).sort();
  return values[0] === 2 && values[1] === 3;
}

export function isStraightFlush(cards, config = DEFAULT_CONFIG) {
  return isStraight(cards, config) && isFlush(cards);
}

export function detectCombo(cards, config = DEFAULT_CONFIG) {
  const n = cards.length;
  if (n === 0) return null;
  if (n === 1) {
    const rank = cards[0].rank;
    return { type: ComboType.SINGLE, cards, keyRank: rank, strength: 100 + rankValue(rank, config) };
  }
  if (n === 2 && (sameRank(cards) || canMakeSameRankWithJoker(cards, 2, config))) {
    const baseRank = resolvedRank(cards, 2, config);
    return { type: ComboType.PAIR, cards, keyRank: baseRank, strength: 200 + rankValue(baseRank, config) };
  }
  if (n === 3 && (sameRank(cards) || canMakeSameRankWithJoker(cards, 3, config))) {
    const baseRank = resolvedRank(cards, 3, config);
    return { type: ComboType.TRIPS, cards, keyRank: baseRank, strength: 300 + rankValue(baseRank, config) };
  }
  if (n === 4 && fourOfKind(cards, config)) {
    const baseRank = resolvedRank(cards, 4, config);
    return { type: ComboType.BOMB_4K, cards, keyRank: baseRank, strength: 900 + rankValue(baseRank, config) };
  }
  if (n === 5 && config.enableFiveCard) {
    if (isStraightFlush(cards, config)) {
      const high = straightHighCard(cards, config);
      return {
        type: ComboType.STRAIGHT_FLUSH,
        cards,
        keyRank: high,
        strength: 880 + rankValue(high, config)
      };
    }
    const counts = {};
    for (const c of cards) counts[c.rank] = (counts[c.rank] || 0) + 1;
    const quadRank = Object.keys(counts).find((r) => counts[r] === 4);
    if (quadRank) {
      return {
        type: ComboType.BOMB_4K,
        cards,
        keyRank: quadRank,
        strength: 860 + rankValue(quadRank, config)
      };
    }
    if (isFullHouse(cards)) {
      const tripleRank = Object.keys(counts).find((r) => counts[r] === 3);
      return {
        type: ComboType.FULL_HOUSE,
        cards,
        keyRank: tripleRank,
        strength: 840 + rankValue(tripleRank, config)
      };
    }
    if (isFlush(cards)) {
      const high = sortHand(cards, config)[n - 1].rank;
      return {
        type: ComboType.FLUSH,
        cards,
        keyRank: high,
        strength: 820 + rankValue(high, config)
      };
    }
    if (isStraight(cards, config)) {
      const high = straightHighCard(cards, config);
      return {
        type: ComboType.STRAIGHT,
        cards,
        keyRank: high,
        strength: 800 + rankValue(high, config)
      };
    }
  }
  if (n >= config.MIN_STRAIGHT_LENGTH && isStraight(cards, config)) {
    const high = straightHighCard(cards, config);
    return {
      type: ComboType.STRAIGHT,
      cards,
      keyRank: high,
      strength: 800 + rankValue(high, config)
    };
  }
  return null;
}

export function isBomb(combo) {
  return combo && combo.type === ComboType.BOMB_4K;
}

export function canBeat(candidate, onTable, config = DEFAULT_CONFIG) {
  if (!onTable) return true;
  if (candidate.type === onTable.type && candidate.cards.length === onTable.cards.length) {
    return candidate.strength > onTable.strength;
  }
  if (isBomb(candidate) && (candidate.cards.length === onTable.cards.length || config.bombBeatsEverything)) {
    return true;
  }
  return false;
}


function generateSubsets(hand, max = hand.length) {
  const result = [];
  const n = hand.length;
  const recurse = (start, subset) => {
    if (subset.length > 0 && subset.length <= max) result.push([...subset]);
    if (subset.length === max) return;
    for (let i = start; i < n; i++) {
      subset.push(hand[i]);
      recurse(i + 1, subset);
      subset.pop();
    }
  };
  recurse(0, []);
  return result;
}

export function legalCombosFromHand(hand, onTable, config = DEFAULT_CONFIG) {
  const all = [];
  const subsets = generateSubsets(hand, hand.length);
  for (const s of subsets) {
    const c = detectCombo(s, config);
    if (c && canBeat(c, onTable, config)) all.push(c);
  }
  return all.sort((a, b) => a.strength - b.strength);
}

export function nextAlive(i, state) {
  const n = state.players.length;
  let idx = (i + 1) % n;
  while (state.players[idx].finished) {
    idx = (idx + 1) % n;
  }
  return idx;
}

export function dealPlayers(numPlayers, deck) {
  const players = Array.from({ length: numPlayers }, () => ({ hand: [] }));
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  let p = 0;
  for (const card of shuffled) {
    players[p].hand.push(card);
    p = (p + 1) % numPlayers;
  }
  players.forEach((pl) => { pl.hand = sortHand(pl.hand); });
  const startIdx = players.findIndex((pl) =>
    pl.hand.some((c) => c.rank === '3' && c.suit === '♠')
  );
  players.startingPlayer = startIdx;
  return players;
}

export function playTurn(state, action) {
  if (state.firstMove === undefined) state.firstMove = true;
  const player = state.players[state.turn.activePlayer];
  if (state.firstMove) {
    const startIdx = state.players.findIndex((p) =>
      p.hand.some((c) => c.rank === '3' && c.suit === '♠')
    );
    if (state.turn.activePlayer !== startIdx) {
      throw new Error('3♠ player must start');
    }
  }
  if (action.type === 'PASS') {
    state.turn.passesInRow += 1;
    if (state.turn.passesInRow === state.players.filter((p) => !p.finished).length - 1) {
      state.turn.currentCombo = null;
      state.turn.passesInRow = 0;
      state.turn.activePlayer = state.lastWinner;
    } else {
      state.turn.activePlayer = nextAlive(state.turn.activePlayer, state);
    }
    return;
  }
  const combo = detectCombo(action.cards, state.config);
  if (!combo) throw new Error('invalid combo');
  if (!canBeat(combo, state.turn.currentCombo, state.config)) throw new Error('cannot beat');
  if (state.firstMove) {
    const hasThreeSpade = action.cards.some(
      (c) => c.rank === '3' && c.suit === '♠'
    );
    if (!hasThreeSpade) throw new Error('first move must include 3♠');
    state.firstMove = false;
  }
  for (const card of action.cards) {
    const idx = player.hand.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
    if (idx !== -1) player.hand.splice(idx, 1);
  }
  state.lastWinner = state.turn.activePlayer;
  state.turn.passesInRow = 0;
  const isBombPlay = combo.type === ComboType.BOMB_4K;
  state.turn.currentCombo = isBombPlay ? null : combo;
  if (player.hand.length === 0) {
    player.finished = true;
    if (state.players.filter((p) => !p.finished).length === 1) {
      state.gameEnded = true;
      return;
    }
  }
  if (isBombPlay) {
    if (player.finished) {
      state.turn.activePlayer = nextAlive(state.turn.activePlayer, state);
    } else {
      state.turn.activePlayer = state.lastWinner;
    }
  } else {
    state.turn.activePlayer = nextAlive(state.turn.activePlayer, state);
  }
}

function usesJoker(cards) {
  return cards.some((c) => isJoker(c));
}

function breaksBomb(combo, hand) {
  const counts = {};
  for (const c of hand) counts[c.rank] = (counts[c.rank] || 0) + 1;
  const bombRanks = Object.keys(counts).filter((r) => counts[r] === 4);
  for (const r of bombRanks) {
    const used = combo.cards.filter((c) => c.rank === r).length;
    if (used > 0 && used < 4) return true;
    if (used === 4 && combo.cards.length > 4) return true;
  }
  return false;
}

export function aiChooseAction(hand, onTable, config = DEFAULT_CONFIG) {
  const moves = legalCombosFromHand(hand, onTable, config);
  if (moves.length === 0) return { type: 'PASS' };
  const value = (c) => {
    let base = onTable ? c.strength : -c.cards.length;
    base += usesJoker(c.cards) * 0.1;
    if (breaksBomb(c, hand)) base += 100;
    return base;
  };
  moves.sort((a, b) => value(a) - value(b));
  return { type: 'PLAY', cards: moves[0].cards };
}
