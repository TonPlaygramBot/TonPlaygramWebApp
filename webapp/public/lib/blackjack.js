export const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
export const SUITS = ['H','D','C','S'];

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

export function dealInitial(deck, players){
  const d=[...deck];
  const hands=Array.from({length:players},()=>[]);
  for(let r=0;r<2;r++){
    for(let p=0;p<players;p++){
      hands[p].push(d.pop());
    }
  }
  return {hands, deck:d};
}

export function hitCard(deck){
  const d=[...deck];
  const card=d.pop();
  return {card, deck:d};
}

function rankValue(r){
  if(r==='A') return 11;
  if(r==='K'||r==='Q'||r==='J'||r==='T') return 10;
  return parseInt(r,10);
}

export function handValue(hand){
  let total=0; let aces=0;
  hand.forEach(c=>{ total+=rankValue(c.rank); if(c.rank==='A') aces++; });
  while(total>21 && aces>0){ total-=10; aces--; }
  return total;
}

export function isBust(hand){
  return handValue(hand)>21;
}

export function evaluateWinners(players){
  let best=0; let winners=[];
  players.forEach((p,i)=>{
    if(p.bust) return;
    const val=handValue(p.hand);
    if(val>21) return;
    if(val>best){ best=val; winners=[i]; }
    else if(val===best){ winners.push(i); }
  });
  return winners;
}

export function aiAction(hand){
  return handValue(hand)<17? 'hit':'stand';
}

export function aiBetAction(hand){
  const val=handValue(hand);
  const bluff=Math.random()<0.1;
  if(val>=19) return 'raise';
  if(val>=15) return bluff? 'raise':'call';
  if(val>=12){
    if(bluff) return 'raise';
    return Math.random()<0.5? 'call':'fold';
  }
  return bluff? 'raise':'fold';
}
