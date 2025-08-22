import {
  createDeck,
  shuffle,
  dealInitial,
  hitCard,
  handValue,
  isBust,
  evaluateWinners,
  aiAction
} from './lib/blackjack.js';

const FLAG_EMOJIS = window.FLAG_EMOJIS || [];

const state = {
  players: [],
  deck: [],
  turn: 0,
  stake: 0,
  token: 'TPC',
  devAccountId: '',
};

let myAccountId = '';
let myTelegramId;

async function awardDevShare(total) {
  if (!state.devAccountId || !window.fbApi) return;
  try {
    await window.fbApi.depositAccount(state.devAccountId, Math.round(total * 0.1), {
      game: 'blackjack-dev'
    });
  } catch {}
}

function cardFaceEl({ r, s }) {
  const div = document.createElement('div');
  div.className = `card ${s === '♥' || s === '♦' ? 'red' : ''}`;
  div.innerHTML = `\n    <div class="corner tl"><span class="rank">${r}</span><span class="suit">${s}</span></div>\n    <div class="corner br"><span class="rank">${r}</span><span class="suit">${s}</span></div>\n    <div class="big">${s}</div>\n  `;
  return div;
}

const SUIT_MAP = { H: '♥', D: '♦', C: '♣', S: '♠' };
function cardEl(card) {
  return cardFaceEl({
    r: card.rank === 'T' ? '10' : card.rank,
    s: SUIT_MAP[card.suit] || card.suit
  });
}

function render() {
  const seats = document.getElementById('seats');
  seats.innerHTML = '';
  const POS = [
    { left: '50%', top: '80%' },
    { left: '80%', top: '60%' },
    { left: '80%', top: '30%' },
    { left: '50%', top: '10%' },
    { left: '20%', top: '30%' },
    { left: '20%', top: '60%' }
  ];
  state.players.forEach((p, i) => {
    const seat = document.createElement('div');
    seat.className = 'seat';
    const pos = POS[i] || { left: '50%', top: '50%' };
    seat.style.left = pos.left;
    seat.style.top = pos.top;
    seat.style.transform = 'translate(-50%, -50%)';
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = p.avatar || p.name[0];
    const cards = document.createElement('div');
    cards.className = 'cards';
    p.hand.forEach((c) => cards.appendChild(cardEl(c)));
    const bal = document.createElement('div');
    bal.className = 'seat-balance';
    bal.textContent = `${p.name} (${handValue(p.hand)})`;
    seat.append(avatar, cards, bal);
    if (i === state.turn && !p.stood && !p.bust) seat.classList.add('active');
    if (p.bust) seat.classList.add('folded');
    seats.appendChild(seat);
  });
}

function nextTurn() {
  state.turn++;
  if (state.turn >= state.players.length) {
    finish();
    return;
  }
  const p = state.players[state.turn];
  if (!p.isHuman) {
    setTimeout(aiTurn, 500);
  }
  render();
}

function aiTurn() {
  const p = state.players[state.turn];
  if (p.stood || p.bust) {
    nextTurn();
    return;
  }
  const act = aiAction(p.hand);
  if (act === 'hit') {
    const { card, deck } = hitCard(state.deck);
    state.deck = deck;
    p.hand.push(card);
    if (isBust(p.hand)) {
      p.bust = true;
      p.stood = true;
    }
    render();
    setTimeout(aiTurn, 500);
  } else {
    p.stood = true;
    nextTurn();
  }
}

window.hit = () => {
  const p = state.players[state.turn];
  if (!p || !p.isHuman || p.stood || p.bust) return;
  const { card, deck } = hitCard(state.deck);
  state.deck = deck;
  p.hand.push(card);
  if (isBust(p.hand) || handValue(p.hand) === 21) {
    p.bust = isBust(p.hand);
    p.stood = true;
    nextTurn();
  }
  render();
};

window.stand = () => {
  const p = state.players[state.turn];
  if (!p || !p.isHuman) return;
  p.stood = true;
  nextTurn();
};

function finish() {
  const winners = evaluateWinners(state.players);
  const pot = state.stake * state.players.length;
  awardDevShare(pot);
  const share = Math.floor((pot * 0.9) / winners.length);
  winners.forEach((i) => {
    const player = state.players[i];
    player.balance = (player.balance || 0) + share;
  });
  const status = document.getElementById('status');
  if (status) {
    status.textContent =
      winners.length === 1
        ? `${state.players[winners[0]].name} wins!`
        : `Tie between ${winners.map((i) => state.players[i].name).join(', ')}`;
  }
  render();
}

function init() {
  const params = new URLSearchParams(location.search);
  state.token = params.get('token') || 'TPC';
  state.stake = parseInt(params.get('amount') || '0', 10);
  state.devAccountId = params.get('dev') || '';
  myAccountId = params.get('accountId') || '';
  myTelegramId = params.get('tgId') || '';
  const avatar = params.get('avatar') || '';
  const username = params.get('username') || 'You';

  const playerCount = 6;
  for (let i = 0; i < playerCount; i++) {
    const ai = i !== 0;
    const name = ai ? `AI ${i}` : username;
    const av = ai ? FLAG_EMOJIS[i % FLAG_EMOJIS.length] : avatar;
    state.players.push({ hand: [], stood: false, bust: false, name, avatar: av, isHuman: !ai });
  }

  const deck = shuffle(createDeck());
  const { hands, deck: d } = dealInitial(deck, state.players.length);
  state.deck = d;
  hands.forEach((h, i) => (state.players[i].hand = h));
  render();
  const p0 = state.players[0];
  if (!p0.isHuman) setTimeout(aiTurn, 500);
}

init();
