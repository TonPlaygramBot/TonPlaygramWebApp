// Basic Texas Hold'em poker logic with simple AI
// Card representation: { rank: 'A', suit: 'S' }

export const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
export const SUITS = ['H','D','C','S'];
export const HAND_RANK_NAMES = [
  'High Card',
  'One Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
];

export function createDeck(){
  const deck=[];
  for(const r of RANKS){
    for(const s of SUITS){
      deck.push({rank:r,suit:s});
    }
  }
  return deck;
}

export function shuffle(deck){
  const d=[...deck];
  for(let i=d.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [d[i],d[j]]=[d[j],d[i]];
  }
  return d;
}

export function dealHoleCards(deck, players){
  const d=[...deck];
  const hands=Array.from({length:players},()=>[]);
  for(let r=0;r<2;r++){
    for(let p=0;p<players;p++){
      hands[p].push(d.pop());
    }
  }
  return {hands, deck:d};
}

export function dealCommunity(deck){
  const d=[...deck];
  const burn=()=>d.pop();
  burn();
  const flop=[d.pop(),d.pop(),d.pop()];
  burn();
  const turn=[d.pop()];
  burn();
  const river=[d.pop()];
  return {community:[...flop,...turn,...river], deck:d};
}

function rankValue(r){
  return RANKS.indexOf(r)+2;
}

function countRanks(cards){
  const counts={};
  for(const c of cards) counts[c.rank]=(counts[c.rank]||0)+1;
  return counts;
}

function isFlush(cards){
  return cards.every(c=>c.suit===cards[0].suit);
}

function isStraight(values){
  const v=[...new Set(values)].sort((a,b)=>a-b);
  if(v.length<5) return false;
  for(let i=0;i<=v.length-5;i++){
    let ok=true;
    for(let j=1;j<5;j++) if(v[i+j]!==v[i]+j) {ok=false;break;}
    if(ok) return v[i+4];
  }
  // special wheel straight (A-2-3-4-5)
  if(v.includes(14)&&v.slice(0,4).join()==='2,3,4,5') return 5;
  return false;
}

function evaluate5(cards){
  const values=cards.map(c=>rankValue(c.rank)).sort((a,b)=>b-a);
  const counts=countRanks(cards);
  const freq=Object.values(counts).sort((a,b)=>b-a);
  const straightHigh=isStraight(values);
  const flush=isFlush(cards);
  let rank=0; let tiebreak=[];
  if(straightHigh && flush){
    rank=8; tiebreak=[straightHigh];
  }else if(freq[0]===4){
    rank=7;
    const four=Object.keys(counts).find(r=>counts[r]===4);
    const kicker=Object.keys(counts).find(r=>counts[r]===1);
    tiebreak=[rankValue(four), rankValue(kicker)];
  }else if(freq[0]===3 && freq[1]===2){
    rank=6;
    const triple=Object.keys(counts).find(r=>counts[r]===3);
    const pair=Object.keys(counts).find(r=>counts[r]===2);
    tiebreak=[rankValue(triple), rankValue(pair)];
  }else if(flush){
    rank=5; tiebreak=values;
  }else if(straightHigh){
    rank=4; tiebreak=[straightHigh];
  }else if(freq[0]===3){
    rank=3;
    const triple=Object.keys(counts).find(r=>counts[r]===3);
    const kickers=Object.keys(counts).filter(r=>counts[r]===1).sort((a,b)=>rankValue(b)-rankValue(a));
    tiebreak=[rankValue(triple), ...kickers.map(rankValue)];
  }else if(freq[0]===2 && freq[1]===2){
    rank=2;
    const pairs=Object.keys(counts).filter(r=>counts[r]===2).sort((a,b)=>rankValue(b)-rankValue(a));
    const kicker=Object.keys(counts).find(r=>counts[r]===1);
    tiebreak=[...pairs.map(rankValue), rankValue(kicker)];
  }else if(freq[0]===2){
    rank=1;
    const pair=Object.keys(counts).find(r=>counts[r]===2);
    const kickers=Object.keys(counts).filter(r=>counts[r]===1).sort((a,b)=>rankValue(b)-rankValue(a));
    tiebreak=[rankValue(pair), ...kickers.map(rankValue)];
  }else{
    rank=0; tiebreak=values;
  }
  return {rank, tiebreak};
}

function combinations(cards, k){
  const res=[]; const n=cards.length;
  function rec(start,combo){
    if(combo.length===k){res.push([...combo]); return;}
    for(let i=start;i<n;i++){
      combo.push(cards[i]);
      rec(i+1,combo);
      combo.pop();
    }
  }
  rec(0,[]);
  return res;
}

export function bestHand(cards){
  let best=null;
  for(const c of combinations(cards,5)){
    const e=evaluate5(c);
    if(!best||e.rank>best.rank|| (e.rank===best.rank && compareTiebreak(e.tiebreak,best.tiebreak)>0)){
      best={...e,cards:c};
    }
  }
  return best;
}

function compareTiebreak(a,b){
  for(let i=0;i<Math.max(a.length,b.length);i++){
    const av=a[i]||0, bv=b[i]||0;
    if(av!==bv) return av-bv;
  }
  return 0;
}

export function compareHands(aCards,bCards){
  const a=bestHand(aCards);
  const b=bestHand(bCards);
  if(a.rank!==b.rank) return a.rank-b.rank;
  return compareTiebreak(a.tiebreak,b.tiebreak);
}

export function evaluateWinner(players, community){
  let best=-Infinity, winner=null;
  players.forEach((p,i)=>{
    const score=bestHand([...p.hand,...community]);
    if(score.rank>best || (score.rank===best && compareTiebreak(score.tiebreak,winner?.score.tiebreak)>0)){
      best=score.rank; winner={index:i, score};
    } else if(score.rank===winner?.score.rank && compareTiebreak(score.tiebreak,winner.score.tiebreak)===0){
      winner=null; // tie
    }
  });
  return winner;
}

export function aiChooseAction (hand, community = [], toCall = 0) {
  const stage = community.length; //0 preflop,3 flop,4 turn,5 river

  if (stage < 3) {
    const hv = hand.map((c) => rankValue(c.rank)).sort((a, b) => b - a);
    if (toCall > 0) {
      if (hv[0] === hv[1] && hv[0] >= 11) return 'raise';
      if (hv[0] >= 12 || hv[0] === hv[1]) return 'call';
      return 'fold';
    }
    if (hv[0] === hv[1] && hv[0] >= 12) return 'raise';
    if (hv[0] >= 11) return 'check';
    return 'fold';
  }

  const score = bestHand([...hand, ...community]);
  if (toCall > 0) {
    if (score && score.rank >= 5) return 'raise';
    if (score && score.rank >= 2) return 'call';
    return 'fold';
  }
  if (score && score.rank >= 4) return 'raise';
  if (score && score.rank >= 1) return 'check';
  return 'fold';
}
