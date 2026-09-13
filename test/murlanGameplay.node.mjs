import test from 'node:test';
import assert from 'node:assert/strict';
import { arenaHarness } from './fixtures/murlanArenaHarness.mjs';
import {DEFAULT_CONFIG,detectCombo,canBeat,legalCombosFromHand} from '../lib/murlan.js';

function rng(seed) {return () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const key = (cards) => cards.map(c=>c.id).sort().join(',');

test('targeted legal move generation matches exhaustive subsets', () => {
  const random=rng(47);
  const deck=[]; for(const suit of ['♠','♥','♣','♦']) for(const rank of DEFAULT_CONFIG.RANK_ORDER.slice(0,13)) deck.push({id:`${rank}${suit}`,rank,suit});
  deck.push({id:'JB',rank:'JB',suit:'🃏'},{id:'JR',rank:'JR',suit:'🃏'});
  for(const config of [DEFAULT_CONFIG,{...DEFAULT_CONFIG,enableFiveCard:true},{...DEFAULT_CONFIG,USE_JOKER_AS_WILD:true},{...DEFAULT_CONFIG,STRAIGHTS_REQUIRE_SAME_SUIT:true}]) {
    for(let deal=0;deal<12;deal++) {
      const hand=[...deck].sort(()=>random()-.5).slice(0,12);
      if(deal===0) hand.splice(0,7,...deck.slice(0,7));
      const table=deal%2?detectCombo([deck[deal]],config):null;
      const expected=[];
      for(let mask=1;mask<(1<<hand.length);mask++) {
        const cards=hand.filter((_,i)=>mask&(1<<i)); const combo=detectCombo(cards,config);
        if(combo && canBeat(combo,table,config))expected.push(key(cards));
      }
      assert.deepEqual(legalCombosFromHand(hand,table,config).map(c=>key(c.cards)).sort(),[...new Set(expected)].sort());
    }
  }
});

test('production arena completes 90 seeded 2/3/4-player games without losing cards or skipping the opener', () => {
  for(const count of [2,3,4]) for(let seed=1;seed<=30;seed++) {
    const math=Object.create(Math); math.random=rng(seed);
    const {context:c,load}=arenaHarness({Math:math});
    for(const name of ['GAME_CONFIG','SUITS','DEFAULT_START_CARD','createDeck','shuffleInPlace','dealHands','getNextAlive','initializeGame','buildPlayState','buildPassState','runAiTurn'])load(name);
    let state=c.initializeGame(Array.from({length:count},(_,i)=>({name:`Player ${i}`,isHuman:false})));
    let turns=0;
    while(state.status==='PLAYING' && turns<600) {
      const previous=state;
      state=c.runAiTurn(state); turns++;
      assert.notEqual(state,previous);
      const action=state.lastAction;
      assert.equal(action.playerIndex,previous.activePlayer);
      assert.equal(previous.players[action.playerIndex].finished,false);
      if(action.type==='PLAY') {
        assert.ok(canBeat(detectCombo(action.cards),previous.tableCombo));
        assert.ok(action.cards.every(card=>previous.players[action.playerIndex].hand.some(c=>c.id===card.id)));
        if(previous.firstMove)assert.ok(action.cards.some(c=>c.rank===previous.openingCard.rank && c.suit===previous.openingCard.suit));
      } else assert.ok(previous.tableCombo);
      const cards=[...state.players.flatMap(p=>p.hand),...state.tableCards,...state.discardPile,...state.stockCards];
      assert.equal(cards.length,54); assert.equal(new Set(cards.map(c=>c.id)).size,54);
    }
    assert.equal(state.status,'ENDED',`${count} players seed ${seed}`);
    assert.ok(turns<600);
    assert.equal(state.players.filter(p=>!p.finished).length,1);
  }
});
