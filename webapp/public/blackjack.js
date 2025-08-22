import {
  createDeck,
  shuffle,
  hitCard,
  handValue,
  isBust,
  evaluateWinners,
  aiAction
} from './lib/blackjack.js';

const FLAG_EMOJIS = window.FLAG_EMOJIS || [];
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
function flagName(flag) {
  const codePoints = [...flag].map((c) => c.codePointAt(0) - 0x1f1e6 + 65);
  return regionNames.of(String.fromCharCode(...codePoints));
}

const state = {
  players: [],
  deck: [],
  turn: 0,
  stake: 0,
  token: 'TPC',
  devAccountId: '',
  pot: 0,
  raiseAmount: 0,
};

let myAccountId = '';
let myTelegramId;

const CHIP_VALUES = [1000, 500, 200, 50, 20, 10, 5, 2, 1];
let sndCallRaise;
let sndFlip;

const TPC_ICON_HTML =
  '<img src="assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" class="tpc-inline-icon" />';

function formatAmount(amount) {
  return `${amount} ${TPC_ICON_HTML}`;
}

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
      ...(JSON.parse(localStorage.getItem('bjSettings')) || {})
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings = loadSettings();

function saveSettings() {
  try {
    localStorage.setItem('bjSettings', JSON.stringify(settings));
  } catch {}
}

function applySettings() {
  document.documentElement.style.setProperty('--seat-bg-color', settings.playerColor);
  document.documentElement.style.setProperty('--card-back-color', settings.cardBackColor);
  document.documentElement.style.setProperty('--player-frame-color', settings.playerColor);
  document.body.classList.remove(...FRAME_STYLE_OPTIONS.map((s) => `frame-style-${s}`));
  document.body.classList.add(`frame-style-${settings.playerFrameStyle}`);
  const flip = document.getElementById('sndFlip');
  if (flip) flip.volume = settings.muteCards ? 0 : settings.cardVolume;
  const callRaise = document.getElementById('sndCallRaise');
  if (callRaise) callRaise.volume = settings.muteChips ? 0 : settings.chipVolume;
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

function playCallRaise() {
  if (sndCallRaise) {
    sndCallRaise.currentTime = 0;
    sndCallRaise.play();
  }
}

function playFlipSound() {
  if (sndFlip) {
    sndFlip.currentTime = 0;
    sndFlip.play();
  }
}

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

function cardBackEl() {
  const div = document.createElement('div');
  div.className = 'card back';
  return div;
}

function render() {
  const seats = document.getElementById('seats');
  seats.innerHTML = '';
  const POS = [
    { left: '50%', top: '80%' },
    { left: '80%', top: '64%' },
    { left: '80%', top: '26%' },
    { left: '50%', top: '10%' },
    { left: '20%', top: '26%' },
    { left: '20%', top: '64%' }
  ];
  state.players.forEach((p, i) => {
    const seat = document.createElement('div');
    seat.className = 'seat';
    if (i !== 0) seat.classList.add('small');
    const pos = POS[i] || { left: '50%', top: '50%' };
    seat.style.left = pos.left;
    seat.style.top = pos.top;
    seat.style.transform = 'translate(-50%, -50%)';
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    if (p.avatar && p.avatar.startsWith('http')) {
      avatar.style.background = `url('${p.avatar}') center/cover no-repeat`;
    } else {
      avatar.textContent = p.avatar || p.name[0];
    }
    const cards = document.createElement('div');
    cards.className = 'cards';
    p.hand.forEach((c, idx) => {
      if (i === 0 || idx >= 2 || p.revealed) {
        cards.appendChild(cardEl(c));
      } else {
        cards.appendChild(cardBackEl());
      }
    });
    const bal = document.createElement('div');
    bal.className = 'seat-balance';
    bal.innerHTML = formatAmount(p.balance || 0);
    seat.append(avatar, cards, bal);
    if (i === state.turn && !p.stood && !p.bust) seat.classList.add('active');
    if (p.bust) seat.classList.add('folded');
    if (p.winner) seat.classList.add('winner');
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
    playFlipSound();
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
  playFlipSound();
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
  const pot = state.pot;
  awardDevShare(pot);
  const share = Math.floor((pot * 0.9) / winners.length);
  winners.forEach((i) => {
    const player = state.players[i];
    player.balance = (player.balance || 0) + share;
    player.winner = true;
  });
  state.players.forEach((p) => (p.revealed = true));
  render();
  const status = document.getElementById('status');
  if (status)
    status.textContent = `Winner(s): ${winners
      .map((i) => state.players[i].name)
      .join(', ')}`;
  setTimeout(() => {
    state.players.forEach((p) => (p.winner = false));
    if (status) status.textContent = '';
    startNewRound();
  }, 2200);
}

function renderPot() {
  const potEl = document.getElementById('pot');
  const potTotal = document.getElementById('potTotal');
  if (potEl) {
    potEl.innerHTML = '';
    potEl.appendChild(buildChipPiles(state.pot));
  }
  if (potTotal) potTotal.textContent = `${state.pot} ${state.token}`;
}

function updateRaiseAmount() {
  const chipAmt = document.getElementById('chipAmount');
  const sliderAmt = document.getElementById('raiseSliderAmount');
  const slider = document.getElementById('raiseSlider');
  if (chipAmt) chipAmt.textContent = state.raiseAmount.toString();
  if (sliderAmt) sliderAmt.textContent = state.raiseAmount.toString();
  if (slider) slider.value = state.raiseAmount.toString();
}

function commitRaise() {
  if (state.raiseAmount <= 0) return;
  const amt = state.raiseAmount;
  state.pot += amt;
  animateChipsFromPlayer(state.turn, amt);
  playCallRaise();
  state.raiseAmount = 0;
  updateRaiseAmount();
}

function startNewRound() {
  state.turn = 0;
  state.pot = state.stake * state.players.length;
  state.raiseAmount = 0;
  state.deck = shuffle(createDeck());
  state.players.forEach((p) => {
    p.hand = [];
    p.stood = false;
    p.bust = false;
    p.revealed = false;
  });

  state.players.forEach((p, i) => {
    const { card, deck: d1 } = hitCard(state.deck);
    state.deck = d1;
    p.hand.push(card);
    p.revealed = i === 0;
    playFlipSound();
  });

  render();

  setTimeout(() => {
    state.players.forEach((p) => {
      const { card, deck: d2 } = hitCard(state.deck);
      state.deck = d2;
      p.hand.push(card);
      playFlipSound();
    });
    render();
    aiBettingRound();
    const p0 = state.players[0];
    if (!p0.isHuman) setTimeout(aiTurn, 500);
  }, 500);

  renderPot();
}

function init() {
  const params = new URLSearchParams(location.search);
  state.token = params.get('token') || 'TPC';
  state.stake = parseInt(params.get('amount') || '0', 10);
  state.devAccountId = params.get('dev') || '';
  myAccountId = params.get('accountId') || '';
  myTelegramId = params.get('tgId') || '';
  let avatar = params.get('avatar') || '';
  let username = params.get('username') || '';

  try {
    if (!username) {
      const initParam = params.get('init');
      if (initParam) {
        const data = new URLSearchParams(decodeURIComponent(initParam));
        const user = JSON.parse(data.get('user') || '{}');
        username = user.username || user.first_name || 'You';
        avatar = user.photo_url || avatar;
      } else if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        const u = window.Telegram.WebApp.initDataUnsafe.user;
        username = u.username || u.first_name || 'You';
        avatar = u.photo_url || avatar;
      }
    }
  } catch {}
  if (!username) username = 'You';

  const playerCount = 6;
  for (let i = 0; i < playerCount; i++) {
    const ai = i !== 0;
    const av = ai ? FLAG_EMOJIS[i % FLAG_EMOJIS.length] : avatar;
    const name = ai ? flagName(av) : username;
    state.players.push({ hand: [], stood: false, bust: false, name, avatar: av, isHuman: !ai });
  }

  const deck = shuffle(createDeck());
  state.deck = deck;

  // deal first card to each player
  state.players.forEach((p, i) => {
    const { card, deck: d1 } = hitCard(state.deck);
    state.deck = d1;
    p.hand.push(card);
    p.revealed = i === 0;
    playFlipSound();
  });

  render();

  // deal second card after short delay
  setTimeout(() => {
    state.players.forEach((p, i) => {
      const { card, deck: d2 } = hitCard(state.deck);
      state.deck = d2;
      p.hand.push(card);
      playFlipSound();
    });
    render();
    aiBettingRound();
    const p0 = state.players[0];
    if (!p0.isHuman) setTimeout(aiTurn, 500);
  }, 500);

  state.pot = state.stake * state.players.length;
  renderPot();

  document.querySelectorAll('#raiseContainer .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = parseInt(chip.dataset.value || '0', 10);
      state.raiseAmount += val;
      updateRaiseAmount();
      playCallRaise();
    });
  });

  const slider = document.getElementById('raiseSlider');
  if (slider) {
    slider.max = (state.stake * 10).toString();
    slider.addEventListener('input', () => {
      state.raiseAmount = parseInt(slider.value, 10);
      updateRaiseAmount();
    });
  }

  const raiseBtn = document.getElementById('raiseBtn');
  const allInBtn = document.getElementById('allInBtn');
  if (raiseBtn) raiseBtn.addEventListener('click', commitRaise);
  if (allInBtn)
    allInBtn.addEventListener('click', () => {
      state.raiseAmount = state.stake * 10;
      commitRaise();
    });
  sndCallRaise = document.getElementById('sndCallRaise');
  sndFlip = document.getElementById('sndFlip');
}

function buildChipPiles(amount) {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '4px';
  wrap.style.flexWrap = 'nowrap';
  wrap.style.justifyContent = 'center';
  let remaining = amount;
  CHIP_VALUES.forEach((val) => {
    while (remaining >= val) {
      remaining -= val;
      const chip = document.createElement('div');
      chip.className = 'chip v' + val;
      wrap.appendChild(chip);
    }
  });
  return wrap;
}

document.getElementById('lobbyIcon')?.addEventListener('click', () => {
  location.href = '/games/blackjack/lobby';
});
document.addEventListener('DOMContentLoaded', () => {
  initSettingsMenu();
  applySettings();
  init();
});

function animateChipsFromPlayer(index, amount) {
  const stage = document.querySelector('.stage');
  const seats = document.querySelectorAll('#seats .seat');
  const seat = seats[index];
  const potWrap = document.querySelector('.pot-wrap');
  if (!stage || !seat || !potWrap) {
    renderPot();
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
    renderPot();
  }, 500);
}

function aiBetAction(hand) {
  const val = handValue(hand);
  if (val >= 18) return 'raise';
  if (val <= 11) return 'fold';
  return 'call';
}

function aiBettingRound() {
  state.players.forEach((p, i) => {
    if (p.isHuman || p.bust) return;
    const act = aiBetAction(p.hand);
    if (act === 'raise') {
      state.pot += state.stake;
      animateChipsFromPlayer(i, state.stake);
      playCallRaise();
    } else if (act === 'fold') {
      p.bust = true;
      p.stood = true;
    }
  });
  renderPot();
  render();
}
