import {
  createDeck,
  shuffle,
  hitCard,
  handValue,
  isBust,
  evaluateWinners,
  aiAction,
  aiBetAction
} from './lib/blackjack.js';

const FLAG_EMOJIS = window.FLAG_EMOJIS || [];

const state = {
  players: [],
  deck: [],
  turn: 0,
  stake: 0,
  startBet: 0,
  token: 'TPC',
  devAccountId: '',
  pot: 0,
  accountBalance: 0,
  raiseAmount: 0,
  community: [],
  currentBet: 0,
  awaitingCall: true,
  raiseInitiator: -1,
};

let myAccountId = '';
let myTelegramId;
const api = window.blackjackApi || window.fbApi;

const CHIP_VALUES = [1000, 500, 200, 50, 20, 10, 5, 2, 1];
let sndCallRaise;
let sndFlip;
let callTimer;
const pendingTimers = [];

function delay(fn, ms) {
  const id = setTimeout(fn, ms);
  pendingTimers.push(id);
  return id;
}

function clearPendingTimers() {
  pendingTimers.forEach(clearTimeout);
  pendingTimers.length = 0;
}

const TPC_ICON_HTML =
  '<img src="assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" class="tpc-inline-icon" />';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
function flagName(flag) {
  const codePoints = [...flag].map((c) => c.codePointAt(0) - 0x1f1e6 + 65);
  return regionNames.of(String.fromCharCode(...codePoints));
}

function randomBalance() {
  return Math.floor(Math.random() * 9000) + 1000;
}

async function loadAccountBalance() {
  if (!myAccountId || !api?.getAccountBalance) return;
  try {
    const res = await api.getAccountBalance(myAccountId);
    if (res && typeof res.balance === 'number') {
      state.accountBalance = res.balance;
      state.players.forEach((p) => {
        if (p.isHuman) p.balance = res.balance;
      });
      render();
      updateBalanceDisplay();
    }
  } catch {}
}

function formatAmount(amount) {
  return `${amount} ${TPC_ICON_HTML}`;
}

function updateBalanceDisplay() {
  const el = document.getElementById('tpcTotal');
  const totalDiv = el ? el.closest('.tpc-total') : null;
  if (el) el.textContent = state.accountBalance;
  if (totalDiv) {
    if (state.accountBalance >= 100000) totalDiv.classList.add('small');
    else totalDiv.classList.remove('small');
  }
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
    el.classList.add('small');
    name = name.slice(0, 10);
  } else {
    el.classList.remove('small');
  }
  el.textContent = name;
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
  if (!state.devAccountId || !api) return;
  try {
    await api.depositAccount(state.devAccountId, Math.round(total * 0.1), {
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
    temp.style.left = deckRect.left + deckRect.width / 2 - stageRect.left + 'px';
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

function render() {
  updateRaiseAmount();
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
    seat.className = 'seat ' + (positions[i] || 'bottom');
    const inner = document.createElement('div');
    inner.className = 'seat-inner';
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    if (p.avatar && p.avatar.startsWith('http')) {
      avatar.style.background = `url('${p.avatar}') center/cover no-repeat`;
    } else if (p.avatar) {
      avatar.textContent = p.avatar;
    } else {
      avatar.textContent = p.name[0] || '?';
    }
    inner.appendChild(avatar);
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = p.name;
    adjustNameSize(name);
    inner.appendChild(name);

    const cards = document.createElement('div');
    cards.className = 'cards';
    cards.id = 'cards-' + i;
    p.hand.forEach((c) => {
      cards.appendChild(p.revealed || p.isHuman ? cardEl(c) : cardBackEl());
    });
    if (p.winner) {
      Array.from(cards.children).forEach((card) => card.classList.add('winning'));
    }
    if (p.isHuman || p.winner || p.revealed) {
      const total = document.createElement('div');
      total.className = 'hand-total';
      total.textContent = handValue(p.hand).toString();
      if (p.bust) total.classList.add('bust');
      cards.appendChild(total);
    }
    inner.appendChild(cards);

    const isMyTurn = p.isHuman && state.turn === i && !p.stood && !p.bust;
    if (isMyTurn && !state.awaitingCall) {
      const hs = document.createElement('div');
      hs.className = 'hit-stand';
      const hitBtn = document.createElement('button');
      hitBtn.id = 'hitBtn';
      hitBtn.textContent = 'Hit';
      hitBtn.addEventListener('click', () => window.hit());
      const standBtn = document.createElement('button');
      standBtn.id = 'standBtn';
      standBtn.textContent = 'Stand';
      standBtn.addEventListener('click', () => window.stand());
      if (canSplit(p)) {
        const splitBtn = document.createElement('button');
        splitBtn.id = 'splitBtn';
        splitBtn.textContent = 'Split';
        splitBtn.addEventListener('click', playerSplit);
        hs.append(hitBtn, standBtn, splitBtn);
      } else {
        hs.append(hitBtn, standBtn);
      }
      inner.appendChild(hs);
    }
    const bal = document.createElement('div');
    bal.className = 'seat-balance';
    bal.innerHTML = formatAmount(p.isHuman ? state.accountBalance : p.balance || 0);

    if (isMyTurn) {
      if (state.awaitingCall) {
        const controls = document.createElement('div');
        controls.className = 'controls';
        controls.id = 'controls';
        const foldBtn = document.createElement('button');
        foldBtn.id = 'fold';
        foldBtn.textContent = 'Fold';
        foldBtn.addEventListener('click', playerFold);
        const callBtn = document.createElement('button');
        callBtn.id = 'call';
        const callAmt = Math.max(0, state.currentBet - (p.bet || 0));
        callBtn.innerHTML = `Call ${formatAmount(callAmt)}`;
        callBtn.addEventListener('click', playerCall);
        controls.append(foldBtn, callBtn);
        seat.append(inner, bal, controls);
      } else {
        seat.append(inner, bal);
      }
    } else {
      seat.append(inner, bal);
    }
    const actionText = document.createElement('div');
    actionText.className = 'action-text';
    if (p.action) {
      actionText.classList.add(p.action.type);
      actionText.innerHTML = p.action.text;
    }
    seat.appendChild(actionText);

    if (i === state.turn && !p.stood && !p.bust) seat.classList.add('active');
    if (p.bust) seat.classList.add('folded');
    if (p.winner) seat.classList.add('winner');
    if (p.stood && !p.bust) {
      const action = document.createElement('div');
      action.className = 'action-label';
      action.textContent = 'STAND';
      seat.appendChild(action);
    }
    seats.appendChild(seat);
  });
  adjustPlayerScaling();
  updateBalanceDisplay();
  renderCommunity();
}

function adjustPlayerScaling() {
  const player = state.players[0];
  if (!player) return;
  const count = player.hand.length;
  const baseCard = 1.083;
  const baseUi = 1;
  if (count <= 3) {
    document.documentElement.style.setProperty('--bottom-card-scale', baseCard);
    document.documentElement.style.setProperty('--ui-scale', '1');
    return;
  }
  const extra = count - 3;
  const cardScale = Math.max(0.6, baseCard - 0.1 * extra);
  const uiScale = Math.max(0.6, baseUi - 0.1 * extra);
  document.documentElement.style.setProperty('--bottom-card-scale', cardScale.toString());
  document.documentElement.style.setProperty('--ui-scale', uiScale.toString());
}

function aiRespondToRaise() {
  const p = state.players[state.turn];
  const act = aiBetAction(p.hand);
  if (act === 'fold') {
    p.bust = true;
    p.stood = true;
    p.action = { type: 'fold', text: `${p.name} folds` };
    render();
    nextTurn();
    return;
  }
  const callAmt = Math.max(0, state.currentBet - (p.bet || 0));
  const callPay = Math.min(callAmt, p.balance || callAmt);
  state.pot += callPay;
  p.balance -= callPay;
  p.bet = (p.bet || 0) + callPay;
  animateChipsFromPlayer(state.turn, callPay);
  playCallRaise();
  if (act === 'raise') {
    const maxRaise = Math.max(0, state.stake - state.currentBet);
    const raiseAmt = Math.min(state.currentBet, p.balance || state.currentBet, maxRaise);
    if (raiseAmt > 0) {
      state.pot += raiseAmt;
      p.balance -= raiseAmt;
      p.bet += raiseAmt;
      state.currentBet = p.bet;
      state.raiseInitiator = state.turn;
      animateChipsFromPlayer(state.turn, raiseAmt);
      playCallRaise();
      renderPot();
      p.action = { type: 'raise', text: `${p.name} raises to ${formatAmount(p.bet)}` };
      render();
      nextTurn();
      return;
    }
  }
  renderPot();
  p.action = { type: 'call', text: `${p.name} calls ${formatAmount(callPay)}` };
  render();
  nextTurn();
}

function nextTurn() {
  if (state.awaitingCall) {
    do {
      state.turn = (state.turn + 1) % state.players.length;
      const p = state.players[state.turn];
      if (!p.bust) break;
    } while (state.turn !== state.raiseInitiator);

    if (state.turn === state.raiseInitiator) {
      state.awaitingCall = false;
      state.currentBet = 0;
      state.raiseInitiator = -1;
      const p = state.players[state.turn];
      if (!p.isHuman) {
        delay(aiTurn, 500);
      }
      render();
      return;
    }

    const p = state.players[state.turn];
    if (p.isHuman) {
      startCallTimer();
      render();
    } else {
      delay(aiRespondToRaise, 500);
    }
    return;
  }

  state.turn++;
  while (
    state.turn < state.players.length &&
    (state.players[state.turn].bust || state.players[state.turn].stood)
  ) {
    state.turn++;
  }
  if (state.turn >= state.players.length) {
    finish();
    return;
  }
  const p = state.players[state.turn];
  if (!p.isHuman) {
    delay(aiTurn, 500);
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
    delay(aiTurn, 500);
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
  clearCallTimer();
  nextTurn();
};

window.split = playerSplit;

function playerFold() {
  const p = state.players[state.turn];
  if (!p || !p.isHuman) return;
  p.bust = true;
  p.stood = true;
  p.action = { type: 'fold', text: `${p.name} folds` };
  clearCallTimer();
  render();
  nextTurn();
}

function playerCheck() {
  const p = state.players[state.turn];
  if (!p) return;
  p.action = { type: 'check', text: `${p.name} checks` };
  render();
  nextTurn();
}

function playerCall() {
  clearCallTimer();
  const p = state.players[state.turn];
  if (!p) return;
  const callAmt = Math.max(0, state.currentBet - (p.bet || 0));
  const pay = Math.min(callAmt, p.balance || callAmt);
  state.pot += pay;
  p.balance -= pay;
  if (p.isHuman) state.accountBalance -= pay;
  p.bet = (p.bet || 0) + pay;
  animateChipsFromPlayer(state.turn, pay);
  playCallRaise();
  renderPot();
  p.action = { type: 'call', text: `${p.name} calls ${formatAmount(pay)}` };
  state.awaitingCall = false;
  render();
}

function canSplit(p) {
  return (
    p &&
    p.isHuman &&
    p.hand &&
    p.hand.length === 2 &&
    p.hand[0].rank === p.hand[1].rank &&
    p.balance >= state.startBet
  );
}

function playerSplit() {
  const p = state.players[state.turn];
  if (!canSplit(p)) return;
  const second = p.hand.pop();
  const newPlayer = {
    hand: [second],
    stood: false,
    bust: false,
    name: p.name,
    avatar: p.avatar,
    isHuman: true,
    balance: p.balance - state.startBet,
    bet: state.startBet,
    revealed: true
  };
  p.balance -= state.startBet;
  state.accountBalance -= state.startBet;
  state.pot += state.startBet;
  state.players.splice(state.turn + 1, 0, newPlayer);
  renderPot();
  render();
}

async function finish() {
  const winners = evaluateWinners(state.players);
  const pot = state.pot;
  awardDevShare(pot);

  if (winners.length === 0) {
    state.players.forEach((p) => (p.revealed = true));
    state.pot = 0;
    render();
    renderPot();
    setStatus('', 'All players busted. Starting a new round.');
    delay(() => {
      setStatus('', '');
      startNewRound();
    }, 4000);
    return;
  }

  const share = Math.floor((pot * 0.9) / winners.length);
  for (const i of winners) {
    const player = state.players[i];
    player.balance = (player.balance || 0) + share;
    player.winner = true;
    if (player.isHuman && myAccountId && api) {
      try {
        await api.depositAccount(myAccountId, share, {
          game: 'blackjack-win'
        });
        if (myTelegramId) {
          api.addTransaction(myTelegramId, 0, 'win', {
            game: 'blackjack',
            accountId: myAccountId
          });
        }
        state.accountBalance += share;
      } catch {}
    }
  }
  await loadAccountBalance();
  state.players.forEach((p) => (p.revealed = true));
  state.pot = 0;
  render();
  renderPot();
  const status = document.getElementById('status');
  let text = '';
  if (winners.length === 1) {
    const idx = winners[0];
    const val = handValue(state.players[idx].hand);
    text = `${state.players[idx].name} wins with ${val}!`;
  } else {
    text = `Winner(s): ${winners
      .map((i) => state.players[i].name)
      .join(', ')}`;
  }
  const showWinnerCountdown = (remaining) => {
    const sub = remaining > 0 ? `<span class="status-subtext">Next round in ${remaining}s</span>` : '';
    setStatus('', `${text}${sub}`);
    if (remaining <= 0) {
      state.players.forEach((p) => (p.winner = false));
      setStatus('', '');
      startNewRound();
      return;
    }
    delay(() => showWinnerCountdown(remaining - 1), 1000);
  };
  showWinnerCountdown(5);
}

function setStatus(action, text) {
  const status = document.getElementById('status');
  if (!status) return;
  if (text && text !== '') {
    status.className = 'status-default';
    status.innerHTML = text;
  } else {
    status.innerHTML = '';
  }
}

function startCallTimer() {
  clearTimeout(callTimer);
  callTimer = setTimeout(() => {
    if (state.awaitingCall && state.players[state.turn]?.isHuman) {
      playerFold();
    }
  }, 15000);
}

function clearCallTimer() {
  clearTimeout(callTimer);
}

function renderPot() {
  const potEl = document.getElementById('pot');
  const potTotal = document.getElementById('potTotal');
  if (potEl) {
    potEl.innerHTML = '';
    potEl.appendChild(buildChipPiles(state.pot, true));
  }
  if (potTotal) potTotal.textContent = `${state.pot} ${state.token}`;
}

function renderCommunity() {
  const el = document.getElementById('community');
  if (!el) return;
  el.innerHTML = '';
  const highlight = state.players.some((p) => p.winner);
  state.community.forEach((c) => {
    if (!c) {
      el.appendChild(cardBackEl());
    } else {
      const card = cardEl(c);
      if (highlight) card.classList.add('winning');
      el.appendChild(card);
    }
  });
}

function updateRaiseAmount() {
  const maxRaise = Math.max(0, state.stake - state.currentBet);
  if (state.raiseAmount > maxRaise) state.raiseAmount = maxRaise;
  const chipAmt = document.getElementById('chipAmount');
  const sliderAmt = document.getElementById('raiseSliderAmount');
  const slider = document.getElementById('raiseSlider');
  if (chipAmt) chipAmt.textContent = state.raiseAmount.toString();
  if (sliderAmt) sliderAmt.textContent = state.raiseAmount.toString();
  if (slider) {
    slider.max = maxRaise.toString();
    slider.value = state.raiseAmount.toString();
  }
}

function commitRaise() {
  const p = state.players[state.turn];
  if (!p) return;
  const callAmt = Math.max(0, state.currentBet - (p.bet || 0));
  const maxPay = state.stake - (p.bet || 0);
  const totalNeeded = Math.min(callAmt + state.raiseAmount, maxPay);
  const pay = Math.min(totalNeeded, p.balance || totalNeeded);
  if (pay <= 0) return;
  state.pot += pay;
  p.balance -= pay;
  if (p.isHuman) state.accountBalance -= pay;
  p.bet = (p.bet || 0) + pay;
  state.currentBet = p.bet;
  state.raiseInitiator = state.turn;
  animateChipsFromPlayer(state.turn, pay);
  playCallRaise();
  state.raiseAmount = 0;
  updateRaiseAmount();
  renderPot();
  p.action = { type: 'raise', text: `${p.name} raises to ${formatAmount(p.bet)}` };
  render();
  state.awaitingCall = true;
  nextTurn();
}

async function startNewRound() {
  clearPendingTimers();
  state.players = state.players.filter((p, i) => i === 0 || !p.isHuman);
  state.turn = 0;
  state.raiseAmount = 0;
  state.currentBet = 0;
  state.awaitingCall = true;
  state.raiseInitiator = -1;
  clearCallTimer();
  state.deck = shuffle(createDeck());
  state.community = [];
  state.players.forEach((p) => {
    p.hand = [];
    p.stood = false;
    p.bust = false;
    p.revealed = false;
    p.bet = 0;
    p.action = null;
  });

  await loadAccountBalance();
  state.players.forEach((p) => {
    p.balance = (p.balance || 0) - state.startBet;
    p.bet = state.startBet;
    if (p.isHuman) state.accountBalance -= state.startBet;
  });
  state.currentBet = state.startBet;
  state.raiseInitiator = 0;
  state.pot = state.startBet * state.players.length;

  // show cleared table before dealing new cards
  render();
  renderPot();
  await new Promise((r) => delay(r, 500));

  // deal cards to each player one by one
  for (let i = 0; i < state.players.length; i++) {
    const { card, deck: d1 } = hitCard(state.deck);
    state.deck = d1;
    const p = state.players[i];
    p.hand.push(card);
    p.revealed = p.isHuman;
    await dealCardToPlayer(i, card, p.revealed);
  }
  for (let i = 0; i < state.players.length; i++) {
    const { card, deck: d2 } = hitCard(state.deck);
    state.deck = d2;
    state.players[i].hand.push(card);
    if (state.players[i].isHuman) state.players[i].revealed = true;
    await dealCardToPlayer(i, card, state.players[i].revealed);
  }

  // place deck back in the center
  state.community.push(null);
  state.awaitingCall = true;
  render();
  renderPot();
}

async function init() {
  const params = new URLSearchParams(location.search);
  state.token = params.get('token') || 'TPC';
  state.stake = parseInt(params.get('amount') || '0', 10);
  state.startBet = Math.max(1, Math.floor(state.stake / 100));
  state.devAccountId = params.get('dev') || '';
  myAccountId = params.get('accountId') || '';
  myTelegramId = params.get('tgId') || '';
  let avatar = params.get('avatar') || '';
  let username = params.get('username') || 'You';

  try {
    if (myAccountId && api?.getUserInfo) {
      const u = await api.getUserInfo({ accountId: myAccountId, tgId: myTelegramId });
      if (u) {
        username = u.username || u.first_name || username;
        avatar = u.photo_url || avatar;
      }
    }
  } catch {}

  const playerCount = 6;
  const flags = [...FLAG_EMOJIS].sort(() => 0.5 - Math.random()).slice(0, playerCount - 1);
  state.players = [
    {
      hand: [],
      stood: false,
      bust: false,
      name: username,
      avatar,
      isHuman: true,
      balance: 0,
      action: null,
    },
    ...flags.map((f) => ({
      hand: [],
      stood: false,
      bust: false,
      name: flagName(f),
      avatar: f,
      isHuman: false,
      balance: randomBalance(),
      action: null,
    })),
  ];

  await loadAccountBalance();
  state.players.forEach((p) => {
    p.balance = (p.balance || 0) - state.startBet;
    p.bet = state.startBet;
    if (p.isHuman) state.accountBalance -= state.startBet;
  });
  state.currentBet = state.startBet;
  state.raiseInitiator = 0;
  state.pot = state.startBet * state.players.length;
  state.deck = shuffle(createDeck());

  render();

  async function dealInitial() {
    for (let i = 0; i < state.players.length; i++) {
      const { card, deck: d1 } = hitCard(state.deck);
      state.deck = d1;
      const p = state.players[i];
      p.hand.push(card);
      p.revealed = p.isHuman;
      await dealCardToPlayer(i, card, p.revealed);
    }
    for (let i = 0; i < state.players.length; i++) {
      const { card, deck: d2 } = hitCard(state.deck);
      state.deck = d2;
      state.players[i].hand.push(card);
      if (state.players[i].isHuman) state.players[i].revealed = true;
      await dealCardToPlayer(i, card, state.players[i].revealed);
    }
    state.community.push(null);
    state.awaitingCall = true;
    render();
    renderPot();
  }

  dealInitial();

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
    slider.max = Math.max(0, state.stake - state.currentBet).toString();
    slider.addEventListener('input', () => {
      state.raiseAmount = parseInt(slider.value, 10);
      updateRaiseAmount();
    });
  }

  const raiseBtn = document.getElementById('raiseBtn');
  if (raiseBtn) raiseBtn.addEventListener('click', commitRaise);
  const statusEl = document.getElementById('status');
  sndCallRaise = document.getElementById('sndCallRaise');
  sndFlip = document.getElementById('sndFlip');
}

function buildChipPiles(amount, small = false) {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '4px';
  wrap.style.flexWrap = 'nowrap';
  wrap.style.justifyContent = 'center';
  let remaining = amount;
  const chips = [];
  CHIP_VALUES.forEach((val) => {
    while (remaining >= val && chips.length < 3) {
      remaining -= val;
      chips.push(val);
    }
  });
  if (remaining > 0) chips.push(remaining);
  chips.slice(0, 4).forEach((val) => {
    const chip = document.createElement('div');
    if (CHIP_VALUES.includes(val)) {
      chip.className = 'chip v' + val;
    } else {
      chip.className = 'chip custom';
      chip.textContent = val.toString();
    }
    if (small) chip.classList.add('small');
    wrap.appendChild(chip);
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
  delay(() => {
    chips.remove();
    renderPot();
  }, 500);
}

function aiBettingRound() {
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (p.isHuman || p.bust) continue;
    const act = aiBetAction(p.hand);
    if (act === 'raise') {
      const maxAmt = Math.max(0, state.stake - state.currentBet);
      const amt = Math.min(maxAmt, p.balance || maxAmt);
      if (amt > 0) {
        state.pot += amt;
        p.balance = (p.balance || 0) - amt;
        animateChipsFromPlayer(i, amt);
        playCallRaise();
        state.currentBet += amt;
        state.awaitingCall = true;
        state.raiseInitiator = i;
        state.turn = i;
        p.action = { type: 'raise', text: `${p.name} raises to ${formatAmount(state.currentBet)}` };
        renderPot();
        render();
        delay(aiTurn, 500);
        return;
      }
    } else if (act === 'fold') {
      p.bust = true;
      p.stood = true;
      p.action = { type: 'fold', text: `${p.name} folds` };
    }
  }
  renderPot();
  render();
}
