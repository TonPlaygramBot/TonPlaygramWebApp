import { newDeck, shuffle } from './deck';
import type { TableState, PlayerAction, Card } from './pokerTypes';

function rotateActive(ts: TableState): string | undefined {
  if (!ts.activePlayerId) return undefined;
  const idx = ts.players.findIndex(p => p.id === ts.activePlayerId);
  for (let i = 1; i <= ts.players.length; i++) {
    const p = ts.players[(idx + i) % ts.players.length];
    if (!p.folded && p.stack > 0) return p.id;
  }
  return undefined;
}

export function startHand(ts: TableState, rng: () => number = Math.random): { table: TableState; deck: Card[] } {
  const deck = shuffle(newDeck(), rng);
  const players = ts.players.map(p => ({ ...p, bet: 0, folded: false, hole: [] as Card[] }));
  // blinds
  const sb = ts.stake / 10;
  const bb = ts.stake / 5;
  if (players[0]) {
    players[0].bet = sb;
    players[0].stack -= sb;
  }
  if (players[1]) {
    players[1].bet = bb;
    players[1].stack -= bb;
  }
  let deckIdx = 0;
  for (let r = 0; r < 2; r++) {
    for (const p of players) {
      p.hole!.push(deck[deckIdx++]);
    }
  }
  return {
    table: {
      ...ts,
      players,
      board: [],
      pot: sb + bb,
      minRaise: ts.stake / 5,
      activePlayerId: players[2]?.id ?? players[0]?.id,
      handFinished: false,
    },
    deck: deck.slice(deckIdx),
  };
}

export function applyAction(ts: TableState, pid: string, action: PlayerAction): TableState {
  const players = ts.players.map(p => ({ ...p }));
  const actor = players.find(p => p.id === pid);
  if (!actor) return ts;
  let pot = ts.pot;
  let minRaise = ts.minRaise;
  switch (action.type) {
    case 'FOLD':
      actor.folded = true;
      break;
    case 'CHECK_CALL': {
      const maxBet = Math.max(...players.map(p => p.bet));
      const toCall = Math.max(0, maxBet - actor.bet);
      const call = Math.min(toCall, actor.stack);
      actor.bet += call;
      actor.stack -= call;
      pot += call;
      break;
    }
    case 'RAISE': {
      const maxBet = Math.max(...players.map(p => p.bet));
      const raiseTo = maxBet + action.amount;
      const diff = raiseTo - actor.bet;
      const paid = Math.min(diff, actor.stack);
      actor.bet += paid;
      actor.stack -= paid;
      pot += paid;
      minRaise = action.amount;
      break;
    }
  }
  const activePlayerId = rotateActive({ ...ts, players, activePlayerId: pid });
  const othersActive = players.filter(p => !p.folded).length;
  const handFinished = othersActive <= 1;
  return { ...ts, players, activePlayerId, handFinished, pot, minRaise };
}
