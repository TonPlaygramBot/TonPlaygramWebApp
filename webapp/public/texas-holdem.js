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
  tpcTotal: 0,
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

async function loadAccountBalance() {
  if (!myAccountId || !window.fbApi?.getAccountBalance) return;
  try {
    const res = await window.fbApi.getAccountBalance(myAccountId);
    if (res && typeof res.balance === 'number') {
      state.tpcTotal = res.balance;
      const el = document.getElementById('tpcTotal');
      if (el) el.textContent = res.balance;
    }
  } catch {}
}

const SUIT_MAP = { H: '♥', D: '♦', C: '♣', S: '♠' };
const CHIP_VALUES = [1000, 200, 100, 50, 20, 10, 5, 2, 1];
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

function adjustNameSize(el) {
  const base = 12;
  const min = 8;
  const len = el.textContent.length;
  if (len > 10) {
    el.style.fontSize = Math.max(min, base - (len - 10)) + 'px';
  }
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
    adjustNameSize(name);
    if (i === 0) {
      const wrap = document.createElement('div');
      wrap.className = 'avatar-wrap';
      const ring = document.createElement('div');
      ring.className = 'timer-ring';
      ring.id = 'timer-' + i;
      wrap.append(ring, avatar);
      const inner = document.createElement('div');
      inner.className = 'seat-inner';
      // Move action text above the player's cards so the cards sit directly above the controls
      inner.append(wrap, name, action, cards);
      const controls = document.createElement('div');
      controls.className = 'controls';
      controls.id = 'controls';
      seat.append(inner, controls);
    } else {
      const timer = document.createElement('div');
      timer.className = 'timer';
      timer.id = 'timer-' + i;
      const inner = document.createElement('div');
      inner.className = 'seat-inner';
      inner.append(avatar, name, cards, timer);
      seat.append(inner, action);
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

function buildChipPiles(amount) {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '6px';
  let remaining = amount;
  CHIP_VALUES.forEach((val) => {
    const count = Math.floor(remaining / val);
    if (count > 0) {
      remaining -= count * val;
      const pile = document.createElement('div');
      pile.className = 'chip-pile';
      for (let i = 0; i < count; i++) {
        const chip = document.createElement('div');
        chip.className = 'chip v' + val;
        chip.style.top = -i * 4 + 'px';
        pile.appendChild(chip);
      }
      wrap.appendChild(pile);
    }
  });
  return wrap;
}

function updatePotDisplay() {
  const potEl = document.getElementById('pot');
  if (!potEl) return;
  potEl.innerHTML = '';
  potEl.appendChild(buildChipPiles(state.pot));
  const textEl = document.getElementById('potTotal');
  if (textEl) textEl.textContent = `Total: ${state.pot} ${state.token}`;
}

function animateChipsFromPlayer(index, amount) {
  const stage = document.querySelector('.stage');
  const seats = document.querySelectorAll('#seats .seat');
  const seat = seats[index];
  const potWrap = document.getElementById('potWrap');
  if (!stage || !seat || !potWrap) {
    updatePotDisplay();
    return;
  }
  const chips = buildChipPiles(amount);
  chips.classList.add('moving-pot');
  stage.appendChild(chips);
  const seatRect = seat.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const potRect = potWrap.getBoundingClientRect();
  chips.style.left =
    seatRect.left + seatRect.width / 2 - stageRect.left - chips.offsetWidth / 2 + 'px';
  chips.style.top =
    seatRect.top + seatRect.height / 2 - stageRect.top - chips.offsetHeight / 2 + 'px';
  requestAnimationFrame(() => {
    chips.style.left =
      potRect.left + potRect.width / 2 - stageRect.left - chips.offsetWidth / 2 + 'px';
    chips.style.top =
      potRect.top + potRect.height / 2 - stageRect.top - chips.offsetHeight / 2 + 'px';
  });
  setTimeout(() => {
    chips.remove();
    updatePotDisplay();
  }, 500);
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
  if (!controls) return;

  if (!document.getElementById('fold')) {
    const foldBtn = document.createElement('button');
    foldBtn.id = 'fold';
    foldBtn.textContent = 'fold';
    foldBtn.addEventListener('click', playerFold);
    const callBtn = document.createElement('button');
    callBtn.id = 'call';
    callBtn.textContent = 'call';
    callBtn.addEventListener('click', playerCall);
    const checkBtn = document.createElement('button');
    checkBtn.id = 'check';
    checkBtn.textContent = 'check';
    checkBtn.addEventListener('click', playerCheck);
    controls.append(foldBtn, callBtn, checkBtn);
  }

  const stage = document.querySelector('.stage');

  let sliderContainer = document.getElementById('sliderContainer');
  if (!sliderContainer) {
    sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';
    sliderContainer.id = 'sliderContainer';

    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'slider-wrap';

    const allInBtn = document.createElement('button');
    allInBtn.id = 'allIn';
    allInBtn.textContent = 'All in';
    sliderWrap.appendChild(allInBtn);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'raiseSlider';
    slider.min = '0';
    slider.value = '0';
    slider.addEventListener('input', () => {
      const amt = document.getElementById('raiseSliderAmount');
      if (amt) amt.textContent = `${slider.value} ${state.token}`;
      const status = document.getElementById('status');
      if (status)
        status.textContent =
          slider.value > 0 ? `Raise ${slider.value} ${state.token}` : '';
    });
    sliderWrap.appendChild(slider);

    const sliderRaise = document.createElement('button');
    sliderRaise.id = 'sliderRaise';
    sliderRaise.textContent = 'raise';
    sliderRaise.className = 'raise-btn';
    sliderRaise.addEventListener('click', () => {
      const sliderVal = parseInt(slider.value, 10);
      const amount = state.raiseAmount > 0 ? state.raiseAmount : sliderVal;
      playerRaise(amount);
    });
    sliderWrap.appendChild(sliderRaise);

    const sliderAmt = document.createElement('div');
    sliderAmt.id = 'raiseSliderAmount';
    sliderAmt.className = 'raise-amount';
    sliderAmt.textContent = `0 ${state.token}`;
    sliderWrap.appendChild(sliderAmt);

    allInBtn.addEventListener('click', () => {
      const max = parseInt(slider.max, 10) || 0;
      slider.value = max;
      slider.dispatchEvent(new Event('input'));
      playerRaise(max);
    });

    sliderContainer.appendChild(sliderWrap);

    if (stage) stage.appendChild(sliderContainer);
  }

  let raiseContainer = document.getElementById('raiseContainer');
  if (!raiseContainer) {
    raiseContainer = document.createElement('div');
    raiseContainer.className = 'raise-container';
    raiseContainer.id = 'raiseContainer';

    const grid = document.createElement('div');
    grid.className = 'chip-grid';
    CHIP_VALUES.forEach((val) => {
      const chip = document.createElement('div');
      chip.className = 'chip v' + val;
      chip.dataset.value = val;
      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
        state.raiseAmount = Array.from(
          grid.querySelectorAll('.chip.selected')
        ).reduce((sum, c) => sum + parseInt(c.dataset.value, 10), 0);
        updateRaiseAmount();
      });
      grid.appendChild(chip);
    });
    raiseContainer.appendChild(grid);

    const amountText = document.createElement('div');
    amountText.id = 'raiseAmountText';
    amountText.className = 'raise-amount';
    amountText.textContent = `0 ${state.token}`;
    raiseContainer.appendChild(amountText);

    const totalDiv = document.createElement('div');
    totalDiv.className = 'tpc-total';
    totalDiv.innerHTML =
      'Total: <span id="tpcTotal">0</span> <img src="assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" />';
    raiseContainer.appendChild(totalDiv);

    if (stage) stage.appendChild(raiseContainer);
  }

  document
    .querySelectorAll('#raiseContainer .chip.selected')
    .forEach((c) => c.classList.remove('selected'));
  state.raiseAmount = 0;
  updateRaiseAmount();

  const slider = document.getElementById('raiseSlider');
  if (slider) {
    slider.value = '0';
    const amt = document.getElementById('raiseSliderAmount');
    if (amt) amt.textContent = `0 ${state.token}`;
  }

  ['fold', 'call', 'check', 'sliderRaise', 'allIn'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
  if (slider) slider.disabled = false;
  document
    .querySelectorAll('#raiseContainer .chip')
    .forEach((chip) => (chip.style.pointerEvents = 'auto'));

  const checkBtn = document.getElementById('check');
  if (checkBtn) checkBtn.disabled = state.currentBet > 0;

  const maxAllowed = Math.min(state.stake, state.maxPot - state.pot, state.tpcTotal);
  ['sliderRaise', 'allIn'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = maxAllowed <= 0;
  });
  if (slider) {
    slider.max = Math.max(0, maxAllowed);
    slider.disabled = maxAllowed <= 0;
  }
  document
    .querySelectorAll('#raiseContainer .chip')
    .forEach((chip) => {
      chip.style.pointerEvents = maxAllowed > 0 ? 'auto' : 'none';
    });

  loadAccountBalance().then(() => updateSliderRange());
}

function updateRaiseAmount() {
  const amtEl = document.getElementById('raiseAmountText');
  if (amtEl) amtEl.textContent = `${state.raiseAmount} ${state.token}`;
  const status = document.getElementById('status');
  if (status) {
    status.textContent =
      state.raiseAmount > 0 ? `Raise ${state.raiseAmount} ${state.token}` : '';
  }
}

function updateSliderRange() {
  const slider = document.getElementById('raiseSlider');
  if (!slider) return;
  const maxAllowed = Math.min(state.stake, state.maxPot - state.pot, state.tpcTotal);
  slider.max = Math.max(0, maxAllowed);
  const disable = maxAllowed <= 0;
  ['sliderRaise', 'allIn'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = disable;
  });
  slider.disabled = disable;
  document
    .querySelectorAll('#raiseContainer .chip')
    .forEach((chip) => (chip.style.pointerEvents = disable ? 'none' : 'auto'));
}

function hideControls() {
  ['fold', 'call', 'check', 'sliderRaise', 'allIn'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = true;
  });
  const slider = document.getElementById('raiseSlider');
  if (slider) {
    slider.disabled = true;
    slider.value = '0';
  }
  document
    .querySelectorAll('#raiseContainer .chip')
    .forEach((chip) => {
      chip.style.pointerEvents = 'none';
      chip.classList.remove('selected');
    });
  state.raiseAmount = 0;
  updateRaiseAmount();
  const amt = document.getElementById('raiseSliderAmount');
  if (amt) amt.textContent = `0 ${state.token}`;
  const status = document.getElementById('status');
  if (status) status.textContent = '';
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
  animateChipsFromPlayer(0, state.currentBet);
  setActionText(0, 'call');
  document.getElementById('status').textContent = `You call ${state.currentBet} ${state.token}`;
  if (state.pot >= state.maxPot) playAllInSound();
  else playCallRaiseSound();
  proceedStage();
}

function playerRaise(amount = state.raiseAmount) {
  const maxAllowed = Math.min(state.stake, state.maxPot - state.pot);
  amount = Math.min(amount, maxAllowed);
  if (amount <= 0) return;
  state.pot += amount;
  state.currentBet += amount;
  animateChipsFromPlayer(0, amount);
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
      animateChipsFromPlayer(i, total);
      document.getElementById('status').textContent = `${p.name} raises to ${total} ${state.token}`;
      if (state.pot >= state.maxPot) playAllInSound();
      else playCallRaiseSound();
    } else if (action === 'call') {
      state.pot += state.currentBet;
      animateChipsFromPlayer(i, state.currentBet);
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
