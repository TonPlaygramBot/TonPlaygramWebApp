// Basic multiplayer Blackjack game logic with community cards and betting

export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(card) {
  if (card.rank === 'A') return 11;
  if (['K','Q','J'].includes(card.rank)) return 10;
  return parseInt(card.rank, 10);
}

export class BlackjackGame {
  constructor(roomId, { stake = 100, maxPlayers = 5, maxCommunity = 5 } = {}) {
    this.roomId = roomId;
    this.stake = stake;
    this.maxPlayers = maxPlayers;
    this.maxCommunity = maxCommunity; // maximum community cards
    this.players = []; // {id,name,hand:[],folded:false,stood:false,bet:stake, chips:0}
    this.pot = 0;
    this.currentBet = stake;
    this.deck = [];
    this.community = [];
    this.phase = 'waiting';
    this.lastShowdown = null;
  }

  addPlayer(id, name = 'Player') {
    if (this.phase !== 'waiting' || this.players.length >= this.maxPlayers) return null;
    if (this.players.find(p => p.id === id)) return null;
    const player = { id, name, hand: [], folded: false, stood: false, bet: this.stake, chips: 0, acted: false };
    this.players.push(player);
    this.pot += this.stake;
    return player;
  }

  start() {
    if (this.phase !== 'waiting') return;
    this.deck = shuffle(createDeck());
    for (const p of this.players) {
      p.hand = [this.draw(), this.draw()];
      p.folded = false;
      p.stood = false;
      p.acted = false;
    }
    this.currentBet = this.stake;
    this.phase = 'betting';
  }

  draw() {
    return this.deck.pop();
  }

  placeBet(id, amount) {
    return this.raise(id, amount);
  }

  call(id) {
    if (this.phase !== 'betting') return false;
    const player = this.players.find(p => p.id === id && !p.folded);
    if (!player) return false;
    const diff = this.currentBet - player.bet;
    if (diff <= 0) return false;
    player.bet += diff;
    this.pot += diff;
    player.acted = true;
    return true;
  }

  raise(id, amount) {
    if (this.phase !== 'betting') return false;
    const player = this.players.find(p => p.id === id && !p.folded);
    if (!player) return false;
    player.bet += amount;
    this.pot += amount;
    if (player.bet > this.currentBet) {
      this.currentBet = player.bet;
      for (const p of this.players) {
        if (p.id !== id && !p.folded) p.acted = false;
      }
    }
    player.acted = true;
    return true;
  }

  fold(id) {
    if (this.phase !== 'betting') return false;
    const player = this.players.find(p => p.id === id && !p.folded);
    if (!player) return false;
    player.folded = true;
    player.acted = true;
    return true;
  }

  startHitPhase() {
    if (this.phase === 'betting') this.phase = 'hit';
  }

  hit(id) {
    if (this.phase !== 'hit') return false;
    const player = this.players.find(p => p.id === id && !p.folded && !p.stood);
    if (!player) return false;
    player.hand.push(this.draw());
    if (this.getBestValue(player.hand) > 21) {
      player.folded = true; // bust
    }
    return true;
  }

  stand(id) {
    if (this.phase !== 'hit') return false;
    const player = this.players.find(p => p.id === id && !p.folded);
    if (!player) return false;
    player.stood = true;
    return true;
  }

  revealCommunityCard() {
    if (this.phase !== 'community') return null;
    if (this.community.length >= this.maxCommunity) return null;
    const card = this.draw();
    this.community.push(card);
    this.phase = 'betting';
    return card;
  }

  startCommunityPhase() {
    if (this.phase === 'hit' || this.phase === 'betting') {
      this.phase = 'community';
    }
  }

  getBestValue(cards) {
    let total = 0;
    let aces = 0;
    for (const card of cards) {
      total += cardValue(card);
      if (card.rank === 'A') aces++;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  }

  showdown() {
    this.phase = 'showdown';
    let best = -1;
    let winners = [];
    for (const p of this.players) {
      if (p.folded) continue;
      const value = this.getBestValue(p.hand.concat(this.community));
      if (value > 21) continue;
      if (value > best) {
        best = value;
        winners = [p.id];
      } else if (value === best) {
        winners.push(p.id);
      }
    }
    const share = winners.length ? this.pot / winners.length : 0;
    const result = { winners, score: best, share };
    this.lastShowdown = result;
    return result;
  }

  finishRound() {
    if (!this.lastShowdown) return null;
    const { winners, share } = this.lastShowdown;
    for (const id of winners) {
      const player = this.players.find(p => p.id === id);
      if (player) player.chips += share;
    }
    this.pot = 0;
    this.community = [];
    for (const p of this.players) {
      p.hand = [];
      p.folded = false;
      p.stood = false;
      p.bet = this.stake;
      p.acted = false;
    }
    this.currentBet = this.stake;
    this.pot = this.stake * this.players.length;
    this.phase = 'waiting';
    this.start();
    return { winners, share };
  }

  getState() {
    return {
      roomId: this.roomId,
      stake: this.stake,
      pot: this.pot,
      currentBet: this.currentBet,
      players: this.players,
      community: this.community,
      phase: this.phase,
      lastShowdown: this.lastShowdown
    };
  }

  allPlayersCalled() {
    return this.players.every(p => p.folded || (p.bet === this.currentBet && p.acted));
  }

  allPlayersSettled() {
    return this.players.every(p => p.folded || p.stood);
  }
}

export default BlackjackGame;
