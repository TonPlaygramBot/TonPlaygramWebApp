import {
  createDeck,
  shuffle,
  dealHoleCards,
  dealCommunity,
  evaluateWinner,
  aiChooseAction,
  HAND_RANK_NAMES,
} from './lib/texasHoldem.js';
const FLAG_EMOJIS = window.FLAG_EMOJIS || [];

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
  pot: 0,
  maxPot: 0,
  raiseAmount: 0,
  seated: true,
};

let myAccountId = '';
let myTelegramId;
let devAccountId;

async function awardDevShare(total) {
  if (!devAccountId || !window.fbApi) return;
  try {
    await window.fbApi.depositAccount(devAccountId, Math.round(total * 0.1), {
      game: 'texasholdem-dev',
    });
  } catch {}
}

function playCallRaiseSound() {
  const snd = document.getElementById('sndCallRaise');
  if (snd) {
    snd.currentTime = 0;
    snd.play();
  }
}

function playAllInSound() {
  const snd = document.getElementById('sndAllIn');
  if (snd) {
    snd.currentTime = 0;
    snd.play();
  }
}

function playFlipSound() {
  const snd = document.getElementById('sndFlip');
  if (snd) {
    snd.currentTime = 0;
    snd.play();
  }
}

function playKnockSound() {
  const snd = document.getElementById('sndKnock');
  if (snd) {
    snd.currentTime = 1;
    snd.play();
    setTimeout(() => snd.pause(), 2000);
  }
}

const SUIT_MAP = { H: '♥', D: '♦', C: '♣', S: '♠' };
const CHIP_VALUES = [1000, 500, 200, 100, 50, 20, 10, 5, 1];
const ANTE = 10;
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

function init() {
  clearInterval(state.timerInterval);
  const params = new URLSearchParams(location.search);
  let name = params.get('username') || 'You';
  let avatar = params.get('avatar') || '';
  state.stake = parseInt(params.get('amount'), 10) || 0;
  state.token = params.get('token') || 'TPC';
  devAccountId = params.get('dev');
  myAccountId = params.get('accountId') || '';
  try {
    if (!myAccountId) myAccountId = localStorage.getItem('accountId');
  } catch {}
  if (!myAccountId) {
    myAccountId = crypto.randomUUID();
    try {
      localStorage.setItem('accountId', myAccountId);
    } catch {}
  }
  myTelegramId = params.get('tgId') || window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
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
  const playerCount = state.seated ? 6 : 5;
  const { hands, deck: rest } = dealHoleCards(deck, playerCount);
  const flags = [...FLAG_EMOJIS]
    .sort(() => 0.5 - Math.random())
    .slice(0, playerCount - (state.seated ? 1 : 0));
  state.players = [
    state.seated
      ? { name, avatar, hand: hands[0], isHuman: true, active: true }
      : { name: '', avatar: '', hand: [], isHuman: false, active: false, vacant: true },
    ...flags.map((f, idx) => ({
      name: flagName(f),
      avatar: f,
      hand: hands[idx + (state.seated ? 1 : 0)],
      active: true,
    })),
  ];
  const comm = dealCommunity(rest);
  state.community = comm.community;
  state.stage = 0;
  state.turn = 0;
  state.currentBet = 0;
  state.raiseAmount = 0;
  state.pot = 0;
  state.maxPot = state.stake * state.players.filter((p) => p.active).length;
  const potEl = document.getElementById('pot');
  const wrap = document.getElementById('potWrap');
  if (potEl && wrap) {
    potEl.classList.remove('moving-pot');
    potEl.style.left = '';
    potEl.style.top = '';
    wrap.appendChild(potEl);
  }
  const potText = document.getElementById('potTotal');
  if (potText) potText.textContent = '';
  setupFlopBacks();
  renderSeats();
  collectAntes();
  updatePotDisplay();
  dealInitialCards();
}

function renderSeats() {
  const seats = document.getElementById('seats');
  seats.innerHTML = '';
  const positions = ['bottom', 'bottom-right', 'right', 'top', 'left', 'bottom-left'];
  state.players.forEach((p, i) => {
    const seat = document.createElement('div');
    seat.className = 'seat ' + positions[i];
    if (p.vacant) {
      seat.classList.add('vacant');
      const btn = document.createElement('button');
      btn.className = 'vacant-seat';
      btn.textContent = 'Seat';
      btn.addEventListener('click', joinSeat);
      seat.appendChild(btn);
      seats.appendChild(seat);
      return;
    }
    if (!p.isHuman) seat.classList.add('small');
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.id = 'avatar-' + i;
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
    const action = document.createElement('div');
    action.className = 'action-text';
    action.id = 'action-' + i;
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
      seat.append(cards, action, controls, wrap, name);
    } else {
      const timer = document.createElement('div');
      timer.className = 'timer';
      timer.id = 'timer-' + i;
      if (positions[i] === 'top') seat.append(name, avatar, cards, action, timer);
      else seat.append(avatar, cards, action, name, timer);
    }
    seats.appendChild(seat);
  });
}

function setActionText(idx, action) {
  const el = document.getElementById('action-' + idx);
  if (!el) return;
  el.textContent = action ? action.charAt(0).toUpperCase() + action.slice(1) : '';
  el.className = 'action-text';
  if (action) el.classList.add(action);
}

function clearActionTexts() {
  state.players.forEach((_, i) => setActionText(i, ''));
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

function setupFlopBacks() {
  const comm = document.getElementById('community');
  if (!comm) return;
  comm.innerHTML = '';
  for (let i = 0; i < 3; i++) comm.appendChild(cardBackEl());
}

function collectAntes() {
  const active = state.players.filter((p) => !p.vacant).length;
  state.pot += ANTE * active;
}

function updatePotDisplay() {
  const potEl = document.getElementById('pot');
  if (!potEl) return;
  potEl.innerHTML = '';
  let amount = state.pot;
  CHIP_VALUES.forEach((val) => {
    const count = Math.floor(amount / val);
    if (count > 0) {
      amount -= count * val;
      const pile = document.createElement('div');
      pile.className = 'chip-pile';
      for (let i = 0; i < count; i++) {
        const chip = document.createElement('div');
        chip.className = 'chip v' + val;
        chip.textContent = val;
        chip.style.top = -i * 4 + 'px';
        pile.appendChild(chip);
      }
      potEl.appendChild(pile);
    }
  });
  const textEl = document.getElementById('potTotal');
  if (textEl) textEl.textContent = `Total: ${state.pot} ${state.token}`;
}

async function dealInitialCards() {
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      if (p.vacant) continue;
      await dealCardToPlayer(i, p.hand[r], !!p.isHuman);
    }
  }
  if (state.seated) startPlayerTurn();
  else proceedStage();
}

function dealCardToPlayer(idx, card, showFace) {
  return new Promise((resolve) => {
    const stage = document.querySelector('.stage');
    const deck = document.getElementById('community');
    if (!stage || !deck) {
      const target = document.getElementById('cards-' + idx);
      if (target) target.appendChild(showFace ? cardEl(card) : cardBackEl());
      resolve();
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const deckRect = deck.getBoundingClientRect();
    const temp = showFace ? cardEl(card) : cardBackEl();
    temp.classList.add('moving-card');
    temp.style.left = deckRect.left + deckRect.width / 2 - stageRect.left + 'px';
    temp.style.top = deckRect.top + deckRect.height / 2 - stageRect.top + 'px';
    stage.appendChild(temp);
    const target = document.getElementById('cards-' + idx);
    const targetRect = target.getBoundingClientRect();
    playFlipSound();
    requestAnimationFrame(() => {
      temp.style.left = targetRect.left - stageRect.left + 'px';
      temp.style.top = targetRect.top - stageRect.top + 'px';
    });
    temp.addEventListener(
      'transitionend',
      () => {
        temp.classList.remove('moving-card');
        temp.style.left = '';
        temp.style.top = '';
        temp.style.transition = '';
        target.appendChild(temp);
        resolve();
      },
      { once: true }
    );
  });
}

function setPlayerTurnIndicator(idx) {
  document.querySelectorAll('.avatar').forEach((a) => a.classList.remove('turn'));
  if (idx === null || idx === undefined || idx < 0) return;
  const avatar = document.getElementById('avatar-' + idx);
  if (avatar) avatar.classList.add('turn');
}

function showControls() {
  const controls = document.getElementById('controls');
  controls.innerHTML = '';
  const baseActions = [{ id: 'fold', fn: playerFold }];
  if (state.currentBet === 0) baseActions.push({ id: 'check', fn: playerCheck });
  baseActions.push({ id: 'call', fn: playerCall });
  baseActions.forEach((a) => {
    const btn = document.createElement('button');
    btn.id = a.id;
    btn.textContent = a.id;
    btn.addEventListener('click', a.fn);
    controls.appendChild(btn);
  });
  const raiseContainer = document.createElement('div');
  raiseContainer.className = 'raise-container';
  const panel = document.createElement('div');
  panel.id = 'raisePanel';
  panel.innerHTML =
    '<div class="max-zone"><div class="max-label">MAX</div></div>' +
    '<div id="raiseFill"></div><div id="raiseThumb"></div>';
  raiseContainer.appendChild(panel);
  const btn = document.createElement('button');
  btn.textContent = 'raise';
  btn.id = 'raise';
  btn.addEventListener('click', playerRaise);
  if (state.pot >= state.maxPot) btn.disabled = true;
  raiseContainer.appendChild(btn);
  const amountText = document.createElement('div');
  amountText.id = 'raiseAmountText';
  amountText.className = 'raise-amount';
  amountText.textContent = `0 ${state.token}`;
  raiseContainer.appendChild(amountText);
  controls.appendChild(raiseContainer);
  initRaiseSlider();
}

function initRaiseSlider() {
  const panel = document.getElementById('raisePanel');
  const fill = document.getElementById('raiseFill');
  const thumb = document.getElementById('raiseThumb');
  if (!panel || !fill || !thumb) return;
  state.raiseAmount = 0;
  function update(e) {
    const rect = panel.getBoundingClientRect();
    let pct = (rect.bottom - e.clientY) / rect.height;
    pct = Math.max(0, Math.min(1, pct));
    fill.style.height = pct * 100 + '%';
    thumb.style.bottom = 'calc(12px + (100% - 24px) * ' + pct + ')';
    const maxAllowed = Math.min(state.stake, state.maxPot - state.pot);
    state.raiseAmount = Math.round(pct * maxAllowed);
    const amtEl = document.getElementById('raiseAmountText');
    if (amtEl) amtEl.textContent = `${state.raiseAmount} ${state.token}`;
    const status = document.getElementById('status');
    if (status) status.textContent = `Raise ${state.raiseAmount} ${state.token}`;
  }
  panel.addEventListener('pointerdown', function (e) {
    update(e);
    panel.setPointerCapture(e.pointerId);
  });
  panel.addEventListener('pointermove', function (e) {
    if (panel.hasPointerCapture(e.pointerId)) update(e);
  });
  panel.addEventListener('pointerup', function (e) {
    panel.releasePointerCapture(e.pointerId);
  });
}

function hideControls() {
  const controls = document.getElementById('controls');
  if (controls) controls.innerHTML = '';
}

function startPlayerTurn() {
  state.turn = 0;
  state.currentBet = 0;
  setPlayerTurnIndicator(0);
  playKnockSound();
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
  state.players[0].active = false;
  setPlayerTurnIndicator(null);
  setActionText(0, 'fold');
  document.getElementById('status').textContent = 'You folded';
  proceedStage();
}

function playerCheck() {
  setActionText(0, 'check');
  document.getElementById('status').textContent = 'You check';
  proceedStage();
}

function playerCall() {
  state.pot += state.currentBet;
  updatePotDisplay();
  setActionText(0, 'call');
  document.getElementById('status').textContent = `You call ${state.currentBet} ${state.token}`;
  if (state.pot >= state.maxPot) playAllInSound();
  else playCallRaiseSound();
  proceedStage();
}

function playerRaise() {
  const maxAllowed = Math.min(state.stake, state.maxPot - state.pot);
  const amount = Math.min(state.raiseAmount, maxAllowed);
  if (amount <= 0) return;
  state.pot += amount;
  state.currentBet += amount;
  updatePotDisplay();
  setActionText(0, 'raise');
  document.getElementById('status').textContent = `You raise ${amount} ${state.token}`;
  if (state.pot >= state.maxPot) playAllInSound();
  else playCallRaiseSound();
  proceedStage();
}

async function proceedStage() {
  clearInterval(state.timerInterval);
  setPlayerTurnIndicator(null);
  hideControls();
  for (let i = 1; i < state.players.length; i++) {
    const p = state.players[i];
    if (p.vacant || !p.active) continue;
    setPlayerTurnIndicator(i);
    document.getElementById('status').textContent = `${p.name}...`;
    await new Promise((r) => setTimeout(r, 2500));
    let action = aiChooseAction(
      p.hand,
      state.community.slice(0, stageCommunityCount()),
      state.currentBet
    );
    if (state.currentBet > 0 && action === 'check') action = 'call';
    if (action === 'raise') {
      const raiseBy = ANTE;
      const total = state.currentBet + raiseBy;
      state.currentBet = total;
      state.pot += total;
      updatePotDisplay();
      document.getElementById('status').textContent = `${p.name} raises to ${total} ${state.token}`;
      if (state.pot >= state.maxPot) playAllInSound();
      else playCallRaiseSound();
    } else if (action === 'call') {
      state.pot += state.currentBet;
      updatePotDisplay();
      document.getElementById('status').textContent = `${p.name} calls ${state.currentBet} ${state.token}`;
      if (state.pot >= state.maxPot) playAllInSound();
      else playCallRaiseSound();
    } else if (action === 'fold') {
      p.active = false;
      document.getElementById('status').textContent = `${p.name} folds`;
    } else {
      document.getElementById('status').textContent = `${p.name} checks`;
    }
    setActionText(i, action);
  }
  setPlayerTurnIndicator(null);
  state.stage++;
  if (state.stage === 1) revealFlop();
  else if (state.stage === 2) revealTurn();
  else if (state.stage === 3) revealRiver();
  else await showdown();
}

function stageCommunityCount() {
  if (state.stage === 0) return 0;
  if (state.stage === 1) return 3;
  if (state.stage === 2) return 4;
  return 5;
}

function movePotToWinner(idx) {
  const potEl = document.getElementById('pot');
  const stage = document.querySelector('.stage');
  if (!potEl || !stage) return;
  playAllInSound();
  const stageRect = stage.getBoundingClientRect();
  const potRect = potEl.getBoundingClientRect();
  potEl.classList.add('moving-pot');
  potEl.style.left = potRect.left - stageRect.left + 'px';
  potEl.style.top = potRect.top - stageRect.top + 'px';
  stage.appendChild(potEl);
  const cards = document.getElementById('cards-' + idx);
  if (!cards) return;
  const cardRect = cards.getBoundingClientRect();
  const targetX = cardRect.left - stageRect.left + cardRect.width / 2 - potEl.offsetWidth / 2;
  const targetY = idx === 0
    ? cardRect.top - stageRect.top - potEl.offsetHeight - 10
    : cardRect.bottom - stageRect.top + 10;
  requestAnimationFrame(() => {
    potEl.style.left = targetX + 'px';
    potEl.style.top = targetY + 'px';
  });
}

async function revealFlop() {
  const comm = document.getElementById('community');
  for (let i = 0; i < 3; i++) {
    const card = cardEl(state.community[i]);
    if (comm.children[i]) comm.children[i].replaceWith(card);
    else comm.appendChild(card);
    playFlipSound();
    await new Promise((r) => setTimeout(r, 400));
  }
  clearActionTexts();
  if (state.players[0].active) startPlayerTurn();
  else proceedStage();
}

async function revealTurn() {
  const comm = document.getElementById('community');
  comm.appendChild(cardEl(state.community[3]));
  playFlipSound();
  await new Promise((r) => setTimeout(r, 400));
  clearActionTexts();
  if (state.players[0].active) startPlayerTurn();
  else proceedStage();
}

async function revealRiver() {
  const comm = document.getElementById('community');
  comm.appendChild(cardEl(state.community[4]));
  playFlipSound();
  await new Promise((r) => setTimeout(r, 400));
  clearActionTexts();
  if (state.players[0].active) startPlayerTurn();
  else proceedStage();
}

async function showdown() {
  state.players.forEach((p, i) => {
    if (p.vacant || !p.active) return;
    const cards = document.getElementById('cards-' + i);
    cards.innerHTML = '';
    p.hand.forEach((c) => cards.appendChild(cardEl(c)));
  });
  const activePlayers = state.players.filter((p) => !p.vacant && p.active);
  const winners = evaluateWinner(activePlayers, state.community);
  const pot = state.pot;
  const text = winners.length === 1
    ? `${activePlayers[winners[0].index].name} wins with ${HAND_RANK_NAMES[winners[0].score.rank]}!`
    : 'Tie';
  document.getElementById('status').textContent = text;
  if (winners.length === 1) {
    const winner = winners[0];
    const winning = winner.score.cards;
    const commEl = document.getElementById('community');
    state.community.forEach((c, idx) => {
      if (winning.includes(c)) commEl.children[idx].classList.add('winning');
    });
    const winnerPlayer = activePlayers[winner.index];
    const playerIndex = state.players.indexOf(winnerPlayer);
    const playerCardsEl = document.getElementById('cards-' + playerIndex);
    state.players[playerIndex].hand.forEach((c, idx) => {
      const el = playerCardsEl.children[idx];
      el.classList.add('winning');
    });
    const seat = playerCardsEl.closest('.seat');
    if (seat) seat.classList.add('winner');
    if (pot > 0) {
      movePotToWinner(playerIndex);
      await awardDevShare(pot);
      if (winnerPlayer.isHuman && myAccountId && window.fbApi) {
        const winAmt = Math.round(pot * 0.9);
        try {
          await window.fbApi.depositAccount(myAccountId, winAmt, {
            game: 'texasholdem-win',
          });
          if (myTelegramId) {
            window.fbApi.addTransaction(myTelegramId, 0, 'win', {
              game: 'texasholdem',
              players: activePlayers.length,
              accountId: myAccountId,
            });
          }
        } catch {}
      }
      state.pot = 0;
    }
  }
  setTimeout(() => init(), 5000);
}

document.getElementById('lobbyIcon')?.addEventListener('click', () => {
  location.href = '/games/texasholdem/lobby';
});
document.getElementById('leaveSeatBtn')?.addEventListener('click', () => {
  state.seated = false;
  init();
});
document.addEventListener('DOMContentLoaded', init);

function joinSeat() {
  state.seated = true;
  init();
}
