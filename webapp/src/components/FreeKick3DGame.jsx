import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const INSTRUCTION_TEXT = 'Swipe up to shoot • Curve by swiping sideways';
const FIELD_TEXTURE_URL = 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg';

function formatTime(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (clamped % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function makeBillboardTexture(text, accentColor, frameThickness = 32) {
  const width = 1024;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const innerX = frameThickness;
  const innerY = frameThickness;
  const innerWidth = width - frameThickness * 2;
  const innerHeight = height - frameThickness * 2;

  const gradient = ctx.createLinearGradient(innerX, 0, innerX + innerWidth, 0);
  gradient.addColorStop(0, accentColor);
  gradient.addColorStop(1, '#0b1120');
  ctx.fillStyle = gradient;
  ctx.fillRect(innerX, innerY, innerWidth, innerHeight);

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 160px "Montserrat", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + frameThickness * 0.05);

  ctx.save();
  ctx.beginPath();
  ctx.rect(innerX, innerY, innerWidth, innerHeight);
  ctx.clip();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i += 1) {
    ctx.fillRect((width / 6) * i, 0, width / 12, height);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.lineWidth = frameThickness * 0.6;
  ctx.strokeStyle = '#000000';
  ctx.strokeRect(frameThickness / 2, frameThickness / 2, width - frameThickness, height - frameThickness);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(2.5, 1);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFallbackGrassTexture(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#0d5f1f');
  gradient.addColorStop(1, '#0c4718');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const bladeCount = size * 5;
  for (let i = 0; i < bladeCount; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const length = 6 + Math.random() * 18;
    const angle = Math.random() * Math.PI;
    const red = 20 + Math.random() * 20;
    const green = 110 + Math.random() * 70;
    const blue = 25 + Math.random() * 30;
    const alpha = 0.08 + Math.random() * 0.22;
    ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createNetSimulation(mesh) {
  const geometry = mesh.geometry;
  const positionAttr = geometry.attributes.position;
  const rest = new Float32Array(positionAttr.array.length);
  rest.set(positionAttr.array);
  const velocity = new Float32Array(positionAttr.count * 3);
  return {
    mesh,
    rest,
    velocity,
    damping: 0.9,
    stiffness: 26,
    impulseScale: 1.15
  };
}

function applyNetImpulse(sim, point, force) {
  if (!sim) return;
  const positionAttr = sim.mesh.geometry.attributes.position;
  const { array, count } = positionAttr;
  const rest = sim.rest;
  const velocity = sim.velocity;
  const tmp = new THREE.Vector3();
  let closestIndex = 0;
  let minDistance = Infinity;
  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    tmp.set(array[idx], array[idx + 1], array[idx + 2]);
    const distance = tmp.distanceTo(point);
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }

  const scaledForce = force * (sim.impulseScale ?? 1);
  const influenceRadius = Math.max(BALL_RADIUS * 1.8, scaledForce * 0.42);
  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    tmp.set(rest[idx], rest[idx + 1], rest[idx + 2]);
    const distance = tmp.distanceTo(point);
    if (distance > influenceRadius) continue;
    const weight = 1 - distance / influenceRadius;
    const impulse = scaledForce * weight;
    velocity[idx + 2] -= impulse * 0.95;
    velocity[idx] += (point.x - tmp.x) * impulse * 0.18;
    velocity[idx + 1] += (point.y - tmp.y) * impulse * 0.12;
  }

  if (closestIndex >= 0) {
    const idx = closestIndex * 3;
    velocity[idx + 2] -= scaledForce * 1.1;
  }
}

function updateNetSimulation(sim, dt) {
  if (!sim) return;
  const positionAttr = sim.mesh.geometry.attributes.position;
  const { array, count } = positionAttr;
  const rest = sim.rest;
  const velocity = sim.velocity;
  const damping = sim.damping;
  const stiffness = sim.stiffness;
  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    const displacementX = array[idx] - rest[idx];
    const displacementY = array[idx + 1] - rest[idx + 1];
    const displacementZ = array[idx + 2] - rest[idx + 2];

    velocity[idx] += -displacementX * stiffness * dt;
    velocity[idx + 1] += -displacementY * stiffness * dt;
    velocity[idx + 2] += -displacementZ * stiffness * dt;

    velocity[idx] *= damping;
    velocity[idx + 1] *= damping;
    velocity[idx + 2] *= damping;

    array[idx] += velocity[idx] * dt;
    array[idx + 1] += velocity[idx + 1] * dt;
    array[idx + 2] += velocity[idx + 2] * dt;
  }
  positionAttr.needsUpdate = true;
  sim.mesh.geometry.computeVertexNormals();
}
function makeUCLBallTexture(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() * 8) | 0;
    data[i] = 255 - noise;
    data[i + 1] = 255 - noise;
    data[i + 2] = 255 - noise;
  }
  ctx.putImageData(imageData, 0, 0);

  const rows = 3;
  const cols = 6;
  const mainColor = '#0a1a4f';
  const accentColor = '#1d3fa6';
  const drawStar = (x, y, outer, inner, color, alpha = 1) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 10);
    ctx.beginPath();
    const step = Math.PI / 5;
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = i * step;
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.restore();
  };

  const strokeStar = (x, y, outer, inner) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 10);
    ctx.beginPath();
    const step = Math.PI / 5;
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? outer : inner;
      const angle = i * step;
      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const offset = (r % 2 ? 0.5 : 0) * (size / cols);
      const x = c * (size / cols) + offset + size / (cols * 2);
      const y = (r + 0.5) * (size / (rows + 1));
      drawStar(x, y, size * 0.12, size * 0.055, mainColor, 1);
      drawStar(x, y, size * 0.085, size * 0.04, accentColor, 0.35);
    }
  }

  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = '#444';
  ctx.lineWidth = size * 0.0022;
  ctx.setLineDash([size * 0.004, size * 0.004]);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const offset = (r % 2 ? 0.5 : 0) * (size / cols);
      const x = c * (size / cols) + offset + size / (cols * 2);
      const y = (r + 0.5) * (size / (rows + 1));
      strokeStar(x, y, size * 0.12, size * 0.055);
    }
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#000';
  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 2000; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeBumpFromColor(texture) {
  const canvas = document.createElement('canvas');
  canvas.width = texture.image.width;
  canvas.height = texture.image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(texture.image, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = lum;
    data[i + 1] = lum;
    data[i + 2] = lum;
  }
  ctx.putImageData(imageData, 0, 0);
  const bump = new THREE.CanvasTexture(canvas);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = 8;
  return bump;
}

function makeTargetTexture({
  text,
  accentColor,
  icon,
  subtext,
  background = '#0b1120',
  detailColor = '#fde047'
}) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);

  const center = size / 2;
  const radius = size * 0.42;
  const gradient = ctx.createRadialGradient(center, center, radius * 0.2, center, center, radius);
  gradient.addColorStop(0, '#1f2937');
  gradient.addColorStop(1, '#111827');
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.lineWidth = size * 0.035;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(center, center, radius * 0.82, 0, Math.PI * 2);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = size * 0.03;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(center, center, radius * 0.6, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = size * 0.02;
  ctx.stroke();

  if (icon) {
    ctx.font = `900 ${Math.floor(size * 0.24)}px "Segoe UI Emoji", "Apple Color Emoji", "Twemoji Mozilla", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, center, center - size * 0.14);
  }

  if (text) {
    ctx.font = `800 ${Math.floor(size * 0.2)}px "Montserrat", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = detailColor;
    ctx.fillText(text, center, center + (icon ? size * 0.02 : 0));
  }

  if (subtext) {
    ctx.font = `700 ${Math.floor(size * 0.12)}px "Montserrat", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.fillText(subtext, center, center + size * 0.22);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const GOAL_CONFIG = {
  width: 7.32,
  height: 2.44,
  depthTop: 0.8,
  depthBottom: 2.0,
  postDiameter: 0.12,
  z: -10.2
};

const MIN_GOAL_POINTS = 5;
const TIMER_BONUS_OPTIONS = Object.freeze([10, 15, 20]);
const BOMB_TIME_PENALTY = 15;
const BOMB_SCORE_PENALTY = 50;
const BOMB_RESET_DELAY = 0.7;

const PENALTY_AREA_DEPTH = 16.5;
const BALL_PENALTY_BUFFER = 1.5; // ensures kick is taken outside of the box
const BALL_RADIUS = 0.184; // 20% smaller ball for tighter mobile play
const GRAVITY = new THREE.Vector3(0, -9.81 * 0.35, 0);
const AIR_DRAG = 0.0006;
const FRICTION = 0.995;
const MAGNUS_COEFFICIENT = 0.045;
const RESTITUTION = 0.45;
const GROUND_Y = 0;
const START_Z = GOAL_CONFIG.z + PENALTY_AREA_DEPTH + BALL_PENALTY_BUFFER;
const DEFENDER_WALL_Z = 1.2; // legacy spot where the ball used to start
const SHOOT_POWER_SCALE = 2.25; // additional top-end power for faster, punchier strikes
const SHOOT_VERTICAL_POWER_MIN = 0.38;
const SHOOT_VERTICAL_POWER_MAX = 0.58;
const SHOOT_VERTICAL_FULL_POWER_THRESHOLD = 0.68;
const MAX_BASE_SHOT_POWER = 36;
const MAX_SHOT_POWER = MAX_BASE_SHOT_POWER * SHOOT_POWER_SCALE;
const BASE_SPIN_SCALE = 1.6;
const SPIN_SCALE = BASE_SPIN_SCALE * 1.35;
const CROSSBAR_HEIGHT_MARGIN = 0.2;
const SOLVER_MAX_ITERATIONS = 8;
const SOLVER_TARGET_EPSILON = 0.0012;
const SOLVER_DELTA_AZIMUTH = 0.008;
const SOLVER_DELTA_SLOPE = 0.008;
const CURVE_SWIPE_INFLUENCE = 0; // prioritize the target over swipe variance for pinpoint accuracy
const MAX_VERTICAL_LAUNCH_SPEED = Math.sqrt(
  Math.max(
    0,
    2 * Math.abs(GRAVITY.y) * Math.max(0, GOAL_CONFIG.height + CROSSBAR_HEIGHT_MARGIN - BALL_RADIUS)
  )
);
const DEFENDER_JUMP_VELOCITY = 3.6;
const DEFENDER_GRAVITY_SCALE = 0.85;
const DEFENDER_MAX_OFFSET = GOAL_CONFIG.width * 0.48;
const KEEPER_RETURN_EASE = 0.05;
const KEEPER_CENTER_EASE = 0.08;
const TARGET_PADDING_X = 0.35;
const TARGET_PADDING_Y = 0.28;
const TARGET_SEPARATION = 0.32;
const FIXED_TIME_STEP = 1 / 60;
const MAX_FRAME_DELTA = 0.08;
const MAX_ACCUMULATED_TIME = 0.24;
const CAMERA_IDLE_POSITION = new THREE.Vector3(0, 1.82, START_Z + 4.1);
const CAMERA_IDLE_FOCUS = new THREE.Vector3(0, 1.48, GOAL_CONFIG.z);
const CAMERA_ACTIVE_MIN_DISTANCE = 3.4;
const CAMERA_ACTIVE_MAX_DISTANCE = 8.6;
const CAMERA_LATERAL_CLAMP = 3.6;
const CAMERA_IDLE_LERP = 0.1;
const CAMERA_ACTIVE_LERP = 0.18;
const CAMERA_SHAKE_DECAY = 3.5;
const SOUND_SOURCES = {
  crowd: encodeURI('/assets/sounds/football-crowd-3-69245.mp3'),
  whistle: encodeURI('/assets/sounds/metal-whistle-6121.mp3'),
  goal: encodeURI('/assets/sounds/goal net origjinal (2).mp3'),
  kick: encodeURI('/assets/sounds/ball kick .mp3')
};
export default function FreeKick3DGame({ config }) {
  const hostRef = useRef(null);
  const threeRef = useRef(null);
  const gestureRef = useRef({ start: null, last: null, pointerId: null, history: [], plan: null });
  const messageTimeoutRef = useRef(null);
  const resetTimeoutRef = useRef(null);
  const gameStateRef = useRef({ gameOver: false });
  const audioRef = useRef({
    started: false,
    crowd: null,
    whistle: null,
    goal: null,
    kick: null
  });

  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(0);
  const [goals, setGoals] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.duration ?? 60);
  const [isRunning, setIsRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState(INSTRUCTION_TEXT);

  const playerName = useMemo(() => config.playerName || 'Player', [config.playerName]);
  const playDuration = useMemo(() => Math.max(10, Number(config.duration) || 60), [config.duration]);

  const playWhistle = useCallback(() => {
    const { whistle } = audioRef.current;
    if (!whistle) return;
    whistle.currentTime = 0;
    whistle.play().catch(() => {});
    window.setTimeout(() => {
      whistle.pause();
      whistle.currentTime = 0;
    }, 1800);
  }, []);

  const playGoalSound = useCallback(() => {
    const { goal } = audioRef.current;
    if (!goal) return;
    goal.currentTime = 0;
    goal.play().catch(() => {});
  }, []);

  const playKickSound = useCallback(() => {
    const { kick } = audioRef.current;
    if (!kick) return;
    kick.currentTime = 0;
    kick.play().catch(() => {});
  }, []);

  const startCrowdSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio.crowd) return;
    audio.started = true;
    if (audio.crowd.paused) {
      audio.crowd.currentTime = 0;
    }
    audio.crowd.play().catch(() => {});
  }, []);

  const pauseCrowdSound = useCallback(() => {
    const { crowd } = audioRef.current;
    if (!crowd) return;
    crowd.pause();
  }, []);

  useEffect(() => {
    setTimeLeft(playDuration);
    setScore(0);
    setShots(0);
    setGoals(0);
    setIsRunning(false);
    setGameOver(false);
    setMessage(INSTRUCTION_TEXT);
    gestureRef.current.start = null;
    gestureRef.current.last = null;
    gestureRef.current.history = [];
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    if (threeRef.current?.resetBall) {
      threeRef.current.resetBall();
    }
  }, [playDuration]);

  useEffect(() => {
    if (typeof Audio === 'undefined') return undefined;
    const crowd = new Audio(SOUND_SOURCES.crowd);
    crowd.loop = true;
    crowd.volume = 0.5;
    const whistle = new Audio(SOUND_SOURCES.whistle);
    const goal = new Audio(SOUND_SOURCES.goal);
    goal.volume = 1;
    const kick = new Audio(SOUND_SOURCES.kick);
    kick.volume = 1;

    audioRef.current.crowd = crowd;
    audioRef.current.whistle = whistle;
    audioRef.current.goal = goal;
    audioRef.current.kick = kick;
    audioRef.current.started = false;

    return () => {
      [crowd, whistle, goal, kick].forEach((audio) => {
        if (!audio) return;
        audio.pause();
        audio.src = '';
      });
      audioRef.current.crowd = null;
      audioRef.current.whistle = null;
      audioRef.current.goal = null;
      audioRef.current.kick = null;
      audioRef.current.started = false;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy?.() ?? 1;
    const texturesToDispose = [];
    const registerTexture = (texture) => {
      if (texture) {
        texturesToDispose.push(texture);
      }
      return texture;
    };
    const configureGrassTexture = (texture, repeatX, repeatZ) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeatX, repeatZ);
      texture.anisotropy = Math.min(8, maxAnisotropy);
      texture.colorSpace = THREE.SRGBColorSpace;
    };
    const applyGrassTexture = (texture, material, repeatX, repeatZ) => {
      configureGrassTexture(texture, repeatX, repeatZ);
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
      registerTexture(texture);
    };
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin?.('anonymous');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.03).texture;

    const camera = new THREE.PerspectiveCamera(55, host.clientWidth / host.clientHeight, 0.1, 240);
    camera.position.copy(CAMERA_IDLE_POSITION);
    camera.lookAt(CAMERA_IDLE_FOCUS);
    camera.up.set(0, 1, 0);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.7);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(-4, 6, 5.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    scene.add(sun);

    const fieldGroup = new THREE.Group();

    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(21, 32),
      new THREE.MeshStandardMaterial({ color: 0x0b2012, roughness: 0.98, metalness: 0.02 })
    );
    apron.rotation.x = -Math.PI / 2;
    apron.receiveShadow = true;
    apron.position.y = -0.018;
    fieldGroup.add(apron);

    const surroundMaterial = new THREE.MeshStandardMaterial({ color: 0x14522a, roughness: 0.95, metalness: 0.04 });
    const surround = new THREE.Mesh(new THREE.PlaneGeometry(16.5, 28.5), surroundMaterial);
    surround.rotation.x = -Math.PI / 2;
    surround.receiveShadow = true;
    surround.position.y = -0.009;
    fieldGroup.add(surround);

    const pitchMaterial = new THREE.MeshStandardMaterial({
      color: 0x1f7a32,
      roughness: 0.92,
      metalness: 0.04
    });
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(14, 26), pitchMaterial);
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    fieldGroup.add(pitch);

    const applySharedGrassTexture = (baseTexture) => {
      applyGrassTexture(baseTexture, pitchMaterial, 7.5, 14.5);
      const surroundTexture = baseTexture.clone();
      surroundTexture.image = baseTexture.image;
      applyGrassTexture(surroundTexture, surroundMaterial, 5, 9.5);
    };

    textureLoader.load(
      FIELD_TEXTURE_URL,
      (texture) => {
        applySharedGrassTexture(texture);
      },
      undefined,
      () => {
        applySharedGrassTexture(createFallbackGrassTexture());
      }
    );

    const goalWidth = GOAL_CONFIG.width;
    const goalHeight = GOAL_CONFIG.height;
    const goalDepthTop = GOAL_CONFIG.depthTop;
    const goalDepthBottom = GOAL_CONFIG.depthBottom;
    const goalZ = GOAL_CONFIG.z;
    const postDiameter = GOAL_CONFIG.postDiameter ?? 0.12;
    const postRadius = postDiameter / 2;

    const pitchWidth = pitch.geometry.parameters.width ?? 0;
    const pitchHalfWidth = pitchWidth / 2;
    const markings = new THREE.Group();
    markings.position.y = 0.002;
    const lineMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.1
    });
    const lineThickness = 0.12;
    const addLine = (width, depth, position) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.004, depth), lineMaterial);
      mesh.position.copy(position);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      markings.add(mesh);
      return mesh;
    };

    const penaltyAreaDepth = PENALTY_AREA_DEPTH;
    const goalAreaDepth = 5.5;
    const penaltySpotDistance = 11;
    const availableSideSpace = Math.max(0.1, pitchHalfWidth - goalWidth / 2);
    const clampedSideSpace = Math.max(availableSideSpace, 0);
    const penaltyAreaExtraX = Math.min(PENALTY_AREA_DEPTH, clampedSideSpace);
    const widthScale = penaltyAreaExtraX > 0 ? penaltyAreaExtraX / PENALTY_AREA_DEPTH : 0;
    const goalAreaExtraX = Math.min(clampedSideSpace, Math.max(0.3, 5.5 * widthScale));
    const penaltyAreaHalfWidth = goalWidth / 2 + penaltyAreaExtraX;
    const goalAreaHalfWidth = goalWidth / 2 + goalAreaExtraX;
    const goalAreaFrontZ = goalZ + goalAreaDepth;
    const penaltyAreaFrontZ = goalZ + penaltyAreaDepth;

    addLine(pitchWidth, lineThickness, new THREE.Vector3(0, 0, goalZ));

    addLine(penaltyAreaHalfWidth * 2, lineThickness, new THREE.Vector3(0, 0, penaltyAreaFrontZ));
    addLine(
      lineThickness,
      penaltyAreaDepth,
      new THREE.Vector3(penaltyAreaHalfWidth, 0, goalZ + penaltyAreaDepth / 2)
    );
    addLine(
      lineThickness,
      penaltyAreaDepth,
      new THREE.Vector3(-penaltyAreaHalfWidth, 0, goalZ + penaltyAreaDepth / 2)
    );

    addLine(goalAreaHalfWidth * 2, lineThickness, new THREE.Vector3(0, 0, goalAreaFrontZ));
    addLine(lineThickness, goalAreaDepth, new THREE.Vector3(goalAreaHalfWidth, 0, goalZ + goalAreaDepth / 2));
    addLine(
      lineThickness,
      goalAreaDepth,
      new THREE.Vector3(-goalAreaHalfWidth, 0, goalZ + goalAreaDepth / 2)
    );

    const penaltySpotZ = goalZ + penaltySpotDistance;
    const penaltySpot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.004, 32), lineMaterial);
    penaltySpot.position.set(0, 0.002, penaltySpotZ);
    penaltySpot.castShadow = false;
    penaltySpot.receiveShadow = false;
    markings.add(penaltySpot);

    const penaltyArcDepth = penaltyAreaFrontZ - penaltySpotZ;
    const maxArcRadius = Math.sqrt(
      Math.max(penaltyAreaHalfWidth * penaltyAreaHalfWidth + penaltyArcDepth * penaltyArcDepth, 0.01)
    );
    const penaltyArcRadius = Math.min(9.15, maxArcRadius);
    if (penaltyArcRadius > penaltyArcDepth + 0.01) {
      const depthRatio = THREE.MathUtils.clamp(penaltyArcDepth / penaltyArcRadius, -0.999, 0.999);
      const arcOffset = Math.asin(depthRatio);
      const arcStart = Math.PI + arcOffset;
      const arcLength = Math.max(0.1, Math.PI - 2 * arcOffset);
      const penaltyArc = new THREE.Mesh(
        new THREE.RingGeometry(
          penaltyArcRadius - lineThickness / 2,
          penaltyArcRadius + lineThickness / 2,
          72,
          1,
          arcStart,
          arcLength
        ),
        lineMaterial
      );
      penaltyArc.rotation.x = -Math.PI / 2;
      penaltyArc.position.set(0, 0.002, penaltySpotZ);
      penaltyArc.castShadow = false;
      penaltyArc.receiveShadow = false;
      markings.add(penaltyArc);
    }

    fieldGroup.add(markings);
    scene.add(fieldGroup);

    const depthAtHeight = (height) => {
      const clamped = THREE.MathUtils.clamp((height - postRadius) / Math.max(0.0001, goalHeight - postRadius), 0, 1);
      return THREE.MathUtils.lerp(goalDepthBottom, goalDepthTop, clamped);
    };

    const postMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.05,
      clearcoat: 0.3
    });
    const goal = new THREE.Group();
    const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 32), postMaterial);
    leftPost.castShadow = true;
    leftPost.receiveShadow = true;
    leftPost.position.set(-goalWidth / 2, goalHeight / 2, goalZ);
    goal.add(leftPost);
    const rightPost = leftPost.clone();
    rightPost.position.x = goalWidth / 2;
    goal.add(rightPost);
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalWidth, 32), postMaterial);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, goalHeight, goalZ);
    crossbar.castShadow = true;
    crossbar.receiveShadow = true;
    goal.add(crossbar);

    const makeTubeBetween = (start, end, radius, material) => {
      const direction = new THREE.Vector3().subVectors(end, start);
      const length = direction.length();
      if (length <= 1e-6) return null;
      const geometry = new THREE.CylinderGeometry(radius, radius, length, 24);
      const mesh = new THREE.Mesh(geometry, material);
      const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      mesh.position.copy(midpoint);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    const frontLeftTop = new THREE.Vector3(-goalWidth / 2, goalHeight, goalZ);
    const frontRightTop = new THREE.Vector3(goalWidth / 2, goalHeight, goalZ);
    const frontLeftBottom = new THREE.Vector3(-goalWidth / 2, postRadius, goalZ);
    const frontRightBottom = new THREE.Vector3(goalWidth / 2, postRadius, goalZ);
    const rearLeftTop = new THREE.Vector3(-goalWidth / 2, goalHeight, goalZ - goalDepthTop);
    const rearRightTop = new THREE.Vector3(goalWidth / 2, goalHeight, goalZ - goalDepthTop);
    const rearLeftBottom = new THREE.Vector3(-goalWidth / 2, postRadius, goalZ - goalDepthBottom);
    const rearRightBottom = new THREE.Vector3(goalWidth / 2, postRadius, goalZ - goalDepthBottom);

    [
      makeTubeBetween(frontLeftBottom, rearLeftBottom, postRadius * 0.9, postMaterial),
      makeTubeBetween(frontRightBottom, rearRightBottom, postRadius * 0.9, postMaterial),
      makeTubeBetween(rearLeftBottom, rearRightBottom, postRadius * 0.9, postMaterial),
      makeTubeBetween(frontLeftTop, rearLeftTop, postRadius * 0.85, postMaterial),
      makeTubeBetween(frontRightTop, rearRightTop, postRadius * 0.85, postMaterial),
      makeTubeBetween(rearLeftTop, rearRightTop, postRadius * 0.85, postMaterial),
      makeTubeBetween(rearLeftTop, rearLeftBottom, postRadius * 0.8, postMaterial),
      makeTubeBetween(rearRightTop, rearRightBottom, postRadius * 0.8, postMaterial)
    ]
      .filter(Boolean)
      .forEach((mesh) => goal.add(mesh));

    const createFrameCollider = (start, end, radius, overrides = {}) => ({
      start: start.clone(),
      end: end.clone(),
      radius,
      restitution: 1.12,
      velocityDamping: 0.8,
      spinDamping: 0.72,
      slop: 0.0025,
      ...overrides
    });

    const structureColliders = [
      createFrameCollider(new THREE.Vector3(-goalWidth / 2, GROUND_Y, goalZ), new THREE.Vector3(-goalWidth / 2, goalHeight, goalZ), postRadius, {
        restitution: 1.28,
        slop: 0.002
      }),
      createFrameCollider(new THREE.Vector3(goalWidth / 2, GROUND_Y, goalZ), new THREE.Vector3(goalWidth / 2, goalHeight, goalZ), postRadius, {
        restitution: 1.28,
        slop: 0.002
      }),
      createFrameCollider(
        new THREE.Vector3(-goalWidth / 2 + postRadius * 0.9, goalHeight, goalZ),
        new THREE.Vector3(goalWidth / 2 - postRadius * 0.9, goalHeight, goalZ),
        postRadius,
        { restitution: 1.22 }
      ),
      createFrameCollider(frontLeftBottom, rearLeftBottom, postRadius * 0.9, { restitution: 0.92 }),
      createFrameCollider(frontRightBottom, rearRightBottom, postRadius * 0.9, { restitution: 0.92 }),
      createFrameCollider(rearLeftBottom, rearRightBottom, postRadius * 0.9, { restitution: 0.95 }),
      createFrameCollider(frontLeftTop, rearLeftTop, postRadius * 0.85, { restitution: 1.05 }),
      createFrameCollider(frontRightTop, rearRightTop, postRadius * 0.85, { restitution: 1.05 }),
      createFrameCollider(rearLeftTop, rearRightTop, postRadius * 0.85, { restitution: 1.05 }),
      createFrameCollider(rearLeftTop, rearLeftBottom, postRadius * 0.8, { restitution: 0.98 }),
      createFrameCollider(rearRightTop, rearRightBottom, postRadius * 0.8, { restitution: 0.98 })
    ];

    const netTexture = (() => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      const radius = 36;
      const outlineWidth = radius * 0.66;
      const innerWidth = radius * 0.46;
      const patternWidth = radius * 3.2;
      const patternHeight = Math.sqrt(3) * radius;
      const drawHex = (cx, cy) => {
        ctx.save();
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const angle = (Math.PI / 3) * i + Math.PI / 6;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.shadowColor = 'rgba(0,0,0,0.55)';
        ctx.shadowBlur = 4.2;
        ctx.lineWidth = outlineWidth;
        ctx.strokeStyle = '#0b1120';
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.lineWidth = innerWidth;
        ctx.strokeStyle = '#fde047';
        ctx.stroke();
        ctx.restore();
      };
      for (let y = -patternHeight; y < size + patternHeight; y += patternHeight) {
        for (let x = -patternWidth; x < size + patternWidth; x += patternWidth) {
          const offset = Math.floor(y / patternHeight) % 2 ? 1.5 * radius : 0;
          drawHex(x + offset, y);
        }
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(3, 3);
      texture.anisotropy = 8;
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    })();

    const netMaterial = new THREE.MeshPhysicalMaterial({
      map: netTexture,
      transparent: true,
      alphaMap: netTexture,
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0.08,
      transmission: 0,
      clearcoat: 0.2,
      clearcoatRoughness: 0.5,
      alphaTest: 0.35
    });

    const buildBackNetGeometry = () => {
      const segmentsX = 48;
      const segmentsY = 28;
      const vertexCount = (segmentsX + 1) * (segmentsY + 1);
      const positions = new Float32Array(vertexCount * 3);
      const uvs = new Float32Array(vertexCount * 2);
      let index = 0;
      let uvIndex = 0;
      for (let y = 0; y <= segmentsY; y += 1) {
        const v = y / segmentsY;
        const heightY = THREE.MathUtils.lerp(postRadius, goalHeight, v);
        const depth = depthAtHeight(heightY);
        for (let x = 0; x <= segmentsX; x += 1) {
          const u = x / segmentsX;
          const posX = THREE.MathUtils.lerp(-goalWidth / 2, goalWidth / 2, u);
          positions[index] = posX;
          positions[index + 1] = heightY;
          positions[index + 2] = goalZ - depth;
          uvs[uvIndex] = u;
          uvs[uvIndex + 1] = v;
          index += 3;
          uvIndex += 2;
        }
      }
      const indices = [];
      for (let y = 0; y < segmentsY; y += 1) {
        for (let x = 0; x < segmentsX; x += 1) {
          const a = y * (segmentsX + 1) + x;
          const b = a + 1;
          const c = (y + 1) * (segmentsX + 1) + x;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };

    const buildSideNetGeometry = (isLeft) => {
      const segmentsDepth = 36;
      const segmentsHeight = 28;
      const vertexCount = (segmentsDepth + 1) * (segmentsHeight + 1);
      const positions = new Float32Array(vertexCount * 3);
      const uvs = new Float32Array(vertexCount * 2);
      let index = 0;
      let uvIndex = 0;
      for (let y = 0; y <= segmentsHeight; y += 1) {
        const v = y / segmentsHeight;
        const heightY = THREE.MathUtils.lerp(postRadius, goalHeight, v);
        const depth = depthAtHeight(heightY);
        for (let x = 0; x <= segmentsDepth; x += 1) {
          const u = x / segmentsDepth;
          const dir = isLeft ? -1 : 1;
          const worldX = dir * goalWidth * 0.5;
          positions[index] = worldX;
          positions[index + 1] = heightY;
          positions[index + 2] = goalZ - depth * u;
          uvs[uvIndex] = isLeft ? u : 1 - u;
          uvs[uvIndex + 1] = v;
          index += 3;
          uvIndex += 2;
        }
      }
      const indices = [];
      for (let y = 0; y < segmentsHeight; y += 1) {
        for (let x = 0; x < segmentsDepth; x += 1) {
          const a = y * (segmentsDepth + 1) + x;
          const b = a + 1;
          const c = (y + 1) * (segmentsDepth + 1) + x;
          const d = c + 1;
          if (isLeft) {
            indices.push(a, c, b, b, c, d);
          } else {
            indices.push(a, b, c, b, d, c);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };

    const buildRoofNetGeometry = () => {
      const segmentsDepth = 28;
      const segmentsWidth = 48;
      const vertexCount = (segmentsDepth + 1) * (segmentsWidth + 1);
      const positions = new Float32Array(vertexCount * 3);
      const uvs = new Float32Array(vertexCount * 2);
      const sag = 0.12;
      let index = 0;
      let uvIndex = 0;
      for (let zStep = 0; zStep <= segmentsDepth; zStep += 1) {
        const u = zStep / segmentsDepth;
        const depth = THREE.MathUtils.lerp(0, goalDepthTop, u);
        const sagFactorDepth = 1 - Math.pow(u, 2);
        for (let xStep = 0; xStep <= segmentsWidth; xStep += 1) {
          const v = xStep / segmentsWidth;
          const widthPos = THREE.MathUtils.lerp(-goalWidth / 2, goalWidth / 2, v);
          const sagAcross = 1 - Math.pow(2 * v - 1, 2);
          const drop = sag * sagFactorDepth * sagAcross;
          positions[index] = widthPos;
          positions[index + 1] = goalHeight - drop;
          positions[index + 2] = goalZ - depth;
          uvs[uvIndex] = v;
          uvs[uvIndex + 1] = u;
          index += 3;
          uvIndex += 2;
        }
      }
      const indices = [];
      for (let zStep = 0; zStep < segmentsDepth; zStep += 1) {
        for (let xStep = 0; xStep < segmentsWidth; xStep += 1) {
          const a = zStep * (segmentsWidth + 1) + xStep;
          const b = a + 1;
          const c = (zStep + 1) * (segmentsWidth + 1) + xStep;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    };

    const backNet = new THREE.Mesh(buildBackNetGeometry(), netMaterial);
    const leftNet = new THREE.Mesh(buildSideNetGeometry(true), netMaterial);
    const rightNet = new THREE.Mesh(buildSideNetGeometry(false), netMaterial);
    const roofNet = new THREE.Mesh(buildRoofNetGeometry(), netMaterial);
    goal.add(backNet, leftNet, rightNet, roofNet);

    const netSim = createNetSimulation(backNet);

    const billboardConfigs = [
      { text: 'TONPLAY', color: '#0ea5e9', widthMultiplier: 1.32 },
      { text: 'GRAM ARENA', color: '#22c55e', widthMultiplier: 1.0 },
      { text: 'FREE KICK LIVE', color: '#f97316', widthMultiplier: 1.32 }
    ];
    const billboardHeight = 1.1;
    const baseBillboardWidth = goalWidth / 3.2;
    const billboardMargin = baseBillboardWidth * 0.2;
    const billboardWidths = billboardConfigs.map((config) => baseBillboardWidth * (config.widthMultiplier ?? 1));
    const totalBillboardWidth = billboardWidths.reduce((sum, width) => sum + width, 0) +
      billboardMargin * (billboardConfigs.length - 1);
    const billboardBaseY = billboardHeight / 2 + 0.02;
    const billboardZ = goalZ - goalDepthBottom - 1.35;
    const billboardGroup = new THREE.Group();
    const billboardFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.42,
      metalness: 0.55
    });
    const billboardAnimations = [];
    const fieldFacingTarget = new THREE.Vector3();
    const orientTowardsField = (mesh, targetZOffset = 2.4, rotateFront = false) => {
      fieldFacingTarget.set(mesh.position.x, mesh.position.y, goalZ + targetZOffset);
      mesh.lookAt(fieldFacingTarget);
      if (rotateFront) {
        mesh.rotateY(Math.PI);
      }
    };
    let billboardCursor = -totalBillboardWidth / 2;
    billboardConfigs.forEach((config, index) => {
      const width = billboardWidths[index];
      const frameSize = 24 + (config.widthMultiplier ?? 1) * 6;
      const texture = makeBillboardTexture(config.text, config.color, frameSize);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        emissive: new THREE.Color(config.color).multiplyScalar(0.25),
        emissiveIntensity: 1.4,
        roughness: 0.5,
        metalness: 0.2
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, billboardHeight), material);
      const frameThicknessWorld = Math.max(0.12, width * 0.04);
      const frameDepth = 0.08;
      const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(width + frameThicknessWorld * 2, frameThicknessWorld, frameDepth),
        billboardFrameMaterial
      );
      topBar.position.set(0, billboardHeight / 2 + frameThicknessWorld / 2, frameDepth * 0.5);
      const bottomBar = topBar.clone();
      bottomBar.position.y = -topBar.position.y;
      const sideBarGeo = new THREE.BoxGeometry(
        frameThicknessWorld,
        billboardHeight + frameThicknessWorld * 2,
        frameDepth
      );
      const leftBar = new THREE.Mesh(sideBarGeo, billboardFrameMaterial);
      leftBar.position.set(-width / 2 - frameThicknessWorld / 2, 0, frameDepth * 0.5);
      const rightBar = leftBar.clone();
      rightBar.position.x = -leftBar.position.x;
      [topBar, bottomBar, leftBar, rightBar].forEach((bar) => {
        bar.castShadow = false;
        bar.receiveShadow = false;
        mesh.add(bar);
      });
      const centerX = billboardCursor + width / 2;
      mesh.position.set(centerX, billboardBaseY, billboardZ);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      orientTowardsField(mesh, 2.4);
      billboardGroup.add(mesh);
      texture.repeat.set((width / baseBillboardWidth) * 2.5, 1);
      texture.offset.x = Math.random();
      billboardAnimations.push({ texture, speed: 0.12 + index * 0.04 });
      billboardCursor += width + billboardMargin;
    });
    scene.add(billboardGroup);

    const standSeatMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x15306d,
      roughness: 0.26,
      metalness: 0.28,
      clearcoat: 0.45,
      clearcoatRoughness: 0.2,
      sheen: 0.35,
      sheenColor: new THREE.Color(0x6fa0ff)
    });
    const standFrameMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x333333,
      roughness: 0.48,
      metalness: 0.55,
      clearcoat: 0.2,
      clearcoatRoughness: 0.4
    });
    const standConcreteMaterial = new THREE.MeshStandardMaterial({
      color: 0x7b7b7b,
      roughness: 0.82,
      metalness: 0.08
    });
    const standMetalMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xb5b5b5,
      roughness: 0.32,
      metalness: 0.82,
      clearcoat: 0.35,
      clearcoatRoughness: 0.18
    });

    const standSeatGeo = new THREE.BoxGeometry(1.4, 0.15, 1.2, 4, 2, 4);
    const standBackGeo = new THREE.BoxGeometry(1.4, 0.8, 0.1, 4, 2, 1);
    const standLegGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 16);
    const standStepGeo = new THREE.BoxGeometry(32, 0.4, 1.8, 8, 1, 2);
    const walkwayGeo = new THREE.BoxGeometry(8, 0.4, 20, 4, 1, 6);

    const STAND_ROWS = 8;
    const STAND_SEATS_PER_ROW = 18;
    const STAND_ROW_RISE = 0.82;
    const STAND_ROW_DEPTH = 1.8;
    const STAND_CENTRAL_AISLE_INDICES = new Set([
      Math.floor(STAND_SEATS_PER_ROW / 2) - 1,
      Math.floor(STAND_SEATS_PER_ROW / 2)
    ]);

    const suiteGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xbcdfff,
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
      transmission: 0.88,
      ior: 1.45
    });
    const suiteFrameMaterial = new THREE.MeshStandardMaterial({ color: 0x3d454f, roughness: 0.48, metalness: 0.62 });
    const suiteMullionMaterial = new THREE.MeshStandardMaterial({ color: 0x1f242c, roughness: 0.5, metalness: 0.6 });
    const suiteRoofMaterial = new THREE.MeshStandardMaterial({ color: 0x202126, roughness: 0.32, metalness: 0.7 });
    const suiteGeo = new THREE.BoxGeometry(9.2, 4.8, 13);
    const suiteFrameGeo = new THREE.BoxGeometry(10.4, 5.9, 14.6);
    const suiteRoofGeo = new THREE.BoxGeometry(11.2, 0.6, 15);
    const suiteDeckGeo = new THREE.BoxGeometry(78, 0.5, 16);
    const suiteWindowGeo = new THREE.BoxGeometry(3.8, 1.8, 9.2);
    const suiteMullionGeo = new THREE.BoxGeometry(0.28, 1.8, 9.4);
    const suiteTransomGeo = new THREE.BoxGeometry(3.8, 0.24, 9.4);

    function createStandSection(offsetX = 0, baseY = 0, depthOffset = 0) {
      const section = new THREE.Group();

      for (let r = 0; r < STAND_ROWS; r += 1) {
        for (let c = 0; c < STAND_SEATS_PER_ROW; c += 1) {
          if (STAND_CENTRAL_AISLE_INDICES.has(c)) {
            continue;
          }

          const x = c * 1.7 - (STAND_SEATS_PER_ROW * 1.7) / 2 + offsetX;

          const seat = new THREE.Mesh(standSeatGeo, standSeatMaterial);
          const back = new THREE.Mesh(standBackGeo, standSeatMaterial);
          const leftLeg = new THREE.Mesh(standLegGeo, standFrameMaterial);
          const rightLeg = new THREE.Mesh(standLegGeo, standFrameMaterial);

          const y = baseY + r * STAND_ROW_RISE;
          const z = -r * STAND_ROW_DEPTH + depthOffset;

          seat.position.set(x, y, z);
          back.position.set(x, y + 0.45, z - 0.55);
          leftLeg.position.set(x - 0.6, y - 0.35, z + 0.4);
          rightLeg.position.set(x + 0.6, y - 0.35, z + 0.4);

          section.add(seat, back, leftLeg, rightLeg);
        }

        const step = new THREE.Mesh(standStepGeo, standConcreteMaterial);
        step.position.set(offsetX, baseY + r * STAND_ROW_RISE - 0.4, -r * STAND_ROW_DEPTH - 0.9 + depthOffset);
        section.add(step);
      }
      return section;
    }

    const standsGroup = new THREE.Group();
    const tierConfigs = [
      { baseY: 0, depthOffset: 0 },
      { baseY: 6, depthOffset: -15 },
      { baseY: 12, depthOffset: -30 },
      { baseY: 18, depthOffset: -45 }
    ];
    tierConfigs.forEach(({ baseY, depthOffset }) => {
      const leftStand = createStandSection(-15, baseY, depthOffset);
      const rightStand = createStandSection(15, baseY, depthOffset);
      const walkway = new THREE.Mesh(walkwayGeo, standConcreteMaterial);
      walkway.position.set(0, baseY - 0.4, -6 + depthOffset);
      walkway.castShadow = false;
      walkway.receiveShadow = true;
      standsGroup.add(leftStand, rightStand, walkway);
    });

    const topTierConfig = tierConfigs[tierConfigs.length - 1];
    const topRowY = topTierConfig.baseY + (STAND_ROWS - 1) * STAND_ROW_RISE;
    const topRowZ = -((STAND_ROWS - 1) * STAND_ROW_DEPTH) + topTierConfig.depthOffset;
    const suiteBaseY = topRowY + 1.2;
    const suiteCenterZ = topRowZ - 6.5;
    const terraceGroup = new THREE.Group();
    const suiteDeck = new THREE.Mesh(suiteDeckGeo, standConcreteMaterial);
    const deckHeight = suiteBaseY - suiteDeckGeo.parameters.height / 2;
    suiteDeck.position.set(0, deckHeight, 0);
    suiteDeck.castShadow = true;
    suiteDeck.receiveShadow = true;
    terraceGroup.add(suiteDeck);

    const terraceSupportMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x2a2a2a,
      roughness: 0.42,
      metalness: 0.78,
      clearcoat: 0.12,
      clearcoatRoughness: 0.35
    });
    const terraceSupportHeight = Math.max(0.1, deckHeight);
    const terraceSupportGeo = new THREE.CylinderGeometry(0.6, 0.6, terraceSupportHeight, 18);
    const supportOffsetsX = [-30, -15, 0, 15, 30];
    const supportOffsetZ = suiteDeckGeo.parameters.depth / 2 - 1.2;
    supportOffsetsX.forEach((offsetX) => {
      [supportOffsetZ, -supportOffsetZ].forEach((offsetZ) => {
        const support = new THREE.Mesh(terraceSupportGeo, terraceSupportMaterial);
        support.position.set(offsetX, terraceSupportHeight / 2, offsetZ);
        support.castShadow = true;
        support.receiveShadow = true;
        terraceGroup.add(support);
      });
    });

    terraceGroup.position.set(0, 0, suiteCenterZ);
    orientTowardsField(terraceGroup, 2.4, true);

    const suitesGroup = new THREE.Group();
    suitesGroup.add(terraceGroup);

    const canopyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1d242f,
      roughness: 0.32,
      metalness: 0.55,
      clearcoat: 0.4,
      clearcoatRoughness: 0.18,
      side: THREE.DoubleSide
    });
    const canopyWidth = 150;
    const canopyDepth = 110;
    const canopySegmentsWidth = 32;
    const canopySegmentsDepth = 16;
    const canopyGeometry = new THREE.PlaneGeometry(
      canopyWidth,
      canopyDepth,
      canopySegmentsWidth,
      canopySegmentsDepth
    );
    const canopyPositions = canopyGeometry.attributes.position;
    for (let i = 0; i < canopyPositions.count; i += 1) {
      const x = canopyPositions.getX(i);
      const y = canopyPositions.getY(i);
      const normalizedX = x / (canopyWidth / 2);
      const normalizedY = (y + canopyDepth / 2) / canopyDepth;
      const arch = Math.pow(Math.max(0, 1 - normalizedX * normalizedX), 1.1);
      const lift = 1 - Math.pow(normalizedY, 1.35);
      const rearDrop = Math.pow(normalizedY, 1.55) * 9;
      const height = 9 + arch * 11 * lift - rearDrop;
      canopyPositions.setZ(i, height);
    }
    canopyPositions.needsUpdate = true;
    canopyGeometry.computeVertexNormals();
    canopyGeometry.computeBoundingBox();
    const canopyCenterZ =
      (canopyGeometry.boundingBox.min.z + canopyGeometry.boundingBox.max.z) / 2;
    canopyGeometry.translate(0, 0, -canopyCenterZ);
    canopyGeometry.rotateX(-Math.PI / 2);
    const stadiumRoof = new THREE.Mesh(canopyGeometry, canopyMaterial);
    stadiumRoof.castShadow = true;
    stadiumRoof.receiveShadow = true;
    stadiumRoof.position.set(0, suiteBaseY + suiteGeo.parameters.height + 2.5, suiteCenterZ - 32);
    suitesGroup.add(stadiumRoof);

    const roofSupportMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a313d,
      roughness: 0.45,
      metalness: 0.6
    });
    const supportHeight = 36;
    const supportGeo = new THREE.CylinderGeometry(0.8, 0.9, supportHeight, 20);
    const roofSupports = new THREE.Group();
    for (let i = -2; i <= 2; i += 1) {
      const support = new THREE.Mesh(supportGeo, roofSupportMaterial);
      support.castShadow = true;
      support.receiveShadow = true;
      support.position.set(
        i * 22,
        suiteBaseY - 0.4 + supportHeight / 2,
        suiteCenterZ - 40
      );
      roofSupports.add(support);
    }

    const roofStrutMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x363d48,
      roughness: 0.32,
      metalness: 0.72,
      clearcoat: 0.22,
      clearcoatRoughness: 0.28
    });
    const roofStruts = new THREE.Group();
    roofSupports.children.forEach((support) => {
      const supportTop = new THREE.Vector3(
        support.position.x,
        support.position.y + supportHeight / 2,
        support.position.z
      );
      const forwardAnchor = new THREE.Vector3(
        support.position.x,
        suiteBaseY + suiteGeo.parameters.height + 6,
        suiteCenterZ - 26
      );
      const midAnchor = new THREE.Vector3(
        support.position.x,
        suiteBaseY + suiteGeo.parameters.height + 4.5,
        suiteCenterZ - 32
      );
      [forwardAnchor, midAnchor].forEach((target, index) => {
        const strut = makeTubeBetween(supportTop, target, index === 0 ? 0.55 : 0.45, roofStrutMaterial);
        if (strut) {
          strut.castShadow = true;
          strut.receiveShadow = true;
          roofStruts.add(strut);
        }
      });
    });
    for (let i = 0; i < roofSupports.children.length - 1; i += 1) {
      const leftSupport = roofSupports.children[i];
      const rightSupport = roofSupports.children[i + 1];
      const crossStart = new THREE.Vector3(
        leftSupport.position.x,
        suiteBaseY + suiteGeo.parameters.height + 4.5,
        suiteCenterZ - 32
      );
      const crossEnd = new THREE.Vector3(
        rightSupport.position.x,
        suiteBaseY + suiteGeo.parameters.height + 4.5,
        suiteCenterZ - 32
      );
      const crossBrace = makeTubeBetween(crossStart, crossEnd, 0.42, roofStrutMaterial);
      if (crossBrace) {
        crossBrace.castShadow = true;
        crossBrace.receiveShadow = true;
        roofStruts.add(crossBrace);
      }
    }
    suitesGroup.add(roofStruts);

    for (let i = -2.5; i <= 2.5; i += 1) {
      const centerX = i * 12;
      const centerY = suiteBaseY + suiteGeo.parameters.height / 2;

      const frame = new THREE.Mesh(suiteFrameGeo, suiteFrameMaterial);
      frame.position.set(centerX, centerY, suiteCenterZ);
      frame.castShadow = true;
      frame.receiveShadow = true;
      orientTowardsField(frame, 2.4, true);

      const glass = new THREE.Mesh(suiteWindowGeo, suiteGlassMaterial);
      const mullionOffsets = [
        -suiteWindowGeo.parameters.width / 6,
        suiteWindowGeo.parameters.width / 6
      ];
      mullionOffsets.forEach((offset) => {
        const mullion = new THREE.Mesh(suiteMullionGeo, suiteMullionMaterial);
        mullion.position.x = offset;
        mullion.castShadow = false;
        mullion.receiveShadow = false;
        glass.add(mullion);
      });
      const transom = new THREE.Mesh(suiteTransomGeo, suiteMullionMaterial);
      transom.position.y =
        suiteWindowGeo.parameters.height / 2 - suiteTransomGeo.parameters.height / 2 - 0.08;
      transom.castShadow = false;
      transom.receiveShadow = false;
      glass.add(transom);
      glass.position.copy(frame.position);
      orientTowardsField(glass, 2.4, true);

      const roof = new THREE.Mesh(suiteRoofGeo, suiteRoofMaterial);
      roof.position.set(
        centerX,
        centerY + suiteGeo.parameters.height / 2 + suiteRoofGeo.parameters.height / 2,
        suiteCenterZ
      );
      roof.castShadow = true;
      roof.receiveShadow = true;
      orientTowardsField(roof, 2.4, true);

      suitesGroup.add(frame, glass, roof);
    }

    standsGroup.add(suitesGroup);
    standsGroup.add(roofSupports);

    const standScale = 0.36; // 20% larger seating tiers for better presence
    standsGroup.scale.set(standScale, standScale, standScale);
    const standsOffsetZ = goalZ - goalDepthBottom - 3.3;
    standsGroup.position.set(0, 0.12, standsOffsetZ);
    scene.add(standsGroup);

    const billboardColliders = billboardGroup.children.map((mesh) => {
      const { width = baseBillboardWidth, height = billboardHeight } = mesh.geometry.parameters || {};
      return {
        mesh,
        center: new THREE.Vector3(),
        halfSize: new THREE.Vector3(width / 2, height / 2, 0.08),
        restitution: 0.58,
        velocityDamping: 0.76,
        spinDamping: 0.7
      };
    });

    const CAMERA_BASE_SCALE = 1.25;
    const createRoyalBroadcastCamera = (() => {
      const metalDark = new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        metalness: 0.7,
        roughness: 0.35
      });
      const metalLite = new THREE.MeshStandardMaterial({
        color: 0x374151,
        metalness: 0.6,
        roughness: 0.4
      });
      const plastic = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        metalness: 0.18,
        roughness: 0.46,
        emissive: new THREE.Color(0x1d4ed8).multiplyScalar(0.22),
        emissiveIntensity: 1.0
      });
      const rubber = new THREE.MeshStandardMaterial({
        color: 0x0b1220,
        metalness: 0.0,
        roughness: 0.96
      });
      const glass = new THREE.MeshStandardMaterial({
        color: 0x9bd3ff,
        metalness: 0.0,
        roughness: 0.08,
        transparent: true,
        opacity: 0.38,
        envMapIntensity: 1.3
      });

      const hubGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.06, 18);
      const legGeo = new THREE.CylinderGeometry(0.032, 0.018, 1.18, 14);
      const footGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.024, 14);
      const braceGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.7, 10);
      const columnGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.18, 16);
      const bodyGeo = new THREE.BoxGeometry(0.44, 0.24, 0.24);
      const lensTubeGeo = new THREE.CylinderGeometry(0.07, 0.075, 0.2, 24);
      const lensGlassGeo = new THREE.CircleGeometry(0.064, 24);
      const hoodGeo = new THREE.BoxGeometry(0.16, 0.12, 0.16);
      const viewfinderGeo = new THREE.BoxGeometry(0.16, 0.1, 0.09);
      const topHandleGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.28, 12);
      const panBarGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.36, 10);
      const gripGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.14, 12);
      const cableCurve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(-0.08, 0.36, 0.16),
        new THREE.Vector3(-0.22, 0.28, 0.32),
        new THREE.Vector3(-0.32, 0.12, 0.28),
        new THREE.Vector3(-0.36, 0.02, 0.08)
      );
      const cableGeo = new THREE.TubeGeometry(cableCurve, 24, 0.005, 8, false);

      const LEG_SPREAD = 0.6;
      const LEG_TILT = 0.42;
      const HUB_HEIGHT = 0.95;
      const COLUMN_HEIGHT = 0.18;
      const HEAD_HEIGHT = HUB_HEIGHT + COLUMN_HEIGHT;

      return (scale = CAMERA_BASE_SCALE) => {
        const group = new THREE.Group();
        group.name = 'royalBroadcastCamera';
        const base = new THREE.Group();
        group.add(base);

        const hub = new THREE.Mesh(hubGeo, metalLite);
        hub.position.y = HUB_HEIGHT;
        hub.castShadow = true;
        hub.receiveShadow = true;
        base.add(hub);

        const column = new THREE.Mesh(columnGeo, metalLite);
        column.position.y = HUB_HEIGHT + COLUMN_HEIGHT / 2;
        column.castShadow = true;
        column.receiveShadow = true;
        base.add(column);

        const legAngles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
        legAngles.forEach((angle) => {
          const leg = new THREE.Mesh(legGeo, metalDark);
          leg.castShadow = true;
          leg.receiveShadow = true;
          const tiltAxis = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)).normalize();
          leg.position.set(Math.cos(angle) * LEG_SPREAD * 0.42, HUB_HEIGHT - 0.6, Math.sin(angle) * LEG_SPREAD * 0.42);
          leg.quaternion.setFromAxisAngle(tiltAxis, LEG_TILT);
          base.add(leg);

          const foot = new THREE.Mesh(footGeo, rubber);
          foot.position.set(Math.cos(angle) * LEG_SPREAD, 0.012, Math.sin(angle) * LEG_SPREAD);
          foot.receiveShadow = true;
          base.add(foot);

          const from = new THREE.Vector3(0, HUB_HEIGHT, 0);
          const to = new THREE.Vector3(Math.cos(angle) * LEG_SPREAD, 0.02, Math.sin(angle) * LEG_SPREAD);
          const dir = new THREE.Vector3().subVectors(to, from);
          const brace = new THREE.Mesh(braceGeo, metalLite);
          brace.castShadow = true;
          brace.receiveShadow = true;
          brace.scale.set(1, dir.length() / 0.7, 1);
          brace.position.copy(from.clone().add(to).multiplyScalar(0.5));
          brace.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
          base.add(brace);
        });

        const headPivot = new THREE.Group();
        headPivot.position.set(0, HEAD_HEIGHT + 0.02, 0);
        base.add(headPivot);

        const cameraAssembly = new THREE.Group();
        headPivot.add(cameraAssembly);

        const body = new THREE.Mesh(bodyGeo, plastic);
        body.position.set(0, 0.2, 0);
        body.castShadow = true;
        body.receiveShadow = true;
        cameraAssembly.add(body);

        const lensTube = new THREE.Mesh(lensTubeGeo, metalDark);
        lensTube.rotation.x = Math.PI / 2;
        lensTube.position.set(0, 0.22, 0.28);
        lensTube.castShadow = true;
        lensTube.receiveShadow = true;
        cameraAssembly.add(lensTube);

        const lensGlass = new THREE.Mesh(lensGlassGeo, glass);
        lensGlass.rotation.x = Math.PI / 2;
        lensGlass.position.set(0, 0.22, 0.38);
        cameraAssembly.add(lensGlass);

        const hood = new THREE.Mesh(hoodGeo, rubber);
        hood.position.set(0, 0.22, 0.46);
        hood.castShadow = true;
        hood.receiveShadow = true;
        cameraAssembly.add(hood);

        const viewfinder = new THREE.Mesh(viewfinderGeo, metalLite);
        viewfinder.position.set(-0.22, 0.3, -0.02);
        viewfinder.castShadow = true;
        viewfinder.receiveShadow = true;
        cameraAssembly.add(viewfinder);

        const topHandle = new THREE.Mesh(topHandleGeo, rubber);
        topHandle.rotation.z = Math.PI / 2;
        topHandle.position.set(0, 0.38, 0);
        topHandle.castShadow = true;
        topHandle.receiveShadow = true;
        cameraAssembly.add(topHandle);

        const panBar = new THREE.Mesh(panBarGeo, metalLite);
        panBar.rotation.z = Math.PI / 2.4;
        panBar.position.set(0.32, 0.16, 0.12);
        panBar.castShadow = true;
        panBar.receiveShadow = true;
        headPivot.add(panBar);

        const grip = new THREE.Mesh(gripGeo, rubber);
        grip.rotation.z = Math.PI / 2.4;
        grip.position.set(0.46, 0.08, 0.12);
        grip.castShadow = true;
        grip.receiveShadow = true;
        headPivot.add(grip);

        const cable = new THREE.Mesh(cableGeo, rubber);
        cable.castShadow = true;
        cameraAssembly.add(cable);

        const bodyAnchor = new THREE.Object3D();
        bodyAnchor.position.set(0, 0.22, 0.24);
        cameraAssembly.add(bodyAnchor);

        const baseAnchor = new THREE.Object3D();
        baseAnchor.position.set(0, 0.32, 0);
        base.add(baseAnchor);

        group.scale.setScalar(scale);
        return { group, headPivot, bodyAnchor, baseAnchor };
      };
    })();

    const CAMERA_SCALE = CAMERA_BASE_SCALE * 0.6;
    const cameraOffset = goalWidth / 2 + 1.6;
    const cameraZ = goalZ - goalDepthBottom - 1.1;
    const broadcastFocus = new THREE.Vector3(0, goalHeight * 0.55, goalZ + 2.4);
    const tripodTilt = THREE.MathUtils.degToRad(-8);

    const broadcastCameras = [];
    const cameraColliders = [];

    const registerCameraRig = (rig) => {
      const scaleRatio = rig.group.scale.x / CAMERA_BASE_SCALE;
      const bodyRadius = 0.36 * scaleRatio;
      const baseRadius = 0.29 * scaleRatio;
      cameraColliders.push(
        {
          anchor: rig.bodyAnchor,
          radius: bodyRadius,
          restitution: 1.15,
          velocityDamping: 0.78,
          spinDamping: 0.72,
          slop: 0.002,
          center: new THREE.Vector3()
        },
        {
          anchor: rig.baseAnchor,
          radius: baseRadius,
          restitution: 1.1,
          velocityDamping: 0.78,
          spinDamping: 0.72,
          slop: 0.002,
          center: new THREE.Vector3()
        }
      );
      broadcastCameras.push(rig);
    };

    const orientCameraRig = (rig) => {
      const toTarget = new THREE.Vector3().subVectors(broadcastFocus, rig.group.position);
      rig.group.rotation.y = Math.atan2(toTarget.x, toTarget.z);
      scene.add(rig.group);
      rig.group.updateWorldMatrix(true, false);
      rig.headPivot.up.set(0, 1, 0);
      rig.headPivot.lookAt(broadcastFocus);
      rig.headPivot.rotateY(Math.PI);
      rig.headPivot.rotateX(tripodTilt);
      registerCameraRig(rig);
    };

    const placeCameraRig = (position) => {
      const rig = createRoyalBroadcastCamera(CAMERA_SCALE);
      rig.group.position.copy(position);
      orientCameraRig(rig);
      return rig;
    };

    placeCameraRig(new THREE.Vector3(-cameraOffset, GROUND_Y, cameraZ));
    placeCameraRig(new THREE.Vector3(cameraOffset, GROUND_Y, cameraZ));

    const suiteCameraOffsetX = standScale * (suiteDeckGeo.parameters.width / 2 + 4);
    const suiteCameraY =
      standsGroup.position.y + standScale * (suiteBaseY + suiteGeo.parameters.height * 0.6);
    const suiteCameraZ =
      standsGroup.position.z + standScale * (suiteCenterZ + suiteGeo.parameters.depth * 0.45);

    placeCameraRig(new THREE.Vector3(-suiteCameraOffsetX, suiteCameraY, suiteCameraZ));
    placeCameraRig(new THREE.Vector3(suiteCameraOffsetX, suiteCameraY, suiteCameraZ));

    scene.add(goal);

    const wallGroup = new THREE.Group();
    wallGroup.position.set(0, 0, DEFENDER_WALL_Z);
    const wallMaterial = new THREE.MeshPhysicalMaterial({ color: 0x20232a, roughness: 0.6 });
    const defenders = [];
    const defenderOffsets = [];
    const defenderBaseY = 1.1;
    for (let i = 0; i < 3; i += 1) {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.9, 4, 8), wallMaterial);
      body.castShadow = true;
      body.receiveShadow = true;
      const offsetX = (i - 1) * 0.8;
      body.position.set(offsetX, defenderBaseY, 0);
      wallGroup.add(body);
      defenders.push({ mesh: body, radius: 0.28, halfHeight: 0.7, offsetX });
      defenderOffsets.push(offsetX);
    }
    scene.add(wallGroup);

    const keeperMaterial = new THREE.MeshPhysicalMaterial({ color: 0x1c2432, roughness: 0.45 });
    const keeperMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.2, 6, 12), keeperMaterial);
    keeperMesh.castShadow = true;
    keeperMesh.receiveShadow = true;
    keeperMesh.position.set(0, 1.02, goalZ + 0.32);
    scene.add(keeperMesh);

    const targetGroup = new THREE.Group();
    targetGroup.position.set(0, 0, goalZ - 0.08);
    scene.add(targetGroup);

    const wallState = {
      group: wallGroup,
      defenders,
      offsets: defenderOffsets,
      baseY: defenderBaseY,
      centerX: 0,
      offsetY: 0,
      velocityY: 0,
      jumping: false
    };

    const keeperState = {
      mesh: keeperMesh,
      radius: 0.34,
      halfHeight: 0.92,
      baseY: keeperMesh.position.y,
      baseZ: keeperMesh.position.z,
      baseX: keeperMesh.position.x,
      targetX: keeperMesh.position.x,
      targetY: keeperMesh.position.y,
      moveEase: KEEPER_RETURN_EASE,
      side: 0
    };

    const ballTexture = makeUCLBallTexture(2048);
    const bumpMap = makeBumpFromColor(ballTexture);
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 56, 56),
      new THREE.MeshPhysicalMaterial({
        map: ballTexture,
        bumpMap,
        bumpScale: 0.01,
        roughness: 0.35,
        metalness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.25
      })
    );
    ball.castShadow = true;
    ball.receiveShadow = true;
    scene.add(ball);

    const aimLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.08, gapSize: 0.04 })
    );
    aimLine.computeLineDistances();
    aimLine.visible = false;
    scene.add(aimLine);

    const aimLineOffsets = [];
    const aimLineBaseOffset = new THREE.Vector3(0, 0.05, 0);

    const summarizeSwipe = (samples) => {
      if (!samples || samples.length < 2) {
        return { pathDistance: 0, avgDx: 0, avgDy: 0 };
      }
      let pathDistance = 0;
      let weightedDx = 0;
      let weightedDy = 0;
      let totalWeight = 0;
      for (let i = 1; i < samples.length; i += 1) {
        const prev = samples[i - 1];
        const curr = samples[i];
        const segDx = (curr.x - prev.x) / curr.w;
        const segDy = (curr.y - prev.y) / curr.h;
        const segDistance = Math.hypot(segDx, segDy);
        const segTime = Math.max(0.016, (curr.t - prev.t) / 1000);
        if (segDistance <= 1e-6) continue;
        pathDistance += segDistance;
        const weight = segTime + segDistance * 0.5;
        weightedDx += segDx * weight;
        weightedDy += segDy * weight;
        totalWeight += weight;
      }
      return {
        pathDistance,
        avgDx: totalWeight > 0 ? weightedDx / totalWeight : 0,
        avgDy: totalWeight > 0 ? weightedDy / totalWeight : 0
      };
    };

    const directionFromAzimuthSlope = (azimuth, slope) => {
      const horizontalScale = 1 / Math.sqrt(1 + slope * slope);
      return new THREE.Vector3(
        Math.sin(azimuth) * horizontalScale,
        slope * horizontalScale,
        -Math.cos(azimuth) * horizontalScale
      );
    };

    const simulateShotPreview = ({
      speed,
      azimuth,
      slope,
      spin,
      planeZ,
      collectPath = false
    }) => {
      if (!Number.isFinite(speed) || speed <= 0) {
        return { hit: false, point: ball.position.clone(), path: collectPath ? [] : null };
      }
      const dt = 1 / 180;
      const maxTime = 4.5;
      const position = ball.position.clone();
      const prevPosition = position.clone();
      const velocity = directionFromAzimuthSlope(azimuth, slope).multiplyScalar(speed);
      const spinState = spin.clone();
      const tmpForce = new THREE.Vector3();
      const path = collectPath ? [position.clone()] : null;
      let time = 0;
      let steps = 0;
      while (time < maxTime && steps < 900) {
        const speedNow = velocity.length();
        const dragFactor = 1 - AIR_DRAG * speedNow;
        const frictionFactor = Math.pow(FRICTION, dt * 60);
        velocity.multiplyScalar(frictionFactor * dragFactor);
        tmpForce.copy(spinState).cross(velocity).multiplyScalar(MAGNUS_COEFFICIENT);
        tmpForce.add(GRAVITY);
        velocity.addScaledVector(tmpForce, dt);
        prevPosition.copy(position);
        position.addScaledVector(velocity, dt);
        if (collectPath && (steps % 2 === 0 || time + dt >= maxTime)) {
          path.push(position.clone());
        }
        if (position.y < BALL_RADIUS) {
          position.y = BALL_RADIUS;
          if (velocity.y < 0) velocity.y *= -0.35;
        }
        spinState.multiplyScalar(0.985);
        time += dt;
        steps += 1;
        if (prevPosition.z >= planeZ && position.z <= planeZ) {
          const denom = prevPosition.z - position.z;
          const ratio = denom !== 0 ? THREE.MathUtils.clamp((prevPosition.z - planeZ) / denom, 0, 1) : 0;
          const hitPoint = prevPosition.clone().lerp(position, ratio);
          if (collectPath) {
            path[path.length - 1] = hitPoint.clone();
          }
          return { hit: true, point: hitPoint, path };
        }
        if (velocity.lengthSq() < 0.0004 && position.z > planeZ) break;
      }
      return { hit: false, point: position.clone(), path };
    };

    const solveLaunchParameters = ({ speed, azimuth, slope, target, spin }) => {
      const planeZ = target.z;
      let currentAzimuth = azimuth;
      let currentSlope = slope;
      let preview = simulateShotPreview({ speed, azimuth: currentAzimuth, slope: currentSlope, spin, planeZ });
      if (!preview.hit) {
        return null;
      }
      for (let i = 0; i < SOLVER_MAX_ITERATIONS; i += 1) {
        const errorX = preview.point.x - target.x;
        if (Math.abs(errorX) > SOLVER_TARGET_EPSILON) {
          const deltaAzimuth = SOLVER_DELTA_AZIMUTH;
          const forward = simulateShotPreview({
            speed,
            azimuth: currentAzimuth + deltaAzimuth,
            slope: currentSlope,
            spin,
            planeZ
          });
          if (forward.hit) {
            const derivative = (forward.point.x - preview.point.x) / deltaAzimuth;
            if (Math.abs(derivative) > 1e-5) {
              currentAzimuth = THREE.MathUtils.clamp(
                currentAzimuth - errorX / derivative,
                -Math.PI / 2 + 0.02,
                Math.PI / 2 - 0.02
              );
              preview = simulateShotPreview({
                speed,
                azimuth: currentAzimuth,
                slope: currentSlope,
                spin,
                planeZ
              });
              if (!preview.hit) break;
            }
          }
        }
        const errorY = preview.point.y - target.y;
        if (Math.abs(errorY) > SOLVER_TARGET_EPSILON) {
          const deltaSlope = SOLVER_DELTA_SLOPE;
          const forwardSlope = simulateShotPreview({
            speed,
            azimuth: currentAzimuth,
            slope: currentSlope + deltaSlope,
            spin,
            planeZ
          });
          if (forwardSlope.hit) {
            const derivativeY = (forwardSlope.point.y - preview.point.y) / deltaSlope;
            if (Math.abs(derivativeY) > 1e-5) {
              currentSlope = THREE.MathUtils.clamp(currentSlope - errorY / derivativeY, -0.35, 3.4);
              preview = simulateShotPreview({
                speed,
                azimuth: currentAzimuth,
                slope: currentSlope,
                spin,
                planeZ
              });
              if (!preview.hit) break;
            }
          }
        }
        if (
          Math.abs(preview.point.x - target.x) < SOLVER_TARGET_EPSILON &&
          Math.abs(preview.point.y - target.y) < SOLVER_TARGET_EPSILON
        ) {
          break;
        }
      }
      if (!preview.hit) {
        return null;
      }
      const finalPreview = simulateShotPreview({
        speed,
        azimuth: currentAzimuth,
        slope: currentSlope,
        spin,
        planeZ,
        collectPath: true
      });
      if (!finalPreview.hit || !finalPreview.path || finalPreview.path.length < 2) {
        return null;
      }
      if (
        Math.abs(finalPreview.point.x - target.x) > SOLVER_TARGET_EPSILON ||
        Math.abs(finalPreview.point.y - target.y) > SOLVER_TARGET_EPSILON
      ) {
        return null;
      }
      return {
        azimuth: currentAzimuth,
        slope: currentSlope,
        landing: finalPreview.point,
        pathPoints: finalPreview.path
      };
    };

    const buildShotPlan = (samples) => {
      if (!samples || samples.length < 2) return null;
      const start = samples[0];
      const end = samples[samples.length - 1];
      const dt = Math.max(16, end.t - start.t);
      const { pathDistance, avgDx, avgDy } = summarizeSwipe(samples);
      const rawDx = (end.x - start.x) / end.w;
      const rawDy = (end.y - start.y) / end.h;
      const baseDistance = Math.hypot(rawDx, rawDy);
      const hasAverage = Math.abs(avgDx) + Math.abs(avgDy) > 1e-6;
      const dx = hasAverage ? avgDx : rawDx;
      const dy = hasAverage ? avgDy : rawDy;
      const effectiveDistance = Math.max(pathDistance, baseDistance);
      if (effectiveDistance < 0.02) return null;
      const dtSeconds = Math.max(0.04, dt / 1000);

      let targetPoint = projectPointerToGoal(end);
      if (targetPoint) {
        targetPoint.x = THREE.MathUtils.clamp(
          targetPoint.x,
          -goalWidth / 2 + BALL_RADIUS * 0.6,
          goalWidth / 2 - BALL_RADIUS * 0.6
        );
        targetPoint.y = THREE.MathUtils.clamp(
          targetPoint.y,
          BALL_RADIUS * 1.1,
          goalHeight - BALL_RADIUS * 0.4
        );
      } else {
        const fallbackX = THREE.MathUtils.clamp(
          dx * goalWidth * 1.1,
          -goalWidth / 2 + BALL_RADIUS * 0.6,
          goalWidth / 2 - BALL_RADIUS * 0.6
        );
        const fallbackY = THREE.MathUtils.clamp(
          goalHeight * 0.6 - dy * goalHeight * 0.9,
          BALL_RADIUS * 1.1,
          goalHeight - BALL_RADIUS * 0.4
        );
        targetPoint = new THREE.Vector3(fallbackX, fallbackY, goalZ);
      }
      targetPoint.z = goalZ - 0.4;

      const samplesCount = samples.length;
      const midIndex = Math.min(samplesCount - 1, Math.max(1, Math.floor(samplesCount / 2)));
      const early = samples[0];
      const mid = samples[midIndex];
      const late = samples[samplesCount - 1];
      const earlyDx = (mid.x - early.x) / mid.w;
      const earlyDt = Math.max(0.05, (mid.t - early.t) / 1000);
      const earlyRate = earlyDt > 0 ? earlyDx / earlyDt : 0;
      const lateDx = (late.x - mid.x) / late.w;
      const lateDt = Math.max(0.05, (late.t - mid.t) / 1000);
      const lateRate = lateDt > 0 ? lateDx / lateDt : 0;
      const lateralChange = lateRate - earlyRate;
      let weightedLateralRate = 0;
      let totalWeight = 0;
      for (let i = 1; i < samplesCount; i += 1) {
        const prev = samples[i - 1];
        const curr = samples[i];
        const segDx = (curr.x - prev.x) / curr.w;
        const segDt = Math.max(0.016, (curr.t - prev.t) / 1000);
        const segRate = segDt > 0 ? segDx / segDt : 0;
        const progress = i / Math.max(1, samplesCount - 1);
        const weight = progress * segDt;
        weightedLateralRate += segRate * weight;
        totalWeight += weight;
      }
      const fallbackLateralSpeed = dx / dtSeconds;
      const averageCurveRate = totalWeight > 0 ? weightedLateralRate / totalWeight : fallbackLateralSpeed;
      const rawTargetDepth = Math.abs(targetPoint.z - ball.position.z);
      const targetDepth = Math.max(rawTargetDepth, 0.5);
      const curveBoost = 1 + Math.min(0.35, Math.abs(lateralChange) * 0.9 + Math.abs(averageCurveRate) * 0.8);
      const distanceScale = THREE.MathUtils.clamp(targetDepth / 8.5, 0.85, 1.32);
      const basePower = THREE.MathUtils.clamp((effectiveDistance * 30) / dtSeconds, 3.2, MAX_BASE_SHOT_POWER);
      const rawPower = basePower * SHOOT_POWER_SCALE * curveBoost * distanceScale;
      const power = Math.min(rawPower, MAX_SHOT_POWER);
      const normalizedPower = MAX_SHOT_POWER > 0 ? THREE.MathUtils.clamp(power / MAX_SHOT_POWER, 0, 1) : 0;
      const fullArcThreshold = SHOOT_VERTICAL_FULL_POWER_THRESHOLD;
      const highArcWeight =
        normalizedPower <= fullArcThreshold
          ? 0
          : Math.pow((normalizedPower - fullArcThreshold) / (1 - fullArcThreshold), 1.6);

      const aimVector = targetPoint.clone().sub(ball.position);
      const horizontalDistance = Math.max(0.1, Math.hypot(aimVector.x, aimVector.z));
      const slopeToTarget = aimVector.y / horizontalDistance;
      const swipeSlope = THREE.MathUtils.clamp(-dy * 1.7 + 0.6, -0.4, 2.8);
      const arcBias = highArcWeight * 0.45 + THREE.MathUtils.clamp(effectiveDistance * 0.5, 0, 0.3);
      const slopeGuess = THREE.MathUtils.clamp(
        THREE.MathUtils.lerp(slopeToTarget, swipeSlope, 0.6) + arcBias,
        -0.35,
        3.4
      );
      const azimuthGuess = Math.atan2(targetPoint.x - ball.position.x, ball.position.z - targetPoint.z);

      const verticalSpeed = -dy / dtSeconds;
      const lateralSpeed = fallbackLateralSpeed;
      const intensity = THREE.MathUtils.clamp(power / (MAX_SHOT_POWER * 0.92), 0, 1.1);
      const swipeCurve = THREE.MathUtils.clamp(lateralChange * 0.85 + averageCurveRate * 1.1, -1.8, 1.8);
      const targetCurve = THREE.MathUtils.clamp((targetPoint.x - ball.position.x) / targetDepth, -1.6, 1.6);
      const combinedCurve = THREE.MathUtils.lerp(targetCurve, swipeCurve, CURVE_SWIPE_INFLUENCE);
      const spinXDeg = THREE.MathUtils.clamp(verticalSpeed * 260 - swipeSlope * 85, -720, 720);
      const spinYDeg = THREE.MathUtils.clamp(lateralSpeed * 150 + combinedCurve * 520, -900, 900);
      const spinZDeg = THREE.MathUtils.clamp(combinedCurve * 300, -540, 540);
      const spinScale = SPIN_SCALE * (1 + intensity * 0.35);
      const spinVector = new THREE.Vector3(
        THREE.MathUtils.degToRad(spinXDeg * intensity * spinScale),
        THREE.MathUtils.degToRad(spinYDeg * intensity * spinScale),
        THREE.MathUtils.degToRad(spinZDeg * intensity * 0.65 * spinScale)
      );

      let appliedSpin = spinVector.clone();
      let solution = solveLaunchParameters({
        speed: power,
        azimuth: azimuthGuess,
        slope: slopeGuess,
        target: targetPoint,
        spin: appliedSpin
      });

      if (!solution) {
        appliedSpin = new THREE.Vector3(0, 0, 0);
        solution = solveLaunchParameters({
          speed: power,
          azimuth: azimuthGuess,
          slope: slopeGuess,
          target: targetPoint,
          spin: appliedSpin
        });
      }

      const resolvedDirection = solution
        ? directionFromAzimuthSlope(solution.azimuth, solution.slope)
        : directionFromAzimuthSlope(azimuthGuess, slopeGuess);

      const velocity = resolvedDirection.clone().multiplyScalar(power);

      const verticalFactor = THREE.MathUtils.lerp(
        SHOOT_VERTICAL_POWER_MIN,
        SHOOT_VERTICAL_POWER_MAX,
        Math.pow(highArcWeight, 0.9)
      );
      const maxVerticalSpeed = Math.min(power * verticalFactor, MAX_VERTICAL_LAUNCH_SPEED);
      if (velocity.y > maxVerticalSpeed) {
        velocity.y = maxVerticalSpeed;
        const horizontalMag = Math.hypot(velocity.x, velocity.z);
        const remaining = Math.sqrt(Math.max(power * power - maxVerticalSpeed * maxVerticalSpeed, 0));
        if (horizontalMag > 1e-5 && remaining > 0) {
          const scale = remaining / horizontalMag;
          velocity.x *= scale;
          velocity.z *= scale;
        }
      }

      let offsets;
      if (solution) {
        offsets = solution.pathPoints.map((point, index) => {
          const offset = new THREE.Vector3(
            point.x - ball.position.x,
            point.y - ball.position.y,
            point.z - ball.position.z
          );
          if (index === 0) {
            offset.add(aimLineBaseOffset);
          }
          return offset;
        });
      } else {
        const base = aimLineBaseOffset.clone();
        offsets = [base, base.clone().add(new THREE.Vector3(0, 0, -1.2))];
      }
      if (offsets.length < 2) {
        const base = aimLineBaseOffset.clone();
        offsets = [base, base.clone().add(new THREE.Vector3(0, 0, -1.2))];
      }

      return {
        velocity,
        spin: appliedSpin.clone(),
        offsets,
        targetPoint,
        power,
        intensity,
        landing: solution?.landing ?? null
      };
    };

    const rebuildAimLine = (samples) => {
      aimLineOffsets.length = 0;
      gestureRef.current.plan = null;
      let plan = null;
      if (samples && samples.length >= 2) {
        plan = buildShotPlan(samples);
      }
      if (plan) {
        plan.offsets.forEach((offset) => {
          aimLineOffsets.push(offset.clone());
        });
        gestureRef.current.plan = plan;
      } else {
        const base = aimLineBaseOffset.clone();
        aimLineOffsets.push(base);
        aimLineOffsets.push(base.clone().add(new THREE.Vector3(0, 0, -1.2)));
      }
      const worldPoints = aimLineOffsets.map((offset) =>
        new THREE.Vector3(
          ball.position.x + offset.x,
          ball.position.y + offset.y,
          ball.position.z + offset.z
        )
      );
      aimLine.geometry.setFromPoints(worldPoints);
      aimLine.computeLineDistances();
      aimLine.visible = true;
    };

    const clearAimLine = () => {
      aimLineOffsets.length = 0;
      gestureRef.current.plan = null;
      aimLine.visible = false;
    };

    const goalAABB = new THREE.Box3(
      new THREE.Vector3(-goalWidth / 2 + BALL_RADIUS, BALL_RADIUS * 0.6, goalZ - 0.25),
      new THREE.Vector3(goalWidth / 2 - BALL_RADIUS, goalHeight - BALL_RADIUS * 0.5, goalZ + 0.4)
    );

    const tmp = new THREE.Vector3();
    const tmp2 = new THREE.Vector3();
    const tmp3 = new THREE.Vector3();
    const spinAxis = new THREE.Vector3();
    const spinStep = new THREE.Vector3();
    const segmentStart = new THREE.Vector3();
    const segmentEnd = new THREE.Vector3();
    const localImpact = new THREE.Vector3();
    const defenderNormal = new THREE.Vector3();
    const cameraTarget = new THREE.Vector3();
    const defenderQuat = new THREE.Quaternion();
    const cameraForward = new THREE.Vector3();
    const cameraStrafe = new THREE.Vector3();
    const upVector = new THREE.Vector3(0, 1, 0);
    const desiredCameraPos = new THREE.Vector3();
    const desiredCameraFocus = new THREE.Vector3();
    const cameraShakeSample = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();

    const state = {
      renderer,
      scene,
      camera,
      pmrem,
      ball,
      aimLine,
      goalAABB,
      lastTime: performance.now(),
      timeAccumulator: 0,
      smoothedFrameTime: FIXED_TIME_STEP,
      velocity: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      scored: false,
      started: false,
      animationId: 0,
      disposed: false,
      netSim: null,
      billboards: [],
      defenders: [],
      structureColliders: [],
      cameraColliders: [],
      broadcastCameraRigs: [],
      billboardColliders: [],
      netCooldown: 0,
      wallState,
      keeperState,
      targets: [],
      targetGroup,
      currentShotPoints: 0,
      shotResolved: false,
      ballExploded: false,
      shotInFlight: false,
      cameraCurrentPosition: camera.position.clone(),
      cameraFocus: CAMERA_IDLE_FOCUS.clone(),
      cameraShakeIntensity: 0,
      cameraShakeOffset: new THREE.Vector3()
    };

    state.netSim = netSim;
    state.billboards = billboardAnimations;
    state.defenders = defenders;
    state.structureColliders = structureColliders;
    state.cameraColliders = cameraColliders;
    state.broadcastCameraRigs = broadcastCameras;
    state.billboardColliders = billboardColliders;

    const applyCapsuleCollision = (start, end, radius, options = {}) => {
      tmp.copy(end).sub(start);
      tmp2.copy(ball.position).sub(start);
      const segLengthSq = tmp.lengthSq();
      let t = 0;
      if (segLengthSq > 0) {
        t = THREE.MathUtils.clamp(tmp.dot(tmp2) / segLengthSq, 0, 1);
      }
      tmp3.copy(start).addScaledVector(tmp, t);
      const combinedRadius = radius + BALL_RADIUS;
      const distance = tmp3.distanceTo(ball.position);
      if (distance >= combinedRadius - 0.001) return false;
      defenderNormal.copy(ball.position).sub(tmp3);
      if (defenderNormal.lengthSq() <= 1e-6) return false;
      defenderNormal.normalize();
      const penetration = combinedRadius - distance;
      const slop = options.slop ?? 0.002;
      ball.position.addScaledVector(defenderNormal, penetration + slop);
      const restitution = options.restitution ?? 1.0;
      const velocityDamping = options.velocityDamping ?? 1.0;
      const spinDamping = options.spinDamping ?? 1.0;
      const speedAlongNormal = state.velocity.dot(defenderNormal);
      if (speedAlongNormal < 0) {
        state.velocity.addScaledVector(defenderNormal, -speedAlongNormal * restitution);
      }
      state.velocity.multiplyScalar(velocityDamping);
      state.spin.multiplyScalar(spinDamping);
      return true;
    };

    const applySphereCollision = (collider) => {
      const { center, radius, restitution = 1.0, velocityDamping = 1.0, spinDamping = 1.0, slop = 0.002 } = collider;
      const combinedRadius = radius + BALL_RADIUS;
      const distance = center.distanceTo(ball.position);
      if (distance >= combinedRadius - 0.001) return;
      defenderNormal.copy(ball.position).sub(center);
      if (defenderNormal.lengthSq() <= 1e-6) return;
      defenderNormal.normalize();
      const penetration = combinedRadius - distance;
      ball.position.addScaledVector(defenderNormal, penetration + slop);
      const speedAlongNormal = state.velocity.dot(defenderNormal);
      if (speedAlongNormal < 0) {
        state.velocity.addScaledVector(defenderNormal, -speedAlongNormal * restitution);
      }
      state.velocity.multiplyScalar(velocityDamping);
      state.spin.multiplyScalar(spinDamping);
    };

    const applyBillboardCollision = (collider) => {
      const { center, halfSize, restitution = 1.0, velocityDamping = 1.0, spinDamping = 1.0 } = collider;
      if (!center || !halfSize) return;
      if (Math.abs(ball.position.x - center.x) > halfSize.x + BALL_RADIUS) return;
      if (Math.abs(ball.position.y - center.y) > halfSize.y + BALL_RADIUS) return;
      const frontZ = center.z + halfSize.z;
      const backZ = center.z - halfSize.z;
      if (ball.position.z < backZ - BALL_RADIUS) return;
      if (ball.position.z - BALL_RADIUS > frontZ) return;
      if (state.velocity.z < 0) {
        const targetZ = frontZ + BALL_RADIUS;
        if (ball.position.z < targetZ) {
          ball.position.z = targetZ;
        }
        state.velocity.z *= -restitution;
        state.velocity.x *= velocityDamping;
        state.velocity.y *= velocityDamping;
        state.spin.multiplyScalar(spinDamping);
      }
    };

    const showTransientMessage = (text, duration = 2000) => {
      if (!text) return;
      setMessage(text);
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
      messageTimeoutRef.current = window.setTimeout(() => {
        setMessage(INSTRUCTION_TEXT);
        messageTimeoutRef.current = null;
      }, duration);
    };

    const disposeTarget = (target) => {
      if (!target) return;
      if (target.mesh) {
        targetGroup.remove(target.mesh);
        target.mesh.geometry?.dispose?.();
        if (target.mesh.material) {
          const { material } = target.mesh;
          if (material.map) {
            material.map.dispose?.();
          }
          material.dispose?.();
        }
      }
      if (target.texture) {
        target.texture.dispose?.();
      }
    };

    const clearTargets = () => {
      if (state.targets.length > 0) {
        state.targets.forEach(disposeTarget);
      }
      state.targets = [];
    };

    const randomBetween = (min, max) => THREE.MathUtils.lerp(min, max, Math.random());

    const canPlaceTarget = (list, x, y, r) =>
      list.every((existing) => Math.hypot(existing.x - x, existing.y - y) > existing.radius + r + TARGET_SEPARATION);

    const pickSideX = (side, r, minX, maxX, span) => {
      if (side < 0) {
        const leftMin = minX;
        const leftMax = Math.min(leftMin + span, maxX);
        return randomBetween(leftMin, leftMax);
      }
      const rightMax = maxX;
      const rightMin = Math.max(rightMax - span, minX);
      return randomBetween(rightMin, rightMax);
    };

    const buildTargetSet = (wallCenter, keeperSide) => {
      const results = [];
      const baseCount = 6 + Math.floor(Math.random() * 7);
      const minRadius = Math.max(BALL_RADIUS * 1.05, 0.32);
      const maxRadius = Math.max(minRadius + 0.18, 0.7);
      const minX = -goalWidth / 2 + TARGET_PADDING_X + minRadius;
      const maxX = goalWidth / 2 - TARGET_PADDING_X - minRadius;
      const minY = BALL_RADIUS * 0.6 + TARGET_PADDING_Y + minRadius;
      const maxY = goalHeight - TARGET_PADDING_Y - minRadius;
      const sideSpan = goalWidth * 0.2;
      let attempts = 0;
      while (results.length < baseCount && attempts < 1600) {
        attempts += 1;
        const radius = randomBetween(minRadius, maxRadius);
        let x;
        if (Math.random() < 0.6) {
          const side = Math.random() < 0.5 ? -1 : 1;
          x = pickSideX(side, radius, minX, maxX, sideSpan);
        } else {
          x = randomBetween(minX, maxX);
        }
        const y = randomBetween(minY, maxY);
        if (!canPlaceTarget(results, x, y, radius)) continue;
        const points = Math.max(10, Math.round(((maxRadius / radius) * 70) / 5) * 5);
        results.push({ x, y, radius, points, type: 'points' });
      }

      const timerAttempts = 12;
      for (let i = 0; i < timerAttempts; i += 1) {
        const radius = randomBetween(minRadius, maxRadius);
        let x;
        if (Math.random() < 0.8) {
          const side = Math.random() < 0.5 ? -1 : 1;
          x = pickSideX(side, radius, minX, maxX, goalWidth * 0.22);
        } else {
          x = randomBetween(minX, maxX);
        }
        const y = randomBetween(minY, maxY);
        if (!canPlaceTarget(results, x, y, radius)) continue;
        const timer = TIMER_BONUS_OPTIONS[Math.floor(Math.random() * TIMER_BONUS_OPTIONS.length)];
        results.push({ x, y, radius, timer, type: 'timer' });
      }

      const preferSide = keeperSide === 0 ? (wallCenter < 0 ? 1 : wallCenter > 0 ? -1 : Math.random() < 0.5 ? -1 : 1) : -Math.sign(keeperSide);
      const bombAttempts = 12;
      for (let i = 0; i < bombAttempts; i += 1) {
        const radius = randomBetween(minRadius * 1.05, maxRadius * 1.1);
        let side = preferSide;
        if (Math.random() < 0.25) {
          side = Math.random() < 0.5 ? -1 : 1;
        }
        const x = pickSideX(side, radius, minX, maxX, goalWidth * 0.26);
        const y = randomBetween(minY, maxY);
        if (!canPlaceTarget(results, x, y, radius)) continue;
        results.push({ x, y, radius: radius * 1.05, bomb: true, type: 'bomb' });
      }

      return results;
    };

    const addTargetToScene = (target) => {
      const diameter = target.radius * 2;
      const geometry = new THREE.PlaneGeometry(diameter, diameter);
      let texture;
      if (target.bomb) {
        texture = makeTargetTexture({ text: '-15s', subtext: '-50', accentColor: '#ef4444', icon: '💣', detailColor: '#f87171' });
      } else if (target.timer) {
        texture = makeTargetTexture({ text: `+${target.timer}s`, accentColor: '#22c55e', icon: '⏳', detailColor: '#bbf7d0' });
      } else {
        texture = makeTargetTexture({ text: `${target.points}`, accentColor: '#fde047', icon: '⭐', detailColor: '#facc15' });
      }
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 1
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(target.x, target.y, 0);
      targetGroup.add(mesh);
      target.mesh = mesh;
      target.material = material;
      target.texture = texture;
      target.opacity = 1;
      target.hit = false;
      state.targets.push(target);
    };

    const regenerateTargets = () => {
      clearTargets();
      const wallCenter = state.wallState?.centerX ?? 0;
      const keeperSide = state.keeperState?.side ?? 0;
      const targets = buildTargetSet(wallCenter, keeperSide);
      targets.forEach(addTargetToScene);
    };

    const settleKeeper = () => {
      if (!state.keeperState) return;
      state.keeperState.targetX = state.keeperState.baseX;
      state.keeperState.targetY = state.keeperState.baseY;
      state.keeperState.moveEase = KEEPER_RETURN_EASE;
    };

    const scheduleReset = (delayMs = 900) => {
      if (resetTimeoutRef.current) return;
      resetTimeoutRef.current = window.setTimeout(() => {
        resetBall();
      }, delayMs);
    };

    const applyTimerBonus = (seconds) => {
      setTimeLeft((value) => value + seconds);
      showTransientMessage(`+${seconds}s Bonus`, 1800);
    };

    const applyBombPenalty = () => {
      if (state.shotResolved) return;
      state.shotResolved = true;
      state.shotInFlight = false;
      state.currentShotPoints = 0;
      setTimeLeft((value) => Math.max(0, value - BOMB_TIME_PENALTY));
      setScore((value) => Math.max(0, value - BOMB_SCORE_PENALTY));
      state.velocity.set(0, 0, 0);
      state.spin.set(0, 0, 0);
      state.ballExploded = true;
      ball.visible = false;
      showTransientMessage('💣 Bomb! -15s -50', 2000);
      state.cameraShakeIntensity = Math.min(state.cameraShakeIntensity + 0.35, 0.9);
      settleKeeper();
      scheduleReset(BOMB_RESET_DELAY * 1000);
    };

    const applyPrizePoints = (points) => {
      state.currentShotPoints += points;
      showTransientMessage(`+${points} pts`, 1500);
    };

    const handleKeeperSave = () => {
      if (state.shotResolved) return;
      state.shotResolved = true;
      state.shotInFlight = false;
      state.currentShotPoints = 0;
      state.velocity.set(0, 0, 0);
      state.spin.set(0, 0, 0);
      showTransientMessage('Saved!', 1400);
      state.cameraShakeIntensity = Math.min(state.cameraShakeIntensity + 0.25, 0.8);
      settleKeeper();
      scheduleReset(900);
    };

    const handleMiss = (text = 'Missed!') => {
      if (state.shotResolved) return;
      state.shotResolved = true;
      state.shotInFlight = false;
      state.currentShotPoints = 0;
      showTransientMessage(text, 1400);
      state.cameraShakeIntensity = Math.min(state.cameraShakeIntensity + 0.18, 0.75);
      settleKeeper();
      scheduleReset(900);
    };

    const resetBall = () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
      state.velocity.set(0, 0, 0);
      state.spin.set(0, 0, 0);
      state.scored = false;
      state.shotResolved = false;
      state.currentShotPoints = 0;
      state.ballExploded = false;
      state.shotInFlight = false;
      state.netCooldown = 0;
      state.cameraShakeIntensity = 0;
      state.timeAccumulator = 0;
      ball.visible = true;
      const startRange = goalWidth * 0.35;
      const startX = THREE.MathUtils.clamp(THREE.MathUtils.randFloat(-startRange, startRange), -DEFENDER_MAX_OFFSET, DEFENDER_MAX_OFFSET);
      ball.position.set(startX, BALL_RADIUS, START_Z);
      ball.rotation.set(0, 0, 0);
      if (state.netSim) {
        state.netSim.velocity.fill(0);
      }
      const wall = state.wallState;
      if (wall) {
        wall.centerX = THREE.MathUtils.clamp(startX, -DEFENDER_MAX_OFFSET, DEFENDER_MAX_OFFSET);
        wall.offsetY = 0;
        wall.velocityY = 0;
        wall.jumping = false;
        wall.group.position.set(wall.centerX, wall.offsetY, DEFENDER_WALL_Z);
      }
      const keeper = state.keeperState;
      if (keeper) {
        const gap = goalWidth * 0.02;
        let keeperX;
        if (wall && wall.centerX < -goalWidth * 0.1) {
          keeperX = goalWidth / 2 - keeper.radius - gap;
        } else if (wall && wall.centerX > goalWidth * 0.1) {
          keeperX = -goalWidth / 2 + keeper.radius + gap;
        } else {
          keeperX = Math.random() < 0.5 ? -goalWidth / 2 + keeper.radius + gap : goalWidth / 2 - keeper.radius - gap;
        }
        keeper.mesh.position.set(keeperX, keeper.baseY, keeper.baseZ ?? keeper.mesh.position.z);
        keeper.baseX = keeperX;
        keeper.targetX = keeperX;
        keeper.targetY = keeper.baseY;
        keeper.moveEase = KEEPER_RETURN_EASE;
        keeper.side = keeperX >= 0 ? 1 : -1;
      }
      regenerateTargets();
      state.cameraCurrentPosition.copy(CAMERA_IDLE_POSITION);
      state.cameraFocus.copy(CAMERA_IDLE_FOCUS);
      camera.position.copy(CAMERA_IDLE_POSITION);
      camera.lookAt(CAMERA_IDLE_FOCUS);
      camera.up.set(0, 1, 0);
    };
    resetBall();

    threeRef.current = {
      ...state,
      resetBall
    };

    const updateAimLine = () => {
      if (!aimLine.visible || aimLineOffsets.length === 0) return;
      const positions = aimLine.geometry.attributes.position;
      if (!positions) return;
      for (let i = 0; i < aimLineOffsets.length; i += 1) {
        const offset = aimLineOffsets[i];
        positions.setXYZ(
          i,
          ball.position.x + offset.x,
          ball.position.y + offset.y,
          ball.position.z + offset.z
        );
      }
      positions.needsUpdate = true;
      aimLine.computeLineDistances();
    };

    const applyGoalCelebration = () => {
      if (state.shotResolved) return;
      state.shotResolved = true;
      state.shotInFlight = false;
      const awarded = Math.max(
        MIN_GOAL_POINTS,
        Math.round((state.currentShotPoints || 0) / 5) * 5 || MIN_GOAL_POINTS
      );
      state.currentShotPoints = 0;
      setGoals((value) => value + 1);
      setScore((value) => value + awarded);
      playGoalSound();
      showTransientMessage(`Goal! +${awarded}`, 2200);
      state.cameraShakeIntensity = Math.min(state.cameraShakeIntensity + 0.45, 1);
      settleKeeper();
      resetTimeoutRef.current = window.setTimeout(() => {
        resetBall();
      }, 900);
    };

    const stepSimulation = (dt) => {
      state.netCooldown = Math.max(0, state.netCooldown - dt);

      const wall = state.wallState;
      if (wall) {
        if (wall.jumping || wall.offsetY > 0) {
          wall.velocityY += GRAVITY.y * DEFENDER_GRAVITY_SCALE * dt;
          wall.offsetY = Math.max(0, wall.offsetY + wall.velocityY * dt);
          if (wall.offsetY <= 0) {
            wall.offsetY = 0;
            wall.velocityY = 0;
            wall.jumping = false;
          }
        }
        wall.group.position.set(wall.centerX, wall.offsetY, DEFENDER_WALL_Z);
      }

      const keeper = state.keeperState;
      if (keeper) {
        const ease = keeper.moveEase ?? KEEPER_RETURN_EASE;
        const lerpFactor = 1 - Math.pow(1 - ease, Math.max(1, dt * 60));
        keeper.mesh.position.x += (keeper.targetX - keeper.mesh.position.x) * lerpFactor;
        keeper.mesh.position.y += (keeper.targetY - keeper.mesh.position.y) * lerpFactor;
        keeper.mesh.position.z = keeper.baseZ ?? keeper.mesh.position.z;
        if (
          Math.abs(keeper.mesh.position.x - keeper.targetX) < 0.01 &&
          Math.abs(keeper.mesh.position.y - keeper.targetY) < 0.01
        ) {
          keeper.moveEase = KEEPER_RETURN_EASE;
        }
      }

      if (state.targets.length > 0) {
        state.targets.forEach((target) => {
          if (!target.material) return;
          if (target.hit) {
            target.material.opacity = Math.max(0, target.material.opacity - dt * 4);
            if (target.material.opacity <= 0.05) {
              disposeTarget(target);
              target.removed = true;
            }
          } else if (target.material.opacity < 1) {
            target.material.opacity = Math.min(1, target.material.opacity + dt * 2.5);
          }
        });
        if (state.targets.some((target) => target?.removed)) {
          state.targets = state.targets.filter((target) => !target.removed);
        }
      }

      if (
        !gameStateRef.current.gameOver &&
        !state.ballExploded &&
        state.velocity.lengthSq() > 0.00001
      ) {
        const speed = state.velocity.length();
        const dragFactor = 1 - AIR_DRAG * speed;
        const frictionFactor = Math.pow(FRICTION, dt * 60);
        state.velocity.multiplyScalar(frictionFactor * dragFactor);

        tmp.copy(state.spin).cross(state.velocity).multiplyScalar(MAGNUS_COEFFICIENT);
        const acceleration = tmp.add(GRAVITY);
        state.velocity.addScaledVector(acceleration, dt);
        ball.position.addScaledVector(state.velocity, dt);

        if (ball.position.y - BALL_RADIUS < GROUND_Y) {
          ball.position.y = GROUND_Y + BALL_RADIUS;
          state.velocity.y *= -RESTITUTION;
          state.velocity.multiplyScalar(0.82);
          state.spin.multiplyScalar(0.92);
        }

        state.defenders.forEach((defender) => {
          const { mesh, radius, halfHeight } = defender;
          mesh.updateWorldMatrix(true, false);
          mesh.getWorldPosition(tmp3);
          mesh.getWorldQuaternion(defenderQuat);
          segmentStart.set(0, -halfHeight, 0).applyQuaternion(defenderQuat).add(tmp3);
          segmentEnd.set(0, halfHeight, 0).applyQuaternion(defenderQuat).add(tmp3);
          applyCapsuleCollision(segmentStart, segmentEnd, radius, {
            restitution: 1.6,
            velocityDamping: 0.78,
            spinDamping: 0.7,
            slop: 0.002
          });
        });

        state.structureColliders.forEach((collider) => {
          applyCapsuleCollision(collider.start, collider.end, collider.radius, collider);
        });

        state.cameraColliders.forEach((collider) => {
          applySphereCollision(collider);
        });

        state.billboardColliders.forEach((collider) => {
          applyBillboardCollision(collider);
        });

        if (keeper) {
          keeper.mesh.updateWorldMatrix(true, false);
          keeper.mesh.getWorldPosition(tmp3);
          keeper.mesh.getWorldQuaternion(defenderQuat);
          segmentStart.set(0, -keeper.halfHeight, 0).applyQuaternion(defenderQuat).add(tmp3);
          segmentEnd.set(0, keeper.halfHeight, 0).applyQuaternion(defenderQuat).add(tmp3);
          if (
            applyCapsuleCollision(segmentStart, segmentEnd, keeper.radius, {
              restitution: 1.25,
              velocityDamping: 0.68,
              spinDamping: 0.5,
              slop: 0.0025
            })
          ) {
            handleKeeperSave();
          }
        }

        if (!state.shotResolved && state.targets.length > 0) {
          const insideGoalFace =
            Math.abs(ball.position.x) <= goalWidth / 2 &&
            ball.position.y >= BALL_RADIUS * 0.6 &&
            ball.position.y <= goalHeight &&
            ball.position.z <= goalZ + 0.25;
          if (insideGoalFace) {
            for (const target of state.targets) {
              if (target.hit) continue;
              const distance = Math.hypot(ball.position.x - target.x, ball.position.y - target.y);
              if (distance <= target.radius + BALL_RADIUS * 0.3) {
                target.hit = true;
                if (target.timer) {
                  applyTimerBonus(target.timer);
                } else if (target.bomb) {
                  applyBombPenalty();
                } else if (target.points) {
                  applyPrizePoints(target.points);
                }
                state.spin.multiplyScalar(0.6);
                break;
              }
            }
          }
        }

        if (!state.scored && state.velocity.z < 0 && state.goalAABB.containsPoint(ball.position)) {
          state.scored = true;
          applyGoalCelebration();
        }

        const netMesh = state.netSim?.mesh;
        if (
          netMesh &&
          Math.abs(ball.position.x) <= goalWidth / 2 + BALL_RADIUS &&
          ball.position.y >= BALL_RADIUS * 0.3 &&
          ball.position.y <= goalHeight + BALL_RADIUS
        ) {
          const depthAtBall = depthAtHeight(ball.position.y);
          const netPlaneZ = goalZ - depthAtBall;
          if (ball.position.z <= netPlaneZ + BALL_RADIUS * 0.45 && state.velocity.z < 0) {
            const impactX = THREE.MathUtils.clamp(ball.position.x, -goalWidth / 2, goalWidth / 2);
            const impactY = THREE.MathUtils.clamp(ball.position.y, BALL_RADIUS * 0.6, goalHeight);
            const impactDepth = depthAtHeight(impactY);
            tmp3.set(impactX, impactY, goalZ - impactDepth);
            if (state.netCooldown <= 0) {
              localImpact.copy(tmp3);
              netMesh.worldToLocal(localImpact);
              const impactForce = Math.min(7.5, state.velocity.length() * 0.95 + 1.4);
              applyNetImpulse(state.netSim, localImpact, impactForce);
              tmp.set(impactX, impactY, goalZ).sub(tmp3).normalize();
              ball.position.copy(tmp3).addScaledVector(tmp, BALL_RADIUS * 0.45);
              const approach = state.velocity.dot(tmp);
              if (approach < 0) {
                state.velocity.addScaledVector(tmp, -approach * (1.3 + impactForce * 0.12));
              }
              state.velocity.multiplyScalar(0.5);
              state.spin.multiplyScalar(0.62);
              state.netCooldown = 0.25;
            }
          }
        }

        if (
          ball.position.z < goalZ - goalDepthBottom - 4 ||
          ball.position.z > START_Z + 2 ||
          (state.velocity.length() < 0.18 && ball.position.y <= BALL_RADIUS + 0.002)
        ) {
          if (!state.shotResolved) {
            handleMiss();
          } else {
            scheduleReset(600);
          }
        }

        if (!state.ballExploded && state.spin.lengthSq() > 1e-6) {
          spinAxis.copy(state.spin).normalize();
          spinStep.copy(spinAxis).multiplyScalar(state.spin.length() * dt);
          ball.rotateOnAxis(spinAxis, spinStep.length());
          state.spin.multiplyScalar(0.985);
        }
      }

      updateNetSimulation(state.netSim, dt);
      state.billboards.forEach((billboard) => {
        billboard.texture.offset.x = (billboard.texture.offset.x + dt * billboard.speed) % 1;
      });

      if (state.cameraShakeIntensity > 0) {
        state.cameraShakeIntensity = Math.max(0, state.cameraShakeIntensity - dt * CAMERA_SHAKE_DECAY);
      }
    };

    const updateCameraRig = (dt) => {
      const followLerp = state.shotInFlight ? CAMERA_ACTIVE_LERP : CAMERA_IDLE_LERP;
      const blend = 1 - Math.pow(1 - followLerp, Math.max(1, dt * 60));

      if (state.shotInFlight) {
        desiredCameraFocus.copy(ball.position);
        desiredCameraFocus.y += 0.45;

        cameraForward.copy(state.velocity);
        cameraForward.y = 0;
        if (cameraForward.lengthSq() < 0.0001) {
          cameraForward.set(0, 0, -1);
        } else {
          cameraForward.normalize();
        }

        cameraStrafe.crossVectors(upVector, cameraForward).normalize();
        const speed = state.velocity.length();
        const distance = THREE.MathUtils.clamp(
          CAMERA_ACTIVE_MIN_DISTANCE + speed * 0.14,
          CAMERA_ACTIVE_MIN_DISTANCE,
          CAMERA_ACTIVE_MAX_DISTANCE
        );
        const lateralOffset = THREE.MathUtils.clamp(ball.position.x * 0.32, -CAMERA_LATERAL_CLAMP, CAMERA_LATERAL_CLAMP);
        desiredCameraPos.copy(ball.position);
        desiredCameraPos.addScaledVector(cameraForward, -distance);
        desiredCameraPos.addScaledVector(cameraStrafe, lateralOffset);
        desiredCameraPos.y = THREE.MathUtils.clamp(
          1.4 + ball.position.y * 0.35 + Math.abs(state.velocity.y) * 0.06,
          CAMERA_IDLE_POSITION.y - 0.3,
          CAMERA_IDLE_POSITION.y + 3.6
        );
      } else {
        desiredCameraFocus.copy(CAMERA_IDLE_FOCUS);
        desiredCameraPos.copy(CAMERA_IDLE_POSITION);
      }

      desiredCameraPos.x = THREE.MathUtils.clamp(desiredCameraPos.x, -GOAL_CONFIG.width, GOAL_CONFIG.width);
      desiredCameraPos.z = THREE.MathUtils.clamp(
        desiredCameraPos.z,
        GOAL_CONFIG.z - GOAL_CONFIG.depthBottom - 4.8,
        START_Z + 7.4
      );
      desiredCameraPos.y = THREE.MathUtils.clamp(desiredCameraPos.y, 1.1, CAMERA_IDLE_POSITION.y + 4.0);

      state.cameraCurrentPosition.lerp(desiredCameraPos, blend);
      state.cameraFocus.lerp(desiredCameraFocus, blend * 0.9 + 0.05);

      if (state.cameraShakeIntensity > 0) {
        cameraShakeSample.set(
          (Math.random() - 0.5) * state.cameraShakeIntensity * 0.12,
          (Math.random() - 0.5) * state.cameraShakeIntensity * 0.08,
          (Math.random() - 0.5) * state.cameraShakeIntensity * 0.1
        );
        state.cameraShakeOffset.lerp(cameraShakeSample, 0.4);
      } else {
        state.cameraShakeOffset.multiplyScalar(0.6);
      }

      camera.position.copy(state.cameraCurrentPosition).add(state.cameraShakeOffset);
      lookTarget.copy(state.cameraFocus).addScaledVector(state.cameraShakeOffset, 0.5);
      camera.lookAt(lookTarget);
      camera.up.copy(upVector);
    };

    const animate = () => {
      if (state.disposed) return;
      const now = performance.now();
      let frameDelta = (now - state.lastTime) / 1000;
      if (!Number.isFinite(frameDelta) || frameDelta <= 0) {
        frameDelta = FIXED_TIME_STEP;
      }
      frameDelta = Math.min(MAX_FRAME_DELTA, frameDelta);
      state.lastTime = now;
      state.smoothedFrameTime = THREE.MathUtils.lerp(state.smoothedFrameTime, frameDelta, 0.15);
      state.timeAccumulator = Math.min(state.timeAccumulator + frameDelta, MAX_ACCUMULATED_TIME);

      if (state.broadcastCameraRigs.length > 0) {
        cameraTarget.copy(ball.position);
        cameraTarget.y += 0.35;
        state.broadcastCameraRigs.forEach((rig) => {
          rig.headPivot.up.set(0, 1, 0);
          rig.headPivot.lookAt(cameraTarget);
          rig.headPivot.rotateY(Math.PI);
          rig.headPivot.rotateX(tripodTilt);
          rig.headPivot.updateWorldMatrix(true, true);
        });
      }

      if (state.cameraColliders.length > 0) {
        state.cameraColliders.forEach((collider) => {
          if (!collider.anchor || !collider.center) return;
          collider.anchor.updateWorldMatrix(true, false);
          collider.anchor.getWorldPosition(collider.center);
        });
      }

      if (state.billboardColliders.length > 0) {
        state.billboardColliders.forEach((collider) => {
          if (!collider.mesh || !collider.center) return;
          collider.mesh.updateWorldMatrix(true, false);
          collider.mesh.getWorldPosition(collider.center);
        });
      }

      while (state.timeAccumulator >= FIXED_TIME_STEP) {
        stepSimulation(FIXED_TIME_STEP);
        state.timeAccumulator -= FIXED_TIME_STEP;
      }

      updateCameraRig(state.smoothedFrameTime);
      updateAimLine();
      renderer.render(scene, camera);
      state.animationId = requestAnimationFrame(animate);
    };

    animate();

    const pushPointerSample = (pointer) => {
      const history = gestureRef.current.history;
      if (!history) return;
      history.push(pointer);
      if (history.length > 24) {
        history.splice(0, history.length - 24);
      }
    };

    const getPointer = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;
      return {
        x: clientX - bounds.left,
        y: clientY - bounds.top,
        t: performance.now(),
        w: bounds.width,
        h: bounds.height
      };
    };

    const projectPointerToGoal = (pointer) => {
      if (!pointer) return null;
      const ndc = new THREE.Vector3(
        (pointer.x / pointer.w) * 2 - 1,
        -(pointer.y / pointer.h) * 2 + 1,
        0.5
      );
      ndc.unproject(camera);
      const dir = ndc.sub(camera.position).normalize();
      if (Math.abs(dir.z) < 1e-4) return null;
      const distance = (goalZ - camera.position.z) / dir.z;
      if (!Number.isFinite(distance) || distance <= 0.1) return null;
      return camera.position.clone().addScaledVector(dir, distance);
    };

    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (gameStateRef.current.gameOver) return;
      const pointer = getPointer(event);
      gestureRef.current.start = pointer;
      gestureRef.current.last = pointer;
      gestureRef.current.pointerId = event.pointerId;
      gestureRef.current.history = [pointer];
      gestureRef.current.plan = null;
      rebuildAimLine(gestureRef.current.history);
      startCrowdSound();
      if (!state.started) {
        setIsRunning(true);
        state.started = true;
        playWhistle();
      }
    };

    const onPointerMove = (event) => {
      if (gestureRef.current.pointerId !== event.pointerId) return;
      const pointer = getPointer(event);
      gestureRef.current.last = pointer;
      pushPointerSample(pointer);
      rebuildAimLine(gestureRef.current.history);
    };

    const onPointerUp = (event) => {
      if (gestureRef.current.pointerId !== event.pointerId) return;
      gestureRef.current.pointerId = null;
      const start = gestureRef.current.start;
      const end = gestureRef.current.last;
      const history = gestureRef.current.history ? [...gestureRef.current.history] : [];
      gestureRef.current.start = null;
      gestureRef.current.last = null;
      gestureRef.current.history = [];
      const storedPlan = gestureRef.current.plan;
      if (!start || !end || gameStateRef.current.gameOver) {
        clearAimLine();
        gestureRef.current.plan = null;
        return;
      }
      if (history.length === 0) history.push(start);
      if (history[history.length - 1] !== end) history.push(end);
      else if (history.length === 1) history.push(end);
      const plan = storedPlan ?? buildShotPlan(history);
      clearAimLine();
      gestureRef.current.plan = null;
      if (!plan) return;
      state.velocity.copy(plan.velocity);
      state.spin.copy(plan.spin);
      state.scored = false;
      state.shotResolved = false;
      state.ballExploded = false;
      state.shotInFlight = true;
      state.currentShotPoints = 0;
      state.cameraShakeIntensity = Math.min(state.cameraShakeIntensity + 0.4, 0.95);
      if (state.wallState && !state.wallState.jumping) {
        state.wallState.velocityY = DEFENDER_JUMP_VELOCITY;
        state.wallState.jumping = true;
      }
      if (state.keeperState) {
        state.keeperState.targetX = 0;
        state.keeperState.targetY = state.keeperState.baseY + goalHeight * 0.02;
        state.keeperState.moveEase = KEEPER_CENTER_EASE;
      }
      setShots((value) => value + 1);
      playKickSound();
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown, { passive: false });
    renderer.domElement.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });

    const onResize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      state.disposed = true;
      cancelAnimationFrame(state.animationId);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      clearTargets();
      aimLine.geometry.dispose();
      aimLine.material.dispose();
      scene.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose?.());
          } else {
            object.material?.dispose?.();
          }
        }
      });
      ballTexture.dispose();
      bumpMap.dispose();
      netTexture.dispose();
      texturesToDispose.forEach((texture) => texture.dispose());
      pmrem.dispose();
      renderer.dispose();
      threeRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isRunning || gameOver) return;
    const interval = setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          clearInterval(interval);
          setGameOver(true);
          setMessage('Time is up!');
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, gameOver]);

  useEffect(() => {
    if (gameOver) {
      setIsRunning(false);
      if (threeRef.current) {
        threeRef.current.velocity?.set(0, 0, 0);
        threeRef.current.spin?.set(0, 0, 0);
      }
    }
  }, [gameOver]);

  useEffect(() => {
    if (gameOver || !isRunning) {
      pauseCrowdSound();
    } else if (audioRef.current.started) {
      startCrowdSound();
    }
  }, [gameOver, isRunning, pauseCrowdSound, startCrowdSound]);

  useEffect(() => {
    gameStateRef.current.gameOver = gameOver;
  }, [gameOver]);

  useEffect(() => () => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
  }, []);

  const restart = () => {
    setScore(0);
    setShots(0);
    setGoals(0);
    setTimeLeft(playDuration);
    setIsRunning(false);
    setGameOver(false);
    setMessage(INSTRUCTION_TEXT);
    if (threeRef.current) {
      threeRef.current.resetBall();
      threeRef.current.started = false;
      threeRef.current.velocity.set(0, 0, 0);
      threeRef.current.spin.set(0, 0, 0);
    }
  };

  return (
    <div className="relative h-full w-full select-none text-white">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="absolute top-4 left-4 right-4 z-10 grid grid-cols-3 gap-3 text-sm md:text-base">
        <div className="pointer-events-none rounded-xl bg-black/45 px-3 py-2">
          <div className="text-xs uppercase tracking-wider text-white/60">Player</div>
          <div className="font-semibold">{playerName}</div>
        </div>
        <div className="pointer-events-none rounded-xl bg-black/45 px-3 py-2 text-center">
          <div className="text-xs uppercase tracking-wider text-white/60">Time</div>
          <div className="font-semibold text-lg">{formatTime(timeLeft)}</div>
        </div>
        <div className="pointer-events-none rounded-xl bg-black/45 px-3 py-2 text-right">
          <div className="text-xs uppercase tracking-wider text-white/60">Score</div>
          <div className="font-semibold text-lg">{score}</div>
        </div>
      </div>
      <div className="absolute top-20 left-1/2 z-10 flex -translate-x-1/2 gap-2 text-xs md:text-sm">
        <div className="rounded-full bg-black/50 px-3 py-1">Shots {shots}</div>
        <div className="rounded-full bg-black/50 px-3 py-1">Goals {goals}</div>
      </div>
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 w-[90%] -translate-x-1/2 rounded-xl bg-black/50 px-4 py-3 text-center text-sm md:text-base">
        {message}
      </div>
      {gameOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900/90 p-6 text-center">
            <h3 className="text-xl font-semibold">Match Complete</h3>
            <p className="mt-2 text-sm text-white/70">Shots taken: {shots}</p>
            <p className="text-sm text-white/70">Goals scored: {goals}</p>
            <p className="text-sm text-white/70">Total points: {score}</p>
            <button
              type="button"
              onClick={restart}
              className="mt-4 w-full rounded-lg bg-emerald-500 py-2 font-semibold text-white shadow-lg shadow-emerald-500/30"
            >
              Play again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
