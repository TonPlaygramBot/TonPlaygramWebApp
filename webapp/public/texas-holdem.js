import { createDeck, shuffle, dealHoleCards, dealCommunity, evaluateWinner, aiChooseAction, bestHand } from './lib/texasHoldem.js';

const state={};
function init(){
  const deck=shuffle(createDeck());
  const {hands, deck:rest}=dealHoleCards(deck,2);
  state.players=[{name:'You', hand:hands[0]},{name:'AI', hand:hands[1]}];
  const comm=dealCommunity(rest);
  state.community=comm.community;
  state.stage=0;
  renderHands();
  setTimeout(()=>revealFlop(),500);
}

function cardEl(card){
  const div=document.createElement('div');
  div.className='card';
  div.textContent=card.rank+card.suit;
  return div;
}

function renderHands(){
  const pc=document.getElementById('player-cards');
  pc.innerHTML='';
  state.players[0].hand.forEach(c=>pc.appendChild(cardEl(c)));
  const ai=document.getElementById('ai-cards');
  ai.innerHTML='';
  if(state.stage<5){
    state.players[1].hand.forEach(()=>{
      const b=document.createElement('div'); b.className='card back'; ai.appendChild(b);
    });
  }else{
    state.players[1].hand.forEach(c=>ai.appendChild(cardEl(c)));
  }
}

function revealFlop(){
  state.stage=3;
  const comm=document.getElementById('community');
  for(let i=0;i<3;i++) comm.appendChild(cardEl(state.community[i]));
  const aiAction=aiChooseAction(state.players[1].hand, state.community.slice(0,3));
  document.getElementById('status').textContent=`AI ${aiAction}s`;
  setTimeout(()=>revealTurn(),800);
}

function revealTurn(){
  state.stage=4;
  const comm=document.getElementById('community');
  comm.appendChild(cardEl(state.community[3]));
  setTimeout(()=>revealRiver(),800);
}

function revealRiver(){
  state.stage=5;
  const comm=document.getElementById('community');
  comm.appendChild(cardEl(state.community[4]));
  renderHands();
  showdown();
}

function showdown(){
  const winner=evaluateWinner(state.players, state.community);
  const text= winner? `${state.players[winner.index].name} wins!` : 'Tie';
  document.getElementById('status').textContent=text;
}

document.addEventListener('DOMContentLoaded', init);
