import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  createArenaCarpetMaterial,
  createArenaWallMaterial
} from '../../utils/arenaDecor.js';
import { ARENA_CAMERA_DEFAULTS, buildArenaCameraConfig } from '../../utils/arenaCameraConfig.js';

const ARENA_COLOR = 0x0c1020;
const TABLE_RADIUS = 3.4;
const TABLE_HEIGHT = 1.15;
const CHAIR_COUNT = 6;
const DEAL_PER_PLAYER = 13;

const FLAG_EMOJIS = ['🇦🇱', '🇺🇸', '🇫🇷', '🇬🇧', '🇮🇹', '🇩🇪', '🇯🇵', '🇨🇦'];

const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_COLORS = { '♠': '#111111', '♣': '#111111', '♥': '#cc2233', '♦': '#cc2233', '🃏': '#111111' };

const CARD_W = 0.4;
const CARD_H = 0.56;
const CARD_D = 0.02;

function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of [3, 4, 5, 6, 7, 8, 9, 10, 'J', 'Q', 'K', 'A', 2]) {
      deck.push({ r: rank, s: suit });
    }
  }
  deck.push({ r: 'BJ', s: '🃏' });
  deck.push({ r: 'RJ', s: '🃏' });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function rankValue(rank) {
  if (rank === 'RJ') return 17;
  if (rank === 'BJ') return 16;
  if (rank === 2) return 15;
  if (rank === 'A') return 14;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  return rank;
}

function makeCardFace(rank, suit, w = 512, h = 720) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#e5e7eb';
  g.lineWidth = 8;
  roundRect(g, 6, 6, w - 12, h - 12, 32);
  g.stroke();
  const color = SUIT_COLORS[suit] || '#111111';
  g.fillStyle = color;
  g.font = 'bold 96px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  const label = rank === 'BJ' ? 'JB' : rank === 'RJ' ? 'JR' : String(rank);
  g.fillText(label, 36, 112);
  g.font = 'bold 78px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI"';
  g.fillText(suit, 36, 188);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
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

function makeLabelTexture(name, avatar) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = 'rgba(12, 16, 32, 0.92)';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  g.lineWidth = 12;
  roundRect(g, 16, 16, canvas.width - 32, canvas.height - 32, 42);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.font = 'bold 140px "Inter", system-ui, sans-serif';
  const display = avatar && avatar.startsWith('http') ? '' : avatar || '🂠';
  g.fillText(display, 48, 172);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (avatar && avatar.startsWith('http')) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      g.save();
      g.beginPath();
      g.arc(128, 128, 96, 0, Math.PI * 2);
      g.closePath();
      g.clip();
      g.drawImage(img, 32, 32, 192, 192);
      g.restore();
      texture.needsUpdate = true;
    };
    img.src = avatar;
  }
  g.font = 'bold 96px "Inter", system-ui, sans-serif';
  g.fillText(name, 220, 172);
  texture.needsUpdate = true;
  return texture;
}

function buildPlayers(search) {
  const params = new URLSearchParams(search);
  const username = params.get('username') || 'You';
  const avatar = params.get('avatar') || '';
  const seedFlags = [...FLAG_EMOJIS].sort(() => 0.5 - Math.random());
  const players = [
    { name: username, avatar, isHuman: true },
    seedFlags[0] ? { name: flagName(seedFlags[0]), avatar: seedFlags[0] } : { name: 'Aria', avatar: '🦊' },
    seedFlags[1] ? { name: flagName(seedFlags[1]), avatar: seedFlags[1] } : { name: 'Milo', avatar: '🐻' },
    seedFlags[2] ? { name: flagName(seedFlags[2]), avatar: seedFlags[2] } : { name: 'Sora', avatar: '🐱' }
  ];
  return players;
}

function flagName(flag) {
  if (!flag) return 'Player';
  const base = 0x1f1e6;
  const codePoints = [...flag].map((c) => c.codePointAt(0) - base + 65);
  try {
    const region = String.fromCharCode(...codePoints);
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(region) || `Player ${flag}`;
  } catch (err) {
    return `Player ${flag}`;
  }
}

export default function MurlanRoyaleArena({ search }) {
  const mountRef = useRef(null);
  const players = useMemo(() => buildPlayers(search), [search]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ARENA_COLOR);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1f2b, 0.95);
    const key = new THREE.DirectionalLight(0xffffff, 1.0);
    key.position.set(1.8, 2.6, 1.6);
    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-1.4, 2.2, -2.0);
    const rim = new THREE.PointLight(0xff7373, 0.4, 12, 2.0);
    rim.position.set(0, 2.1, 0);
    const spot = new THREE.SpotLight(0xffffff, 1.05, 0, Math.PI / 4, 0.35, 1.1);
    spot.position.set(0, 4.2, 4.6);
    scene.add(hemi, key, fill, rim, spot);

    const spotTarget = new THREE.Object3D();
    scene.add(spotTarget);
    spot.target = spotTarget;

    const arena = new THREE.Group();
    scene.add(arena);

    const arenaScale = 1.3;
    const boardSize = (TABLE_RADIUS * 2 + 1.2) * arenaScale;
    const camConfig = buildArenaCameraConfig(boardSize);

    const arenaHalfWidth = boardSize;
    const arenaHalfDepth = boardSize * 1.05;
    const wallInset = 0.5;
    const wallProximity = 0.5;
    const wallHeight = 3 * 2;

    const halfRoomX = (arenaHalfWidth - wallInset) * wallProximity;
    const halfRoomZ = (arenaHalfDepth - wallInset) * wallProximity;
    const roomHalfWidth = halfRoomX + wallInset;
    const roomHalfDepth = halfRoomZ + wallInset;

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(roomHalfWidth * 2, roomHalfDepth * 2),
      new THREE.MeshStandardMaterial({ color: 0x0f1222, roughness: 0.95, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    arena.add(floor);

    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(roomHalfWidth * 1.2, roomHalfDepth * 1.2),
      createArenaCarpetMaterial()
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.y = 0.002;
    arena.add(carpet);

    const wallMat = createArenaWallMaterial();
    const wallT = 0.1;
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(halfRoomX * 2, wallHeight, wallT), wallMat);
    backWall.position.set(0, wallHeight / 2, halfRoomZ);
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(halfRoomX * 2, wallHeight, wallT), wallMat);
    frontWall.position.set(0, wallHeight / 2, -halfRoomZ);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallHeight, halfRoomZ * 2), wallMat);
    leftWall.position.set(-halfRoomX, wallHeight / 2, 0);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallHeight, halfRoomZ * 2), wallMat);
    rightWall.position.set(halfRoomX, wallHeight / 2, 0);
    arena.add(backWall, frontWall, leftWall, rightWall);

    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(halfRoomX * 2, 0.02, halfRoomZ * 2),
      new THREE.MeshStandardMaterial({ color: 0x1a233f, roughness: 0.9, metalness: 0.02, side: THREE.DoubleSide })
    );
    trim.position.set(0, wallHeight - 0.02, 0);
    arena.add(trim);

    const ledMat = new THREE.MeshStandardMaterial({
      color: 0x00f7ff,
      emissive: 0x0099aa,
      emissiveIntensity: 0.4,
      roughness: 0.6,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    const stripBack = new THREE.Mesh(new THREE.BoxGeometry(halfRoomX * 2, 0.02, 0.01), ledMat);
    stripBack.position.set(0, 0.05, halfRoomZ - wallT / 2);
    const stripFront = stripBack.clone();
    stripFront.position.set(0, 0.05, -halfRoomZ + wallT / 2);
    const stripLeft = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.02, halfRoomZ * 2), ledMat);
    stripLeft.position.set(-halfRoomX + wallT / 2, 0.05, 0);
    const stripRight = stripLeft.clone();
    stripRight.position.set(halfRoomX - wallT / 2, 0.05, 0);
    arena.add(stripBack, stripFront, stripLeft, stripRight);

    const baseMat = new THREE.MeshPhysicalMaterial({ color: 0x141414, metalness: 0.85, roughness: 0.2, clearcoat: 0.9 });
    const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.25, 64), baseMat);
    tableBase.position.y = TABLE_HEIGHT - 0.2;
    arena.add(tableBase);

    const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x3a1e0f, roughness: 0.35, metalness: 0.45 });
    const frame = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.15, 32, 64), frameMat);
    frame.rotation.x = Math.PI / 2;
    frame.position.y = TABLE_HEIGHT - 0.1;
    arena.add(frame);

    const velvetTex = makeVelvetTexture(1024, 1024, '#7a001a', '#520014');
    velvetTex.colorSpace = THREE.SRGBColorSpace;
    velvetTex.anisotropy = 8;
    const velvetMat = new THREE.MeshStandardMaterial({ map: velvetTex, roughness: 0.7, metalness: 0.15 });
    const surface = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.25, 0.05, 64), velvetMat);
    surface.position.y = TABLE_HEIGHT;
    arena.add(surface);

    const baseColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.8, 1.2, 32),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    baseColumn.position.y = TABLE_HEIGHT - 0.8;
    arena.add(baseColumn);

    const chairMat = new THREE.MeshPhysicalMaterial({ color: 0x8b0000, roughness: 0.35, metalness: 0.5, clearcoat: 1 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const chairRadius = 4.8;

    const cardGeo = new THREE.BoxGeometry(CARD_W, CARD_H, CARD_D, 1, 1, 1);
    const labelGeo = new THREE.PlaneGeometry(1.6, 0.8);
    const cardMeshes = [];
    const cardMaterials = [];
    const labelTextures = [];
    const labelMaterials = [];

    const deck = makeDeck();
    const playerHands = players.map(() => []);
    for (let i = 0; i < DEAL_PER_PLAYER; i++) {
      players.forEach((_, idx) => {
        if (deck.length) {
          playerHands[idx].push(deck.pop());
        }
      });
    }
    playerHands.forEach((hand) => hand.sort((a, b) => rankValue(a.r) - rankValue(b.r)));

    for (let i = 0; i < CHAIR_COUNT; i++) {
      const player = players[i] ?? null;
      const chair = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 1.3), chairMat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.2), chairMat);
      back.position.set(0, 0.5, -0.55);
      const armLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.9), chairMat);
      armLeft.position.set(-0.7, 0.2, -0.1);
      const armRight = armLeft.clone();
      armRight.position.x = 0.7;
      const legBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.6, 16), legMat);
      legBase.position.y = -0.45;
      chair.add(seat, back, armLeft, armRight, legBase);

      const angle = (i / CHAIR_COUNT) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(angle) * chairRadius;
      const z = Math.sin(angle) * chairRadius;
      chair.position.set(x, TABLE_HEIGHT - 0.15, z);
      chair.lookAt(new THREE.Vector3(0, TABLE_HEIGHT - 0.15, 0));
      arena.add(chair);
      if (player) {
        const labelTex = makeLabelTexture(player.name, player.avatar);
        labelTextures.push(labelTex);
        const labelMat = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, side: THREE.DoubleSide });
        labelMaterials.push(labelMat);
        const label = new THREE.Mesh(labelGeo, labelMat);
        label.position.set(0, 0.75, 1.05);
        label.rotation.y = Math.PI;
        chair.add(label);

        const hand = playerHands[i];
        const spread = hand.length ? Math.min(hand.length * 0.18, 2.2) : 0;
        hand.forEach((card, idx) => {
          const tex = makeCardFace(card.r, card.s);
          const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.05 });
          cardMaterials.push(mat);
          const mesh = new THREE.Mesh(cardGeo, mat);
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.set(0, TABLE_HEIGHT + 0.05, 0);
          arena.add(mesh);
          cardMeshes.push({ mesh, texture: tex });

          const offset = idx - (hand.length - 1) / 2;
          const cardAngle = angle - Math.PI / 2;
          const radius = 3.4;
          const target = new THREE.Vector3(
            Math.cos(cardAngle) * radius - Math.sin(cardAngle) * (offset * (spread / Math.max(hand.length, 1))),
            TABLE_HEIGHT + 0.02,
            Math.sin(cardAngle) * radius + Math.cos(cardAngle) * (offset * (spread / Math.max(hand.length, 1)))
          );
          animateCard(mesh, target, TABLE_HEIGHT + 0.02, idx * 0.08 + i * 0.2);
          mesh.lookAt(new THREE.Vector3(0, TABLE_HEIGHT + 0.02, 0));
        });
      }
    }

    spotTarget.position.set(0, TABLE_HEIGHT + 0.2, 0);
    spot.target.updateMatrixWorld();

    const camera = new THREE.PerspectiveCamera(
      camConfig.fov,
      mount.clientWidth / mount.clientHeight,
      camConfig.near,
      camConfig.far
    );
    const initialRadius = Math.max(boardSize * ARENA_CAMERA_DEFAULTS.initialRadiusFactor, camConfig.minRadius + 0.6);
    const spherical = new THREE.Spherical(
      initialRadius,
      THREE.MathUtils.lerp(ARENA_CAMERA_DEFAULTS.phiMin, ARENA_CAMERA_DEFAULTS.phiMax, ARENA_CAMERA_DEFAULTS.initialPhiLerp),
      Math.PI * 0.25
    );
    const target = new THREE.Vector3(0, TABLE_HEIGHT + 0.2, 0);
    updateCameraFromSpherical(camera, spherical, target);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.copy(target);
    controls.minPolarAngle = ARENA_CAMERA_DEFAULTS.phiMin;
    controls.maxPolarAngle = ARENA_CAMERA_DEFAULTS.phiMax;
    controls.minDistance = camConfig.minRadius;
    controls.maxDistance = camConfig.maxRadius;
    controls.enablePan = false;
    controls.zoomSpeed = ARENA_CAMERA_DEFAULTS.wheelDeltaFactor;
    controls.rotateSpeed = 0.5;

    function resize() {
      const { clientWidth, clientHeight } = mount;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    let frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      cardGeo.dispose();
      labelGeo.dispose();
      cardMeshes.forEach(({ mesh, texture }) => {
        arena.remove(mesh);
        texture.dispose();
      });
      cardMaterials.forEach((mat) => mat.dispose());
      labelTextures.forEach((tex) => tex.dispose());
      labelMaterials.forEach((mat) => mat.dispose());
    };
  }, [players]);

  return <div ref={mountRef} className="absolute inset-0" />;
}

function updateCameraFromSpherical(camera, spherical, target) {
  const position = new THREE.Vector3().setFromSpherical(spherical).add(target);
  camera.position.copy(position);
  camera.lookAt(target);
}

function animateCard(card, target, height, delay) {
  const start = card.position.clone();
  const duration = 900;
  const startTime = performance.now() + delay * 1000;

  function step() {
    const elapsed = performance.now() - startTime;
    if (elapsed < 0) {
      requestAnimationFrame(step);
      return;
    }
    const t = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    card.position.lerpVectors(start, target, eased);
    card.position.y = height + Math.sin(Math.PI * eased) * 0.35;
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      card.position.copy(target);
      card.position.y = height;
    }
  }

  requestAnimationFrame(step);
}

function makeVelvetTexture(w, h, c1, c2) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, c1);
  gradient.addColorStop(1, c2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 7000; i++) {
    const px = Math.random() * w;
    const py = Math.random() * h;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
    ctx.fillRect(px, py, 1, 1);
  }
  return new THREE.CanvasTexture(canvas);
}
