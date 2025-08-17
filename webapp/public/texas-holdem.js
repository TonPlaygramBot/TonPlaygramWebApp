import {
  createDeck,
  shuffle,
  dealHoleCards,
  dealCommunity,
  evaluateWinner,
  aiChooseAction,
  HAND_RANK_NAMES,
} from './lib/texasHoldem.js';
import { FLAG_EMOJIS } from './flag-emojis.js';

const state = {
  players: [],
  community: [],
  stage: 0,
  currentBet: 0,
  turn: 0,
  turnTime: 0,
  timerInterval: null,
  stake: 0,
  token: 'TPC',
};

const SUIT_MAP = { H: '♥', D: '♦', C: '♣', S: '♠' };
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
function flagName(flag) {
  const codePoints = [...flag].map((c) => c.codePointAt(0) - 0x1f1e6 + 65);
  return regionNames.of(String.fromCharCode(...codePoints));
}

function cardFaceEl(c) {
  const d = document.createElement('div');
  d.className =
    'card' +
    ((c.s === '♥' || c.s === '♦') ? ' red' : '') +
    ((c.r === 'RJ' || c.r === 'BJ') ? ' joker' : '');
  const tl = document.createElement('div');
  tl.className = 'tl';
  tl.textContent =
    (c.r === 'BJ' ? 'JB' : c.r === 'RJ' ? 'JR' : c.r) +
    (c.s === '🃏' ? '' : c.s);
  const br = document.createElement('div');
  br.className = 'br';
  br.textContent = c.s === '🃏' ? '🃏' : c.s;
  const big = document.createElement('div');
  big.className = 'big';
  big.textContent = c.s === '🃏' ? '🃏' : c.s;
  d.append(tl, big, br);
  return d;
}

function coinConfetti(count = 50, iconSrc = '/assets/icons/ezgif-54c96d8a9b9236.webp') {
  for (let i = 0; i < count; i++) {
    const img = document.createElement('img');
    img.src = iconSrc;
    img.className = 'coin-confetti';
    img.style.left = Math.random() * 100 + 'vw';
    img.style.setProperty('--duration', 2 + Math.random() * 2 + 's');
    document.body.appendChild(img);
    setTimeout(() => img.remove(), 3000);
  }
}

function init() {
  const params = new URLSearchParams(location.search);
  let name = params.get('username') || 'You';
  let avatar = params.get('avatar') || '';
  state.stake = parseInt(params.get('amount'), 10) || 0;
  state.token = params.get('token') || 'TPC';
  try {
    if (!name) {
      const initParam = params.get('init');
      if (initParam) {
        const data = new URLSearchParams(decodeURIComponent(initParam));
        const user = JSON.parse(data.get('user') || '{}');
        name = user.username || user.first_name || name;
        avatar = user.photo_url || avatar;
      } else if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const u = window.Telegram.WebApp.initDataUnsafe.user;
        name = u.username || u.first_name || name;
        avatar = u.photo_url || avatar;
      }
    }
  } catch {}

    const deck = shuffle(createDeck());
    const { hands, deck: rest } = dealHoleCards(deck, 6);
    const flags = [...FLAG_EMOJIS].sort(() => 0.5 - Math.random()).slice(0, 5);
    state.players = [
      { name, avatar, hand: hands[0], isHuman: true },
      ...flags.map((f, idx) => ({
        name: flagName(f),
        avatar: f,
        hand: hands[idx + 1],
      })),
    ];
  const comm = dealCommunity(rest);
  state.community = comm.community;
  renderSeats();
  startPlayerTurn();
}

function renderSeats() {
  const seats = document.getElementById('seats');
  seats.innerHTML = '';
  const positions = ['bottom', 'bottom-right', 'right', 'top', 'left', 'bottom-left'];
  state.players.forEach((p, i) => {
    const seat = document.createElement('div');
    seat.className = 'seat ' + positions[i];
    if (!p.isHuman) seat.classList.add('small');
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    if (p.avatar && p.avatar.startsWith('http')) {
      avatar.style.background = `url('${p.avatar}') center/cover no-repeat`;
    } else if (p.avatar) {
      avatar.textContent = p.avatar;
    } else {
      avatar.textContent = p.name[0] || '?';
    }
    const cards = document.createElement('div');
    cards.className = 'cards';
    cards.id = 'cards-' + i;
    if (p.isHuman) {
      p.hand.forEach((c) => cards.appendChild(cardEl(c)));
    } else {
      p.hand.forEach(() => cards.appendChild(cardBackEl()));
    }
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = p.name;
      if (i === 0) {
        const wrap = document.createElement('div');
        wrap.className = 'avatar-wrap';
        const ring = document.createElement('div');
        ring.className = 'timer-ring';
        ring.id = 'timer-' + i;
        wrap.append(ring, avatar);
        const controls = document.createElement('div');
        controls.className = 'controls';
        controls.id = 'controls';
        seat.append(cards, controls, wrap, name);
      } else {
        const timer = document.createElement('div');
        timer.className = 'timer';
        timer.id = 'timer-' + i;
        if (positions[i] === 'top') seat.append(name, avatar, cards, timer);
        else seat.append(avatar, cards, name, timer);
      }
    seats.appendChild(seat);
  });
}

function cardEl(card) {
  return cardFaceEl({
    r: card.rank === 'T' ? '10' : card.rank,
    s: SUIT_MAP[card.suit] || card.suit,
  });
}

function cardBackEl() {
  const div = document.createElement('div');
  div.className = 'card back';
  return div;
}

function showControls() {
  const controls = document.getElementById('controls');
  controls.innerHTML = '';
  const actions = [
    { id: 'fold', fn: playerFold },
    { id: 'check', fn: playerCheck },
    { id: 'call', fn: playerCall },
    { id: 'raise', fn: playerRaise },
  ];
  actions.forEach((a) => {
    const btn = document.createElement('button');
    btn.textContent = a.id;
    btn.addEventListener('click', a.fn);
    controls.appendChild(btn);
  });
}

function hideControls() {
  const controls = document.getElementById('controls');
  if (controls) controls.innerHTML = '';
}

function startPlayerTurn() {
  state.turn = 0;
  state.currentBet = 0;
  showControls();
  startTurnTimer(() => {
    if (state.currentBet > 0) playerFold();
    else playerCheck();
  });
}

function startTurnTimer(onTimeout) {
  state.turnTime = 15;
  updateTimer();
  const snd = document.getElementById('sndTimer');
  clearInterval(state.timerInterval);
  state.timerInterval = setInterval(() => {
    state.turnTime--;
    if (state.turnTime <= 7 && state.turnTime > 0) {
      snd.currentTime = 0;
      snd.play();
    }
    updateTimer();
    if (state.turnTime <= 0) {
      clearInterval(state.timerInterval);
      onTimeout();
    }
  }, 1000);
}

function updateTimer() {
  const t = document.getElementById('timer-' + state.turn);
  if (!t) return;
  if (state.turn === 0) {
    const pct = (state.turnTime / 15) * 360;
    t.style.setProperty('--progress', pct);
  } else {
    t.textContent = state.turnTime > 0 ? state.turnTime : '';
  }
}

function playerFold() {
  clearInterval(state.timerInterval);
  hideControls();
  document.getElementById('status').textContent = 'You folded';
}

function playerCheck() {
  proceedStage();
}

function playerCall() {
  proceedStage();
}

function playerRaise() {
  state.currentBet++;
  proceedStage();
}

function proceedStage() {
  clearInterval(state.timerInterval);
  hideControls();
  state.players.slice(1).forEach((p) => {
    const action = aiChooseAction(p.hand, state.community.slice(0, stageCommunityCount()));
    document.getElementById('status').textContent = `${p.name} ${action}s`;
  });
  state.stage++;
  if (state.stage === 1) revealFlop();
  else if (state.stage === 2) revealTurn();
  else if (state.stage === 3) revealRiver();
  else showdown();
}

function stageCommunityCount() {
  if (state.stage === 0) return 0;
  if (state.stage === 1) return 3;
  if (state.stage === 2) return 4;
  return 5;
}

function revealFlop() {
  const comm = document.getElementById('community');
  for (let i = 0; i < 3; i++) comm.appendChild(cardEl(state.community[i]));
  startPlayerTurn();
}

function revealTurn() {
  const comm = document.getElementById('community');
  comm.appendChild(cardEl(state.community[3]));
  startPlayerTurn();
}

function revealRiver() {
  const comm = document.getElementById('community');
  comm.appendChild(cardEl(state.community[4]));
  startPlayerTurn();
}

function showdown() {
  state.players.forEach((p, i) => {
    const cards = document.getElementById('cards-' + i);
    cards.innerHTML = '';
    p.hand.forEach((c) => cards.appendChild(cardEl(c)));
  });
  const winner = evaluateWinner(state.players, state.community);
  const pot = state.stake * state.players.length;
  const text = winner
    ? `${state.players[winner.index].name} wins with ${HAND_RANK_NAMES[winner.score.rank]}!`
    : 'Tie';
  document.getElementById('status').textContent = text;
  if (winner) {
    const winning = winner.score.cards;
    const commEl = document.getElementById('community');
    state.community.forEach((c, idx) => {
      if (winning.includes(c)) commEl.children[idx].classList.add('winning');
    });
    const playerCardsEl = document.getElementById('cards-' + winner.index);
    state.players[winner.index].hand.forEach((c, idx) => {
      const el = playerCardsEl.children[idx];
      el.classList.add('winning');
    });
    const seat = playerCardsEl.closest('.seat');
    if (seat) seat.classList.add('winner');

    const winnerPlayer = state.players[winner.index];
    const overlay = document.getElementById('winnerOverlay');
    const amountText = pot ? `${pot} ${state.token}` : '';
    if (winnerPlayer.avatar && winnerPlayer.avatar.startsWith('http')) {
      overlay.innerHTML = `<img src="${winnerPlayer.avatar}"/><div>${amountText}</div>`;
    } else if (winnerPlayer.avatar) {
      overlay.innerHTML = `<div class="avatar">${winnerPlayer.avatar}</div><div>${amountText}</div>`;
    } else {
      overlay.innerHTML = `<div class="avatar">${winnerPlayer.name[0] || '?'}</div><div>${amountText}</div>`;
    }
    overlay.classList.remove('hidden');
    coinConfetti(50);
    setTimeout(() => {
      overlay.classList.add('hidden');
      document.getElementById('resultText').textContent = `${winnerPlayer.name} won ${amountText}`;
      document.getElementById('results').showModal();
    }, 2000);
  } else {
    document.getElementById('resultText').textContent = 'Tie';
    document.getElementById('results').showModal();
  }
}

document.getElementById('lobbyBtn')?.addEventListener('click', () => {
  location.href = '/games/texasholdem/lobby';
});
document.addEventListener('DOMContentLoaded', init);
