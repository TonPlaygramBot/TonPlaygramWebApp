import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  buildDominoArena,
  DOMINO_TABLE_DIMENSIONS,
  DOMINO_CAMERA_CONFIG
} from '../../utils/dominoArena.js';
import { applyRendererSRGB } from '../../utils/colorSpace.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getTelegramFirstName,
  getTelegramUsername,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import coinConfetti from '../../utils/coinConfetti';
import {
  dropSound,
  snakeSound,
  cheerSound
} from '../../assets/soundData.js';
import { getGameVolume } from '../../utils/sound.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const CAMERA_INITIAL_RADIUS_FACTOR = 1.35;
const CAMERA_INITIAL_PHI_LERP = 0.42;
const CAMERA_DOLLY_FACTOR = 0.2;
const CAM = {
  fov: DOMINO_CAMERA_CONFIG.fov,
  near: DOMINO_CAMERA_CONFIG.near,
  far: DOMINO_CAMERA_CONFIG.far,
  minR: DOMINO_CAMERA_CONFIG.minRadius,
  maxR: DOMINO_CAMERA_CONFIG.maxRadius,
  phiMin: Math.PI * 0.38,
  phiMax: DOMINO_CAMERA_CONFIG.maxPolarAngle
};

const LUDO_GRID = 15;
const LUDO_TILE = 0.075;
const RAW_BOARD_SIZE = LUDO_GRID * LUDO_TILE;
const BOARD_SCALE_MULTIPLIER = 1.25;
const BASE_BOARD_DISPLAY_SIZE = DOMINO_TABLE_DIMENSIONS.playfieldSize * 0.5;
const BOARD_DISPLAY_SIZE = BASE_BOARD_DISPLAY_SIZE * BOARD_SCALE_MULTIPLIER;
const BOARD_SCALE = BOARD_DISPLAY_SIZE / RAW_BOARD_SIZE;
const CHESS_TILE_LIGHT = 0xe7e2d3;
const CHESS_TILE_DARK = 0x776a5a;
const CHESS_TILE_WORLD_HEIGHT =
  0.1 * (3.4 / (8 * 4.2 + 2 * 2.2));
const LUDO_TILE_HEIGHT = CHESS_TILE_WORLD_HEIGHT / BOARD_SCALE;
const TOKEN_LIFT = LUDO_TILE_HEIGHT / 2 + 0.007;
const RING_STEPS = 52;
const HOME_STEPS = 4;
const GOAL_PROGRESS = RING_STEPS + HOME_STEPS;
const PLAYER_START_INDEX = [0, 13, 26, 39];
const COLOR_NAMES = ['Red', 'Green', 'Yellow', 'Blue'];
const PLAYER_COLORS = [0xef4444, 0x22c55e, 0xf59e0b, 0x3b82f6];

const DICE_SIZE = 0.09;
const DICE_CORNER_RADIUS = DICE_SIZE * 0.17;
const DICE_FACE_INSET = DICE_SIZE * 0.04;
const DICE_FACE_SIZE = DICE_SIZE - DICE_FACE_INSET * 2;
const DICE_BASE_HEIGHT = DICE_SIZE / 2 + 0.047;
const DICE_FACE_TEXTURE_CACHE = new Map();
const DICE_FACE_MATERIAL_CACHE = new Map();

function getDiceFaceTexture(value) {
  if (DICE_FACE_TEXTURE_CACHE.has(value)) {
    return DICE_FACE_TEXTURE_CACHE.get(value);
  }
  if (typeof document === 'undefined') {
    const placeholder = new THREE.Texture();
    placeholder.needsUpdate = true;
    DICE_FACE_TEXTURE_CACHE.set(value, placeholder);
    return placeholder;
  }
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const label = String(value);
  ctx.font = `bold ${Math.floor(size * 0.62)}px "Poppins", "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = size * 0.08;
  ctx.strokeText(label, size / 2, size / 2);
  ctx.fillStyle = '#0b0f1a';
  ctx.fillText(label, size / 2, size / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  DICE_FACE_TEXTURE_CACHE.set(value, texture);
  return texture;
}

function getDiceFaceMaterial(value) {
  if (DICE_FACE_MATERIAL_CACHE.has(value)) {
    return DICE_FACE_MATERIAL_CACHE.get(value);
  }
  const texture = getDiceFaceTexture(value);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    roughness: 0.42,
    metalness: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  DICE_FACE_MATERIAL_CACHE.set(value, material);
  return material;
}

function makeDice() {
  const dice = new THREE.Group();

  const dieMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0.25,
    roughness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    reflectivity: 0.75,
    envMapIntensity: 1.4
  });

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(
      DICE_SIZE,
      DICE_SIZE,
      DICE_SIZE,
      6,
      DICE_CORNER_RADIUS
    ),
    dieMaterial
  );
  body.castShadow = true;
  body.receiveShadow = true;
  dice.add(body);

  const halfSize = DICE_SIZE / 2;
  const faceDepth = halfSize - DICE_FACE_INSET;
  const faceGeo = new THREE.PlaneGeometry(DICE_FACE_SIZE, DICE_FACE_SIZE);
  const baseNormal = new THREE.Vector3(0, 0, 1);
  const baseUp = new THREE.Vector3(0, 1, 0);
  const faceDefinitions = [
    {
      value: 1,
      normal: new THREE.Vector3(0, 1, 0),
      up: new THREE.Vector3(0, 0, -1)
    },
    { value: 2, normal: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) },
    { value: 3, normal: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
    { value: 4, normal: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
    { value: 5, normal: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
    {
      value: 6,
      normal: new THREE.Vector3(0, -1, 0),
      up: new THREE.Vector3(0, 0, 1)
    }
  ];

  faceDefinitions.forEach(({ value, normal, up }) => {
    const face = new THREE.Mesh(faceGeo, getDiceFaceMaterial(value));
    face.renderOrder = 6;
    const alignedNormal = normal.clone().normalize();
    const targetUp = up.clone().normalize();
    const initialQuat = new THREE.Quaternion().setFromUnitVectors(baseNormal, alignedNormal);
    const currentUp = baseUp.clone().applyQuaternion(initialQuat).normalize();
    const cross = new THREE.Vector3().crossVectors(currentUp, targetUp);
    const dot = THREE.MathUtils.clamp(currentUp.dot(targetUp), -1, 1);
    let twist = 0;
    if (cross.lengthSq() > 1e-6) {
      twist = Math.atan2(cross.dot(alignedNormal), dot);
    } else if (dot < 0) {
      twist = Math.PI;
    }
    const twistQuat = new THREE.Quaternion().setFromAxisAngle(alignedNormal, twist);
    face.quaternion.copy(initialQuat.multiply(twistQuat));
    face.position.copy(alignedNormal.multiplyScalar(faceDepth));
    dice.add(face);
  });

  dice.userData.setValue = (val) => {
    dice.userData.currentValue = val;
    setDiceOrientation(dice, val);
  };
  dice.userData.currentValue = 1;
  return dice;
}

function setDiceOrientation(dice, val) {
  const q = new THREE.Quaternion();
  const eulers = {
    1: new THREE.Euler(0, 0, 0),
    2: new THREE.Euler(-Math.PI / 2, 0, 0),
    3: new THREE.Euler(0, 0, -Math.PI / 2),
    4: new THREE.Euler(0, 0, Math.PI / 2),
    5: new THREE.Euler(Math.PI / 2, 0, 0),
    6: new THREE.Euler(Math.PI, 0, 0)
  };
  const e = eulers[val] || eulers[1];
  q.setFromEuler(e);
  dice.setRotationFromQuaternion(q);
}

function spinDice(
  dice,
  { duration = 900, targetPosition = new THREE.Vector3(), bounceHeight = 0.06 } = {}
) {
  return new Promise((resolve) => {
    const start = performance.now();
    const startPos = dice.position.clone();
    const endPos = targetPosition.clone();
    const spinVec = new THREE.Vector3(
      0.6 + Math.random() * 0.5,
      0.7 + Math.random() * 0.45,
      0.5 + Math.random() * 0.55
    );
    const wobble = new THREE.Vector3((Math.random() - 0.5) * 0.12, 0, (Math.random() - 0.5) * 0.12);
    const targetValue = 1 + Math.floor(Math.random() * 6);

    const step = () => {
      const now = performance.now();
      const t = Math.min(1, (now - start) / Math.max(1, duration));
      const eased = easeOutCubic(t);
      const position = startPos.clone().lerp(endPos, eased);
      const wobbleStrength = Math.sin(eased * Math.PI);
      position.addScaledVector(wobble, wobbleStrength * 0.45);
      const bounce = Math.sin(Math.min(1, eased * 1.25) * Math.PI) * bounceHeight * (1 - eased * 0.45);
      position.y = THREE.MathUtils.lerp(startPos.y, endPos.y, eased) + bounce;
      dice.position.copy(position);

      const spinFactor = 1 - eased * 0.35;
      dice.rotation.x += spinVec.x * spinFactor * 0.2;
      dice.rotation.y += spinVec.y * spinFactor * 0.2;
      dice.rotation.z += spinVec.z * spinFactor * 0.2;

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        if (typeof dice.userData?.setValue === 'function') {
          dice.userData.setValue(targetValue);
        } else {
          setDiceOrientation(dice, targetValue);
        }
        dice.position.copy(endPos);
        resolve(targetValue);
      }
    };

    requestAnimationFrame(step);
  });
}

function makeTokenMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
}

function makeRook(mat) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.018, 24), mat);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.036, 24), mat);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 8, 24), mat);
  base.position.y = 0.009;
  body.position.y = 0.009 + 0.018;
  rim.position.y = 0.009 + 0.036 + 0.006;
  rim.rotation.x = Math.PI / 2;
  g.add(base, body, rim);
  return g;
}

function ease(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function Ludo3D({ avatar, username }) {
  const wrapRef = useRef(null);
  const rafRef = useRef(0);
  const zoomRef = useRef({});
  const controlsRef = useRef(null);
  const diceRef = useRef(null);
  const diceTransitionRef = useRef(null);
  const rollDiceRef = useRef(() => {});
  const turnIndicatorRef = useRef(null);
  const stateRef = useRef(null);
  const moveSoundRef = useRef(null);
  const captureSoundRef = useRef(null);
  const cheerSoundRef = useRef(null);
  const fitRef = useRef(() => {});
  const [showConfig, setShowConfig] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const settingsRef = useRef({ soundEnabled: true });
  const [ui, setUi] = useState({
    turn: 0,
    status: 'Red to roll',
    dice: null,
    winner: null
  });

  const stopDiceTransition = () => {
    if (diceTransitionRef.current?.cancel) {
      try {
        diceTransitionRef.current.cancel();
      } catch (error) {
        console.warn('Failed to cancel dice transition', error);
      }
    }
    diceTransitionRef.current = null;
  };

  const animateDicePosition = (dice, destination, { duration = 450, lift = 0.04 } = {}) => {
    if (!dice || !destination) return;
    const target = destination.clone ? destination.clone() : new THREE.Vector3().copy(destination);
    stopDiceTransition();
    const startPos = dice.position.clone();
    const started = performance.now();
    const state = { cancelled: false };
    const handle = {
      cancel: () => {
        state.cancelled = true;
      }
    };
    diceTransitionRef.current = handle;
    const step = () => {
      if (state.cancelled) return;
      const now = performance.now();
      const t = Math.min(1, (now - started) / Math.max(1, duration));
      const eased = easeOutCubic(t);
      const pos = startPos.clone().lerp(target, eased);
      if (lift > 0) {
        const arc = Math.sin(Math.PI * eased) * lift * (1 - eased * 0.35);
        pos.y = THREE.MathUtils.lerp(startPos.y, target.y, eased) + arc;
      }
      dice.position.copy(pos);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        dice.position.copy(target);
        if (diceTransitionRef.current === handle) {
          diceTransitionRef.current = null;
        }
      }
    };
    requestAnimationFrame(step);
  };

  const moveDiceToRail = (player, immediate = false) => {
    const dice = diceRef.current;
    if (!dice) return;
    const rails = dice.userData?.railPositions;
    if (!rails || !rails[player]) return;
    const target = rails[player].clone ? rails[player].clone() : new THREE.Vector3().copy(rails[player]);
    if (immediate) {
      stopDiceTransition();
      dice.position.copy(target);
      return;
    }
    animateDicePosition(dice, target, { duration: 520, lift: 0.05 });
  };

  const updateTurnIndicator = (player, immediate = false) => {
    const indicator = turnIndicatorRef.current;
    if (!indicator) return;
    const material = Array.isArray(indicator.material)
      ? indicator.material[0]
      : indicator.material;
    if (!material) return;
    const color = new THREE.Color(PLAYER_COLORS[player]);
    material.color.set(color);
    if (material.emissive) {
      material.emissive.set(color.clone().multiplyScalar(0.3));
    }
    moveDiceToRail(player, immediate);
  };

  useEffect(() => {
    const applyVolume = (baseVolume) => {
      const level = settingsRef.current.soundEnabled ? baseVolume : 0;
      [moveSoundRef, captureSoundRef, cheerSoundRef].forEach((ref) => {
        if (ref.current) {
          ref.current.volume = level;
          if (!settingsRef.current.soundEnabled) {
            try {
              ref.current.pause();
              ref.current.currentTime = 0;
            } catch {}
          }
        }
      });
    };
    const vol = getGameVolume();
    moveSoundRef.current = new Audio(dropSound);
    captureSoundRef.current = new Audio(snakeSound);
    cheerSoundRef.current = new Audio(cheerSound);
    applyVolume(vol);
    const onVolChange = () => {
      applyVolume(getGameVolume());
    };
    window.addEventListener('gameVolumeChanged', onVolChange);
    return () => {
      window.removeEventListener('gameVolumeChanged', onVolChange);
    };
  }, []);

  useEffect(() => {
    settingsRef.current.soundEnabled = soundEnabled;
    const baseVolume = getGameVolume();
    const level = soundEnabled ? baseVolume : 0;
    [moveSoundRef, captureSoundRef, cheerSoundRef].forEach((ref) => {
      if (ref.current) {
        ref.current.volume = level;
        if (!soundEnabled) {
          try {
            ref.current.pause();
            ref.current.currentTime = 0;
          } catch {}
        }
      }
    });
  }, [soundEnabled]);

  useEffect(() => {
    const host = wrapRef.current;
    if (!host) return;
    let scene, camera, renderer;
    let controls;
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();

    const vol = settingsRef.current.soundEnabled ? getGameVolume() : 0;
    const disposers = [];
    moveSoundRef.current?.pause();
    captureSoundRef.current?.pause();
    cheerSoundRef.current?.pause();
    if (moveSoundRef.current) moveSoundRef.current.volume = vol;
    if (captureSoundRef.current) captureSoundRef.current.volume = vol;
    if (cheerSoundRef.current) cheerSoundRef.current.volume = vol;

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.localClippingEnabled = true;
    applyRendererSRGB(renderer);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xece6dc);

    const arenaSetup = buildDominoArena({ scene, renderer });
    if (arenaSetup?.dispose) {
      disposers.push(() => {
        try {
          arenaSetup.dispose();
        } catch (error) {
          console.warn('Failed to dispose Ludo arena', error);
        }
      });
    }

    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, 0.004, 0);
    boardGroup.scale.setScalar(BOARD_SCALE);
    if (arenaSetup?.boardAnchor) {
      arenaSetup.boardAnchor.add(boardGroup);
    } else if (arenaSetup?.arena) {
      arenaSetup.arena.add(boardGroup);
    } else {
      scene.add(boardGroup);
    }

    const boardLookTarget = new THREE.Vector3(
      0,
      DOMINO_CAMERA_CONFIG.targetY,
      0
    );

    camera = new THREE.PerspectiveCamera(CAM.fov, 1, CAM.near, CAM.far);
    const initialRadius = Math.max(
      BOARD_DISPLAY_SIZE * CAMERA_INITIAL_RADIUS_FACTOR,
      CAM.minR
    );
    const initialSpherical = new THREE.Spherical(
      initialRadius,
      THREE.MathUtils.lerp(CAM.phiMin, CAM.phiMax, CAMERA_INITIAL_PHI_LERP),
      Math.PI * 0.25
    );
    const initialOffset = new THREE.Vector3().setFromSpherical(initialSpherical);
    camera.position.copy(boardLookTarget).add(initialOffset);
    camera.lookAt(boardLookTarget);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = CAM.minR;
    controls.maxDistance = CAM.maxR;
    controls.maxPolarAngle = CAM.phiMax;
    controls.minPolarAngle = CAM.phiMin;
    controls.target.copy(boardLookTarget);
    controlsRef.current = controls;

    const fit = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const boardSize = RAW_BOARD_SIZE * BOARD_SCALE;
      const needed =
        boardSize / (2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov) / 2));
      const currentRadius = camera.position.distanceTo(boardLookTarget);
      const radius = clamp(Math.max(needed, currentRadius), CAM.minR, CAM.maxR);
      const dir = camera.position.clone().sub(boardLookTarget).normalize();
      camera.position.copy(boardLookTarget).addScaledVector(dir, radius);
      controls.update();
    };
    fitRef.current = fit;
    fit();

    const dollyScale = 1 + CAMERA_DOLLY_FACTOR;
    zoomRef.current = {
      zoomIn: () => {
        if (!controls) return;
        controls.dollyIn(dollyScale);
        controls.update();
      },
      zoomOut: () => {
        if (!controls) return;
        controls.dollyOut(dollyScale);
        controls.update();
      }
    };

    const boardData = buildLudoBoard(boardGroup);
    diceRef.current = boardData.dice;
    turnIndicatorRef.current = boardData.turnIndicator;
    moveDiceToRail(0, true);
    updateTurnIndicator(0, true);

    stateRef.current = {
      paths: boardData.paths,
      startPads: boardData.startPads,
      homeColumns: boardData.homeColumns,
      goalSlots: boardData.goalSlots,
      tokens: boardData.tokens,
      turnIndicator: boardData.turnIndicator,
      progress: Array.from({ length: 4 }, () => Array(4).fill(-1)),
      turn: 0,
      winner: null,
      animation: null
    };

    const attemptDiceRoll = (clientX, clientY) => {
      const dice = diceRef.current;
      const rollFn = rollDiceRef.current;
      const state = stateRef.current;
      if (
        !dice ||
        !rollFn ||
        !state ||
        state.winner ||
        state.animation ||
        dice.userData?.isRolling
      ) {
        return false;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      pointer.set(x, y);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(dice, true);
      if (hit.length) {
        rollFn();
        return true;
      }
      return false;
    };
    let pointerLocked = false;
    const onPointerDown = (event) => {
      const { clientX, clientY } = event;
      if (clientX == null || clientY == null) return;
      const handled = attemptDiceRoll(clientX, clientY);
      if (handled) {
        pointerLocked = true;
        if (controls) controls.enabled = false;
        event.preventDefault();
      }
    };
    const onPointerUp = () => {
      if (!pointerLocked) return;
      pointerLocked = false;
      if (controls) controls.enabled = true;
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown, {
      passive: false
    });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    const step = () => {
      const state = stateRef.current;
      const anim = state?.animation;
      if (anim && anim.active && anim.token) {
        anim.t += 0.02;
        const { path, segment } = anim;
        const from = path[segment];
        const to = path[segment + 1];
        if (from && to) {
          const k = ease(Math.min(1, anim.t));
          const pos = from.clone().lerp(to, k);
          pos.y += Math.sin(k * Math.PI) * 0.02;
          anim.token.position.copy(pos);
          anim.token.rotation.y += 0.08;
          if (anim.t >= 1) {
            anim.segment += 1;
            anim.t = 0;
            if (anim.segment >= path.length - 1) {
              anim.active = false;
              anim.token.rotation.y = 0;
              const done = anim.onComplete;
              state.animation = null;
              done?.();
            }
          }
        }
      }
      const diceObj = diceRef.current;
      const lights = diceObj?.userData?.lights;
      if (diceObj && lights) {
        const pos = diceObj.position;
        if (lights.accent?.userData?.offset) {
          lights.accent.position.copy(pos).add(lights.accent.userData.offset);
        }
        if (lights.fill?.userData?.offset) {
          lights.fill.position.copy(pos).add(lights.fill.userData.offset);
        }
        if (lights.target) {
          lights.target.position.copy(pos);
        }
      }
      controls?.update();
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(step);
    };
    step();

    const onResize = () => fit();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      stateRef.current = null;
      turnIndicatorRef.current = null;
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      controlsRef.current = null;
      controls?.dispose();
      controls = null;
      stopDiceTransition();
      diceRef.current = null;
      disposers.forEach((fn) => {
        try {
          fn();
        } catch (error) {
          console.warn('Failed during Ludo cleanup', error);
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  const playMove = () => {
    if (!settingsRef.current.soundEnabled) return;
    if (moveSoundRef.current) {
      moveSoundRef.current.currentTime = 0;
      moveSoundRef.current.play().catch(() => {});
    }
  };

  const playCapture = () => {
    if (!settingsRef.current.soundEnabled) return;
    if (captureSoundRef.current) {
      captureSoundRef.current.currentTime = 0;
      captureSoundRef.current.play().catch(() => {});
    }
  };

  const playCheer = () => {
    if (!settingsRef.current.soundEnabled) return;
    if (cheerSoundRef.current) {
      cheerSoundRef.current.currentTime = 0;
      cheerSoundRef.current.play().catch(() => {});
    }
  };

  const getWorldForProgress = (player, progress, tokenIndex) => {
    const state = stateRef.current;
    if (!state) return new THREE.Vector3();
    if (progress < 0) {
      return state.startPads[player][tokenIndex]
        .clone()
        .add(new THREE.Vector3(0, TOKEN_LIFT, 0));
    }
    if (progress < RING_STEPS) {
      const idx = (PLAYER_START_INDEX[player] + progress) % RING_STEPS;
      return state.paths[idx].clone().add(new THREE.Vector3(0, TOKEN_LIFT, 0));
    }
    if (progress < RING_STEPS + HOME_STEPS) {
      const homeStep = progress - RING_STEPS;
      return state.homeColumns[player][homeStep]
        .clone()
        .add(new THREE.Vector3(0, TOKEN_LIFT, 0));
    }
    return state.goalSlots[player][tokenIndex]
      .clone()
      .add(new THREE.Vector3(0, TOKEN_LIFT, 0));
  };

  const scheduleMove = (player, tokenIndex, targetProgress, onComplete) => {
    const state = stateRef.current;
    if (!state) return;
    const fromProgress = state.progress[player][tokenIndex];
    const path = [];
    if (fromProgress < 0) {
      path.push(getWorldForProgress(player, -1, tokenIndex));
      path.push(getWorldForProgress(player, 0, tokenIndex));
    } else {
      path.push(getWorldForProgress(player, fromProgress, tokenIndex));
      for (let p = fromProgress + 1; p <= targetProgress; p++) {
        path.push(getWorldForProgress(player, p, tokenIndex));
      }
    }
    const token = state.tokens[player][tokenIndex];
    state.animation = {
      active: true,
      token,
      path,
      segment: 0,
      t: 0,
      onComplete
    };
  };

  const advanceTurn = (extraTurn) => {
    setUi((s) => {
      if (s.winner) return s;
      const nextTurn = extraTurn ? s.turn : (s.turn + 1) % 4;
      const state = stateRef.current;
      if (state) state.turn = nextTurn;
      updateTurnIndicator(nextTurn);
      return {
        ...s,
        turn: nextTurn,
        status: `${COLOR_NAMES[nextTurn]} to roll`,
        dice: null
      };
    });
  };

  const handleCaptures = (player, tokenIndex) => {
    const state = stateRef.current;
    if (!state) return;
    const prog = state.progress[player][tokenIndex];
    if (prog < 0 || prog >= RING_STEPS) return;
    const landingIdx = (PLAYER_START_INDEX[player] + prog) % RING_STEPS;
    const safeStarts = [0, 8, 16, 24];
    if (safeStarts.includes(landingIdx)) return;
    for (let p = 0; p < 4; p++) {
      if (p === player) continue;
      for (let t = 0; t < 4; t++) {
        if (state.progress[p][t] < 0 || state.progress[p][t] >= RING_STEPS) continue;
        const idx = (PLAYER_START_INDEX[p] + state.progress[p][t]) % RING_STEPS;
        if (idx === landingIdx) {
          state.progress[p][t] = -1;
          const token = state.tokens[p][t];
          const pos = state.startPads[p][t]
            .clone()
            .add(new THREE.Vector3(0, TOKEN_LIFT, 0));
          token.position.copy(pos);
          token.rotation.set(0, 0, 0);
          playCapture();
        }
      }
    }
  };

  const checkWin = (player) => {
    const state = stateRef.current;
    if (!state) return false;
    const allHome = state.progress[player].every((p) => p >= GOAL_PROGRESS);
    if (allHome) {
      state.winner = player;
      setUi((s) => ({
        ...s,
        winner: COLOR_NAMES[player],
        status: `${COLOR_NAMES[player]} wins!`
      }));
      playCheer();
      coinConfetti();
      return true;
    }
    return false;
  };

  const moveToken = (player, tokenIndex, roll) => {
    const state = stateRef.current;
    if (!state) return;
    const current = state.progress[player][tokenIndex];
    const entering = current < 0;
    const target = entering ? 0 : current + roll;
    if (target > GOAL_PROGRESS) return advanceTurn(false);
    const applyResult = () => {
      state.progress[player][tokenIndex] = target;
      const finalPos = getWorldForProgress(player, target, tokenIndex);
      state.tokens[player][tokenIndex].position.copy(finalPos);
      state.tokens[player][tokenIndex].rotation.set(0, 0, 0);
      playMove();
      handleCaptures(player, tokenIndex);
      const winner = checkWin(player);
      advanceTurn(!winner && roll === 6);
    };
    if (entering || target !== current) {
      scheduleMove(player, tokenIndex, target, applyResult);
    } else {
      applyResult();
    }
  };

  const getMovableTokens = (player, roll) => {
    const state = stateRef.current;
    if (!state) return [];
    const list = [];
    for (let i = 0; i < 4; i++) {
      const prog = state.progress[player][i];
      if (prog < 0) {
        if (roll === 6) list.push({ token: i, entering: true });
        continue;
      }
      const target = prog + roll;
      if (target <= GOAL_PROGRESS) list.push({ token: i, entering: false });
    }
    return list;
  };

  const rollDice = async () => {
    const state = stateRef.current;
    if (!state || state.winner) return;
    if (state.animation) return;
    const dice = diceRef.current;
    if (!dice || dice.userData?.isRolling) return;
    const player = state.turn;
    const baseHeight = dice.userData?.baseHeight ?? DICE_BASE_HEIGHT;
    const rollTargets = dice.userData?.rollTargets;
    const clothLimit = dice.userData?.clothLimit ?? DOMINO_TABLE_DIMENSIONS.clothHalfWidth - 0.12;
    const baseTarget = rollTargets?.[player]?.clone() ?? new THREE.Vector3(0, baseHeight, 0);
    const jitter = new THREE.Vector3((Math.random() - 0.5) * 0.18, 0, (Math.random() - 0.5) * 0.18);
    baseTarget.add(jitter);
    baseTarget.x = THREE.MathUtils.clamp(baseTarget.x, -clothLimit, clothLimit);
    baseTarget.z = THREE.MathUtils.clamp(baseTarget.z, -clothLimit, clothLimit);
    baseTarget.y = baseHeight;
    stopDiceTransition();
    dice.userData.isRolling = true;
    const value = await spinDice(dice, {
      duration: 950,
      targetPosition: baseTarget,
      bounceHeight: dice.userData?.bounceHeight ?? 0.06
    });
    dice.userData.isRolling = false;
    setUi((s) => ({ ...s, dice: value }));
    const options = getMovableTokens(player, value);
    if (!options.length) {
      advanceTurn(value === 6);
      return;
    }
    const choice = options[0];
    moveToken(player, choice.token, value);
  };

  rollDiceRef.current = rollDice;

  return (
    <div
      ref={wrapRef}
      className="fixed inset-0 bg-[#0c1020] text-white touch-none select-none"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-3 left-3 bg-white/10 rounded px-3 py-2 text-xs">
          <div className="font-semibold">{ui.status}</div>
          {ui.dice != null && (
            <div className="text-[10px] mt-1">Rolled: {ui.dice}</div>
          )}
        </div>
        <div className="absolute top-3 right-3 flex items-center space-x-3 pointer-events-auto">
          <div className="flex items-center space-x-2 bg-white/10 rounded-full px-3 py-1 text-xs pointer-events-none">
            {avatar && (
              <img
                src={avatar}
                alt="avatar"
                className="h-7 w-7 rounded-full object-cover"
              />
            )}
            <span>{username || 'Guest'}</span>
          </div>
          <div className="relative">
            <button
              type="button"
              aria-label={showConfig ? 'Mbyll konfigurimet e lojës' : 'Hap konfigurimet e lojës'}
              onClick={() => setShowConfig((prev) => !prev)}
              className="rounded-full bg-black/70 p-2 text-lg text-gray-100 shadow-lg backdrop-blur transition hover:bg-black/60"
            >
              ⚙️
            </button>
            {showConfig && (
              <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-black/80 p-3 text-xs text-gray-100 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-300">
                    Konfigurime
                  </span>
                  <button
                    type="button"
                    aria-label="Mbyll konfigurimet"
                    onClick={() => setShowConfig(false)}
                    className="rounded-full p-1 text-gray-400 transition hover:text-gray-100"
                  >
                    ✕
                  </button>
                </div>
                <label className="mt-3 flex items-center justify-between text-[0.7rem] text-gray-200">
                  <span>Efekte zanore</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border border-emerald-400/40 bg-transparent text-emerald-400 focus:ring-emerald-500"
                    checked={soundEnabled}
                    onChange={(event) => setSoundEnabled(event.target.checked)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    fitRef.current?.();
                    setShowConfig(false);
                  }}
                  className="mt-3 w-full rounded-lg bg-white/10 py-2 text-center text-[0.7rem] font-semibold text-white transition hover:bg-white/20"
                >
                  Centro kamerën
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-2 w-full rounded-lg bg-emerald-500/20 py-2 text-center text-[0.7rem] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
                >
                  Rifillo lojën
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="px-5 py-2 rounded-full bg-[rgba(7,10,18,0.65)] border border-[rgba(255,215,0,0.25)] text-sm font-semibold backdrop-blur">
            {ui.winner
              ? `${ui.winner} Wins`
              : ui.turn === 0
              ? 'Your turn — tap the dice to roll'
              : ui.status}
          </div>
        </div>
        <div className="absolute right-3 bottom-3 flex flex-col space-y-2">
          <button
            onClick={() => zoomRef.current.zoomIn?.()}
            className="text-xl bg-white/10 hover:bg-white/20 rounded px-2 py-1"
          >
            +
          </button>
          <button
            onClick={() => zoomRef.current.zoomOut?.()}
            className="text-xl bg-white/10 hover:bg-white/20 rounded px-2 py-1"
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
}

function buildLudoBoard(boardGroup) {
  const scene = boardGroup;
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x3a2d23,
    roughness: 0.84,
    metalness: 0.18
  });
  const tileLightMat = new THREE.MeshStandardMaterial({
    color: CHESS_TILE_LIGHT,
    roughness: 0.86,
    metalness: 0.12
  });
  const tileDarkMat = new THREE.MeshStandardMaterial({
    color: CHESS_TILE_DARK,
    roughness: 0.8,
    metalness: 0.18
  });
  const safeColor = new THREE.Color(CHESS_TILE_LIGHT).lerp(
    new THREE.Color(CHESS_TILE_DARK),
    0.35
  );
  const safeMat = new THREE.MeshStandardMaterial({
    color: safeColor,
    roughness: 0.78,
    metalness: 0.15
  });
  const centerMat = new THREE.MeshStandardMaterial({
    color: CHESS_TILE_DARK,
    roughness: 0.82,
    metalness: 0.22
  });

  const plateThickness = LUDO_TILE_HEIGHT * 2.4;
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(
      RAW_BOARD_SIZE + 0.04,
      plateThickness,
      RAW_BOARD_SIZE + 0.04
    ),
    plateMat
  );
  plate.position.y = -plateThickness / 2;
  scene.add(plate);

  const half = (LUDO_GRID * LUDO_TILE) / 2;
  const tileCenterY = LUDO_TILE_HEIGHT / 2;
  const cellToWorld = (r, c) => {
    const x = -half + (c + 0.5) * LUDO_TILE;
    const z = -half + (r + 0.5) * LUDO_TILE;
    return new THREE.Vector3(x, tileCenterY, z);
  };

  const startPads = getHomeStartPads(half);
  const homeColumns = [[], [], [], []];
  const goalSlots = getGoalSlots(half);
  const ringPath = buildRingFromGrid(cellToWorld);

  const tileGeo = new THREE.BoxGeometry(
    LUDO_TILE * 0.96,
    LUDO_TILE_HEIGHT,
    LUDO_TILE * 0.96
  );
  const homeBaseMats = PLAYER_COLORS.map((color) => {
    const mix = new THREE.Color(CHESS_TILE_LIGHT).lerp(
      new THREE.Color(color),
      0.25
    );
    return new THREE.MeshStandardMaterial({
      color: mix,
      roughness: 0.85,
      metalness: 0.12
    });
  });
  const pathMats = PLAYER_COLORS.map(
    (color) =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(CHESS_TILE_DARK).lerp(
          new THREE.Color(color),
          0.4
        ),
        roughness: 0.82,
        metalness: 0.15
      })
  );
  const safeSet = new Set(['6,0', '0,8', '8,14', '14,6']);
  const center = cellToWorld(7, 7);

  for (let r = 0; r < LUDO_GRID; r++) {
    for (let c = 0; c < LUDO_GRID; c++) {
      const pos = cellToWorld(r, c);
      const key = `${r},${c}`;
      const homeIndex = getHomeIndex(r, c);
      const columnIndex = getHomeColumnIndex(r, c);
      const inCenter = r >= 6 && r <= 8 && c >= 6 && c <= 8;
      const inCross = r >= 6 && r <= 8 || c >= 6 && c <= 8;
      if (homeIndex !== -1) {
        const mesh = new THREE.Mesh(tileGeo, homeBaseMats[homeIndex]);
        mesh.position.copy(pos);
        scene.add(mesh);
        continue;
      }
      if (inCenter) {
        const mesh = new THREE.Mesh(tileGeo, centerMat);
        mesh.position.copy(pos);
        scene.add(mesh);
        continue;
      }
      if (columnIndex !== -1) {
        const mesh = new THREE.Mesh(tileGeo, pathMats[columnIndex]);
        mesh.position.copy(pos);
        scene.add(mesh);
        const dist = pos.distanceTo(center);
        homeColumns[columnIndex].push({ dist, pos });
        continue;
      }
      if (inCross) {
        let mat;
        if (safeSet.has(key)) {
          mat = safeMat;
        } else {
          mat = (r + c) % 2 === 0 ? tileLightMat : tileDarkMat;
        }
        const mesh = new THREE.Mesh(tileGeo, mat);
        mesh.position.copy(pos);
        scene.add(mesh);
      }
    }
  }

  const sortedColumns = homeColumns.map((list) =>
    list
      .sort((a, b) => b.dist - a.dist)
      .map((item) => item.pos.clone())
  );

  const tokens = PLAYER_COLORS.map((color, playerIdx) => {
    return Array.from({ length: 4 }, (_, i) => {
      const rook = makeRook(makeTokenMaterial(color));
      rook.position.copy(
        startPads[playerIdx][i].clone().add(new THREE.Vector3(0, TOKEN_LIFT, 0))
      );
      scene.add(rook);
      return rook;
    });
  });

  const dice = makeDice();
  const clothHalf = DOMINO_TABLE_DIMENSIONS.clothHalfWidth;
  const railDistance = clothHalf + 0.09;
  const railHeight = DICE_BASE_HEIGHT + 0.024;
  const rollRadius = clothHalf * 0.45;
  const railPositions = [
    new THREE.Vector3(0, railHeight, -railDistance),
    new THREE.Vector3(railDistance, railHeight, 0),
    new THREE.Vector3(0, railHeight, railDistance),
    new THREE.Vector3(-railDistance, railHeight, 0)
  ];
  const rollTargets = [
    new THREE.Vector3(0, DICE_BASE_HEIGHT, -rollRadius),
    new THREE.Vector3(rollRadius, DICE_BASE_HEIGHT, 0),
    new THREE.Vector3(0, DICE_BASE_HEIGHT, rollRadius),
    new THREE.Vector3(-rollRadius, DICE_BASE_HEIGHT, 0)
  ];
  dice.position.copy(railPositions[0]);
  dice.userData.railPositions = railPositions.map((pos) => pos.clone());
  dice.userData.rollTargets = rollTargets.map((pos) => pos.clone());
  dice.userData.baseHeight = DICE_BASE_HEIGHT;
  dice.userData.railHeight = railHeight;
  dice.userData.bounceHeight = 0.07;
  dice.userData.clothLimit = clothHalf - 0.12;
  dice.userData.isRolling = false;
  scene.add(dice);

  const diceLightTarget = new THREE.Object3D();
  scene.add(diceLightTarget);

  const diceAccent = new THREE.SpotLight(0xffffff, 2.1, 3.4, Math.PI / 5, 0.42, 1.25);
  diceAccent.userData.offset = new THREE.Vector3(0.45, 1.55, 1.05);
  diceAccent.target = diceLightTarget;
  scene.add(diceAccent);

  const diceFill = new THREE.PointLight(0xfff8e1, 1.05, 2.6, 2.2);
  diceFill.userData.offset = new THREE.Vector3(-0.65, 1.25, -0.75);
  scene.add(diceFill);

  dice.userData.lights = {
    accent: diceAccent,
    fill: diceFill,
    target: diceLightTarget
  };

  const indicatorMat = new THREE.MeshStandardMaterial({
    color: PLAYER_COLORS[0],
    emissive: new THREE.Color(PLAYER_COLORS[0]).multiplyScalar(0.3),
    emissiveIntensity: 0.9,
    metalness: 0.45,
    roughness: 0.35,
    side: THREE.DoubleSide
  });
  const turnIndicator = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.075, 48),
    indicatorMat
  );
  turnIndicator.rotation.x = -Math.PI / 2;
  turnIndicator.position.set(0, 0.006, 0);
  scene.add(turnIndicator);

  return {
    paths: ringPath,
    startPads,
    homeColumns: sortedColumns,
    goalSlots,
    tokens,
    dice,
    turnIndicator
  };
}

function getHomeIndex(r, c) {
  if (r < 6 && c < 6) return 0;
  if (r < 6 && c > 8) return 1;
  if (r > 8 && c < 6) return 2;
  if (r > 8 && c > 8) return 3;
  return -1;
}

function getHomeColumnIndex(r, c) {
  if (c === 7 && r >= 3 && r <= 6) return 0;
  if (r === 7 && c >= 8 && c <= 11) return 1;
  if (c === 7 && r >= 8 && r <= 11) return 3;
  if (r === 7 && c >= 3 && c <= 6) return 2;
  return -1;
}

function buildRingFromGrid(cellToWorld) {
  const pts = [];
  for (let c = 0; c < 15; c++) pts.push(cellToWorld(6, c));
  for (let r = 7; r < 15; r++) pts.push(cellToWorld(r, 8));
  for (let c = 14; c >= 0; c--) pts.push(cellToWorld(8, c));
  for (let r = 7; r >= 1; r--) pts.push(cellToWorld(r, 6));
  const dedup = [];
  const keySet = new Set();
  for (const p of pts) {
    const key = `${p.x.toFixed(3)},${p.z.toFixed(3)}`;
    if (!keySet.has(key)) {
      keySet.add(key);
      dedup.push(p.clone());
    }
  }
  if (dedup.length > 52) {
    const out = [];
    const step = (dedup.length - 1) / 52;
    for (let i = 0; i < 52; i++) {
      out.push(dedup[Math.round(i * step)].clone());
    }
    return out;
  }
  return dedup;
}

function getHomeStartPads(half) {
  const TILE = LUDO_TILE;
  const off = half - TILE * 3;
  const layout = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ];
  return layout.map(([sx, sz]) => {
    const cx = sx * off;
    const cz = sz * off;
    return [
      new THREE.Vector3(cx - 0.8 * TILE, LUDO_TILE_HEIGHT / 2, cz - 0.8 * TILE),
      new THREE.Vector3(cx + 0.8 * TILE, LUDO_TILE_HEIGHT / 2, cz - 0.8 * TILE),
      new THREE.Vector3(cx - 0.8 * TILE, LUDO_TILE_HEIGHT / 2, cz + 0.8 * TILE),
      new THREE.Vector3(cx + 0.8 * TILE, LUDO_TILE_HEIGHT / 2, cz + 0.8 * TILE)
    ];
  });
}

function getGoalSlots(half) {
  const TILE = LUDO_TILE;
  const offsets = [
    [-TILE * 0.3, -TILE * 0.3],
    [TILE * 0.3, -TILE * 0.3],
    [-TILE * 0.3, TILE * 0.3],
    [TILE * 0.3, TILE * 0.3]
  ];
  return Array.from({ length: 4 }, (_, player) =>
    offsets.map(
      ([ox, oz]) => new THREE.Vector3(ox, LUDO_TILE_HEIGHT / 2, oz)
    )
  );
}

export default function LudoBattleRoyal() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const avatar = params.get('avatar') || getTelegramPhotoUrl();
  const username =
    params.get('username') ||
    params.get('name') ||
    getTelegramFirstName() ||
    getTelegramUsername();
  return <Ludo3D avatar={avatar} username={username} />;
}
