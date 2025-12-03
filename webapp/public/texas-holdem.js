import {
  createDeck,
  shuffle,
  dealHoleCards,
  dealCommunity,
  evaluateWinner,
  aiChooseAction,
  HAND_RANK_NAMES
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
  selectedChips: [],
  tpcTotal: 0,
  seated: true,
  roundBets: []
};

const DEFAULT_SETTINGS = {
  muteCards: false,
  muteChips: false,
  muteOthers: false,
  cardVolume: 1,
  chipVolume: 1,
  playerColor: '#f5f5dc',
  cardBackColor: '#233',
  playerFrameStyle: '1'
};
const COLOR_OPTIONS = [
  '#f5f5dc',
  '#f87171',
  '#60a5fa',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#c084fc',
  '#f472b6',
  '#4ade80',
  '#94a3b8'
];
const FRAME_STYLE_OPTIONS = Array.from({ length: 10 }, (_, i) => (i + 1).toString());

function loadSettings() {
  try {
    return {
      ...DEFAULT_SETTINGS,
      ...(JSON.parse(localStorage.getItem('thSettings')) || {})
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings = loadSettings();

function saveSettings() {
  try {
    localStorage.setItem('thSettings', JSON.stringify(settings));
  } catch {}
}

function applySettings() {
  document.documentElement.style.setProperty(
    '--seat-bg-color',
    settings.playerColor
  );
  document.documentElement.style.setProperty(
    '--card-back-color',
    settings.cardBackColor
  );
  document.documentElement.style.setProperty(
    '--player-frame-color',
    settings.playerColor
  );
  document.body.classList.remove(
    ...FRAME_STYLE_OPTIONS.map((s) => `frame-style-${s}`)
  );
  document.body.classList.add(`frame-style-${settings.playerFrameStyle}`);
  const flip = document.getElementById('sndFlip');
  if (flip) flip.volume = settings.muteCards ? 0 : settings.cardVolume;
  const callRaise = document.getElementById('sndCallRaise');
  if (callRaise)
    callRaise.volume = settings.muteChips ? 0 : settings.chipVolume;
  const allIn = document.getElementById('sndAllIn');
  if (allIn) allIn.volume = settings.muteChips ? 0 : settings.chipVolume;
  const fold = document.getElementById('sndFold');
  if (fold) fold.volume = settings.muteChips ? 0 : settings.chipVolume;
  const timer = document.getElementById('sndTimer');
  if (timer) timer.volume = settings.muteOthers ? 0 : 1;
  const knock = document.getElementById('sndKnock');
  if (knock) knock.volume = settings.muteOthers ? 0 : 1;
}

function initSettingsMenu() {
  const panel = document.getElementById('settingsPanel');
  const btn = document.getElementById('settingsBtn');
  const close = document.getElementById('closeSettings');
  btn?.addEventListener('click', () => panel.classList.add('active'));
  close?.addEventListener('click', () => panel.classList.remove('active'));

  const muteCards = document.getElementById('muteCards');
  const cardVolume = document.getElementById('cardVolume');
  const muteChips = document.getElementById('muteChips');
  const chipVolume = document.getElementById('chipVolume');
  const muteOthers = document.getElementById('muteOthers');
  const playerFrameStyle = document.getElementById('playerFrameStyle');
  const playerColor = document.getElementById('playerColor');
  const cardBackColor = document.getElementById('cardBackColor');
  const saveBtn = document.getElementById('saveSettings');
  const resetBtn = document.getElementById('resetSettings');

  function populate(select, value) {
    COLOR_OPTIONS.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      opt.style.background = `linear-gradient(to right, ${c} 0 16px, #fff 16px)`;
      select.appendChild(opt);
    });
    select.value = value;
  }

  populate(playerColor, settings.playerColor);
  populate(cardBackColor, settings.cardBackColor);

  FRAME_STYLE_OPTIONS.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = `Style ${s}`;
    playerFrameStyle.appendChild(opt);
  });
  playerFrameStyle.value = settings.playerFrameStyle;

  function updateControls() {
    muteCards.checked = settings.muteCards;
    cardVolume.value = settings.cardVolume;
    muteChips.checked = settings.muteChips;
    chipVolume.value = settings.chipVolume;
    muteOthers.checked = settings.muteOthers;
    playerFrameStyle.value = settings.playerFrameStyle;
    playerColor.value = settings.playerColor;
    cardBackColor.value = settings.cardBackColor;
  }

  updateControls();

  muteCards.addEventListener('change', (e) => {
    settings.muteCards = e.target.checked;
    applySettings();
  });
  cardVolume.addEventListener('input', (e) => {
    settings.cardVolume = parseFloat(e.target.value);
    applySettings();
  });
  muteChips.addEventListener('change', (e) => {
    settings.muteChips = e.target.checked;
    applySettings();
  });
  chipVolume.addEventListener('input', (e) => {
    settings.chipVolume = parseFloat(e.target.value);
    applySettings();
  });
  muteOthers.addEventListener('change', (e) => {
    settings.muteOthers = e.target.checked;
    applySettings();
  });
  playerFrameStyle.addEventListener('change', (e) => {
    settings.playerFrameStyle = e.target.value;
    applySettings();
  });
  playerColor.addEventListener('change', (e) => {
    settings.playerColor = e.target.value;
    applySettings();
  });
  cardBackColor.addEventListener('change', (e) => {
    settings.cardBackColor = e.target.value;
    applySettings();
  });

  saveBtn?.addEventListener('click', () => {
    saveSettings();
    panel.classList.remove('active');
  });

  resetBtn?.addEventListener('click', () => {
    settings = { ...DEFAULT_SETTINGS };
    updateControls();
    saveSettings();
    applySettings();
  });
}

let myAccountId = '';
let myTelegramId;
let devAccountId;

async function awardDevShare(total) {
  if (!devAccountId || !window.fbApi) return;
  try {
    await window.fbApi.depositAccount(devAccountId, Math.round(total * 0.1), {
      game: 'texasholdem-dev'
    });
  } catch {}
}

function playCallRaiseSound() {
  const snd = document.getElementById('sndCallRaise');
  if (snd && !settings.muteChips) {
    snd.volume = settings.chipVolume;
    snd.currentTime = 0;
    snd.play();
  }
}

function playAllInSound() {
  const snd = document.getElementById('sndAllIn');
  if (snd && !settings.muteChips) {
    snd.volume = settings.chipVolume;
    snd.currentTime = 0;
    snd.play();
  }
}

function playFoldSound() {
  const snd = document.getElementById('sndFold');
  if (snd && !settings.muteChips) {
    snd.volume = settings.chipVolume;
    snd.currentTime = 0;
    snd.play();
  }
}

function playFlipSound() {
  const snd = document.getElementById('sndFlip');
  if (snd && !settings.muteCards) {
    snd.volume = settings.cardVolume;
    snd.currentTime = 0;
    snd.play();
  }
}

function playKnockSound() {
  const snd = document.getElementById('sndKnock');
  if (snd && !settings.muteOthers) {
    snd.volume = 1;
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
      updateBalancePreview();
    }
  } catch {}
}

const SUIT_MAP = { H: '♥', D: '♦', C: '♣', S: '♠' };
const CHIP_VALUES = [1000, 500, 200, 50, 20, 10, 5, 2, 1];
const ANTE = 10;
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
function flagName(flag) {
  const codePoints = [...flag].map((c) => c.codePointAt(0) - 0x1f1e6 + 65);
  return regionNames.of(String.fromCharCode(...codePoints));
}

function randomBalance() {
  return Math.floor(Math.random() * 9000) + 1000;
}

const TPC_ICON_HTML =
  '<img src="assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" class="tpc-inline-icon" />';

function formatAmount(amount) {
  return `${amount} ${TPC_ICON_HTML}`;
}

function updateBalancePreview(preview = 0) {
  const el = document.getElementById('tpcTotal');
  const totalDiv = el ? el.closest('.tpc-total') : null;
  const amount = Math.max(0, state.tpcTotal - preview);
  if (el) el.textContent = amount;
  if (totalDiv) {
    if (amount >= 100000) totalDiv.classList.add('small');
    else totalDiv.classList.remove('small');
  }
  if (state.players[0]) {
    state.players[0].balance = state.tpcTotal;
  }
  updateBalances();
}

function setStatus(action, text) {
  const status = document.getElementById('status');
  if (!status) return;
  if (text && (text.includes('wins with') || text === 'Tie')) {
    status.className = 'status-default';
    status.innerHTML = text;
  } else {
    status.innerHTML = '';
  }
}

function cardFaceEl(c) {
  const d = document.createElement('div');
  d.className =
    'card' +
    (c.s === '♥' || c.s === '♦' ? ' red' : '') +
    (c.r === 'RJ' || c.r === 'BJ' ? ' joker' : '');

  const rankText = c.r === 'BJ' ? 'JB' : c.r === 'RJ' ? 'JR' : c.r;
  const tl = document.createElement('div');
  tl.className = 'tl corner';
  const tlRank = document.createElement('div');
  tlRank.className = 'rank';
  tlRank.textContent = rankText;
  tl.append(tlRank);

  const br = document.createElement('div');
  br.className = 'br corner';
  const brRank = document.createElement('div');
  brRank.className = 'rank';
  brRank.textContent = rankText;
  br.append(brRank);

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
  myTelegramId =
    params.get('tgId') || window?.Telegram?.WebApp?.initDataUnsafe?.user?.id;
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
      ? {
          name,
          avatar,
          hand: hands[0],
          isHuman: true,
          active: true,
          balance: state.tpcTotal
        }
      : {
          name: '',
          avatar: '',
          hand: [],
          isHuman: false,
          active: false,
          vacant: true,
          balance: 0
        },
    ...flags.map((f, idx) => ({
      name: flagName(f),
      avatar: f,
      hand: hands[idx + (state.seated ? 1 : 0)],
      active: true,
      isHuman: false,
      balance: randomBalance()
    }))
  ];
  const comm = dealCommunity(rest);
  state.community = comm.community;
  state.stage = 0;
  state.turn = 0;
  state.currentBet = 0;
  state.raiseAmount = 0;
  state.selectedChips = [];
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
  const folded = document.getElementById('foldedCards');
  const foldedLabel = document.getElementById('foldedLabel');
  if (folded) folded.innerHTML = '';
  if (foldedLabel) foldedLabel.style.display = 'none';
  setupFlopBacks();
  renderSeats();
  collectAntes();
  updatePotDisplay();
  startBettingRound();
  dealInitialCards();
  setStatus('', '');
}

function adjustNameSize(el) {
  let name = el.textContent || '';
  if (name.length > 12) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      name = parts.map((p) => p[0].toUpperCase()).join('');
    }
  }
  if (name.length > 10) {
    name = name.slice(0, 10);
  }
  el.textContent = name;
}

function renderSeats() {
  const seats = document.getElementById('seats');
  seats.innerHTML = '';
  const positions = [
    'bottom',
    'bottom-right',
    'right',
    'top',
    'left',
    'bottom-left'
  ];
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
      inner.append(wrap, name, cards);
      const controls = document.createElement('div');
      controls.className = 'controls';
      controls.id = 'controls';
      const bal = document.createElement('div');
      bal.className = 'seat-balance';
      bal.id = 'balance-' + i;
      bal.innerHTML = formatAmount(p.balance || 0);
      seat.append(inner, bal, action, controls);
    } else {
      const timer = document.createElement('div');
      timer.className = 'timer';
      timer.id = 'timer-' + i;
      const inner = document.createElement('div');
      inner.className = 'seat-inner';
      inner.append(avatar, name, cards, timer);
      const bal = document.createElement('div');
      bal.className = 'seat-balance';
      bal.id = 'balance-' + i;
      bal.innerHTML = formatAmount(p.balance || 0);
      seat.append(inner, bal, action);
    }
    seats.appendChild(seat);
  });
  updateBalances();
}

function updateBalances() {
  state.players.forEach((p, i) => {
    const el = document.getElementById('balance-' + i);
    if (el) el.innerHTML = formatAmount(p.balance || 0);
  });
}

function setActionText(idx, action) {
  const el = document.getElementById('action-' + idx);
  if (!el) return;
  el.textContent = action
    ? action.charAt(0).toUpperCase() + action.slice(1)
    : '';
  el.className = 'action-text';
  if (action) el.classList.add(action);
}

function clearActionTexts() {
  state.players.forEach((_, i) => setActionText(i, ''));
}

function cardEl(card) {
  return cardFaceEl({
    r: card.rank === 'T' ? '10' : card.rank,
    s: SUIT_MAP[card.suit] || card.suit
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
  // ensure no residual text such as player names remain on the first community card
  comm.textContent = '';
  comm.innerHTML = '';
  for (let i = 0; i < 3; i++) comm.appendChild(cardBackEl());
}

function collectAntes() {
  const active = state.players.filter((p) => !p.vacant).length;
  state.pot += ANTE * active;
  state.players.forEach((p, idx) => {
    if (!p.vacant) {
      p.balance = Math.max(0, (p.balance || 0) - ANTE);
      if (p.isHuman) state.tpcTotal = p.balance;
    }
  });
  updateBalancePreview();
}

function startBettingRound() {
  state.currentBet = 0;
  state.roundBets = state.players.map(() => 0);
  state.raiseAmount = 0;
  state.selectedChips = [];
  updateRaiseAmount();
  updateSliderRange();
  updateActionButtons();
}

function buildChipPiles(amount) {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '4px';
  wrap.style.flexWrap = 'nowrap';
  wrap.style.justifyContent = 'center';
  let remaining = amount;
  let chips = 0;
  CHIP_VALUES.forEach((val) => {
    while (remaining >= val && chips < 5) {
      remaining -= val;
      const chip = document.createElement('div');
      chip.className = 'chip v' + val;
      wrap.appendChild(chip);
      chips++;
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
  if (textEl)
    textEl.innerHTML = `<strong>Total Pot:</strong> ${formatAmount(state.pot)}`;
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
    seatRect.left +
    seatRect.width / 2 -
    stageRect.left -
    chips.offsetWidth / 2 +
    'px';
  chips.style.top =
    seatRect.top +
    seatRect.height / 2 -
    stageRect.top -
    chips.offsetHeight / 2 +
    'px';
  requestAnimationFrame(() => {
    chips.style.left =
      potRect.left +
      potRect.width / 2 -
      stageRect.left -
      chips.offsetWidth / 2 +
      'px';
    chips.style.top =
      potRect.top +
      potRect.height / 2 -
      stageRect.top -
      chips.offsetHeight / 2 +
      'px';
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
      // Only the human player (seat 0) should see their hole cards
      const showFace = p.isHuman && i === 0;
      await dealCardToPlayer(i, p.hand[r], showFace);
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
      playFlipSound();
      resolve();
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const deckRect = deck.getBoundingClientRect();
    const temp = showFace ? cardEl(card) : cardBackEl();
    temp.classList.add('moving-card');
    temp.style.left =
      deckRect.left + deckRect.width / 2 - stageRect.left + 'px';
    temp.style.top = deckRect.top + deckRect.height / 2 - stageRect.top + 'px';
    stage.appendChild(temp);
    const target = document.getElementById('cards-' + idx);
    const targetRect = target.getBoundingClientRect();
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
        playFlipSound();
        resolve();
      },
      { once: true }
    );
  });
}

function moveCardsToFolded(idx) {
  const stage = document.querySelector('.stage');
  const from = document.getElementById('cards-' + idx);
  if (!stage || !from) return;
  const stageRect = stage.getBoundingClientRect();
  const cards = Array.from(from.children);
  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    const temp = card.cloneNode(true);
    temp.classList.add('moving-card');
    temp.style.left = rect.left - stageRect.left + 'px';
    temp.style.top = rect.top - stageRect.top + 'px';
    stage.appendChild(temp);
    from.removeChild(card);
    requestAnimationFrame(() => {
      temp.style.top = stageRect.height + 100 + 'px';
    });
    temp.addEventListener(
      'transitionend',
      () => {
        temp.remove();
      },
      { once: true }
    );
  });
  playFoldSound();
}

function setPlayerTurnIndicator(idx) {
  document
    .querySelectorAll('.seat-inner .cards')
    .forEach((c) => c.classList.remove('turn'));
  document
    .querySelectorAll('.avatar')
    .forEach((a) => a.classList.remove('turn'));
  const token = document.getElementById('turnToken');
  if (token) token.classList.remove('active');
  if (idx === null || idx === undefined || idx < 0) return;
  const nextIdx = findNextActivePlayer(idx);
  if (nextIdx === null) return;
  idx = nextIdx;
  const player = state.players[idx];
  const cards = document.getElementById('cards-' + idx);
  if (cards) cards.classList.add('turn');
  const avatar = document.getElementById('avatar-' + idx);
  if (avatar) avatar.classList.add('turn');
  if (token) {
    const stage = document.querySelector('.stage');
    const seat = document.querySelectorAll('#seats .seat')[idx];
    if (stage && seat) {
      const stageRect = stage.getBoundingClientRect();
      const seatRect = seat.getBoundingClientRect();
      token.style.left = seatRect.left - stageRect.left + seatRect.width / 2 + 'px';
      token.style.top = seatRect.top - stageRect.top - 8 + 'px';
      token.classList.add('active');
    }
  }
}

function findNextActivePlayer(startIdx = 0) {
  const total = state.players.length;
  for (let offset = 0; offset < total; offset++) {
    const idx = (startIdx + offset) % total;
    const player = state.players[idx];
    if (player && !player.vacant && player.active) return idx;
  }
  return null;
}

function updateActionButtons() {
  const outstanding = Math.max(0, state.currentBet - (state.roundBets[0] || 0));
  const callBtn = document.getElementById('call');
  const checkBtn = document.getElementById('check');
  if (callBtn) {
    callBtn.innerHTML =
      outstanding > 0 ? `call ${formatAmount(outstanding)}` : 'call';
    callBtn.disabled = outstanding <= 0;
  }
  if (checkBtn) {
    checkBtn.disabled = outstanding > 0;
  }
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

  updateActionButtons();

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
      if (amt) amt.innerHTML = formatAmount(slider.value);
      const text = document.getElementById('raiseAmountText');
      if (text && state.raiseAmount === 0)
        text.innerHTML = formatAmount(slider.value);
      setStatus(
        'raise',
        slider.value > 0 ? `Raise ${formatAmount(slider.value)}` : ''
      );
      const preview =
        state.raiseAmount > 0 ? state.raiseAmount : parseInt(slider.value, 10);
      updateBalancePreview(preview);
    });
    sliderWrap.appendChild(slider);

    const sliderRaise = document.createElement('button');
    sliderRaise.id = 'sliderRaise';
    sliderRaise.textContent = 'Raise';
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
    sliderAmt.innerHTML = formatAmount(0);
    sliderWrap.appendChild(sliderAmt);

    allInBtn.addEventListener('click', () => {
      const max = parseInt(slider.max, 10) || 0;
      slider.value = max;
      slider.dispatchEvent(new Event('input'));
      playerRaise(max);
    });

    sliderContainer.appendChild(sliderWrap);

    if (stage) {
      stage.appendChild(sliderContainer);
    }
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
        const maxAllowed = Math.min(
          state.stake,
          state.maxPot - state.pot,
          state.tpcTotal
        );
        if (state.raiseAmount + val <= maxAllowed) {
          state.selectedChips.push(val);
          state.raiseAmount += val;
          updateRaiseAmount();
          playCallRaiseSound();
        }
      });
      grid.appendChild(chip);
    });
    raiseContainer.appendChild(grid);

    const infoRow = document.createElement('div');
    infoRow.className = 'raise-info';

    const undoBtn = document.createElement('button');
    undoBtn.id = 'undoChip';
    undoBtn.className = 'undo-chip';
    undoBtn.textContent = '⌫';
    undoBtn.addEventListener('click', () => {
      const removed = state.selectedChips.pop();
      if (removed) {
        state.raiseAmount = Math.max(0, state.raiseAmount - removed);
        updateRaiseAmount();
      }
    });
    infoRow.appendChild(undoBtn);

    const amountText = document.createElement('div');
    amountText.id = 'raiseAmountText';
    amountText.className = 'raise-amount';
    amountText.innerHTML = formatAmount(0);
    infoRow.appendChild(amountText);

    raiseContainer.appendChild(infoRow);

    if (stage) stage.appendChild(raiseContainer);
  }

  state.raiseAmount = 0;
  state.selectedChips = [];
  updateRaiseAmount();

  const slider = document.getElementById('raiseSlider');
  if (slider) {
    slider.value = '0';
    const amt = document.getElementById('raiseSliderAmount');
    if (amt) amt.innerHTML = formatAmount(0);
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
  if (checkBtn) {
    const outstanding = Math.max(0, state.currentBet - (state.roundBets[0] || 0));
    const hide = outstanding > 0;
    checkBtn.disabled = hide;
    checkBtn.style.display = hide ? 'none' : '';
  }

  const maxAllowed = Math.min(
    state.stake,
    state.maxPot - state.pot,
    state.tpcTotal
  );
  ['sliderRaise', 'allIn'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = maxAllowed <= 0;
  });
  if (slider) {
    slider.max = Math.max(0, maxAllowed);
    slider.disabled = maxAllowed <= 0;
  }
  document.querySelectorAll('#raiseContainer .chip').forEach((chip) => {
    chip.style.pointerEvents = maxAllowed > 0 ? 'auto' : 'none';
  });

  loadAccountBalance().then(() => updateSliderRange());
}

function updateRaiseAmount() {
  const amtEl = document.getElementById('raiseAmountText');
  if (amtEl) amtEl.innerHTML = formatAmount(state.raiseAmount);
  const slider = document.getElementById('raiseSlider');
  if (slider) {
    slider.value = state.raiseAmount;
    const sliderAmt = document.getElementById('raiseSliderAmount');
    if (sliderAmt) sliderAmt.innerHTML = formatAmount(state.raiseAmount);
  }
  setStatus(
    'raise',
    state.raiseAmount > 0 ? `Raise ${formatAmount(state.raiseAmount)}` : ''
  );
  updateBalancePreview(state.raiseAmount);
}

function updateSliderRange() {
  const slider = document.getElementById('raiseSlider');
  if (!slider) return;
  const maxAllowed = Math.min(
    state.stake,
    state.maxPot - state.pot,
    state.tpcTotal
  );
  slider.max = Math.max(0, maxAllowed);
  slider.value = Math.min(parseInt(slider.value, 10) || 0, slider.max);
  const amt = document.getElementById('raiseSliderAmount');
  if (amt) amt.innerHTML = formatAmount(slider.value);
  const disable = maxAllowed <= 0;
  ['sliderRaise', 'allIn'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = disable;
  });
  slider.disabled = disable;
  document
    .querySelectorAll('#raiseContainer .chip')
    .forEach((chip) => (chip.style.pointerEvents = disable ? 'none' : 'auto'));
  const preview =
    state.raiseAmount > 0 ? state.raiseAmount : parseInt(slider.value, 10);
  updateBalancePreview(preview);
  updateActionButtons();
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
  document.querySelectorAll('#raiseContainer .chip').forEach((chip) => {
    chip.style.pointerEvents = 'none';
  });
  state.raiseAmount = 0;
  state.selectedChips = [];
  updateRaiseAmount();
  const amt = document.getElementById('raiseSliderAmount');
  if (amt) amt.innerHTML = formatAmount(0);
  setStatus('', '');
}

function startPlayerTurn() {
  state.turn = 0;
  setPlayerTurnIndicator(0);
  playKnockSound();
  showControls();
  updateActionButtons();
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
    if (state.turnTime <= 7 && state.turnTime > 0 && !settings.muteOthers) {
      snd.volume = 1;
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
  setStatus('fold', 'You folded');
  moveCardsToFolded(0);
  proceedStage();
}

function playerCheck() {
  const outstanding = Math.max(0, state.currentBet - (state.roundBets[0] || 0));
  // disallow checking when there is an outstanding bet
  if (outstanding > 0) return;
  setActionText(0, 'check');
  setStatus('check', 'You check');
  state.roundBets[0] = Math.max(state.roundBets[0] || 0, state.currentBet);
  proceedStage();
}

function playerCall() {
  const outstanding = Math.max(0, state.currentBet - (state.roundBets[0] || 0));
  if (outstanding <= 0) {
    playerCheck();
    return;
  }
  state.roundBets[0] = (state.roundBets[0] || 0) + outstanding;
  state.pot += outstanding;
  animateChipsFromPlayer(0, outstanding);
  setActionText(0, 'call');
  setStatus('call', `You call ${formatAmount(outstanding)}`);
  if (state.pot >= state.maxPot) playAllInSound();
  else playCallRaiseSound();
  state.tpcTotal = Math.max(0, state.tpcTotal - outstanding);
  updateBalancePreview();
  updateSliderRange();
  updateActionButtons();
  proceedStage();
}

function playerRaise(amount = state.raiseAmount) {
  const outstanding = Math.max(0, state.currentBet - (state.roundBets[0] || 0));
  const maxAllowed = Math.min(state.stake, state.maxPot - state.pot);
  const total = Math.min(outstanding + amount, maxAllowed);
  if (total <= outstanding) return;
  state.pot += total;
  state.roundBets[0] = (state.roundBets[0] || 0) + total;
  state.currentBet = Math.max(state.currentBet, state.roundBets[0]);
  animateChipsFromPlayer(0, total);
  setActionText(0, 'raise');
  setStatus('raise', `You raise ${formatAmount(total)}`);
  if (state.pot >= state.maxPot) playAllInSound();
  else playCallRaiseSound();
  state.tpcTotal = Math.max(0, state.tpcTotal - total);
  updateBalancePreview();
  updateSliderRange();
  updateActionButtons();
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
    setStatus('', `${p.name}...`);
    await new Promise((r) => setTimeout(r, 2500));
    const toCall = Math.max(0, state.currentBet - (state.roundBets[i] || 0));
    let action = aiChooseAction(
      p.hand,
      state.community.slice(0, stageCommunityCount()),
      state.currentBet
    );
    if (toCall <= 0 && action === 'call') action = 'check';
    if (toCall > 0 && action === 'check') action = 'call';
    if (action === 'raise') {
      const raiseBy = ANTE;
      const total = Math.min(toCall + raiseBy, state.maxPot - state.pot);
      if (total <= toCall) {
        action = toCall > 0 ? 'call' : 'check';
      } else {
        state.roundBets[i] = (state.roundBets[i] || 0) + total;
        state.currentBet = Math.max(state.currentBet, state.roundBets[i]);
        state.pot += total;
        p.balance = Math.max(0, (p.balance || 0) - total);
        animateChipsFromPlayer(i, total);
        setStatus('raise', `${p.name} raises to ${formatAmount(state.currentBet)}`);
        if (state.pot >= state.maxPot) playAllInSound();
        else playCallRaiseSound();
        updateBalances();
      }
    }
    if (action === 'call') {
      if (toCall <= 0) {
        action = 'check';
      } else {
        state.roundBets[i] = (state.roundBets[i] || 0) + toCall;
        state.pot += toCall;
        p.balance = Math.max(0, (p.balance || 0) - toCall);
        animateChipsFromPlayer(i, toCall);
        setStatus('call', `${p.name} calls ${formatAmount(toCall)}`);
        if (state.pot >= state.maxPot) playAllInSound();
        else playCallRaiseSound();
        updateBalances();
      }
    }
    if (action === 'fold') {
      p.active = false;
      setStatus('fold', `${p.name} folds`);
      moveCardsToFolded(i);
    } else if (action === 'check') {
      state.roundBets[i] = Math.max(state.roundBets[i] || 0, state.currentBet);
      setStatus('check', `${p.name} checks`);
    }
    setActionText(i, action);
  }
  setPlayerTurnIndicator(null);
  const unsettled = state.players.some(
    (p, idx) => !p.vacant && p.active && (state.roundBets[idx] || 0) < state.currentBet
  );
  if (unsettled && state.players[0]?.active) {
    startPlayerTurn();
    return;
  }
  state.stage++;
  startBettingRound();
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
  const targetX =
    cardRect.left - stageRect.left + cardRect.width / 2 - potEl.offsetWidth / 2;
  const targetY =
    idx === 0
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
  const text =
    winners.length === 1
      ? `${activePlayers[winners[0].index].name} wins with ${HAND_RANK_NAMES[winners[0].score.rank]}!`
      : 'Tie';
  setStatus('', text);
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
            game: 'texasholdem-win'
          });
          if (myTelegramId) {
            window.fbApi.addTransaction(myTelegramId, 0, 'win', {
              game: 'texasholdem',
              players: activePlayers.length,
              accountId: myAccountId
            });
          }
        } catch {}
      }
      state.players[playerIndex].balance =
        (state.players[playerIndex].balance || 0) + pot;
      if (winnerPlayer.isHuman) {
        state.tpcTotal = state.players[playerIndex].balance;
        updateBalancePreview();
      } else {
        updateBalances();
      }
      state.pot = 0;
    }
  }
  // Show winning cards briefly before starting a new hand
  setTimeout(() => init(), 5000);
}

document.getElementById('lobbyIcon')?.addEventListener('click', () => {
  location.href = '/games/texasholdem/lobby';
});
document.addEventListener('DOMContentLoaded', () => {
  initSettingsMenu();
  applySettings();
  init();
});

function joinSeat() {
  state.seated = true;
  init();
}
