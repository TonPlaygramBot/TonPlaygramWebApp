import { createDeck, shuffle, dealCommunity, compareHands } from '../../lib/texasHoldem.js';

// Interactive Texas Hold'em engine used by TexasHoldemRoom.
// Tracks deck, betting rounds, pots and winners.
export class TexasHoldemGame {
  constructor(playerIds, options = {}) {
    const {
      startingChips = 100,
      blinds = { small: 5, big: 10 }
    } = options;
    this.players = playerIds.map((id, idx) => ({
      id,
      index: idx,
      hand: [],
      chips: startingChips,
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false
    }));
    this.blinds = blinds;
    this.startingChips = startingChips;
    this.resetHand();
  }

  // Prepare a new hand
  resetHand() {
    this.deck = shuffle(createDeck());
    this.community = [];
    this.pot = 0;
    this.currentBet = 0;
    this.round = 'preflop';
    this.dealer = 0; // for now dealer is player 0
    this.turn = 0;
    this.calls = 0;
    this.players.forEach((p) => {
      p.hand = [];
      p.bet = 0;
      p.totalBet = 0;
      p.folded = false;
      p.allIn = false;
    });
    this.dealHole();
    this.postBlinds();
    this.turn = this.nextActive((this.dealer + 3) % this.players.length);
  }

  // Deal two cards to each player
  dealHole() {
    for (let r = 0; r < 2; r++) {
      for (const p of this.players) {
        p.hand.push(this.deck.pop());
      }
    }
  }

  // Post blinds from players 1 and 2
  postBlinds() {
    const sb = this.players[(this.dealer + 1) % this.players.length];
    const bb = this.players[(this.dealer + 2) % this.players.length];
    sb.chips -= this.blinds.small;
    sb.bet = this.blinds.small;
    sb.totalBet = this.blinds.small;
    bb.chips -= this.blinds.big;
    bb.bet = this.blinds.big;
    bb.totalBet = this.blinds.big;
    this.pot = this.blinds.small + this.blinds.big;
    this.currentBet = this.blinds.big;
    this.calls = 0;
  }

  // Find next player who hasn't folded or gone all-in
  nextActive(start) {
    let i = start;
    const len = this.players.length;
    while (true) {
      const p = this.players[i];
      if (!p.folded && !p.allIn) return i;
      i = (i + 1) % len;
    }
  }

  // Handle a player's action: fold/call/check/raise
  playerAction(playerId, action) {
    const idx = this.players.findIndex((p) => p.id === playerId);
    if (idx !== this.turn) return { error: 'Not your turn' };
    const p = this.players[idx];
    const toCall = this.currentBet - p.bet;
    if (action === 'fold') {
      p.folded = true;
    } else if (action === 'raise') {
      const raiseTo = toCall + this.blinds.big;
      const amount = Math.min(raiseTo, p.chips);
      p.chips -= amount;
      p.bet += amount;
      p.totalBet += amount;
      this.pot += amount;
      if (p.chips === 0) p.allIn = true;
      this.currentBet = p.bet;
      this.calls = 1; // raiser counts as call
    } else if (action === 'call') {
      const amount = Math.min(toCall, p.chips);
      p.chips -= amount;
      p.bet += amount;
      p.totalBet += amount;
      this.pot += amount;
      if (p.chips === 0) p.allIn = true;
      if (amount === toCall) this.calls++;
      else {
        // partial call treated as raise to all-in
        this.currentBet = p.bet;
        this.calls = 1;
      }
    } else if (action === 'check') {
      if (toCall > 0) return { error: 'Cannot check' };
      this.calls++;
    } else {
      return { error: 'Invalid action' };
    }

    // Move turn to next player
    const remaining = this.players.filter((pl) => !pl.folded && !pl.allIn);
    if (remaining.length <= 1) {
      return { showdown: this.showdown() };
    }

    if (this.calls >= remaining.length) {
      this.advanceRound();
    } else {
      this.turn = this.nextActive((this.turn + 1) % this.players.length);
    }
    return { success: true };
  }

  advanceRound() {
    this.players.forEach((p) => (p.bet = 0));
    this.currentBet = 0;
    this.calls = 0;
    this.turn = this.nextActive((this.dealer + 1) % this.players.length);
    if (this.round === 'preflop') {
      const { community, deck } = dealCommunity(this.deck);
      this.community = community.slice(0, 3);
      this.deck = deck;
      this.round = 'flop';
    } else if (this.round === 'flop') {
      this.community = this.community.concat(this.deck.splice(-1));
      this.round = 'turn';
    } else if (this.round === 'turn') {
      this.community = this.community.concat(this.deck.splice(-1));
      this.round = 'river';
    } else {
      return this.showdown();
    }
    this.turn = this.nextActive((this.dealer + 1) % this.players.length);
    return { round: this.round };
  }

  buildPots() {
    const active = this.players.filter((p) => p.totalBet > 0);
    if (active.length === 0) return [];
    const bets = [...new Set(active.map((p) => p.totalBet))].sort((a, b) => a - b);
    let prev = 0;
    const pots = [];
    bets.forEach((b) => {
      const elig = this.players.filter((p) => p.totalBet >= b);
      const amount = (b - prev) * elig.length;
      pots.push({ amount, players: elig.map((p) => p.index) });
      prev = b;
    });
    return pots;
  }

  determineWinners(indices) {
    let winners = [];
    indices.forEach((i) => {
      if (winners.length === 0) {
        winners = [i];
        return;
      }
      const cmp = compareHands(
        [...this.players[i].hand, ...this.community],
        [...this.players[winners[0]].hand, ...this.community]
      );
      if (cmp > 0) {
        winners = [i];
      } else if (cmp === 0) {
        winners.push(i);
      }
    });
    return winners;
  }

  showdown() {
    const contenders = this.players.filter((p) => !p.folded).map((p) => p.index);
    const pots = this.buildPots();
    const results = [];
    pots.forEach((pot) => {
      const eligible = pot.players.filter((i) => contenders.includes(i));
      const winners = this.determineWinners(eligible);
      const share = pot.amount / winners.length;
      winners.forEach((i) => {
        this.players[i].chips += share;
      });
      results.push({ pot: pot.amount, winners });
    });
    this.round = 'showdown';
    return results;
  }

  stateFor(playerId) {
    return {
      community: this.community,
      pot: this.pot,
      round: this.round,
      turn: this.players[this.turn]?.id,
      players: this.players.map((p) => ({
        id: p.id,
        chips: p.chips,
        bet: p.bet,
        totalBet: p.totalBet,
        folded: p.folded,
        allIn: p.allIn,
        hand: playerId === p.id ? p.hand : []
      }))
    };
  }
}

export default TexasHoldemGame;

