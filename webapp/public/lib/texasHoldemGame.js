import { createDeck, shuffle, dealHoleCards, dealCommunity, compareHands, aiChooseAction } from './texasHoldem.js'

export function determineWinnersFromHands (players, community, indices) {
  let winners = []
  indices.forEach((i) => {
    if (winners.length === 0) {
      winners = [i]
      return
    }
    const cmp = compareHands(
      [...players[i].hand, ...community],
      [...players[winners[0]].hand, ...community]
    )
    if (cmp > 0) {
      winners = [i]
    } else if (cmp === 0) {
      winners.push(i)
    }
  })
  return winners
}

export function buildSidePotsFromBets (players) {
  const active = players.filter((p) => p.totalBet > 0)
  if (active.length === 0) return []
  const bets = [...new Set(active.map((p) => p.totalBet))].sort((a, b) => a - b)
  let prev = 0
  const pots = []
  bets.forEach((b) => {
    const elig = players.filter((p) => p.totalBet >= b)
    const amount = (b - prev) * elig.length
    pots.push({ amount, players: elig.map((p) => p.index ?? players.indexOf(p)) })
    prev = b
  })
  return pots
}

// Simple Texas Hold'em engine for simulating a hand with betting rounds and pot management.
// Focuses on fold/call actions which is enough for basic AI training.

export class TexasHoldemGame {
  constructor (playerCount, options = {}) {
    const {
      startingChips = 100,
      blinds = { small: 5, big: 10 },
      deck = shuffle(createDeck()),
      actions = [] // array of functions(hand, community, toCall) -> 'fold'|'call'|'check'|'raise'
    } = options

    this.deck = [...deck]
    this.players = Array.from({ length: playerCount }, (_, i) => ({
      index: i,
      hand: [],
      chips: startingChips,
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      action:
        actions[i] || ((hand, community, toCall) => aiChooseAction(hand, community, toCall))
    }))
    this.blinds = blinds
    this.pot = 0
    this.community = []
  }

  // Deal hole cards to all players
  dealHole () {
    const { hands, deck } = dealHoleCards(this.deck, this.players.length)
    this.deck = deck
    hands.forEach((h, i) => {
      this.players[i].hand = h
    })
  }

  // Post blinds and set up initial bets
  postBlinds () {
    const sb = this.players[0]
    const bb = this.players[1 % this.players.length]
    sb.chips -= this.blinds.small
    sb.bet = this.blinds.small
    sb.totalBet = this.blinds.small
    bb.chips -= this.blinds.big
    bb.bet = this.blinds.big
    bb.totalBet = this.blinds.big
    this.pot = this.blinds.small + this.blinds.big
    this.currentBet = this.blinds.big
  }

  // Run a betting round starting from given player index
  bettingRound (startIdx = 0) {
    let playersToAct = this.players.filter((p) => !p.folded && !p.allIn).length
    let idx = startIdx
    let calls = 0
    while (playersToAct > 0 && calls < playersToAct) {
      const p = this.players[idx]
      if (!p.folded && !p.allIn) {
        const toCall = this.currentBet - p.bet
        const act = p.action(p.hand, this.community, toCall)
        if (act === 'fold') {
          p.folded = true
          playersToAct--
        } else if (act === 'raise') {
          const raiseTo = toCall + this.blinds.big
          const amount = Math.min(raiseTo, p.chips)
          p.chips -= amount
          p.bet += amount
          p.totalBet += amount
          this.pot += amount
          if (p.chips === 0) {
            p.allIn = true
            playersToAct--
          }
          this.currentBet = p.bet
          calls = 1
        } else if (act === 'check' && toCall === 0) {
          calls++
        } else {
          const amount = Math.min(toCall, p.chips)
          p.chips -= amount
          p.bet += amount
          p.totalBet += amount
          this.pot += amount
          if (p.chips === 0) {
            p.allIn = true
            playersToAct--
          }
          if (amount === toCall) {
            calls++
          } else {
            this.currentBet = p.bet
            calls = 1
          }
        }
      }
      idx = (idx + 1) % this.players.length
      if (playersToAct <= 1) break
    }
    this.players.forEach((p) => (p.bet = 0))
    this.currentBet = 0
  }

  // Reveal community cards: flop, turn, river
  dealCommunity () {
    const { community, deck } = dealCommunity(this.deck)
    this.community = community
    this.deck = deck
  }

  // Determine winners, supporting ties
  determineWinners (indices) {
    return determineWinnersFromHands(this.players, this.community, indices)
  }

  // Split total bets into pots considering all-ins
  buildPots () {
    return buildSidePotsFromBets(this.players)
  }

  showdown () {
    const contenders = this.players
      .filter((p) => !p.folded)
      .map((p) => p.index)
    const pots = this.buildPots()
    const results = []
    pots.forEach((pot) => {
      const eligible = pot.players.filter((i) => contenders.includes(i))
      const winners = this.determineWinners(eligible)
      const share = pot.amount / winners.length
      winners.forEach((i) => {
        this.players[i].chips += share
      })
      results.push({ pot: pot.amount, winners })
    })
    return results
  }

  play () {
    this.dealHole()
    this.postBlinds()
    // Pre-flop
    this.bettingRound(2 % this.players.length)
    if (this.players.filter((p) => !p.folded).length === 1) {
      return this.showdown()
    }
    // Deal community cards and run rounds
    this.dealCommunity()
    // Flop betting
    this.bettingRound(0)
    if (this.players.filter((p) => !p.folded).length === 1) {
      return this.showdown()
    }
    // Turn betting
    this.community = this.community.slice(0, 4)
    this.bettingRound(0)
    if (this.players.filter((p) => !p.folded).length === 1) {
      return this.showdown()
    }
    // River betting
    this.community = this.community.slice(0, 5)
    this.bettingRound(0)
    return this.showdown()
  }
}

export default TexasHoldemGame
