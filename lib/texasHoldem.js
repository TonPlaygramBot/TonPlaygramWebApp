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
  let bestScore=null; const winners=[];
  players.forEach((p,i)=>{
    const score=bestHand([...p.hand,...community]);
    if(!bestScore||score.rank>bestScore.rank|| (score.rank===bestScore.rank && compareTiebreak(score.tiebreak,bestScore.tiebreak)>0)){
      bestScore=score; winners.splice(0,winners.length,{index:i,score});
    } else if(score.rank===bestScore.rank && compareTiebreak(score.tiebreak,bestScore.tiebreak)===0){
      winners.push({index:i,score});
    }
  });
  return winners;
}

export function estimateWinProbability(hand, community = [], opponents = 1, simulations = 200){
  const used=new Set([...hand,...community].map(c=>c.rank+c.suit));
  const remaining=createDeck().filter(c=>!used.has(c.rank+c.suit));
  let wins=0, ties=0;
  for(let i=0;i<simulations;i++){
    const d=shuffle([...remaining]);
    const oppHands=Array.from({length:opponents},()=>[d.pop(),d.pop()]);
    const needed=5-community.length;
    const comm=[...community];
    for(let j=0;j<needed;j++) comm.push(d.pop());
    const myCards=[...hand,...comm];
    const myScore=bestHand(myCards);
    let outcome=1; //1 win,0.5 tie,0 lose
    for(const oh of oppHands){
      const oppScore=bestHand([...oh,...comm]);
      let cmp=myScore.rank-oppScore.rank;
      if(cmp===0) cmp=compareTiebreak(myScore.tiebreak,oppScore.tiebreak);
      if(cmp<0){ outcome=0; break; }
      if(cmp===0){ outcome=Math.min(outcome,0.5); }
    }
    if(outcome===1) wins++; else if(outcome===0.5) ties++;
  }
  return (wins+ties/2)/simulations;
}

export function aiChooseAction (hand, community = [], toCall = 0) {
  const winProb=estimateWinProbability(hand,community);
  if(toCall>0){
    if(winProb>0.7) return 'raise';
    if(winProb>0.4) return 'call';
    return 'fold';
  }
  if(winProb>0.7) return 'raise';
  if(winProb>0.4) return 'check';
  return 'fold';
}
