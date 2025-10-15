import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createArenaCarpetMaterial, createArenaWallMaterial } from '../../utils/arenaDecor.js';
import { applyRendererSRGB, applySRGBColorSpace } from '../../utils/colorSpace.js';
import { ARENA_CAMERA_DEFAULTS, buildArenaCameraConfig } from '../../utils/arenaCameraConfig.js';
import { createMurlanStyleTable } from '../../utils/murlanTable.js';
import { createCardGeometry, createCardMesh, orientCard, setCardFace } from '../../utils/cards3d.js';
import { createChipFactory } from '../../utils/chips3d.js';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import {
  createDeck,
  shuffle,
  dealInitial,
  hitCard,
  handValue,
  isBust,
  aiAction
} from '../../utils/blackjackLogic.js';

const MODEL_SCALE = 0.75;
const TABLE_RADIUS = 3.2 * MODEL_SCALE;
const TABLE_HEIGHT = 1.05 * MODEL_SCALE;
const ARENA_GROWTH = 1.45;
const CARD_W = 0.4 * MODEL_SCALE;
const CARD_H = 0.56 * MODEL_SCALE;
const CARD_D = 0.02 * MODEL_SCALE;
const HOLE_SPACING = CARD_W * 0.65;
const DEALER_INDEX = 4;
const PLAYER_COUNT = 5; // 4 seats + dealer
const CAMERA_SETTINGS = buildArenaCameraConfig(TABLE_RADIUS * ARENA_GROWTH);

const REGION_NAMES = typeof Intl !== 'undefined' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

function flagToName(flag) {
  if (!flag || !REGION_NAMES) return 'Guest';
  const codes = Array.from(flag, (c) => c.codePointAt(0) - 0x1f1e6 + 65);
  if (codes.length !== 2) return 'Guest';
  const code = String.fromCharCode(codes[0], codes[1]);
  return REGION_NAMES.of(code) || 'Guest';
}

function parseSearch(search) {
  const params = new URLSearchParams(search);
  const username = params.get('username') || 'You';
  const amount = Number.parseInt(params.get('amount') || '500', 10);
  const token = params.get('token') || 'TPC';
  const stake = Number.isFinite(amount) && amount > 0 ? amount : 500;
  return { username, stake, token };
}

function buildPlayers(search) {
  const { username, stake } = parseSearch(search);
  const baseChips = Math.max(200, Math.round(stake));
  const flags = [...FLAG_EMOJIS].sort(() => 0.5 - Math.random());
  const players = [];
  for (let i = 0; i < PLAYER_COUNT; i += 1) {
    if (i === DEALER_INDEX) {
      players.push({
        id: 'dealer',
        name: 'Dealer',
        flag: '🎩',
        isDealer: true,
        isHuman: false,
        chips: baseChips * 2,
        avatar: null
      });
    } else if (i === 0) {
      const flag = flags.shift() || '🇦🇱';
      players.push({
        id: 'player',
        name: username,
        flag,
        isDealer: false,
        isHuman: true,
        chips: baseChips,
        avatar: null
      });
    } else {
      const flag = flags[i] || FLAG_EMOJIS[(i * 11) % FLAG_EMOJIS.length];
      players.push({
        id: `ai-${i}`,
        name: flagToName(flag),
        flag,
        isDealer: false,
        isHuman: false,
        chips: baseChips,
        avatar: null
      });
    }
  }
  return players;
}

function createSeatLayout(count) {
  const radius = TABLE_RADIUS * ARENA_GROWTH * 1.02;
  const layout = [];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.PI / 2 + (i / count) * Math.PI * 2;
    const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const right = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle));
    const seatPos = forward.clone().multiplyScalar(radius);
    seatPos.y = TABLE_HEIGHT * 0.3;
    const cardAnchor = forward.clone().multiplyScalar(TABLE_RADIUS * (i === DEALER_INDEX ? 0.45 : 0.68));
    cardAnchor.y = TABLE_HEIGHT + CARD_D * 6;
    const chipAnchor = forward.clone().multiplyScalar(TABLE_RADIUS * 0.55);
    chipAnchor.y = TABLE_HEIGHT + CARD_D * 6;
    const betAnchor = forward.clone().multiplyScalar(TABLE_RADIUS * 0.35);
    betAnchor.y = TABLE_HEIGHT + CARD_D * 6;
    const labelAnchor = forward.clone().multiplyScalar(radius + 0.28 * MODEL_SCALE);
    labelAnchor.y = TABLE_HEIGHT + 0.6 * MODEL_SCALE;
    layout.push({ angle, forward, right, seatPos, cardAnchor, chipAnchor, betAnchor, labelAnchor });
  }
  return layout;
}

function makeNameplate(name, chips, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 220;
  const ctx = canvas.getContext('2d');
  const draw = (playerName, stack, highlight, status) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = highlight ? 'rgba(34,197,94,0.3)' : 'rgba(15,23,42,0.78)';
    ctx.strokeStyle = highlight ? '#4ade80' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 10;
    roundRect(ctx, 16, 16, canvas.width - 32, canvas.height - 32, 32);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 64px "Inter", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(playerName, 40, 40);
    ctx.font = '600 48px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#cbd5f5';
    ctx.fillText(`${stack} chips`, 40, 130);
    if (status) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#facc15';
      ctx.fillText(status, canvas.width - 40, 130);
      ctx.textAlign = 'left';
    }
  };
  draw(name, chips, false, '');
  const texture = new THREE.CanvasTexture(canvas);
  applySRGBColorSpace(texture);
  texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  const scale = 1.3 * MODEL_SCALE;
  sprite.scale.set(scale, scale * 0.45, 1);
  sprite.userData.update = draw;
  sprite.userData.texture = texture;
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
    players: players.map((p, idx) => ({
      ...p,
      seatIndex: idx,
      hand: [],
      bet: 0,
      result: '',
      revealed: false,
      bust: false
    })),
    deck: [],
    token,
    stake,
    stage: 'betting',
    currentIndex: 0,
    dealerIndex: DEALER_INDEX,
    pot: 0,
    awaitingInput: false,
    winners: [],
    round: 0
  };
}

function resetForNextRound(state) {
  const next = { ...state, round: state.round + 1 };
  next.deck = shuffle(createDeck());
  next.stage = 'betting';
  next.currentIndex = 0;
  next.pot = 0;
  next.winners = [];
  next.players = state.players.map((p) => ({
    ...p,
    hand: [],
    bet: 0,
    result: '',
    revealed: p.isDealer,
    bust: false
  }));
  return next;
}

function placeInitialBets(state) {
  state.players.forEach((player, idx) => {
    if (player.isDealer) return;
    const wager = Math.min(player.chips, Math.max(20, Math.round(state.stake * 0.2)));
    player.chips -= wager;
    player.bet = wager;
    state.pot += wager;
    player.result = `Bet ${wager}`;
    if (player.chips <= 0) player.chips = 0;
  });
}

function dealInitialCards(state) {
  const { hands, deck } = dealInitial(state.deck, state.players.length);
  state.deck = deck;
  state.players.forEach((player, idx) => {
    player.hand = hands[idx];
    player.bust = false;
    player.revealed = player.isDealer ? false : true;
  });
  state.stage = 'player-turns';
  state.currentIndex = getNextPlayerIndex(state.players, -1);
}

function getNextPlayerIndex(players, start) {
  for (let offset = 1; offset <= players.length; offset += 1) {
    const idx = (start + offset) % players.length;
    const player = players[idx];
    if (!player) continue;
    if (!player.isDealer && player.bet > 0 && !player.bust) {
      return idx;
    }
  }
  return DEALER_INDEX;
}

function playDealer(state) {
  const dealer = state.players[state.dealerIndex];
  dealer.revealed = true;
  dealer.result = '';
  while (handValue(dealer.hand) < 17) {
    const { card, deck } = hitCard(state.deck);
    state.deck = deck;
    dealer.hand.push(card);
  }
  if (isBust(dealer.hand)) {
    dealer.bust = true;
    dealer.result = 'Bust';
  } else {
    dealer.result = `Dealer ${handValue(dealer.hand)}`;
  }
}

function resolveRound(state) {
  playDealer(state);
  const dealer = state.players[state.dealerIndex];
  const contenders = state.players.filter((p) => !p.isDealer);
  const winners = [];
  contenders.forEach((player) => {
    if (player.bet <= 0) return;
    const playerValue = handValue(player.hand);
    const dealerValue = handValue(dealer.hand);
    if (player.bust) {
      player.result = 'Lose';
    } else if (dealer.bust || playerValue > dealerValue) {
      const payout = player.bet * 2;
      player.chips += payout;
      player.result = `Win ${payout}`;
      winners.push(player.seatIndex);
    } else if (playerValue === dealerValue) {
      player.chips += player.bet;
      player.result = 'Push';
    } else {
      player.result = 'Lose';
    }
  });
  state.pot = 0;
  state.stage = 'round-end';
  state.winners = winners;
}

function applyPlayerAction(state, action) {
  const player = state.players[state.currentIndex];
  if (!player || player.isDealer) return;
  if (action === 'hit') {
    const { card, deck } = hitCard(state.deck);
    state.deck = deck;
    player.hand.push(card);
    player.revealed = true;
    if (isBust(player.hand)) {
      player.bust = true;
      player.result = 'Bust';
      advancePlayer(state);
    }
  } else if (action === 'stand') {
    player.result = `Stand ${handValue(player.hand)}`;
    advancePlayer(state);
  }
}

function advancePlayer(state) {
  const nextIndex = getNextPlayerIndex(state.players, state.currentIndex);
  if (nextIndex === DEALER_INDEX) {
    state.stage = 'dealer';
    state.currentIndex = DEALER_INDEX;
    resolveRound(state);
  } else {
    state.currentIndex = nextIndex;
  }
}

function cloneState(state) {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, hand: [...p.hand] }))
  };
}

function BlackJackArena({ search }) {
  const mountRef = useRef(null);
  const threeRef = useRef(null);
  const animationRef = useRef(null);
  const [gameState, setGameState] = useState(() => {
    const players = buildPlayers(search);
    const { token, stake } = parseSearch(search);
    const base = buildInitialState(players, token, stake);
    const prepared = resetForNextRound(base);
    placeInitialBets(prepared);
    dealInitialCards(prepared);
    return prepared;
  });
  const [uiState, setUiState] = useState({ actions: [] });
  const timerRef = useRef(null);

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
    scene.background = new THREE.Color('#020617');

    const camera = new THREE.PerspectiveCamera(
      CAMERA_SETTINGS.fov,
      mount.clientWidth / mount.clientHeight,
      CAMERA_SETTINGS.near,
      CAMERA_SETTINGS.far
    );
    camera.position.set(0, TABLE_HEIGHT * 3.4, TABLE_RADIUS * 3.1);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minPolarAngle = ARENA_CAMERA_DEFAULTS.phiMin;
    controls.maxPolarAngle = ARENA_CAMERA_DEFAULTS.phiMax;
    controls.minDistance = CAMERA_SETTINGS.minRadius;
    controls.maxDistance = CAMERA_SETTINGS.maxRadius;
    controls.target.set(0, TABLE_HEIGHT, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const spot = new THREE.SpotLight(0xffffff, 2.4, TABLE_RADIUS * 8, Math.PI / 3, 0.35, 1);
    spot.position.set(4, 7, 4);
    spot.castShadow = true;
    scene.add(spot);
    const rim = new THREE.PointLight(0x60a5fa, 1.1);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    const arena = new THREE.Group();
    scene.add(arena);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(TABLE_RADIUS * ARENA_GROWTH * 3, 64),
      new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.92, metalness: 0.1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    arena.add(floor);

    const carpet = new THREE.Mesh(
      new THREE.CircleGeometry(TABLE_RADIUS * ARENA_GROWTH * 2.1, 64),
      createArenaCarpetMaterial(new THREE.Color('#1e293b'), new THREE.Color('#0f172a'))
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.01;
    carpet.receiveShadow = true;
    arena.add(carpet);

    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(TABLE_RADIUS * ARENA_GROWTH * 2.3, TABLE_RADIUS * ARENA_GROWTH * 2.5, 3.4, 32, 1, true),
      createArenaWallMaterial('#0b1120', '#111827')
    );
    wall.position.y = 1.7;
    arena.add(wall);

    const tableInfo = createMurlanStyleTable({ arena, tableRadius: TABLE_RADIUS, tableHeight: TABLE_HEIGHT });

    const cardGeometry = createCardGeometry(CARD_W, CARD_H, CARD_D);
    const faceCache = new Map();
    const chipFactory = createChipFactory(renderer, { cardWidth: CARD_W });
    const seatLayout = createSeatLayout(PLAYER_COUNT);
    const seatGroups = [];

    seatLayout.forEach((seat, index) => {
      const group = new THREE.Group();
      group.position.copy(seat.seatPos);
      group.lookAt(new THREE.Vector3(0, seat.seatPos.y, 0));
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * MODEL_SCALE, 0.34 * MODEL_SCALE, 0.22 * MODEL_SCALE, 24), new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
      base.castShadow = true;
      base.receiveShadow = true;
      group.add(base);
      const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * MODEL_SCALE, 0.4 * MODEL_SCALE, 0.08 * MODEL_SCALE, 24), new THREE.MeshPhysicalMaterial({ color: index === 0 ? 0x2563eb : index === DEALER_INDEX ? 0xf97316 : 0x334155, roughness: 0.4, metalness: 0.28, clearcoat: 1 }));
      cushion.position.y = 0.14 * MODEL_SCALE;
      cushion.castShadow = true;
      group.add(cushion);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.45 * MODEL_SCALE, 0.4 * MODEL_SCALE, 0.08 * MODEL_SCALE), new THREE.MeshStandardMaterial({ color: 0x1f2937 }));
      back.position.set(0, 0.36 * MODEL_SCALE, -0.16 * MODEL_SCALE);
      back.castShadow = true;
      group.add(back);
      arena.add(group);

      const cardMeshes = Array.from({ length: 6 }, () => {
        const mesh = createCardMesh({ rank: 'A', suit: 'S' }, cardGeometry, faceCache);
        mesh.position.set(0, TABLE_HEIGHT + CARD_D * 6, 0);
        mesh.castShadow = true;
        arena.add(mesh);
        return mesh;
      });

      const chipStack = chipFactory.createStack(0);
      chipStack.position.copy(seat.chipAnchor);
      arena.add(chipStack);

      const betStack = chipFactory.createStack(0);
      betStack.position.copy(seat.betAnchor);
      arena.add(betStack);

      const nameplate = makeNameplate('Player', 0, renderer);
      nameplate.position.copy(seat.labelAnchor);
      arena.add(nameplate);

      seatGroups.push({
        group,
        cardMeshes,
        chipStack,
        betStack,
        nameplate,
        forward: seat.forward.clone(),
        right: seat.right.clone(),
        cardAnchor: seat.cardAnchor.clone(),
        chipAnchor: seat.chipAnchor.clone(),
        betAnchor: seat.betAnchor.clone(),
        labelAnchor: seat.labelAnchor.clone()
      });
    });

    const potStack = chipFactory.createStack(0);
    potStack.position.set(0, TABLE_HEIGHT + CARD_D * 6, 0);
    arena.add(potStack);

    threeRef.current = {
      renderer,
      scene,
      camera,
      controls,
      arena,
      tableInfo,
      cardGeometry,
      faceCache,
      chipFactory,
      seatGroups,
      potStack
    };

    const onResize = () => {
      if (!threeRef.current) return;
      const { renderer: r, camera: cam } = threeRef.current;
      const { clientWidth, clientHeight } = mount;
      r.setSize(clientWidth, clientHeight);
      cam.aspect = clientWidth / clientHeight;
      cam.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    const animate = () => {
      const three = threeRef.current;
      if (!three) return;
      three.controls.update();
      three.renderer.render(three.scene, three.camera);
      animationRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animationRef.current);
      if (threeRef.current) {
        const { renderer: r, scene: s, chipFactory: factory, seatGroups: seats, potStack: pot, tableInfo: info } = threeRef.current;
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
          factory.disposeStack(seat.betStack);
          if (seat.nameplate) {
            seat.nameplate.material?.map?.dispose?.();
            seat.nameplate.material?.dispose?.();
            s.remove(seat.nameplate);
          }
        });
        factory.disposeStack(pot);
        factory.dispose();
        info?.dispose?.();
        r.dispose();
      }
      mount.removeChild(renderer.domElement);
      threeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;
    const { seatGroups, chipFactory, potStack, cardGeometry, faceCache } = three;
    const state = gameState;
    if (!state) return;

    seatGroups.forEach((seat, idx) => {
      const player = state.players[idx];
      if (!player) return;
      const base = seat.cardAnchor.clone();
      const right = seat.right.clone();
      const forward = seat.forward.clone();
      seat.cardMeshes.forEach((mesh, cardIdx) => {
        const card = player.hand[cardIdx];
        if (!card) {
          mesh.visible = false;
          return;
        }
        mesh.visible = true;
        applyCardToMesh(mesh, card, cardGeometry, faceCache);
        const target = base
          .clone()
          .add(right.clone().multiplyScalar((cardIdx - (player.hand.length - 1) / 2) * HOLE_SPACING));
        mesh.position.copy(target);
        const look = target.clone().add(forward.clone().multiplyScalar(player.isDealer ? -1 : 1));
        const face = player.isDealer && cardIdx === 1 && !player.revealed ? 'back' : 'front';
        orientCard(mesh, look, { face, flat: true });
        setCardFace(mesh, face);
      });
      chipFactory.setAmount(seat.chipStack, player.chips);
      chipFactory.setAmount(seat.betStack, player.bet);
      if (seat.nameplate?.userData?.update) {
        const active = state.currentIndex === idx && state.stage === 'player-turns';
        seat.nameplate.userData.update(player.name, Math.round(player.chips), active, player.result || '');
        seat.nameplate.userData.texture.needsUpdate = true;
      }
    });
    chipFactory.setAmount(potStack, state.pot);
  }, [gameState]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!gameState) return;
    if (gameState.stage === 'round-end') {
      timerRef.current = setTimeout(() => {
        setGameState((prev) => {
          const next = resetForNextRound(cloneState(prev));
          placeInitialBets(next);
          dealInitialCards(next);
          return next;
        });
      }, 3000);
      setUiState({ actions: [] });
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
    if (gameState.stage === 'player-turns') {
      const actor = gameState.players[gameState.currentIndex];
      if (!actor) return;
      if (actor.isHuman) {
        setUiState({
          actions: [
            { id: 'hit', label: 'Hit' },
            { id: 'stand', label: 'Stand' }
          ]
        });
      } else {
        setUiState({ actions: [] });
        timerRef.current = setTimeout(() => {
          setGameState((prev) => {
            const next = cloneState(prev);
            const player = next.players[next.currentIndex];
            const decision = aiAction(player.hand);
            applyPlayerAction(next, decision);
            return next;
          });
        }, 900);
      }
    } else if (gameState.stage === 'dealer') {
      setUiState({ actions: [] });
      timerRef.current = setTimeout(() => {
        setGameState((prev) => {
          const next = cloneState(prev);
          resolveRound(next);
          return next;
        });
      }, 600);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState]);

  const handleAction = (id) => {
    setGameState((prev) => {
      const next = cloneState(prev);
      if (next.stage !== 'player-turns') return next;
      applyPlayerAction(next, id);
      return next;
    });
  };

  const dealer = gameState.players[DEALER_INDEX];

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="absolute inset-0" />
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-center text-white drop-shadow-lg">
        <p className="text-lg font-semibold">Black Jack Multiplayer</p>
        <p className="text-sm opacity-80">
          Pot: {Math.round(gameState.pot)} {gameState.token} · Dealer:{' '}
          {dealer.revealed ? handValue(dealer.hand) : '??'}
        </p>
      </div>
      {gameState.stage === 'round-end' && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-lg text-sm">
          Round complete
        </div>
      )}
      {gameState.stage === 'player-turns' && gameState.players[gameState.currentIndex]?.isHuman && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
          {uiState.actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="px-5 py-2 rounded-lg bg-green-600/90 text-white font-semibold shadow-lg"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default BlackJackArena;
