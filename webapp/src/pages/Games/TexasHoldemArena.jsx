import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { createArenaCarpetMaterial, createArenaWallMaterial } from '../../utils/arenaDecor.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';
import { ARENA_CAMERA_DEFAULTS, buildArenaCameraConfig } from '../../utils/arenaCameraConfig.js';
import { createMurlanStyleTable, applyTableMaterials } from '../../utils/murlanTable.js';
import {
  createCardGeometry,
  createCardMesh,
  orientCard,
  setCardFace,
  CARD_THEMES
} from '../../utils/cards3d.js';
import { createChipFactory } from '../../utils/chips3d.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import {
  TABLE_WOOD_OPTIONS,
  TABLE_CLOTH_OPTIONS,
  TABLE_BASE_OPTIONS,
  DEFAULT_TABLE_CUSTOMIZATION,
  WOOD_PRESETS_BY_ID,
  WOOD_GRAIN_OPTIONS,
  WOOD_GRAIN_OPTIONS_BY_ID
} from '../../utils/tableCustomizationOptions.js';
import { hslToHexNumber, WOOD_FINISH_PRESETS } from '../../utils/woodMaterials.js';

import {
  createDeck,
  shuffle,
  dealHoleCards,
  compareHands,
  estimateWinProbability
} from '../../../../lib/texasHoldem.js';

const MODEL_SCALE = 0.75;
const ARENA_GROWTH = 1.45;
const TABLE_RADIUS = 3.4 * MODEL_SCALE;
const TABLE_HEIGHT = 1.24 * MODEL_SCALE;
const ARENA_SCALE = 1.3 * ARENA_GROWTH;
const BOARD_SIZE = (TABLE_RADIUS * 2 + 1.2 * MODEL_SCALE) * ARENA_SCALE;
const STOOL_SCALE = 1.5 * 1.3;
const CARD_SCALE = 0.95;
const CARD_W = 0.4 * MODEL_SCALE * CARD_SCALE;
const CARD_H = 0.56 * MODEL_SCALE * CARD_SCALE;
const CARD_D = 0.02 * MODEL_SCALE * CARD_SCALE;
const CARD_SURFACE_OFFSET = CARD_D * 4;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.05 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE;
const CHAIR_RADIUS = TABLE_RADIUS + SEAT_DEPTH * 0.55;
const CHAIR_BASE_HEIGHT = TABLE_HEIGHT - SEAT_THICKNESS / 2;
const STOOL_HEIGHT = CHAIR_BASE_HEIGHT + SEAT_THICKNESS;
const PLAYER_COUNT = 6;
const SMALL_BLIND = 10;
const BIG_BLIND = 20;
const COMMUNITY_SPACING = CARD_W * 0.85;
const HOLE_SPACING = CARD_W * 0.7;
const HUMAN_CARD_SPREAD = HOLE_SPACING * 1.15;
const HUMAN_CARD_FORWARD_OFFSET = CARD_W * 0.18;
const HUMAN_CARD_VERTICAL_OFFSET = CARD_H * 0.52;
const HUMAN_CARD_LOOK_LIFT = CARD_H * 0.24;
const HUMAN_CARD_LOOK_SPLAY = HOLE_SPACING * 0.35;
const POT_OFFSET = new THREE.Vector3(0, TABLE_HEIGHT + CARD_SURFACE_OFFSET, 0);
const DECK_POSITION = new THREE.Vector3(-TABLE_RADIUS * 0.55, TABLE_HEIGHT + CARD_SURFACE_OFFSET, TABLE_RADIUS * 0.55);
const CAMERA_SETTINGS = buildArenaCameraConfig(BOARD_SIZE);
const CAMERA_TARGET_LIFT = 0.2 * MODEL_SCALE;
const CAMERA_HEAD_TURN_LIMIT = THREE.MathUtils.degToRad(38);
const CAMERA_HEAD_PITCH_UP = THREE.MathUtils.degToRad(5);
const CAMERA_HEAD_PITCH_DOWN = THREE.MathUtils.degToRad(28);
const HEAD_YAW_SENSITIVITY = 0.0042;
const HEAD_PITCH_SENSITIVITY = 0.0035;
const CAMERA_LATERAL_OFFSETS = Object.freeze({ portrait: 0.55, landscape: 0.42 });
const CAMERA_RETREAT_OFFSETS = Object.freeze({ portrait: 2.25, landscape: 1.7 });
const CAMERA_ELEVATION_OFFSETS = Object.freeze({ portrait: 1.34, landscape: 1.08 });

const CHIP_VALUES = [1000, 500, 200, 50, 20, 10, 5, 2, 1];
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const DEFAULT_STOOL_THEME = Object.freeze({ seatColor: '#8b0000', legColor: '#1f1f1f' });
const DEFAULT_OUTFIT_THEME = Object.freeze({ baseColor: '#1f3c88', accentColor: '#f5d547', glow: '#0f172a' });
const DEFAULT_HEAD_COLOR = '#f9e0d0';
const LABEL_SIZE = Object.freeze({ width: 1.7 * MODEL_SCALE, height: 0.82 * MODEL_SCALE });
const LABEL_BASE_HEIGHT = 0.62 * MODEL_SCALE;
const HUMAN_LABEL_FORWARD = 0.88 * MODEL_SCALE;
const AI_LABEL_FORWARD = 0.98 * MODEL_SCALE;

const RAIL_CHIP_SCALE = 1.08;
const RAIL_CHIP_SPACING = CARD_W * 0.42;
const RAIL_CHIP_CURVE = CARD_W * 0.38;
const RAIL_HEIGHT_OFFSET = CARD_D * 6.2;
const RAIL_BASE_FORWARD_OFFSET = CARD_W * 0.34;
const RAIL_CHIP_INSET = CARD_W * 0.035;
const RAIL_ANCHOR_RATIO = 0.98;

const STAGE_SEQUENCE = ['preflop', 'flop', 'turn', 'river'];

const APPEARANCE_STORAGE_KEY = 'texasHoldemArenaAppearance';
const DEFAULT_APPEARANCE = {
  ...DEFAULT_TABLE_CUSTOMIZATION
};

const CUSTOMIZATION_SECTIONS = [
  { key: 'tableWood', label: 'Dru i Tavolinës', options: TABLE_WOOD_OPTIONS },
  { key: 'tableCloth', label: 'Rroba e Tavolinës', options: TABLE_CLOTH_OPTIONS },
  { key: 'tableBase', label: 'Baza e Tavolinës', options: TABLE_BASE_OPTIONS },
  { key: 'cards', label: 'Letrat', options: CARD_THEMES }
];

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

function normalizeAppearance(value = {}) {
  const normalized = { ...DEFAULT_APPEARANCE };
  const entries = [
    ['tableWood', TABLE_WOOD_OPTIONS.length],
    ['tableCloth', TABLE_CLOTH_OPTIONS.length],
    ['tableBase', TABLE_BASE_OPTIONS.length],
    ['cards', CARD_THEMES.length]
  ];
  entries.forEach(([key, max]) => {
    const raw = Number(value?.[key]);
    if (Number.isFinite(raw)) {
      const clamped = Math.min(Math.max(0, Math.round(raw)), max - 1);
      normalized[key] = clamped;
    }
  });
  return normalized;
}

function createSeatLayout(count) {
  const radius = CHAIR_RADIUS;
  const layout = [];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.PI / 2 - (i / count) * Math.PI * 2;
    const isHuman = i === 0;
    const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const right = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const seatPos = forward.clone().multiplyScalar(radius);
    seatPos.y = CHAIR_BASE_HEIGHT;
    const cardAnchor = forward.clone().multiplyScalar(TABLE_RADIUS * 0.64);
    cardAnchor.y = TABLE_HEIGHT + CARD_SURFACE_OFFSET;
    const chipAnchor = forward.clone().multiplyScalar(TABLE_RADIUS * 0.6);
    chipAnchor.y = TABLE_HEIGHT + CARD_SURFACE_OFFSET;
    const previewAnchor = forward.clone().multiplyScalar(TABLE_RADIUS * 0.58);
    previewAnchor.y = TABLE_HEIGHT + CARD_SURFACE_OFFSET;
    const stoolAnchor = forward.clone().multiplyScalar(radius);
    stoolAnchor.y = CHAIR_BASE_HEIGHT + SEAT_THICKNESS / 2;
    layout.push({
      angle,
      forward,
      right,
      seatPos,
      cardAnchor,
      chipAnchor,
      previewAnchor,
      labelOffset: {
        height: LABEL_BASE_HEIGHT,
        forward: isHuman ? HUMAN_LABEL_FORWARD : AI_LABEL_FORWARD
      },
      stoolAnchor,
      stoolHeight: STOOL_HEIGHT,
      isHuman
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
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: false
  });
  const geometry = new THREE.PlaneGeometry(LABEL_SIZE.width, LABEL_SIZE.height);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.update = draw;
  mesh.userData.texture = texture;
  mesh.userData.canvas = canvas;
  mesh.userData.dispose = () => {
    texture.dispose();
    material.dispose();
    geometry.dispose();
  };
  return mesh;
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

function createRailTextSprite(initialLines = [], options = {}) {
  const { width = 1.9 * MODEL_SCALE, height = 0.68 * MODEL_SCALE } = options;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const draw = (lines) => {
    const content = Array.isArray(lines) ? lines : [String(lines ?? '')];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(15,23,42,0.82)';
    ctx.strokeStyle = 'rgba(148,163,184,0.4)';
    ctx.lineWidth = 14;
    roundRect(ctx, 32, 32, canvas.width - 64, canvas.height - 64, 56);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const baseY = canvas.height / 2;
    const lineHeight = 96;
    const startY = baseY - ((content.length - 1) * lineHeight) / 2;
    content.forEach((line, idx) => {
      ctx.font = idx === 0 ? '700 92px "Inter", system-ui, sans-serif' : '600 76px "Inter", system-ui, sans-serif';
      ctx.fillText(line, canvas.width / 2, startY + idx * lineHeight);
    });
  };
  draw(initialLines);
  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  sprite.center.set(0.5, 0);
  sprite.userData.update = (lines) => {
    draw(lines);
    texture.needsUpdate = true;
  };
  sprite.userData.dispose = () => {
    texture.dispose();
  };
  sprite.userData.canvas = canvas;
  sprite.userData.texture = texture;
  return sprite;
}

function createRaiseControls({ arena, seat, chipFactory, tableInfo }) {
  if (!arena || !seat || !chipFactory || !tableInfo) return null;
  const group = new THREE.Group();
  group.visible = false;
  arena.add(group);
  const forward = seat.forward.clone().normalize();
  const axis = seat.right.clone().normalize();
  const anchor = forward.clone().multiplyScalar(tableInfo.radius * RAIL_ANCHOR_RATIO);
  anchor.y = tableInfo.surfaceY + RAIL_HEIGHT_OFFSET;
  const baseCenter = anchor.clone().addScaledVector(forward, -RAIL_BASE_FORWARD_OFFSET);

  const chipOrigin = baseCenter
    .clone()
    .addScaledVector(axis, -((CHIP_VALUES.length - 1) / 2) * RAIL_CHIP_SPACING)
    .addScaledVector(forward, -RAIL_CHIP_INSET);
  chipOrigin.y = anchor.y + CARD_D * 2.2;
  const chipButtons = CHIP_VALUES.map((value, index) => {
    const chip = chipFactory.createStack(value);
    chip.scale.setScalar(RAIL_CHIP_SCALE);
    chip.position.copy(chipOrigin).addScaledVector(axis, index * RAIL_CHIP_SPACING);
    const normalized = CHIP_VALUES.length > 1 ? (index / (CHIP_VALUES.length - 1)) * 2 - 1 : 0;
    const curveStrength = Math.max(0, 1 - Math.abs(normalized));
    const curveOffset = Math.pow(curveStrength, 0.8) * RAIL_CHIP_CURVE;
    chip.position.addScaledVector(forward, curveOffset);
    chip.userData = { type: 'chip-button', value, baseScale: RAIL_CHIP_SCALE };
    group.add(chip);
    return chip;
  });

  const interactables = [...chipButtons];

  const dispose = () => {
    chipButtons.forEach((chip) => {
      chipFactory.disposeStack(chip);
      if (chip.parent) {
        chip.parent.remove(chip);
      }
    });
    if (group.parent) {
      group.parent.remove(group);
    }
  };

  return {
    group,
    chipButtons,
    interactables,
    dispose
  };
}

function applyCardToMesh(mesh, card, geometry, cache, theme) {
  if (!mesh) return;
  const target = card || mesh.userData?.card;
  if (!target) return;
  const previousCard = mesh.userData?.card;
  const previousTheme = mesh.userData?.cardThemeId;
  const nextTheme = theme || CARD_THEMES[0];
  const sameCard =
    previousCard && previousCard.rank === target.rank && previousCard.suit === target.suit && previousTheme === nextTheme.id;
  if (sameCard) {
    mesh.userData.card = target;
    mesh.userData.cardThemeId = nextTheme.id;
    return;
  }
  const fresh = createCardMesh(target, geometry, cache, nextTheme);
  const existing = mesh.material;
  if (Array.isArray(existing)) {
    existing.forEach((mat) => mat?.dispose?.());
  } else {
    existing?.dispose?.();
  }
  mesh.material = fresh.material;
  const currentFace = mesh.userData?.cardFace || 'front';
  mesh.userData = { ...mesh.userData, ...fresh.userData, card: target, cardThemeId: nextTheme.id, cardFace: currentFace };
  setCardFace(mesh, currentFace);
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
    mode: null,
    startX: 0,
    startY: 0,
    startYaw: 0,
    startPitch: 0,
    buttonAction: null,
    dragged: false
  });
  const pointerVectorRef = useRef(new THREE.Vector2());
  const interactionsRef = useRef({
    onChip: () => {},
    onSliderChange: () => {},
    onAllIn: () => {},
    onConfirm: () => {},
    onUndo: () => {}
  });
  const hoverTargetRef = useRef(null);
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
  const [appearance, setAppearance] = useState(() => {
    if (typeof window === 'undefined') return { ...DEFAULT_APPEARANCE };
    try {
      const stored = window.localStorage?.getItem(APPEARANCE_STORAGE_KEY);
      if (!stored) return { ...DEFAULT_APPEARANCE };
      const parsed = JSON.parse(stored);
      return normalizeAppearance(parsed);
    } catch (error) {
      console.warn('Failed to load Texas Hold\'em appearance', error);
      return { ...DEFAULT_APPEARANCE };
    }
  });
  const appearanceRef = useRef(appearance);
  const [configOpen, setConfigOpen] = useState(false);
  const timerRef = useRef(null);

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
    three.orientHumanCards?.();
  }, []);

  useEffect(() => {
    appearanceRef.current = appearance;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
      } catch (error) {
        console.warn('Failed to persist Texas Hold\'em appearance', error);
      }
    }
    const three = threeRef.current;
    if (!three) return;
    const safe = normalizeAppearance(appearance);
    const woodOption = TABLE_WOOD_OPTIONS[safe.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const clothOption = TABLE_CLOTH_OPTIONS[safe.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const baseOption = TABLE_BASE_OPTIONS[safe.tableBase] ?? TABLE_BASE_OPTIONS[0];
    const cardTheme = CARD_THEMES[safe.cards] ?? CARD_THEMES[0];
    if (three.tableInfo?.materials) {
      applyTableMaterials(three.tableInfo.materials, { woodOption, clothOption, baseOption }, three.renderer);
    }
    three.cardThemeId = cardTheme.id;
    const applyThemeToMesh = (mesh, cardData) => {
      if (!mesh) return;
      const priorFace = mesh.userData?.cardFace || 'front';
      applyCardToMesh(mesh, cardData, three.cardGeometry, three.faceCache, cardTheme);
      setCardFace(mesh, priorFace);
    };
    three.seatGroups?.forEach((seat) => {
      seat.cardMeshes.forEach((mesh) => {
        const data = mesh.userData?.card;
        if (data) {
          applyThemeToMesh(mesh, data);
        } else {
          applyThemeToMesh(mesh, { rank: 'A', suit: 'S' });
        }
      });
    });
    three.communityMeshes?.forEach((mesh) => {
      const data = mesh.userData?.card;
      if (data) {
        applyThemeToMesh(mesh, data);
      } else {
        applyThemeToMesh(mesh, { rank: 'A', suit: 'S' });
      }
    });
  }, [appearance]);

  const renderPreview = useCallback((type, option) => {
    switch (type) {
      case 'tableWood': {
        const preset = option?.presetId ? WOOD_PRESETS_BY_ID[option.presetId] : undefined;
        const grain = option?.grainId ? WOOD_GRAIN_OPTIONS_BY_ID[option.grainId] : undefined;
        const presetRef = preset || WOOD_FINISH_PRESETS?.[0];
        const baseHex = presetRef ? `#${hslToHexNumber(presetRef.hue, presetRef.sat, presetRef.light).toString(16).padStart(6, '0')}` : '#8b5a2b';
        const accentHex = presetRef
          ? `#${hslToHexNumber(
              presetRef.hue,
              Math.min(1, presetRef.sat + 0.12),
              Math.max(0, presetRef.light - 0.18)
            )
              .toString(16)
              .padStart(6, '0')}`
          : '#5a3820';
        const grainLabel = grain?.label ?? WOOD_GRAIN_OPTIONS?.[0]?.label ?? '';
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(135deg, ${baseHex}, ${baseHex} 12%, ${accentHex} 12%, ${accentHex} 20%)`
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40" />
            <div className="absolute bottom-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-emerald-100/80">
              {grainLabel.slice(0, 12)}
            </div>
          </div>
        );
      }
      case 'tableCloth':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-12 w-20 rounded-[999px] border border-white/10"
                style={{ background: `radial-gradient(circle at 35% 30%, ${option.feltTop}, ${option.feltBottom})` }}
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/50 to-transparent" />
          </div>
        );
      case 'tableBase':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${option.baseColor}, ${option.trimColor})` }} />
            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-black/40" />
          </div>
        );
      case 'cards':
        return (
          <div className="relative h-14 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
            <div className="absolute inset-0" style={{
              background: `linear-gradient(135deg, ${option.backGradient?.[0] ?? option.backColor}, ${option.backGradient?.[1] ?? option.backColor})`
            }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/50 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-white/80">
                {option.label}
              </span>
            </div>
          </div>
        );
      default:
        return null;
    }
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    applyRendererSRGB(renderer);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');

    const camera = new THREE.PerspectiveCamera(
      CAMERA_SETTINGS.fov,
      mount.clientWidth / mount.clientHeight,
      CAMERA_SETTINGS.near,
      CAMERA_SETTINGS.far
    );
    camera.position.set(0, TABLE_HEIGHT * 2.7, TABLE_RADIUS * 4.2);
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';

    const ambient = new THREE.AmbientLight(0xffffff, 1.08);
    scene.add(ambient);
    const spot = new THREE.SpotLight(0xffffff, 4.8384, TABLE_RADIUS * 10, Math.PI / 3, 0.35, 1);
    spot.position.set(3, 7, 3);
    spot.castShadow = true;
    scene.add(spot);
    const rim = new THREE.PointLight(0x33ccff, 1.728);
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
    const initialAppearance = normalizeAppearance(appearanceRef.current);
    const initialWood = TABLE_WOOD_OPTIONS[initialAppearance.tableWood] ?? TABLE_WOOD_OPTIONS[0];
    const initialCloth = TABLE_CLOTH_OPTIONS[initialAppearance.tableCloth] ?? TABLE_CLOTH_OPTIONS[0];
    const initialBase = TABLE_BASE_OPTIONS[initialAppearance.tableBase] ?? TABLE_BASE_OPTIONS[0];
    applyTableMaterials(tableInfo.materials, { woodOption: initialWood, clothOption: initialCloth, baseOption: initialBase }, renderer);

    const cardGeometry = createCardGeometry(CARD_W, CARD_H, CARD_D);
    const faceCache = new Map();
    const cardTheme = CARD_THEMES[initialAppearance.cards] ?? CARD_THEMES[0];

    const chipFactory = createChipFactory(renderer, { cardWidth: CARD_W });
    const seatLayout = createSeatLayout(PLAYER_COUNT);
    const seatGroups = [];
    const deckAnchor = DECK_POSITION.clone();

    const humanSeat = seatLayout.find((seat) => seat.isHuman) ?? seatLayout[0];
    const raiseControls = createRaiseControls({ arena: arenaGroup, seat: humanSeat, chipFactory, tableInfo });
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

    const stoolTheme = DEFAULT_STOOL_THEME;
    const outfitTheme = DEFAULT_OUTFIT_THEME;
    const chairMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(stoolTheme.seatColor),
      roughness: 0.35,
      metalness: 0.5,
      clearcoat: 1
    });
    const legMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(stoolTheme.legColor) });
    const outfitBodyMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(outfitTheme.baseColor),
      roughness: 0.55,
      metalness: 0.35,
      emissive: new THREE.Color(outfitTheme.glow),
      emissiveIntensity: 0.25
    });
    const outfitAccentMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(outfitTheme.accentColor),
      roughness: 0.4,
      metalness: 0.55
    });
    const headMaterial = new THREE.MeshStandardMaterial({ color: DEFAULT_HEAD_COLOR, roughness: 0.75, metalness: 0.1 });

    const torsoGeometry = new THREE.CylinderGeometry(0.22 * MODEL_SCALE, 0.22 * MODEL_SCALE, 0.52 * MODEL_SCALE, 20);
    const headGeometry = new THREE.SphereGeometry(0.16 * MODEL_SCALE, 20, 16);
    const collarGeometry = new THREE.TorusGeometry(0.23 * MODEL_SCALE, 0.035 * MODEL_SCALE, 16, 32);

    const initialPlayers = gameState?.players ?? [];

    seatLayout.forEach((seat, seatIndex) => {
      const group = new THREE.Group();
      group.position.copy(seat.seatPos);
      group.lookAt(new THREE.Vector3(0, seat.seatPos.y, 0));

      const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS, SEAT_DEPTH), chairMaterial);
      seatMesh.position.y = SEAT_THICKNESS / 2;
      seatMesh.castShadow = true;
      seatMesh.receiveShadow = true;
      group.add(seatMesh);

      const backMesh = new THREE.Mesh(new THREE.BoxGeometry(SEAT_WIDTH, BACK_HEIGHT, BACK_THICKNESS), chairMaterial);
      backMesh.position.set(0, SEAT_THICKNESS / 2 + BACK_HEIGHT / 2, -SEAT_DEPTH / 2 + BACK_THICKNESS / 2);
      backMesh.castShadow = true;
      backMesh.receiveShadow = true;
      group.add(backMesh);

      const armLeft = new THREE.Mesh(new THREE.BoxGeometry(ARM_THICKNESS, ARM_HEIGHT, ARM_DEPTH), chairMaterial);
      armLeft.position.set(-(SEAT_WIDTH / 2 + ARM_THICKNESS / 2), SEAT_THICKNESS / 2 + ARM_HEIGHT / 2, -SEAT_DEPTH * 0.05);
      armLeft.castShadow = true;
      armLeft.receiveShadow = true;
      group.add(armLeft);
      const armRight = new THREE.Mesh(new THREE.BoxGeometry(ARM_THICKNESS, ARM_HEIGHT, ARM_DEPTH), chairMaterial);
      armRight.position.set(SEAT_WIDTH / 2 + ARM_THICKNESS / 2, SEAT_THICKNESS / 2 + ARM_HEIGHT / 2, -SEAT_DEPTH * 0.05);
      armRight.castShadow = true;
      armRight.receiveShadow = true;
      group.add(armRight);

      const legBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16 * MODEL_SCALE * STOOL_SCALE, 0.2 * MODEL_SCALE * STOOL_SCALE, BASE_COLUMN_HEIGHT, 16),
        legMaterial
      );
      legBase.position.y = -SEAT_THICKNESS / 2 - BASE_COLUMN_HEIGHT / 2;
      legBase.castShadow = true;
      legBase.receiveShadow = true;
      group.add(legBase);

      const occupant = new THREE.Group();
      occupant.position.z = -SEAT_DEPTH * 0.12;
      const torso = new THREE.Mesh(torsoGeometry, outfitBodyMaterial);
      torso.position.y = SEAT_THICKNESS / 2 + 0.38 * MODEL_SCALE;
      occupant.add(torso);
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = torso.position.y + 0.36 * MODEL_SCALE;
      occupant.add(head);
      const collar = new THREE.Mesh(collarGeometry, outfitAccentMaterial);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = torso.position.y + 0.26 * MODEL_SCALE;
      occupant.add(collar);
      group.add(occupant);

      arenaGroup.add(group);

      const cardMeshes = [0, 1].map(() => {
        const mesh = createCardMesh({ rank: 'A', suit: 'S' }, cardGeometry, faceCache, cardTheme);
        mesh.position.copy(deckAnchor);
        mesh.castShadow = true;
        arenaGroup.add(mesh);
        return mesh;
      });

      const chipStack = chipFactory.createStack(0);
      chipStack.position.copy(seat.chipAnchor);
      arenaGroup.add(chipStack);

      const previewStack = chipFactory.createStack(0);
      previewStack.position.copy(seat.previewAnchor);
      previewStack.visible = false;
      arenaGroup.add(previewStack);

      const player = initialPlayers[seatIndex] ?? null;
      const nameplate = makeNameplate(player?.name ?? 'Player', Math.round(player?.chips ?? 0), renderer);
      nameplate.position.set(0, seat.labelOffset.height, seat.labelOffset.forward);
      nameplate.rotation.y = Math.PI;
      group.add(nameplate);

      seatGroups.push({
        group,
        chairMeshes: [seatMesh, backMesh, armLeft, armRight, legBase],
        cardMeshes,
        chipStack,
        previewStack,
        nameplate,
        forward: seat.forward.clone(),
        right: seat.right.clone(),
        cardAnchor: seat.cardAnchor.clone(),
        chipAnchor: seat.chipAnchor.clone(),
        previewAnchor: seat.previewAnchor.clone(),
        stoolAnchor: seat.stoolAnchor.clone(),
        stoolHeight: seat.stoolHeight,
        isHuman: seat.isHuman
      });
    });

    const communityMeshes = Array.from({ length: 5 }, () => {
      const mesh = createCardMesh({ rank: 'A', suit: 'S' }, cardGeometry, faceCache, cardTheme);
      mesh.position.copy(deckAnchor);
      mesh.castShadow = true;
      arenaGroup.add(mesh);
      return mesh;
    });

    const potStack = chipFactory.createStack(0);
    potStack.position.copy(POT_OFFSET);
    arenaGroup.add(potStack);

    const raycaster = new THREE.Raycaster();

    const orientHumanCards = () => {
      const three = threeRef.current;
      if (!three) return;
      const seat = seatGroups.find((s) => s.isHuman);
      if (!seat) return;
      const { camera } = three;
      if (!camera) return;
      const baseAnchor = seat.cardAnchor.clone().addScaledVector(seat.forward, HUMAN_CARD_FORWARD_OFFSET);
      seat.cardMeshes.forEach((mesh, idx) => {
        if (!mesh.visible || !mesh.userData?.card) {
          return;
        }
        const position = baseAnchor.clone().add(seat.right.clone().multiplyScalar((idx - 0.5) * HUMAN_CARD_SPREAD));
        position.y = TABLE_HEIGHT + HUMAN_CARD_VERTICAL_OFFSET;
        mesh.position.copy(position);
        const lookTarget = camera.position.clone();
        lookTarget.y = position.y + HUMAN_CARD_LOOK_LIFT;
        lookTarget.add(seat.right.clone().multiplyScalar((idx - 0.5) * HUMAN_CARD_LOOK_SPLAY));
        orientCard(mesh, lookTarget, { face: 'front', flat: false });
      });
    };

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
      raiseControls,
      raycaster,
      orientHumanCards,
      frameId: null,
      sharedMaterials: {
        chair: chairMaterial,
        leg: legMaterial,
        outfitBody: outfitBodyMaterial,
        outfitAccent: outfitAccentMaterial,
        head: headMaterial
      },
      sharedGeometries: {
        torso: torsoGeometry,
        head: headGeometry,
        collar: collarGeometry
      },
      arenaGroup,
      tableInfo,
      cardThemeId: cardTheme.id
    };

    orientHumanCards();

    const element = renderer.domElement;
    const getControls = () => threeRef.current?.raiseControls || null;

    const applyHoverTarget = (target) => {
      const prev = hoverTargetRef.current;
      if (prev && prev !== target) {
        if (prev.userData?.type === 'chip-button') {
          prev.scale.setScalar(prev.userData.baseScale);
        } else if (prev.userData?.type === 'button') {
          const controls = getControls();
          const buttons = controls?.buttons ? Object.values(controls.buttons) : [];
          const button = buttons.find((btn) => btn.group === prev) || null;
          button?.setHover(false);
        }
      }
      hoverTargetRef.current = target || null;
      if (!target) return;
      if (target.userData?.type === 'chip-button') {
        target.scale.setScalar(target.userData.baseScale * 1.12);
      } else if (target.userData?.type === 'button') {
        const controls = getControls();
        const buttons = controls?.buttons ? Object.values(controls.buttons) : [];
        const button = buttons.find((btn) => btn.group === target) || null;
        button?.setHover(true);
      }
    };

    const pickInteractive = (event) => {
      const controls = getControls();
      if (!controls?.group?.visible) return null;
      const rect = element.getBoundingClientRect();
      pointerVectorRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerVectorRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerVectorRef.current, camera);
      const intersects = raycaster.intersectObjects(controls.interactables, true);
      if (!intersects.length) return null;
      let target = intersects[0].object;
      while (target && !target.userData?.type && target.parent) {
        target = target.parent;
      }
      if (!target?.userData?.type) return null;
      return { target, point: intersects[0].point };
    };

    const resetPointerState = () => {
      pointerStateRef.current = {
        active: false,
        pointerId: null,
        mode: null,
        startX: 0,
        startY: 0,
        startYaw: 0,
        startPitch: 0,
        buttonAction: null,
        dragged: false
      };
    };

    const handlePointerDown = (event) => {
      event.preventDefault();
      const interactive = pickInteractive(event);
      if (interactive) {
        const { target } = interactive;
        const type = target.userData?.type;
        if (type === 'button' && target.userData?.enabled === false) {
          applyHoverTarget(null);
          element.style.cursor = 'grab';
          return;
        }
        pointerStateRef.current = {
          active: true,
          pointerId: event.pointerId,
          mode: type,
          startX: event.clientX,
          startY: event.clientY,
          startYaw: headAnglesRef.current.yaw,
          startPitch: headAnglesRef.current.pitch,
          buttonAction: target.userData?.action ?? null,
          dragged: false
        };
        element.setPointerCapture(event.pointerId);
        if (type === 'chip-button') {
          interactionsRef.current.onChip?.(target.userData.value);
        } else if (type === 'button') {
          element.style.cursor = 'pointer';
        }
        return;
      }
      pointerStateRef.current = {
        active: true,
        pointerId: event.pointerId,
        mode: 'camera',
        startX: event.clientX,
        startY: event.clientY,
        startYaw: headAnglesRef.current.yaw,
        startPitch: headAnglesRef.current.pitch,
        buttonAction: null,
        dragged: false
      };
      element.setPointerCapture(event.pointerId);
      element.style.cursor = 'grabbing';
    };

    const handlePointerMove = (event) => {
      const state = pointerStateRef.current;
      if (!state.active || state.pointerId !== event.pointerId) {
        const hit = pickInteractive(event);
        if (hit?.target?.userData?.type === 'button' && hit.target.userData.enabled === false) {
          applyHoverTarget(null);
          element.style.cursor = 'grab';
          return;
        }
        applyHoverTarget(hit?.target ?? null);
        element.style.cursor = hit ? 'pointer' : 'grab';
        return;
      }
      if (state.mode === 'camera') {
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
        return;
      }
      if (state.mode === 'button' || state.mode === 'chip-button') {
        const distance = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
        state.dragged = distance > 10;
      }
    };

    const handlePointerUp = (event) => {
      const state = pointerStateRef.current;
      if (state.pointerId === event.pointerId) {
        element.releasePointerCapture(event.pointerId);
        if (state.mode === 'button' && !state.dragged) {
          if (state.buttonAction === 'undo') {
            interactionsRef.current.onUndo?.();
          }
        }
        resetPointerState();
        element.style.cursor = 'grab';
        applyHoverTarget(null);
      }
    };

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointermove', handlePointerMove);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointercancel', handlePointerUp);
    element.addEventListener('pointerleave', handlePointerUp);

    const handleResize = () => {
      if (!mount || !threeRef.current) return;
      const { renderer: r, camera: cam } = threeRef.current;
      const { clientWidth, clientHeight } = mount;
      r.setSize(clientWidth, clientHeight);
      cam.aspect = clientWidth / clientHeight;
      cam.updateProjectionMatrix();
      applySeatedCamera(clientWidth, clientHeight);
    };

    window.addEventListener('resize', handleResize);

    const animate = () => {
      const three = threeRef.current;
      if (!three) return;
      applyHeadOrientation();
      three.renderer.render(three.scene, three.camera);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationRef.current);
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
          raiseControls: controls,
          sharedMaterials,
          sharedGeometries,
          arenaGroup: arena
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
          factory.disposeStack(seat.previewStack);
          seat.chairMeshes?.forEach((mesh) => {
            mesh.geometry?.dispose?.();
            mesh.parent?.remove(mesh);
          });
          if (seat.nameplate) {
            seat.nameplate.userData?.dispose?.();
            seat.nameplate.parent?.remove(seat.nameplate);
          }
          seat.group?.parent?.remove(seat.group);
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
        arena?.parent?.remove(arena);
        controls?.dispose?.();
        sharedMaterials?.chair?.dispose?.();
        sharedMaterials?.leg?.dispose?.();
        sharedMaterials?.outfitBody?.dispose?.();
        sharedMaterials?.outfitAccent?.dispose?.();
        sharedMaterials?.head?.dispose?.();
        sharedGeometries?.torso?.dispose?.();
        sharedGeometries?.head?.dispose?.();
        sharedGeometries?.collar?.dispose?.();
        tableInfo?.dispose?.();
        r.dispose();
      }
      mount.removeChild(renderer.domElement);
      threeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    const { seatGroups, communityMeshes, chipFactory, potStack } = three;
    const cardTheme = CARD_THEMES.find((theme) => theme.id === three.cardThemeId) ?? CARD_THEMES[0];
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
        applyCardToMesh(mesh, card, three.cardGeometry, three.faceCache, cardTheme);
        if (player.isHuman) {
          if (!mesh.visible) {
            mesh.position.copy(three.deckAnchor);
          }
          setCardFace(mesh, 'front');
          return;
        }
        const target = base
          .clone()
          .add(right.clone().multiplyScalar((cardIdx - 0.5) * HOLE_SPACING));
        mesh.position.copy(target);
        const look = target.clone().add(forward.clone());
        orientCard(mesh, look, { face: state.showdown ? 'front' : 'back', flat: true });
        setCardFace(mesh, state.showdown ? 'front' : 'back');
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

    three.orientHumanCards?.();

    communityMeshes.forEach((mesh, idx) => {
      const card = state.community[idx];
      if (!card) {
        mesh.position.copy(three.deckAnchor);
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      applyCardToMesh(mesh, card, three.cardGeometry, three.faceCache, cardTheme);
      const offset = (idx - 2) * COMMUNITY_SPACING;
      const position = new THREE.Vector3(offset, TABLE_HEIGHT + CARD_SURFACE_OFFSET, 0);
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
  const overlaySelected = Math.round(Math.min(sliderMax, Math.max(0, raisePreview)));
  const overlayTotal = Math.round(totalSpend);
  const overlayConfirmDisabled = !sliderEnabled || overlayTotal <= 0;
  const overlayAllInDisabled = !sliderEnabled || sliderMax <= 0;
  const undoDisabled = !sliderEnabled || chipSelection.length === 0;

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

  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    const seat = three.seatGroups?.find((s) => s.isHuman);
    if (!seat?.previewStack) return;
    const amount = sliderEnabled ? Math.round(raisePreview) : 0;
    three.chipFactory.setAmount(seat.previewStack, amount);
    seat.previewStack.visible = amount > 0;
  }, [raisePreview, sliderEnabled]);


  useEffect(() => {
    const three = threeRef.current;
    const controls = three?.raiseControls;
    if (!controls) return;
    const visible = sliderEnabled && sliderMax > 0;
    controls.group.visible = visible;
    controls.chipButtons.forEach((chip) => {
      chip.visible = visible;
      if (chip.userData?.baseScale) {
        chip.scale.setScalar(chip.userData.baseScale);
      }
    });
    if (!visible && hoverTargetRef.current) {
      if (hoverTargetRef.current.userData?.type === 'chip-button') {
        hoverTargetRef.current.scale.setScalar(hoverTargetRef.current.userData.baseScale);
      }
      hoverTargetRef.current = null;
    }
  }, [sliderEnabled, sliderMax]);

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

  useEffect(() => {
    interactionsRef.current = {
      onChip: (value) => handleChipClick(value),
      onUndo: () => handleUndoChip()
    };
  }, [handleChipClick, handleUndoChip]);

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => setConfigOpen((prev) => !prev)}
          aria-expanded={configOpen}
          className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg backdrop-blur transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
            configOpen ? 'bg-black/60' : 'hover:bg-black/60'
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.4 13.5-.44 1.74a1 1 0 0 1-1.07.75l-1.33-.14a7.03 7.03 0 0 1-1.01.59l-.2 1.32a1 1 0 0 1-.98.84h-1.9a1 1 0 0 1-.98-.84l-.2-1.32a7.03 7.03 0 0 1-1.01-.59l-1.33.14a1 1 0 0 1-1.07-.75L4.6 13.5a1 1 0 0 1 .24-.96l1-.98a6.97 6.97 0 0 1 0-1.12l-1-.98a1 1 0 0 1-.24-.96l.44-1.74a1 1 0 0 1 1.07-.75l1.33.14c.32-.23.66-.43 1.01-.6l.2-1.31a1 1 0 0 1 .98-.84h1.9a1 1 0 0 1 .98.84l.2 1.31c.35.17.69.37 1.01.6l1.33-.14a1 1 0 0 1 1.07.75l.44 1.74a1 1 0 0 1-.24.96l-1 .98c.03.37.03.75 0 1.12l1 .98a1 1 0 0 1 .24.96z"
            />
          </svg>
          <span className="sr-only">Hap personalizimin e tavolinës</span>
        </button>
        {configOpen && (
          <div className="pointer-events-auto mt-2 w-72 max-w-[80vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">Table Setup</span>
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="rounded-full p-1 text-white/70 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                aria-label="Mbyll personalizimin"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
              {CUSTOMIZATION_SECTIONS.map(({ key, label, options }) => (
                <div key={key} className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">{label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {options.map((option, idx) => {
                      const selected = appearance[key] === idx;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setAppearance((prev) => ({ ...prev, [key]: idx }))}
                          aria-pressed={selected}
                          className={`flex flex-col items-center rounded-2xl border p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                            selected ? 'border-sky-400/80 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]' : 'border-white/10 bg-white/5 hover:border-white/20'
                          }`}
                        >
                          {renderPreview(key, option)}
                          <span className="mt-2 text-center text-[0.65rem] font-semibold text-gray-200">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {actor?.isHuman && sliderEnabled && sliderMax > 0 && (
        <div className="pointer-events-auto absolute top-1/2 right-2 z-10 flex -translate-y-1/2 flex-col items-center gap-4 text-white sm:right-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-xs uppercase tracking-[0.5em] text-white/60">{sliderLabel}</span>
            <span className="text-2xl font-semibold drop-shadow-md">
              {overlaySelected} {gameState.token}
            </span>
            {toCall > 0 && (
              <span className="text-[0.7rem] text-white/60">Call {Math.round(toCall)} {gameState.token}</span>
            )}
            <span className="text-[0.7rem] text-white/70">Total {overlayTotal} {gameState.token}</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <input
              type="range"
              min={0}
              max={Math.round(sliderMax)}
              step={1}
              value={Math.round(sliderValue)}
              onChange={(event) => {
                const next = Number(event.target.value);
                setChipSelection([]);
                setSliderValue(next);
              }}
              className="h-64 w-10 cursor-pointer appearance-none bg-transparent"
              style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' }}
            />
            <button
              type="button"
              onClick={handleRaiseConfirm}
              disabled={overlayConfirmDisabled}
              className={`w-full rounded-lg px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                overlayConfirmDisabled
                  ? 'bg-blue-900/50 text-white/40 shadow-none'
                  : 'bg-blue-600/90 hover:bg-blue-500'
              }`}
            >
              {sliderLabel}
            </button>
          </div>
        </div>
      )}
      {actor?.isHuman && gameState.stage !== 'showdown' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleUndoChip}
            disabled={undoDisabled}
            className={`px-5 py-2 rounded-lg font-semibold uppercase tracking-wide text-white shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${
              undoDisabled
                ? 'bg-amber-900/40 text-white/40 shadow-none'
                : 'bg-amber-500/90 hover:bg-amber-400'
            }`}
          >
            Undo
          </button>
          {uiState.availableActions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="px-5 py-2 rounded-lg bg-blue-600/90 text-white font-semibold shadow-lg"
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleAllIn}
            disabled={overlayAllInDisabled}
            className={`px-5 py-2 rounded-lg font-semibold uppercase tracking-wide text-white shadow-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
              overlayAllInDisabled
                ? 'bg-red-900/50 text-white/40 shadow-none'
                : 'bg-red-600/90 hover:bg-red-500'
            }`}
          >
            All-in
          </button>
        </div>
      )}
    </div>
  );
}

export default TexasHoldemArena;
