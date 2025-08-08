'use client';

import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import PokerScene from '../../components/poker/PokerScene';
import HUD from '../../components/poker/HUD';
import RoomSelector from '../../components/poker/RoomSelector';
import { FEATURE_FLAGS, BRAND } from '../../lib/config';
import type { TableState, PlayerAction, JoinRoomPayload, StakeTier, Card } from '../../shared/pokerTypes';
import { startHand, applyAction } from '../../shared/pokerLogic';

// Placeholder stake locking functions for future TON integration
export async function lockStakeTPC(_wallet: string, _amount: number, _roomId: string) {}
export async function releaseStakeTPC(_wallet: string, _pot: number, _feeBps: number) {}

export default function PokerPage() {
  const useLocal = FEATURE_FLAGS.useLocalDemo;
  const [joined, setJoined] = useState(false);
  const [table, setTable] = useState<TableState | null>(null);
  const [deck, setDeck] = useState<Card[]>([]);
  const cardsRef = useRef<THREE.Mesh[]>([]);

  const onJoin = ({ stake, seats }: JoinRoomPayload) => {
    const players = [
      { id: 'you', stack: stake * 10, bet: 0, folded: false },
      { id: 'bot', stack: stake * 10, bet: 0, folded: false },
    ];
    const t: TableState = {
      roomId: 'local',
      stake,
      seats,
      players,
      board: [],
      pot: 0,
      minRaise: stake / 5,
    };
    setTable(t);
    setDeck([]);
    setJoined(true);
    lockStakeTPC('wallet', stake * 10, t.roomId);
  };

  const start = () => {
    if (!table) return;
    const { table: t, deck: d } = startHand(table);
    setTable(t);
    setDeck(d);
    if (t.activePlayerId === 'bot') {
      const afterBot = botAct(t, d);
      setTable(afterBot.table);
      setDeck(afterBot.deck);
    }
  };

  const changeStake = (s: StakeTier) => {
    setTable(t => (t ? { ...t, stake: s, minRaise: s / 5 } : t));
  };

  const advanceIfNeeded = (t: TableState, d: Card[]): { table: TableState; deck: Card[] } => {
    const active = t.players.filter(p => !p.folded);
    if (active.length <= 1) {
      const winner = active[0];
      const players = t.players.map(p =>
        p.id === winner.id ? { ...p, stack: p.stack + t.pot, bet: 0 } : { ...p, bet: 0 }
      );
      releaseStakeTPC('wallet', t.pot, 0);
      return { table: { ...t, players, pot: 0, activePlayerId: undefined, handFinished: true }, deck: d };
    }
    const maxBet = Math.max(...active.map(p => p.bet));
    const allEqual = active.every(p => p.bet === maxBet);
    if (!allEqual || t.activePlayerId) return { table: t, deck: d };
    // betting round complete
    let nextBoard: Card[] = t.board;
    let take = 0;
    if (t.board.length === 0) take = 3; // flop
    else if (t.board.length === 3) take = 1; // turn
    else if (t.board.length === 4) take = 1; // river
    else {
      // showdown
      const winner = roughWinner(t);
      const players = t.players.map(p =>
        p.id === winner ? { ...p, stack: p.stack + t.pot, bet: 0 } : { ...p, bet: 0 }
      );
      releaseStakeTPC('wallet', t.pot, 0);
      return {
        table: { ...t, players, pot: 0, activePlayerId: undefined, handFinished: true },
        deck: d,
      };
    }
    nextBoard = [...t.board, ...d.slice(0, take)];
    const nextDeck = d.slice(take);
    const resetPlayers = t.players.map(p => ({ ...p, bet: 0 }));
    return {
      table: { ...t, board: nextBoard, players: resetPlayers, activePlayerId: active[0].id },
      deck: nextDeck,
    };
  };

  const botAct = (t: TableState, d: Card[]): { table: TableState; deck: Card[] } => {
    if (t.activePlayerId !== 'bot') return { table: t, deck: d };
    let action: PlayerAction = { type: 'CHECK_CALL' };
    if (Math.random() < 0.2) action = { type: 'RAISE', amount: t.minRaise };
    if (Math.random() < 0.1) action = { type: 'FOLD' };
    let tableAfter = applyAction(t, 'bot', action);
    let deckAfter = d;
    ({ table: tableAfter, deck: deckAfter } = advanceIfNeeded(tableAfter, deckAfter));
    return { table: tableAfter, deck: deckAfter };
  };

  const onAction = (a: PlayerAction) => {
    if (!table) return;
    let t = applyAction(table, 'you', a);
    let d = deck;
    ({ table: t, deck: d } = advanceIfNeeded(t, d));
    if (!t.handFinished) {
      const botRes = botAct(t, d);
      t = botRes.table;
      d = botRes.deck;
    }
    setTable(t);
    setDeck(d);
  };

  // development smoke tests
  const ranSmoke = useRef(false);
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !table || ranSmoke.current) return;
    ranSmoke.current = true;
    console.log('cards length', cardsRef.current.length);
    console.log('visible initial', cardsRef.current.filter(c => c.visible).length);
    setTable(t => (t ? { ...t, board: ['Ah', 'Kd', 'Qc'] } : t));
    setTimeout(() => {
      console.log('visible after 3', cardsRef.current.filter(c => c.visible).length);
      setTable(t => (t ? { ...t, board: [] } : t));
    }, 0);
  }, [table]);

  if (!joined || !table) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND.bg }}>
        <RoomSelector onJoin={onJoin} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen" style={{ background: BRAND.bg }}>
      <PokerScene table={table} cardsRef={cardsRef} />
      <HUD table={table} onAction={onAction} onStart={start} onStakeChange={changeStake} />
    </div>
  );
}

function roughWinner(t: TableState): string {
  const ranks = '23456789TJQKA';
  const strength = (cards: Card[]) => Math.max(...cards.map(c => ranks.indexOf(c[0])));
  const you = t.players[0];
  const bot = t.players[1];
  const youScore = strength([...(you.hole ?? []), ...t.board]);
  const botScore = strength([...(bot.hole ?? []), ...t.board]);
  return youScore >= botScore ? you.id : bot.id;
}
