import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';

import { createArenaCarpetMaterial, createArenaWallMaterial } from '../../utils/arenaDecor.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';
import { ARENA_CAMERA_DEFAULTS, buildArenaCameraConfig } from '../../utils/arenaCameraConfig.js';
import { createMurlanStyleTable } from '../../utils/murlanTable.js';
import { createCardGeometry, createCardMesh, orientCard, setCardFace } from '../../utils/cards3d.js';
import { createChipFactory } from '../../utils/chips3d.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { DEFAULT_CHIP_VALUES, getChipVisual } from '../../utils/chipUi.js';

import {
  createDeck,
  shuffle,
  dealHoleCards,
  compareHands,
  estimateWinProbability
} from '../../../../lib/texasHoldem.js';

const MODEL_SCALE = 0.75;
const ARENA_GROWTH = 1.45;
const TABLE_RADIUS = 3.85 * MODEL_SCALE;
const TABLE_HEIGHT = 1.24 * MODEL_SCALE;
const ARENA_SCALE = 1.3 * ARENA_GROWTH;
const BOARD_SIZE = (TABLE_RADIUS * 2 + 1.2 * MODEL_SCALE) * ARENA_SCALE;
const STOOL_SCALE = 1.5 * 1.3;
const CARD_SCALE = 0.95;
const CARD_W = 0.4 * MODEL_SCALE * CARD_SCALE;
const CARD_H = 0.56 * MODEL_SCALE * CARD_SCALE;
const CARD_D = 0.02 * MODEL_SCALE * CARD_SCALE;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.05 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE;
const CHAIR_RADIUS = 5.95 * MODEL_SCALE * ARENA_GROWTH * 0.85;
const CHAIR_BASE_HEIGHT = TABLE_HEIGHT - SEAT_THICKNESS * 0.85;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const PLAYER_COUNT = 6;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const COMMUNITY_SPACING = CARD_W * 0.85;
const HOLE_SPACING = CARD_W * 0.7;
const POT_OFFSET = new THREE.Vector3(0, TABLE_HEIGHT + CARD_D * 6, 0);
const DECK_POSITION = new THREE.Vector3(-TABLE_RADIUS * 0.55, TABLE_HEIGHT + CARD_D * 6, TABLE_RADIUS * 0.55);
const CAMERA_SETTINGS = buildArenaCameraConfig(BOARD_SIZE);
const CAMERA_TARGET_LIFT = 0.18 * MODEL_SCALE;
const CAMERA_HEAD_TURN_LIMIT = THREE.MathUtils.degToRad(28);
const CAMERA_HEAD_PITCH_UP = THREE.MathUtils.degToRad(14);
const CAMERA_HEAD_PITCH_DOWN = THREE.MathUtils.degToRad(22);
const HEAD_YAW_SENSITIVITY = 0.0042;
const HEAD_PITCH_SENSITIVITY = 0.0035;
const CAMERA_LATERAL_OFFSETS = Object.freeze({ portrait: 0.62, landscape: 0.48 });
const CAMERA_RETREAT_OFFSETS = Object.freeze({ portrait: 2.05, landscape: 1.55 });
const CAMERA_ELEVATION_OFFSETS = Object.freeze({ portrait: 2.1, landscape: 1.72 });

const WORLD_UP = new THREE.Vector3(0, 1, 0);

const STAGE_SEQUENCE = ['preflop', 'flop', 'turn', 'river'];

const REGION_NAMES = typeof Intl !== 'undefined' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

function flagToName(flag) {
  if (!flag || !REGION_NAMES) return 'Guest';
  const points = Array.from(flag, (c) => c.codePointAt(0) - 0x1f1e6 + 65);
  if (points.length !== 2) return 'Guest';
  const code = String.fromCharCode(points[0], points[1]);
  return REGION_NAMES.of(code) || 'Guest';
}

function parseSearch(search) {
  const params = new URLSearchParams(search);
  const username = params.get('username') || 'You';
  const avatar = params.get('avatar') || '';
  const amount = Number.parseInt(params.get('amount') || '1000', 10);
  const token = params.get('token') || 'TPC';
  const stake = Number.isFinite(amount) && amount > 0 ? amount : 1000;
  return { username, avatar, stake, token };
}

function buildPlayers(search) {
  const { username, stake } = parseSearch(search);
  const baseChips = Math.max(400, Math.round(stake));
  const flags = [...FLAG_EMOJIS].sort(() => 0.5 - Math.random());
  const humanFlag = flags.shift() || '🇦🇱';
  const players = [
    {
      id: 'player-0',
      name: username,
      flag: humanFlag,
      isHuman: true,
      chips: baseChips,
      avatar: null
    }
  ];
  for (let i = 0; i < PLAYER_COUNT - 1; i += 1) {
    const flag = flags[i] || FLAG_EMOJIS[(i * 17) % FLAG_EMOJIS.length];
    players.push({
      id: `ai-${i}`,
      name: flagToName(flag),
      flag,
      isHuman: false,
      chips: baseChips,
      avatar: null
    });
  }
  return players;
}

function createSeatLayout(count) {
  const radius = CHAIR_RADIUS;
  const layout = [];
  const sides = 2;
  const seatsPerSide = Math.ceil(count / sides);
  const xExtent = TABLE_RADIUS * 1.05;
  let seatIndex = 0;
  for (let side = 0; side < sides; side += 1) {
    const seatsRemaining = count - seatIndex;
    if (seatsRemaining <= 0) break;
    const seatsThisSide = Math.min(seatsPerSide, seatsRemaining);
    const rowSign = side === 0 ? 1 : -1;
    const seatZ = rowSign * radius;
    const spacing = seatsThisSide > 1 ? (xExtent * 2) / (seatsThisSide - 1) : 0;
    const rawOffsets = [];
    for (let pos = 0; pos < seatsThisSide; pos += 1) {
      const value = seatsThisSide === 1 ? 0 : -xExtent + spacing * pos;
      rawOffsets.push(value);
    }
    rawOffsets
      .sort((a, b) => {
        const diff = Math.abs(a) - Math.abs(b);
        if (diff !== 0) return diff;
        return a - b;
      })
      .forEach((offset) => {
        if (seatIndex >= count) return;
        const seatPos = new THREE.Vector3(offset, CHAIR_BASE_HEIGHT, seatZ);
        const forward = new THREE.Vector3(0, 0, rowSign);
        const right = new THREE.Vector3(-rowSign, 0, 0);
        const cardAnchor = new THREE.Vector3(
          offset,
          TABLE_HEIGHT + CARD_D * 6,
          seatZ - rowSign * (radius - TABLE_RADIUS * 0.68)
        );
        const chipAnchor = new THREE.Vector3(
          offset,
          TABLE_HEIGHT + CARD_D * 6,
          seatZ - rowSign * (radius - TABLE_RADIUS * 0.56)
        );
        const labelAnchor = new THREE.Vector3(offset, STOOL_HEIGHT + 0.48 * MODEL_SCALE, seatZ + rowSign * 0.6);
        const stoolAnchor = new THREE.Vector3(offset, CHAIR_BASE_HEIGHT + SEAT_THICKNESS / 2, seatZ);
        layout.push({
          forward,
          right,
          seatPos,
          cardAnchor,
          chipAnchor,
          labelAnchor,
          stoolAnchor,
          stoolHeight: STOOL_HEIGHT,
          isHuman: seatIndex === 0
        });
        seatIndex += 1;
      });
  }
  return layout;
}

function makeNameplate(name, chips, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const draw = (playerName, stack, highlight, status) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = highlight ? 'rgba(59,130,246,0.32)' : 'rgba(15,23,42,0.78)';
    ctx.strokeStyle = highlight ? '#60a5fa' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 12;
    roundRect(ctx, 16, 16, canvas.width - 32, canvas.height - 32, 36);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 72px "Inter", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(playerName, 40, 48);
    ctx.font = '600 54px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#e0f2fe';
    ctx.fillText(`${stack} chips`, 40, 140);
    if (status) {
      ctx.fillStyle = '#facc15';
      ctx.font = '600 50px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(status, canvas.width - 40, 140);
      ctx.textAlign = 'left';
    }
  };
  draw(name, chips, false, '');
  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  const scale = 1.45 * MODEL_SCALE;
  sprite.scale.set(scale, scale * 0.5, 1);
  sprite.userData.update = draw;
  sprite.userData.texture = texture;
  sprite.userData.canvas = canvas;
  return sprite;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function applyCardToMesh(mesh, card, geometry, cache) {
  if (!mesh || !card) return;
  const prev = mesh.userData?.card;
  if (prev && prev.rank === card.rank && prev.suit === card.suit) {
    mesh.userData.card = card;
    return;
  }
  const fresh = createCardMesh(card, geometry, cache);
  const existing = mesh.material;
  if (Array.isArray(existing)) {
    existing.forEach((mat) => mat?.dispose?.());
  } else {
    existing?.dispose?.();
  }
  mesh.material = fresh.material;
  mesh.userData = { ...mesh.userData, ...fresh.userData, card };
}

function buildInitialState(players, token, stake) {
  return {
    players: players.map((p, index) => ({
      ...p,
      seatIndex: index,
      hand: [],
      bet: 0,
      totalBet: 0,
      folded: false,
      allIn: false,
      actedInRound: false,
      status: ''
    })),
    token,
    stake,
    pot: 0,
    deck: [],
    community: [],
    stage: 'preflop',
    dealerIndex: players.length - 1,
    actionIndex: 0,
    currentBet: 0,
    minRaise: BIG_BLIND,
    winners: [],
    awaitingInput: false,
    handId: 0,
    showdown: false
  };
}

function resetForNextHand(state) {
  const next = { ...state, handId: state.handId + 1 };
  next.deck = shuffle(createDeck());
  next.community = [];
  next.stage = 'preflop';
  next.winners = [];
  next.showdown = false;
  next.pot = 0;
  next.currentBet = 0;
  next.minRaise = BIG_BLIND;
  next.dealerIndex = (state.dealerIndex + 1) % state.players.length;
  next.players = state.players.map((p, idx) => ({
    ...p,
    seatIndex: p.seatIndex ?? idx,
    bet: 0,
    totalBet: 0,
    hand: [],
    folded: p.chips <= 0,
    allIn: p.chips <= 0,
    actedInRound: false,
    status: p.chips <= 0 ? 'Out' : ''
  }));
  const active = next.players.filter((p) => p.chips > 0);
  if (active.length < 2) {
    return next;
  }
  dealHoleCardsToState(next);
  postBlinds(next);
  prepareNextAction(next, true);
  return next;
}

function dealHoleCardsToState(state) {
  const { hands, deck } = dealHoleCards(state.deck, state.players.length);
  state.deck = deck;
  state.players.forEach((player, idx) => {
    player.hand = hands[idx];
    player.folded = player.chips <= 0;
    player.allIn = player.chips <= 0;
    player.status = player.folded ? 'Out' : '';
  });
}

function postBlinds(state) {
  const smallBlindIndex = getNextActiveIndex(state.players, state.dealerIndex);
  const bigBlindIndex = getNextActiveIndex(state.players, smallBlindIndex);
  const sbPlayer = state.players[smallBlindIndex];
  const bbPlayer = state.players[bigBlindIndex];
  const sbAmount = payChips(sbPlayer, Math.min(SMALL_BLIND, sbPlayer.chips), state);
  const bbAmount = payChips(bbPlayer, Math.min(BIG_BLIND, bbPlayer.chips), state);
  sbPlayer.bet = sbAmount;
  sbPlayer.totalBet = sbAmount;
  bbPlayer.bet = bbAmount;
  bbPlayer.totalBet = bbAmount;
  sbPlayer.status = `SB ${sbAmount}`;
  bbPlayer.status = `BB ${bbAmount}`;
  state.currentBet = bbPlayer.bet;
  state.smallBlindIndex = smallBlindIndex;
  state.bigBlindIndex = bigBlindIndex;
  state.actionIndex = getNextActiveIndex(state.players, bigBlindIndex);
  resetActedFlags(state);
}

function payChips(player, amount, state) {
  if (amount <= 0) return 0;
  const spend = Math.min(amount, player.chips);
  player.chips -= spend;
  state.pot += spend;
  if (player.chips <= 0) {
    player.chips = 0;
    player.allIn = true;
  }
  return spend;
}

function getNextActiveIndex(players, startIndex) {
  if (!players.length) return 0;
  for (let offset = 1; offset <= players.length; offset += 1) {
    const idx = (startIndex + offset) % players.length;
    const p = players[idx];
    if (!p) continue;
    if (!p.folded && p.chips > 0 && !p.allIn) {
      return idx;
    }
  }
  return players.findIndex((p) => !p.folded) ?? 0;
}

function resetActedFlags(state) {
  state.players.forEach((p) => {
    p.actedInRound = p.folded || p.allIn;
  });
}

function allActiveMatched(state) {
  const active = state.players.filter((p) => !p.folded && !p.allIn);
  if (!active.length) return true;
  return active.every((p) => p.actedInRound && p.bet === state.currentBet);
}

function advanceStage(state) {
  if (state.stage === 'river') {
    goToShowdown(state);
    return;
  }
  const stageIndex = STAGE_SEQUENCE.indexOf(state.stage);
  const nextStage = STAGE_SEQUENCE[stageIndex + 1];
  state.stage = nextStage;
  if (nextStage === 'flop') {
    state.deck.pop();
    const cardA = state.deck.pop();
    const cardB = state.deck.pop();
    const cardC = state.deck.pop();
    state.community = [cardA, cardB, cardC];
  } else if (nextStage === 'turn' || nextStage === 'river') {
    state.deck.pop();
    state.community = [...state.community, state.deck.pop()];
  }
  state.players.forEach((p) => {
    p.bet = 0;
    p.actedInRound = p.folded || p.allIn;
    if (!p.folded && !p.allIn) {
      p.status = '';
    }
  });
  state.currentBet = 0;
  state.minRaise = BIG_BLIND;
  state.actionIndex = getNextActiveIndex(state.players, state.dealerIndex);
  prepareNextAction(state, false);
}

function goToShowdown(state) {
  while (state.community.length < 5 && state.deck.length) {
    if (state.community.length === 3 || state.community.length === 4) {
      state.deck.pop();
    }
    state.community.push(state.deck.pop());
  }
  const pots = buildSidePots(state.players);
  const results = [];
  pots.forEach((pot) => {
    const eligible = pot.players.filter((idx) => !state.players[idx].folded);
    if (!eligible.length) return;
    const winners = determineWinners(state.players, state.community, eligible);
    const share = pot.amount / winners.length;
    winners.forEach((idx) => {
      state.players[idx].chips += share;
      state.players[idx].status = `Win ${Math.round(share)}`;
    });
    results.push({ amount: pot.amount, winners });
  });
  state.pot = 0;
  state.winners = results;
  state.stage = 'showdown';
  state.showdown = true;
  state.awaitingInput = false;
}

function buildSidePots(players) {
  const active = players.filter((p) => p.totalBet > 0);
  if (!active.length) return [];
  const bets = [...new Set(active.map((p) => p.totalBet))].sort((a, b) => a - b);
  const pots = [];
  let previous = 0;
  bets.forEach((amount) => {
    const eligible = players.filter((p) => p.totalBet >= amount).map((p) => p.seatIndex ?? players.indexOf(p));
    const potAmount = (amount - previous) * eligible.length;
    pots.push({ amount: potAmount, players: eligible });
    previous = amount;
  });
  return pots;
}

function determineWinners(players, community, indices) {
  let winners = [];
  indices.forEach((idx) => {
    const player = players[idx];
    if (!player || player.folded) return;
    if (!winners.length) {
      winners = [idx];
      return;
    }
    const contender = compareHands([...player.hand, ...community], [...players[winners[0]].hand, ...community]);
    if (contender > 0) {
      winners = [idx];
    } else if (contender === 0) {
      winners.push(idx);
    }
  });
  return winners;
}

function prepareNextAction(state, isNewHand) {
  const activePlayers = state.players.filter((p) => !p.folded);
  if (activePlayers.length <= 1) {
    goToShowdown(state);
    return;
  }
  const actor = state.players[state.actionIndex];
  if (!actor || actor.folded || actor.allIn || actor.chips <= 0) {
    const nextIndex = getNextActiveIndex(state.players, state.actionIndex);
    if (nextIndex === state.actionIndex) {
      if (allActiveMatched(state)) {
        advanceStage(state);
      }
    } else {
      state.actionIndex = nextIndex;
      prepareNextAction(state, false);
    }
    return;
  }
  state.awaitingInput = actor.isHuman;
  if (!actor.isHuman) {
    actor.status = actor.status || 'Thinking';
  }
  if (isNewHand && actor.isHuman && state.stage === 'preflop') {
    actor.status = 'Your move';
  }
}

function performPlayerAction(state, action, raiseSize = BIG_BLIND) {
  const player = state.players[state.actionIndex];
  if (!player || player.folded || player.allIn) return;
  const toCall = Math.max(0, state.currentBet - player.bet);
  let advanced = false;
  if (action === 'fold') {
    player.folded = true;
    player.status = 'Fold';
    player.actedInRound = true;
    advanced = true;
  } else if (action === 'check') {
    if (toCall === 0) {
      player.status = 'Check';
      player.actedInRound = true;
      advanced = true;
    } else {
      return;
    }
  } else if (action === 'call') {
    const amount = Math.min(toCall, player.chips);
    if (amount <= 0 && toCall > 0) {
      player.status = 'Check';
      player.actedInRound = true;
      advanced = true;
    } else {
      const paid = payChips(player, amount, state);
      player.bet += paid;
      player.totalBet += paid;
      player.status = paid === toCall ? 'Call' : 'All-in';
      player.actedInRound = true;
      if (player.chips === 0) {
        player.allIn = true;
      }
      advanced = true;
    }
  } else if (action === 'bet' || action === 'raise') {
    let amount = Math.max(state.minRaise, raiseSize);
    if (action === 'raise') {
      amount += toCall;
    }
    let spend = Math.min(player.chips, amount);
    if (action === 'raise') {
      spend = Math.min(player.chips, toCall + Math.max(state.minRaise, raiseSize));
    }
    if (spend <= 0) {
      return;
    }
    const paid = payChips(player, spend, state);
    player.bet += paid;
    player.totalBet += paid;
    state.currentBet = Math.max(state.currentBet, player.bet);
    state.minRaise = Math.max(state.minRaise, paid - toCall);
    player.status = player.chips === 0 ? 'All-in' : action === 'bet' ? 'Bet' : 'Raise';
    player.actedInRound = true;
    state.players.forEach((p, idx) => {
      if (idx !== player.seatIndex && !p.folded && !p.allIn) {
        p.actedInRound = false;
      }
    });
    advanced = true;
  }
  if (!advanced) return;
  const nextIndex = getNextActiveIndex(state.players, state.actionIndex);
  if (nextIndex === state.actionIndex || nextIndex < 0) {
    if (allActiveMatched(state)) {
      advanceStage(state);
      return;
    }
  }
  state.actionIndex = nextIndex;
  prepareNextAction(state, false);
}

function performAiAction(state) {
  const player = state.players[state.actionIndex];
  if (!player || player.isHuman || player.folded || player.allIn) return;
  const toCall = Math.max(0, state.currentBet - player.bet);
  const community = state.community;
  const opponents = state.players.filter((p) => p !== player && !p.folded).length;
  const winRate = estimateWinProbability(player.hand, community, Math.max(1, opponents - 1), 80);
  let action = 'check';
  let raiseSize = state.minRaise;
  if (toCall > 0) {
    if (winRate < 0.28) {
      action = 'fold';
    } else if (winRate < 0.45) {
      action = 'call';
    } else {
      action = 'raise';
      raiseSize = Math.min(player.chips, Math.round(state.minRaise * (0.75 + winRate)));
    }
  } else {
    if (winRate > 0.55 && player.chips > state.minRaise) {
      action = 'bet';
      raiseSize = Math.min(player.chips, Math.round(state.minRaise * (0.5 + winRate)));
    } else {
      action = 'check';
    }
  }
  performPlayerAction(state, action, raiseSize);
}

function cloneState(state) {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p }))
  };
}

function TexasHoldemArena({ search }) {
  const mountRef = useRef(null);
  const threeRef = useRef(null);
  const animationRef = useRef(null);
  const railUiHostRef = useRef(null);
  const headAnglesRef = useRef({ yaw: 0, pitch: 0 });
  const cameraBasisRef = useRef({
    position: new THREE.Vector3(),
    baseForward: new THREE.Vector3(0, 0, -1),
    baseUp: new THREE.Vector3(0, 1, 0),
    baseRight: new THREE.Vector3(1, 0, 0)
  });
  const pointerStateRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startYaw: 0,
    startPitch: 0
  });
  const [gameState, setGameState] = useState(() => {
    const players = buildPlayers(search);
    const { token, stake } = parseSearch(search);
    const baseState = buildInitialState(players, token, stake);
    return resetForNextHand(baseState);
  });
  const [uiState, setUiState] = useState({
    availableActions: [],
    toCall: 0,
    canRaise: false,
    maxRaise: 0,
    minRaise: 0
  });
  const [chipSelection, setChipSelection] = useState([]);
  const [sliderValue, setSliderValue] = useState(0);
  const timerRef = useRef(null);

  if (!railUiHostRef.current && typeof document !== 'undefined') {
    const host = document.createElement('div');
    host.className = 'rail-ui-root rail-ui-root--texas';
    host.style.width = '360px';
    host.style.pointerEvents = 'auto';
    host.style.transformStyle = 'preserve-3d';
    host.style.transformOrigin = 'center';
    host.style.display = 'none';
    railUiHostRef.current = host;
  }

  const applyHeadOrientation = useCallback(() => {
    const three = threeRef.current;
    if (!three) return;
    const { camera } = three;
    const basis = cameraBasisRef.current;
    const { yaw, pitch } = headAnglesRef.current;

    const yawQuat = new THREE.Quaternion().setFromAxisAngle(WORLD_UP, yaw);
    const rotatedForward = basis.baseForward.clone().applyQuaternion(yawQuat);
    const rotatedUp = basis.baseUp.clone().applyQuaternion(yawQuat);
    const rightAxis = basis.baseRight.clone().applyQuaternion(yawQuat);
    const pitchQuat = new THREE.Quaternion().setFromAxisAngle(rightAxis, pitch);
    const finalForward = rotatedForward.applyQuaternion(pitchQuat).normalize();
    const finalUp = rotatedUp.applyQuaternion(pitchQuat).normalize();

    camera.position.copy(basis.position);
    camera.up.copy(finalUp);
    camera.lookAt(basis.position.clone().add(finalForward));
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    applyRendererSRGB(renderer);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.zIndex = '1';
    mount.appendChild(renderer.domElement);

    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(mount.clientWidth, mount.clientHeight);
    cssRenderer.domElement.style.position = 'absolute';
    cssRenderer.domElement.style.inset = '0';
    cssRenderer.domElement.style.zIndex = '2';
    cssRenderer.domElement.style.background = 'transparent';
    mount.appendChild(cssRenderer.domElement);

    const cssScene = new THREE.Scene();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');

    const camera = new THREE.PerspectiveCamera(
      CAMERA_SETTINGS.fov,
      mount.clientWidth / mount.clientHeight,
      CAMERA_SETTINGS.near,
      CAMERA_SETTINGS.far
    );
    camera.position.set(0, TABLE_HEIGHT * 3.5, TABLE_RADIUS * 3.4);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const spot = new THREE.SpotLight(0xffffff, 2.8, TABLE_RADIUS * 10, Math.PI / 3, 0.35, 1);
    spot.position.set(3, 7, 3);
    spot.castShadow = true;
    scene.add(spot);
    const rim = new THREE.PointLight(0x33ccff, 1.2);
    rim.position.set(-4, 3, -4);
    scene.add(rim);

    const arenaGroup = new THREE.Group();
    scene.add(arenaGroup);

    const floorGeometry = new THREE.CircleGeometry(TABLE_RADIUS * ARENA_GROWTH * 3.2, 64);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.9, metalness: 0.1 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    arenaGroup.add(floor);

    const carpet = new THREE.Mesh(
      new THREE.CircleGeometry(TABLE_RADIUS * ARENA_GROWTH * 2.2, 64),
      createArenaCarpetMaterial(new THREE.Color('#0f172a'), new THREE.Color('#1e3a8a'))
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.01;
    carpet.receiveShadow = true;
    arenaGroup.add(carpet);

    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(TABLE_RADIUS * ARENA_GROWTH * 2.4, TABLE_RADIUS * ARENA_GROWTH * 2.6, 3.6, 32, 1, true),
      createArenaWallMaterial('#0b1120', '#1e293b')
    );
    wall.position.y = 1.8;
    wall.receiveShadow = false;
    arenaGroup.add(wall);

    const tableInfo = createMurlanStyleTable({ arena: arenaGroup, tableRadius: TABLE_RADIUS, tableHeight: TABLE_HEIGHT });

    const cardGeometry = createCardGeometry(CARD_W, CARD_H, CARD_D);
    const faceCache = new Map();

    const chipFactory = createChipFactory(renderer, { cardWidth: CARD_W });
    const seatLayout = createSeatLayout(PLAYER_COUNT);
    const seatGroups = [];
    const deckAnchor = DECK_POSITION.clone();

    const humanSeat = seatLayout.find((seat) => seat.isHuman) ?? seatLayout[0];
    const cameraTarget = new THREE.Vector3(0, TABLE_HEIGHT + CAMERA_TARGET_LIFT, 0);
    const applySeatedCamera = (width, height) => {
      if (!humanSeat) return;
      const portrait = height > width;
      const lateralOffset = portrait ? CAMERA_LATERAL_OFFSETS.portrait : CAMERA_LATERAL_OFFSETS.landscape;
      const retreatOffset = portrait ? CAMERA_RETREAT_OFFSETS.portrait : CAMERA_RETREAT_OFFSETS.landscape;
      const elevation = portrait ? CAMERA_ELEVATION_OFFSETS.portrait : CAMERA_ELEVATION_OFFSETS.landscape;
      const position = humanSeat.stoolAnchor
        .clone()
        .addScaledVector(humanSeat.forward, -retreatOffset)
        .addScaledVector(humanSeat.right, lateralOffset);
      position.y = humanSeat.stoolHeight + elevation;
      camera.position.copy(position);
      camera.lookAt(cameraTarget);
      camera.updateMatrixWorld();
      const baseForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
      const baseUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
      const baseRight = new THREE.Vector3().crossVectors(baseForward, baseUp).normalize();
      cameraBasisRef.current = {
        position: position.clone(),
        baseForward,
        baseUp,
        baseRight
      };
      headAnglesRef.current.yaw = THREE.MathUtils.clamp(
        headAnglesRef.current.yaw,
        -CAMERA_HEAD_TURN_LIMIT,
        CAMERA_HEAD_TURN_LIMIT
      );
      headAnglesRef.current.pitch = THREE.MathUtils.clamp(
        headAnglesRef.current.pitch,
        -CAMERA_HEAD_PITCH_UP,
        CAMERA_HEAD_PITCH_DOWN
      );
      applyHeadOrientation();
    };

    applySeatedCamera(mount.clientWidth, mount.clientHeight);

    let railHud = null;
    if (railUiHostRef.current && humanSeat) {
      const host = railUiHostRef.current;
      const hudObject = new CSS3DObject(host);
      const basePosition = humanSeat.cardAnchor
        .clone()
        .addScaledVector(humanSeat.forward, TABLE_RADIUS * 0.34)
        .addScaledVector(humanSeat.right, TABLE_RADIUS * 0.26);
      basePosition.y = tableInfo.tableHeight + CARD_D * 24;
      const scale = 0.004 * MODEL_SCALE;
      hudObject.scale.setScalar(scale);
      cssScene.add(hudObject);
      railHud = {
        object: hudObject,
        basePosition,
        forward: humanSeat.forward.clone(),
        right: humanSeat.right.clone()
      };
    }

    const seatMaterials = {
      human: new THREE.MeshPhysicalMaterial({ color: 0x2563eb, roughness: 0.35, metalness: 0.5, clearcoat: 1 }),
      ai: new THREE.MeshPhysicalMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.5, clearcoat: 1 })
    };
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x111827 });

    seatLayout.forEach((seat) => {
      const group = new THREE.Group();
      group.position.copy(seat.seatPos);
      group.rotation.y = seat.forward.z > 0 ? Math.PI : 0;

      const seatMaterial = seat.isHuman ? seatMaterials.human : seatMaterials.ai;
      const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS, SEAT_DEPTH), seatMaterial);
      seatMesh.position.y = SEAT_THICKNESS / 2;
      seatMesh.castShadow = true;
      seatMesh.receiveShadow = true;
      group.add(seatMesh);

      const backMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, BACK_HEIGHT, BACK_THICKNESS), seatMaterial);
      backMesh.position.set(0, SEAT_THICKNESS / 2 + BACK_HEIGHT / 2, -SEAT_DEPTH / 2 + BACK_THICKNESS / 2);
      backMesh.castShadow = true;
      backMesh.receiveShadow = true;
      group.add(backMesh);

      const armGeometry = new THREE.BoxGeometry(ARM_THICKNESS, ARM_HEIGHT, ARM_DEPTH);
      const armLeft = new THREE.Mesh(armGeometry, seatMaterial);
      armLeft.position.set(-(SEAT_WIDTH / 2 + ARM_THICKNESS / 2), SEAT_THICKNESS / 2 + ARM_HEIGHT / 2, -SEAT_DEPTH * 0.05);
      armLeft.castShadow = true;
      armLeft.receiveShadow = true;
      group.add(armLeft);
      const armRight = armLeft.clone();
      armRight.position.x = -armLeft.position.x;
      group.add(armRight);

      const legBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16 * MODEL_SCALE * STOOL_SCALE, 0.2 * MODEL_SCALE * STOOL_SCALE, BASE_COLUMN_HEIGHT, 16),
        legMaterial
      );
      legBase.position.y = -SEAT_THICKNESS / 2 - BASE_COLUMN_HEIGHT / 2;
      legBase.castShadow = true;
      legBase.receiveShadow = true;
      group.add(legBase);

      arenaGroup.add(group);

      const cardMeshes = [0, 1].map(() => {
        const mesh = createCardMesh({ rank: 'A', suit: 'S' }, cardGeometry, faceCache);
        mesh.position.copy(deckAnchor);
        mesh.castShadow = true;
        arenaGroup.add(mesh);
        return mesh;
      });

      const chipStack = chipFactory.createStack(0);
      chipStack.position.copy(seat.chipAnchor);
      arenaGroup.add(chipStack);

      const nameplate = makeNameplate('Player', 0, renderer);
      nameplate.position.copy(seat.labelAnchor);
      arenaGroup.add(nameplate);

      seatGroups.push({
        group,
        cardMeshes,
        chipStack,
        nameplate,
        forward: seat.forward.clone(),
        right: seat.right.clone(),
        cardAnchor: seat.cardAnchor.clone(),
        chipAnchor: seat.chipAnchor.clone(),
        labelAnchor: seat.labelAnchor.clone(),
        stoolAnchor: seat.stoolAnchor.clone(),
        stoolHeight: seat.stoolHeight,
        isHuman: seat.isHuman
      });
    });

    const communityMeshes = Array.from({ length: 5 }, () => {
      const mesh = createCardMesh({ rank: 'A', suit: 'S' }, cardGeometry, faceCache);
      mesh.position.copy(deckAnchor);
      mesh.castShadow = true;
      arenaGroup.add(mesh);
      return mesh;
    });

    const potStack = chipFactory.createStack(0);
    potStack.position.copy(POT_OFFSET);
    arenaGroup.add(potStack);

    const updateRailHudPose = () => {
      if (!railHud?.object) return;
      const { object, basePosition, forward } = railHud;
      object.position.copy(basePosition);
      const lookTarget = basePosition.clone().add(forward.clone());
      object.lookAt(lookTarget);
      object.rotateX(-THREE.MathUtils.degToRad(58));
    };
    updateRailHudPose();

    threeRef.current = {
      renderer,
      scene,
      camera,
      chipFactory,
      cardGeometry,
      faceCache,
      seatGroups,
      communityMeshes,
      potStack,
      deckAnchor,
      cssRenderer,
      cssScene,
      railHud,
      updateRailHudPose,
      frameId: null
    };

    const element = renderer.domElement;
    const cssElement = cssRenderer.domElement;
    const forwardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave'];
    const forwardPointerEvent = (event) => {
      if (event.target !== cssElement) return;
      element.dispatchEvent(new PointerEvent(event.type, event));
    };
    forwardedEvents.forEach((name) => cssElement.addEventListener(name, forwardPointerEvent));
    const handlePointerDown = (event) => {
      event.preventDefault();
      pointerStateRef.current = {
        active: true,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startYaw: headAnglesRef.current.yaw,
        startPitch: headAnglesRef.current.pitch
      };
      element.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event) => {
      const state = pointerStateRef.current;
      if (!state.active || state.pointerId !== event.pointerId) return;
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      headAnglesRef.current.yaw = THREE.MathUtils.clamp(
        state.startYaw - dx * HEAD_YAW_SENSITIVITY,
        -CAMERA_HEAD_TURN_LIMIT,
        CAMERA_HEAD_TURN_LIMIT
      );
      headAnglesRef.current.pitch = THREE.MathUtils.clamp(
        state.startPitch - dy * HEAD_PITCH_SENSITIVITY,
        -CAMERA_HEAD_PITCH_UP,
        CAMERA_HEAD_PITCH_DOWN
      );
      applyHeadOrientation();
    };

    const handlePointerUp = (event) => {
      const state = pointerStateRef.current;
      if (state.pointerId === event.pointerId) {
        element.releasePointerCapture(event.pointerId);
        pointerStateRef.current = {
          active: false,
          pointerId: null,
          startX: 0,
          startY: 0,
          startYaw: 0,
          startPitch: 0
        };
      }
    };

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointercancel', handlePointerUp);
    element.addEventListener('pointerleave', handlePointerUp);

    const handleResize = () => {
      if (!mount || !threeRef.current) return;
      const { renderer: r, camera: cam, cssRenderer: cssR, updateRailHudPose: updateHud } = threeRef.current;
      const { clientWidth, clientHeight } = mount;
      r.setSize(clientWidth, clientHeight);
      cam.aspect = clientWidth / clientHeight;
      cam.updateProjectionMatrix();
      cssR?.setSize(clientWidth, clientHeight);
      applySeatedCamera(clientWidth, clientHeight);
      updateHud?.();
    };

    window.addEventListener('resize', handleResize);

    const animate = () => {
      const three = threeRef.current;
      if (!three) return;
      applyHeadOrientation();
      three.updateRailHudPose?.();
      three.renderer.render(three.scene, three.camera);
      three.cssRenderer?.render(three.cssScene, three.camera);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationRef.current);
      forwardedEvents.forEach((name) => cssElement.removeEventListener(name, forwardPointerEvent));
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointermove', handlePointerMove);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointercancel', handlePointerUp);
      element.removeEventListener('pointerleave', handlePointerUp);
      if (threeRef.current) {
        const {
          renderer: r,
          scene: s,
          chipFactory: factory,
          seatGroups: seats,
          communityMeshes: community,
          cssRenderer: cssR,
          cssScene: cssS,
          railHud: hud
        } = threeRef.current;
        seats.forEach((seat) => {
          seat.cardMeshes.forEach((mesh) => {
            mesh.geometry?.dispose?.();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => mat?.dispose?.());
            } else {
              mesh.material?.dispose?.();
            }
            s.remove(mesh);
          });
          factory.disposeStack(seat.chipStack);
          if (seat.nameplate) {
            seat.nameplate.material?.map?.dispose?.();
            seat.nameplate.material?.dispose?.();
            s.remove(seat.nameplate);
          }
        });
        community.forEach((mesh) => {
          mesh.geometry?.dispose?.();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat) => mat?.dispose?.());
          } else {
            mesh.material?.dispose?.();
          }
          s.remove(mesh);
        });
        factory.disposeStack(threeRef.current.potStack);
        factory.dispose();
        tableInfo?.dispose?.();
        if (hud?.object) {
          cssS?.remove(hud.object);
          hud.object.element?.remove?.();
        }
        cssR?.domElement?.remove?.();
        r.dispose();
      }
      mount.removeChild(renderer.domElement);
      if (cssRenderer.domElement.parentNode === mount) {
        mount.removeChild(cssRenderer.domElement);
      }
      if (railUiHostRef.current) {
        railUiHostRef.current.style.display = 'none';
      }
      threeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    const { seatGroups, communityMeshes, chipFactory, potStack } = three;
    const state = gameState;
    if (!state) return;
    state.players.forEach((player, idx) => {
      const seat = seatGroups[idx];
      if (!seat) return;
      const base = seat.cardAnchor.clone();
      const right = seat.right.clone();
      const forward = seat.forward.clone();
      seat.cardMeshes.forEach((mesh, cardIdx) => {
        const card = player.hand[cardIdx];
        if (!card) {
          mesh.visible = false;
          mesh.position.copy(three.deckAnchor);
          return;
        }
        mesh.visible = !player.folded || state.showdown;
        applyCardToMesh(mesh, card, three.cardGeometry, three.faceCache);
        const target = base
          .clone()
          .add(right.clone().multiplyScalar((cardIdx - 0.5) * HOLE_SPACING));
        mesh.position.copy(target);
        const look = target.clone().add(forward.clone().multiplyScalar(player.isHuman ? -1 : 1));
        orientCard(mesh, look, { face: player.isHuman || state.showdown ? 'front' : 'back', flat: true });
        setCardFace(mesh, player.isHuman || state.showdown ? 'front' : 'back');
      });
      chipFactory.setAmount(seat.chipStack, player.chips);
      const label = seat.nameplate;
      if (label?.userData?.update) {
        const highlight = state.stage !== 'showdown' && idx === state.actionIndex && !player.folded && !player.allIn;
        const status = player.status || '';
        label.userData.update(player.name, Math.round(player.chips), highlight, status);
        label.userData.texture.needsUpdate = true;
      }
    });

    communityMeshes.forEach((mesh, idx) => {
      const card = state.community[idx];
      if (!card) {
        mesh.position.copy(three.deckAnchor);
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      applyCardToMesh(mesh, card, three.cardGeometry, three.faceCache);
      const offset = (idx - 2) * COMMUNITY_SPACING;
      const position = new THREE.Vector3(offset, TABLE_HEIGHT + CARD_D * 6, 0);
      mesh.position.copy(position);
      orientCard(mesh, position.clone().add(new THREE.Vector3(0, 0, 1)), { face: 'front', flat: true });
      setCardFace(mesh, 'front');
    });

    chipFactory.setAmount(potStack, state.pot);
  }, [gameState]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!gameState) return;
    if (gameState.stage === 'showdown') {
      timerRef.current = setTimeout(() => {
        setGameState((prev) => resetForNextHand(cloneState(prev)));
      }, 4000);
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
    const actor = gameState.players[gameState.actionIndex];
    if (!actor) return;
    if (actor.isHuman) {
      const toCall = Math.max(0, gameState.currentBet - actor.bet);
      const canCheck = toCall === 0;
      const maxRaise = Math.max(0, actor.chips - toCall);
      const minRaise = Math.min(maxRaise, gameState.minRaise);
      const canRaise = maxRaise > 0;
      const actions = [];
      actions.push({ id: 'fold', label: 'Fold' });
      if (canCheck) {
        actions.push({ id: 'check', label: 'Check' });
      } else {
        actions.push({ id: 'call', label: `Call ${Math.round(toCall)} ${gameState.token}` });
      }
      setUiState({ availableActions: actions, toCall, canRaise, maxRaise, minRaise });
    } else {
      setUiState({ availableActions: [], toCall: 0, canRaise: false, maxRaise: 0, minRaise: 0 });
      timerRef.current = setTimeout(() => {
        setGameState((prev) => {
          const next = cloneState(prev);
          performAiAction(next);
          return next;
        });
      }, 900);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState]);

  const handleAction = (id, raiseAmount) => {
    setGameState((prev) => {
      const next = cloneState(prev);
      if (next.stage === 'showdown') return next;
      const amount = raiseAmount ?? next.minRaise;
      performPlayerAction(next, id, amount);
      return next;
    });
  };

  const actor = gameState.players[gameState.actionIndex];
  const toCall = actor ? Math.max(0, gameState.currentBet - actor.bet) : 0;
  const sliderMax = actor ? Math.max(0, actor.chips - toCall) : 0;
  const minRaiseAmount = actor ? Math.min(sliderMax, gameState.minRaise) : 0;
  const defaultRaise = sliderMax <= 0 ? 0 : minRaiseAmount > 0 ? Math.min(sliderMax, minRaiseAmount) : sliderMax;
  const chipTotal = useMemo(
    () => chipSelection.reduce((sum, chip) => sum + chip, 0),
    [chipSelection]
  );
  const effectiveRaise = chipTotal > 0 ? chipTotal : sliderValue;
  const finalRaise = sliderMax > 0 ? Math.min(sliderMax, Math.max(effectiveRaise, defaultRaise)) : 0;
  const totalSpend = toCall + finalRaise;
  const sliderEnabled = Boolean(actor?.isHuman && uiState.canRaise && sliderMax > 0);
  const sliderLabel = toCall > 0 ? 'Raise' : 'Bet';
  const raisePreview = sliderEnabled ? Math.min(sliderMax, effectiveRaise) : 0;

  useEffect(() => {
    if (!actor?.isHuman || gameState.stage === 'showdown') {
      setChipSelection([]);
      setSliderValue(0);
      return;
    }
    if (sliderMax <= 0) {
      setChipSelection([]);
      setSliderValue(0);
      return;
    }
    setChipSelection([]);
    setSliderValue(defaultRaise);
  }, [actor?.id, sliderMax, minRaiseAmount, gameState.stage, defaultRaise]);

  useEffect(() => {
    if (sliderMax <= 0) return;
    setSliderValue((prev) => Math.min(prev, sliderMax));
  }, [sliderMax]);

  const handleChipClick = (value) => {
    if (!sliderEnabled) return;
    setChipSelection((prev) => {
      const currentTotal = prev.reduce((sum, chip) => sum + chip, 0);
      const nextTotal = currentTotal + value;
      if (nextTotal > sliderMax) return prev;
      setSliderValue(nextTotal);
      return [...prev, value];
    });
  };

  const handleUndoChip = () => {
    setChipSelection((prev) => {
      if (!prev.length) return prev;
      const updated = prev.slice(0, -1);
      const nextTotal = updated.reduce((sum, chip) => sum + chip, 0);
      setSliderValue(nextTotal > 0 ? nextTotal : defaultRaise);
      return updated;
    });
  };

  const handleSliderChange = (event) => {
    const value = Number(event.target.value);
    setSliderValue(value);
  };

  const handleRaiseConfirm = () => {
    if (!sliderEnabled) return;
    const action = toCall > 0 ? 'raise' : 'bet';
    handleAction(action, finalRaise);
  };

  const handleAllIn = () => {
    if (!sliderEnabled) return;
    const action = toCall > 0 ? 'raise' : 'bet';
    handleAction(action, sliderMax);
  };

  const showRailHud = actor?.isHuman && gameState.stage !== 'showdown';

  useEffect(() => {
    const host = railUiHostRef.current;
    if (!host) return;
    host.style.display = showRailHud ? 'block' : 'none';
    if (showRailHud) {
      threeRef.current?.updateRailHudPose?.();
    }
  }, [showRailHud]);

  const railUiContent =
    showRailHud && railUiHostRef.current
      ? createPortal(
          <div className="rail-ui-surface">
            <div className="rail-ui-summary">
              <span className="rail-ui-label">To call</span>
              <span className="rail-ui-value">
                {Math.round(toCall)} {gameState.token}
              </span>
            </div>
            {sliderEnabled ? (
              <div className="rail-ui-section rail-ui-section--split">
                <div className="rail-ui-chips-panel">
                  <div className="rail-ui-chips-grid">
                    {DEFAULT_CHIP_VALUES.map((value) => {
                      const { base, text } = getChipVisual(value);
                      const disabled = value > sliderMax;
                      return (
                        <button
                          key={value}
                          onClick={() => handleChipClick(value)}
                          className="chip-select"
                          style={{ '--chip-color': base, '--chip-text': text }}
                          disabled={!sliderEnabled || disabled}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleUndoChip}
                    disabled={!chipSelection.length}
                    className="rail-ui-button rail-ui-button--ghost"
                  >
                    Undo
                  </button>
                  <span className="rail-ui-note">
                    Selected raise: {Math.round(raisePreview)} {gameState.token}
                  </span>
                </div>
                <div className="rail-ui-slider-panel">
                  <button
                    onClick={handleAllIn}
                    disabled={!sliderEnabled}
                    className="rail-ui-button rail-ui-button--danger"
                  >
                    All-in
                  </button>
                  <input
                    type="range"
                    orient="vertical"
                    min={0}
                    max={sliderMax}
                    step={1}
                    value={Math.min(sliderMax, sliderValue)}
                    onChange={handleSliderChange}
                    disabled={!sliderEnabled}
                    className="vertical-range accent-sky-400"
                  />
                  <div className="rail-ui-note rail-ui-note--stack">
                    <span>
                      Raise amount: {Math.round(finalRaise)} {gameState.token}
                    </span>
                    <span>
                      Total commitment: {Math.round(totalSpend)} {gameState.token}
                    </span>
                  </div>
                  <button
                    onClick={handleRaiseConfirm}
                    disabled={!sliderEnabled}
                    className="rail-ui-button rail-ui-button--primary"
                  >
                    {sliderLabel} {Math.round(totalSpend)} {gameState.token}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rail-ui-section rail-ui-section--disabled">
                <span className="rail-ui-label">Raise unavailable</span>
                <span className="rail-ui-subtle">
                  {toCall > 0
                    ? `Call ${Math.round(toCall)} ${gameState.token}`
                    : 'You can only check or fold this turn'}
                </span>
              </div>
            )}
            <div className="rail-ui-actions">
              {uiState.availableActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  className="rail-ui-button rail-ui-button--action"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>,
          railUiHostRef.current
        )
      : null;

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center text-white drop-shadow-lg">
        <p className="text-lg font-semibold">Texas Hold'em Royale</p>
        <p className="text-sm opacity-80">
          Pot: {Math.round(gameState.pot)} {gameState.token} · Stage: {gameState.stage.toUpperCase()}
        </p>
        {gameState.stage === 'showdown' && (
          <div className="mt-2 text-sm">
            {gameState.winners.length === 0 ? (
              <span>No contest</span>
            ) : (
              gameState.winners.map((win, idx) => (
                <div key={idx}>
                  Pot {Math.round(win.amount)} →{' '}
                  {win.winners
                    .map((i) => gameState.players[i]?.name || 'Player')
                    .join(', ')}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      {railUiContent}
    </div>
  );
}

export default TexasHoldemArena;
