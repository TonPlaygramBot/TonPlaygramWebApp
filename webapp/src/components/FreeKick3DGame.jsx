import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const INSTRUCTION_TEXT = 'Swipe up to shoot • Curve by swiping sideways';

function formatTime(totalSeconds) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (clamped % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function makePitchGreenTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, '#0d5c28');
  gradient.addColorStop(1, '#15903b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() * 8) | 0;
    data[i] = Math.max(0, data[i] - noise);
    data[i + 1] = Math.max(0, data[i + 1] - (noise >> 1));
    data[i + 2] = Math.max(0, data[i + 2] - (noise >> 2));
  }
  ctx.putImageData(imageData, 0, 0);

  const stripeHeight = size / 16;
  for (let y = 0; y < size; y += stripeHeight) {
    ctx.fillStyle = (y / stripeHeight) % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, y, size, stripeHeight);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 16);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeFieldLineMaterial() {
  return new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.0 });
}

function makeBillboardTexture(text, accentColor) {
  const width = 1024;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, accentColor);
  gradient.addColorStop(1, '#111827');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 160px "Montserrat", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i += 1) {
    ctx.fillRect((width / 6) * i, 0, width / 12, height);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(2.5, 1);
  texture.anisotropy = 4;
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
    damping: 0.88,
    stiffness: 38
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

  const influenceRadius = Math.max(0.4, force * 0.45);
  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    tmp.set(rest[idx], rest[idx + 1], rest[idx + 2]);
    const distance = tmp.distanceTo(point);
    if (distance > influenceRadius) continue;
    const weight = 1 - distance / influenceRadius;
    const impulse = force * weight;
    velocity[idx + 2] -= impulse * 0.9;
    velocity[idx] += (point.x - tmp.x) * impulse * 0.15;
    velocity[idx + 1] += (point.y - tmp.y) * impulse * 0.1;
  }

  if (closestIndex >= 0) {
    const idx = closestIndex * 3;
    velocity[idx + 2] -= force * 1.1;
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

const GOAL_CONFIG = {
  width: 7.32,
  height: 2.44,
  depth: 2.4,
  z: -10.2
};

const BALL_RADIUS = 0.23;
const GRAVITY = new THREE.Vector3(0, -9.81 * 0.35, 0);
const AIR_DRAG = 0.0006;
const FRICTION = 0.995;
const MAGNUS_COEFFICIENT = 0.045;
const RESTITUTION = 0.45;
const GROUND_Y = 0;
const START_Z = 1.2;
const SHOOT_POWER_SCALE = 0.46875; // 50% stronger launch than the previous 0.3125 scale
const BASE_SPIN_SCALE = 1.5;
const SPIN_SCALE = BASE_SPIN_SCALE * 1.25;
const CROSSBAR_HEIGHT_MARGIN = 0.25;
const MAX_VERTICAL_LAUNCH_SPEED = Math.sqrt(
  Math.max(
    0,
    2 * Math.abs(GRAVITY.y) * Math.max(0, GOAL_CONFIG.height + CROSSBAR_HEIGHT_MARGIN - BALL_RADIUS)
  )
);
const SOUND_SOURCES = {
  crowd: encodeURI('/assets/sounds/football-crowd-3-69245.mp3'),
  whistle: encodeURI('/assets/sounds/metal-whistle-6121.mp3'),
  goal: encodeURI('/assets/sounds/goal net origjinal (2).mp3'),
  kick: encodeURI('/assets/sounds/ball kick .mp3')
};
export default function FreeKick3DGame({ config }) {
  const hostRef = useRef(null);
  const threeRef = useRef(null);
  const gestureRef = useRef({ start: null, last: null, pointerId: null, history: [] });
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

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.03).texture;

    const camera = new THREE.PerspectiveCamera(55, host.clientWidth / host.clientHeight, 0.1, 240);
    camera.position.set(0, 1.65, 6.6);
    camera.lookAt(0, 1.4, GOAL_CONFIG.z);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.7);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(-4, 6, 5.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    scene.add(sun);

    const pitchTexture = makePitchGreenTexture();
    const field = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 26),
      new THREE.MeshPhysicalMaterial({
        map: pitchTexture,
        roughness: 0.96,
        metalness: 0,
        clearcoat: 0.04,
        clearcoatRoughness: 0.9
      })
    );
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    scene.add(field);

    const lines = new THREE.Group();
    const lineMat = makeFieldLineMaterial();
    const addLine = (w, h, x, z) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lineMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.002, z);
      mesh.receiveShadow = true;
      lines.add(mesh);
    };
    const addCircle = (radius, thickness, segments, x, z) => {
      const geometry = new THREE.RingGeometry(radius - thickness, radius, segments);
      const mesh = new THREE.Mesh(geometry, lineMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.003, z);
      mesh.receiveShadow = true;
      lines.add(mesh);
    };
    const addArc = (radius, thickness, segments, startAngle, angleLength, x, z) => {
      const geometry = new THREE.RingGeometry(radius - thickness, radius, segments, 1, startAngle, angleLength);
      const mesh = new THREE.Mesh(geometry, lineMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.003, z);
      mesh.receiveShadow = true;
      lines.add(mesh);
    };
    const addSpot = (radius, x, z) => {
      const geometry = new THREE.CircleGeometry(radius, 24);
      const mesh = new THREE.Mesh(geometry, lineMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.003, z);
      mesh.receiveShadow = true;
      lines.add(mesh);
    };
    const goalWidth = GOAL_CONFIG.width;
    const goalHeight = GOAL_CONFIG.height;
    const goalDepth = GOAL_CONFIG.depth;
    const goalZ = GOAL_CONFIG.z;
    addLine(0.08, 26, -7, 0);
    addLine(0.08, 26, 7, 0);
    addLine(14, 0.08, 0, 13);
    addLine(14, 0.08, 0, -13);
    addLine(goalWidth + 5.5, 0.08, 0, goalZ + 2.2);
    addLine(0.08, 6.5, -(goalWidth / 2 + 2.75), goalZ + 0.9);
    addLine(0.08, 6.5, goalWidth / 2 + 2.75, goalZ + 0.9);
    addLine(goalWidth + 1.8, 0.08, 0, goalZ + 1.15);
    addLine(0.08, 4.0, -(goalWidth / 2 + 1.1), goalZ + 0.45);
    addLine(0.08, 4.0, goalWidth / 2 + 1.1, goalZ + 0.45);
    addLine(14, 0.06, 0, 0);
    addCircle(3.5, 0.08, 64, 0, goalZ + 7.5);
    addCircle(0.15, 0.15, 32, 0, goalZ + 7.5);
    addSpot(0.15, 0, goalZ + 2.5);
    addArc(8.9, 0.08, 64, Math.PI * 0.16, Math.PI - Math.PI * 0.32, 0, goalZ + 2.2);
    scene.add(lines);

    const postMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.05,
      clearcoat: 0.3
    });
    const goal = new THREE.Group();
    const postRadius = 0.06;
    const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 20), postMaterial);
    leftPost.castShadow = true;
    leftPost.receiveShadow = true;
    leftPost.position.set(-goalWidth / 2, goalHeight / 2, goalZ);
    goal.add(leftPost);
    const rightPost = leftPost.clone();
    rightPost.position.x = goalWidth / 2;
    goal.add(rightPost);
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalWidth, 20), postMaterial);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.set(0, goalHeight, goalZ);
    crossbar.castShadow = true;
    crossbar.receiveShadow = true;
    goal.add(crossbar);

    const structureColliders = [
      {
        start: new THREE.Vector3(-goalWidth / 2, GROUND_Y, goalZ),
        end: new THREE.Vector3(-goalWidth / 2, goalHeight, goalZ),
        radius: postRadius,
        restitution: 1.28,
        velocityDamping: 0.82,
        spinDamping: 0.72,
        slop: 0.002
      },
      {
        start: new THREE.Vector3(goalWidth / 2, GROUND_Y, goalZ),
        end: new THREE.Vector3(goalWidth / 2, goalHeight, goalZ),
        radius: postRadius,
        restitution: 1.28,
        velocityDamping: 0.82,
        spinDamping: 0.72,
        slop: 0.002
      },
      {
        start: new THREE.Vector3(-goalWidth / 2 + postRadius * 0.9, goalHeight, goalZ),
        end: new THREE.Vector3(goalWidth / 2 - postRadius * 0.9, goalHeight, goalZ),
        radius: postRadius,
        restitution: 1.22,
        velocityDamping: 0.82,
        spinDamping: 0.7,
        slop: 0.0025
      }
    ];

    const netTexture = (() => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 2;
      const radius = 18;
      const width = radius * 3;
      const height = Math.sqrt(3) * radius;
      const drawHex = (cx, cy) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const angle = (Math.PI / 3) * i + Math.PI / 6;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      };
      for (let y = -height; y < size + height; y += height) {
        for (let x = -width; x < size + width; x += width) {
          const offset = Math.floor(y / height) % 2 ? 1.5 * radius : 0;
          drawHex(x + offset, y);
        }
      }
      const data = ctx.getImageData(0, 0, size, size);
      for (let i = 0; i < data.data.length; i += 4) {
        const value = data.data[i];
        data.data[i] = 255;
        data.data[i + 1] = 255;
        data.data[i + 2] = 255;
        data.data[i + 3] = value;
      }
      ctx.putImageData(data, 0, 0);
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(4, 3);
      texture.anisotropy = 4;
      return texture;
    })();

    const netMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      alphaMap: netTexture,
      side: THREE.DoubleSide,
      roughness: 0.95
    });

    const backNetGeometry = new THREE.PlaneGeometry(goalWidth, goalHeight, 20, 14);
    const backNet = new THREE.Mesh(backNetGeometry, netMaterial);
    const sideNetGeometry = new THREE.PlaneGeometry(goalDepth, goalHeight, 12, 14);
    const roofNetGeometry = new THREE.PlaneGeometry(goalWidth, goalDepth, 20, 6);
    const leftNet = new THREE.Mesh(sideNetGeometry, netMaterial);
    const rightNet = leftNet.clone();
    const roofNet = new THREE.Mesh(roofNetGeometry, netMaterial);
    backNet.position.set(0, goalHeight / 2, goalZ - goalDepth);
    leftNet.position.set(-goalWidth / 2, goalHeight / 2, goalZ - goalDepth / 2);
    leftNet.rotation.y = Math.PI / 2;
    rightNet.position.set(goalWidth / 2, goalHeight / 2, goalZ - goalDepth / 2);
    rightNet.rotation.y = -Math.PI / 2;
    roofNet.position.set(0, goalHeight, goalZ - goalDepth / 2);
    roofNet.rotation.x = Math.PI / 2;
    goal.add(backNet, leftNet, rightNet, roofNet);

    const netSim = createNetSimulation(backNet);

    const billboardConfigs = [
      { text: 'TONPLAY', color: '#0ea5e9' },
      { text: 'GRAM ARENA', color: '#22c55e' },
      { text: 'FREE KICK LIVE', color: '#f97316' }
    ];
    const billboardGroup = new THREE.Group();
    const billboardAnimations = [];
    billboardConfigs.forEach((config, index) => {
      const texture = makeBillboardTexture(config.text, config.color);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        emissive: new THREE.Color(config.color).multiplyScalar(0.25),
        emissiveIntensity: 1.4,
        roughness: 0.5,
        metalness: 0.2
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth / 2.2, 1.1), material);
      mesh.position.set((index - (billboardConfigs.length - 1) / 2) * (goalWidth / 1.6), 1.2, goalZ - goalDepth - 1.6);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      billboardGroup.add(mesh);
      texture.offset.x = Math.random();
      billboardAnimations.push({ texture, speed: 0.12 + index * 0.04 });
    });
    scene.add(billboardGroup);

    const standSeatMaterial = new THREE.MeshStandardMaterial({
      color: 0x0066ff,
      roughness: 0.4,
      metalness: 0.1
    });
    const standFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.6,
      metalness: 0.2
    });
    const standConcreteMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777,
      roughness: 0.9,
      metalness: 0.05
    });
    const standMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x999999,
      roughness: 0.4,
      metalness: 0.8
    });

    const standSeatGeo = new THREE.BoxGeometry(1.4, 0.15, 1.2);
    const standBackGeo = new THREE.BoxGeometry(1.4, 0.8, 0.1);
    const standLegGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
    const standStepGeo = new THREE.BoxGeometry(32, 0.4, 1.8);

    function createStandSection(offsetX = 0, baseY = 0, depthOffset = 0) {
      const section = new THREE.Group();
      const rows = 8;
      const seatsPerRow = 18;
      const rowRise = 0.7;
      const rowDepth = 1.8;

      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < seatsPerRow; c += 1) {
          const seat = new THREE.Mesh(standSeatGeo, standSeatMaterial);
          const back = new THREE.Mesh(standBackGeo, standSeatMaterial);
          const leftLeg = new THREE.Mesh(standLegGeo, standFrameMaterial);
          const rightLeg = new THREE.Mesh(standLegGeo, standFrameMaterial);

          const x = c * 1.7 - (seatsPerRow * 1.7) / 2 + offsetX;
          const y = baseY + r * rowRise;
          const z = -r * rowDepth + depthOffset;

          seat.position.set(x, y, z);
          back.position.set(x, y + 0.45, z - 0.55);
          leftLeg.position.set(x - 0.6, y - 0.35, z + 0.4);
          rightLeg.position.set(x + 0.6, y - 0.35, z + 0.4);

          section.add(seat, back, leftLeg, rightLeg);
        }

        const step = new THREE.Mesh(standStepGeo, standConcreteMaterial);
        step.position.set(offsetX, baseY + r * rowRise - 0.4, -r * rowDepth - 0.9 + depthOffset);
        section.add(step);
      }
      return section;
    }

    const standsGroup = new THREE.Group();
    const lowerLeftStand = createStandSection(-15, 0, 0);
    const lowerRightStand = createStandSection(15, 0, 0);
    const middleWalkway = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 20), standConcreteMaterial);
    middleWalkway.position.set(0, -0.4, -6);
    standsGroup.add(lowerLeftStand, lowerRightStand, middleWalkway);

    const upperBaseY = 6;
    const upperDepthOffset = -15;
    const upperLeftStand = createStandSection(-15, upperBaseY, upperDepthOffset);
    const upperRightStand = createStandSection(15, upperBaseY, upperDepthOffset);
    const upperWalkway = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 20), standConcreteMaterial);
    upperWalkway.position.set(0, upperBaseY - 0.4, -6 + upperDepthOffset);
    standsGroup.add(upperLeftStand, upperRightStand, upperWalkway);

    const netPoleGeo = new THREE.CylinderGeometry(0.15, 0.15, 10, 12);
    const protectiveNetGeo = new THREE.PlaneGeometry(40, 12);
    const protectiveNetMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide
    });
    const protectiveNet = new THREE.Mesh(protectiveNetGeo, protectiveNetMaterial);
    protectiveNet.position.set(0, 5.6, 3.5);
    standsGroup.add(protectiveNet);

    for (let i = -14; i <= 14; i += 7) {
      const pole = new THREE.Mesh(netPoleGeo, standMetalMaterial);
      pole.position.set(i, 5.6, 3.5);
      standsGroup.add(pole);
    }

    const standScale = 0.3;
    standsGroup.scale.set(standScale, standScale, standScale);
    const standsOffsetZ = goalZ - goalDepth - 3.3;
    standsGroup.position.set(0, 0.12, standsOffsetZ);
    scene.add(standsGroup);

    const billboardColliders = billboardGroup.children.map((mesh) => {
      const { width = goalWidth / 2.2, height = 1.1 } = mesh.geometry.parameters || {};
      return {
        mesh,
        center: new THREE.Vector3(),
        halfSize: new THREE.Vector3(width / 2, height / 2, 0.08),
        restitution: 0.58,
        velocityDamping: 0.76,
        spinDamping: 0.7
      };
    });

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

      return (scale = 1.55) => {
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

    const cameraOffset = goalWidth / 2 + 1.6;
    const cameraZ = goalZ - goalDepth - 1.1;
    const broadcastFocus = new THREE.Vector3(0, goalHeight * 0.55, goalZ + 2.4);
    const tripodTilt = THREE.MathUtils.degToRad(-8);

    const leftCameraRig = createRoyalBroadcastCamera();
    leftCameraRig.group.position.set(-cameraOffset, GROUND_Y, cameraZ);
    const toLeftTarget = new THREE.Vector3().subVectors(broadcastFocus, leftCameraRig.group.position);
    const leftYaw = Math.atan2(toLeftTarget.x, toLeftTarget.z);
    leftCameraRig.group.rotation.y = leftYaw;
    scene.add(leftCameraRig.group);
    leftCameraRig.group.updateWorldMatrix(true, false);
    leftCameraRig.headPivot.up.set(0, 1, 0);
    leftCameraRig.headPivot.lookAt(broadcastFocus);
    leftCameraRig.headPivot.rotateY(Math.PI);
    leftCameraRig.headPivot.rotateX(tripodTilt);

    const rightCameraRig = createRoyalBroadcastCamera();
    rightCameraRig.group.position.set(cameraOffset, GROUND_Y, cameraZ);
    const toRightTarget = new THREE.Vector3().subVectors(broadcastFocus, rightCameraRig.group.position);
    const rightYaw = Math.atan2(toRightTarget.x, toRightTarget.z);
    rightCameraRig.group.rotation.y = rightYaw;
    scene.add(rightCameraRig.group);
    rightCameraRig.group.updateWorldMatrix(true, false);
    rightCameraRig.headPivot.up.set(0, 1, 0);
    rightCameraRig.headPivot.lookAt(broadcastFocus);
    rightCameraRig.headPivot.rotateY(Math.PI);
    rightCameraRig.headPivot.rotateX(tripodTilt);

    const broadcastCameras = [leftCameraRig, rightCameraRig];
    const cameraColliders = [
      {
        anchor: leftCameraRig.bodyAnchor,
        radius: 0.45,
        restitution: 1.15,
        velocityDamping: 0.78,
        spinDamping: 0.72,
        slop: 0.002,
        center: new THREE.Vector3()
      },
      {
        anchor: leftCameraRig.baseAnchor,
        radius: 0.36,
        restitution: 1.1,
        velocityDamping: 0.78,
        spinDamping: 0.72,
        slop: 0.002,
        center: new THREE.Vector3()
      },
      {
        anchor: rightCameraRig.bodyAnchor,
        radius: 0.45,
        restitution: 1.15,
        velocityDamping: 0.78,
        spinDamping: 0.72,
        slop: 0.002,
        center: new THREE.Vector3()
      },
      {
        anchor: rightCameraRig.baseAnchor,
        radius: 0.36,
        restitution: 1.1,
        velocityDamping: 0.78,
        spinDamping: 0.72,
        slop: 0.002,
        center: new THREE.Vector3()
      }
    ];

    const supportScale = 0.9;
    const supportWidth = goalWidth * supportScale;
    const supportHeight = goalHeight * supportScale;
    const supportZ = goalZ - goalDepth - 0.25;
    const supportPost = new THREE.Mesh(new THREE.CylinderGeometry(postRadius * 0.75, postRadius * 0.75, supportHeight, 16), postMaterial);
    supportPost.position.set(-supportWidth / 2, supportHeight / 2, supportZ);
    goal.add(supportPost);
    const supportPostR = supportPost.clone();
    supportPostR.position.x = supportWidth / 2;
    goal.add(supportPostR);
    const supportBar = new THREE.Mesh(new THREE.CylinderGeometry(postRadius * 0.75, postRadius * 0.75, supportWidth, 16), postMaterial);
    supportBar.rotation.z = Math.PI / 2;
    supportBar.position.set(0, supportHeight, supportZ);
    goal.add(supportBar);

    const connectorGeo = new THREE.CylinderGeometry(0.03, 0.03, Math.abs(supportZ - goalZ), 10);
    const addConnector = (x, y) => {
      const mesh = new THREE.Mesh(connectorGeo, postMaterial);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, y, (supportZ + goalZ) / 2);
      goal.add(mesh);
    };
    addConnector(-goalWidth / 2, goalHeight);
    addConnector(goalWidth / 2, goalHeight);
    addConnector(-goalWidth / 2, 0.1);
    addConnector(goalWidth / 2, 0.1);

    scene.add(goal);

    const wallGroup = new THREE.Group();
    const wallMaterial = new THREE.MeshPhysicalMaterial({ color: 0x20232a, roughness: 0.6 });
    const defenders = [];
    for (let i = 0; i < 3; i += 1) {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.9, 4, 8), wallMaterial);
      body.castShadow = true;
      body.receiveShadow = true;
      body.position.set((i - 1) * 0.8, 1.1, goalZ + 5.0);
      wallGroup.add(body);
      defenders.push({ mesh: body, radius: 0.28, halfHeight: 0.7 });
    }
    scene.add(wallGroup);

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

    const state = {
      renderer,
      scene,
      camera,
      pmrem,
      pitchTexture,
      ball,
      aimLine,
      goalAABB,
      lastTime: performance.now(),
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
      netCooldown: 0
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
      if (distance >= combinedRadius - 0.001) return;
      defenderNormal.copy(ball.position).sub(tmp3);
      if (defenderNormal.lengthSq() <= 1e-6) return;
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

    const resetBall = () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
      state.velocity.set(0, 0, 0);
      state.spin.set(0, 0, 0);
      state.scored = false;
      state.netCooldown = 0;
      ball.position.set(0, BALL_RADIUS, START_Z);
      ball.rotation.set(0, 0, 0);
      if (state.netSim) {
        state.netSim.velocity.fill(0);
      }
    };
    resetBall();

    threeRef.current = {
      ...state,
      resetBall
    };

    const updateAimLine = () => {
      if (!aimLine.visible) return;
      const positions = aimLine.geometry.attributes.position;
      positions.setXYZ(0, ball.position.x, ball.position.y + 0.1, ball.position.z);
      positions.needsUpdate = true;
      aimLine.computeLineDistances();
    };

    const applyGoalCelebration = () => {
      setScore((value) => value + 1);
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
      setMessage('Goal!');
      playGoalSound();
      messageTimeoutRef.current = window.setTimeout(() => {
        setMessage(INSTRUCTION_TEXT);
      }, 2000);
      resetTimeoutRef.current = window.setTimeout(() => {
        resetBall();
      }, 900);
    };

    const animate = () => {
      if (state.disposed) return;
      const now = performance.now();
      const dt = Math.min(0.033, (now - state.lastTime) / 1000);
      state.lastTime = now;

      state.netCooldown = Math.max(0, state.netCooldown - dt);

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

      if (!gameStateRef.current.gameOver && state.velocity.lengthSq() > 0.00001) {
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
          segmentStart.set(mesh.position.x, mesh.position.y - halfHeight, mesh.position.z);
          segmentEnd.set(mesh.position.x, mesh.position.y + halfHeight, mesh.position.z);
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

        if (!state.scored && state.velocity.z < 0 && state.goalAABB.containsPoint(ball.position)) {
          state.scored = true;
          applyGoalCelebration();
        }

        const netPlaneZ = goalZ - goalDepth;
        const netMesh = state.netSim?.mesh;
        if (
          netMesh &&
          ball.position.z <= netPlaneZ + BALL_RADIUS * 0.45 &&
          Math.abs(ball.position.x) <= goalWidth / 2 + BALL_RADIUS &&
          ball.position.y >= BALL_RADIUS * 0.3 &&
          ball.position.y <= goalHeight + BALL_RADIUS
        ) {
          if (state.netCooldown <= 0 && state.velocity.z < 0) {
            const impactX = THREE.MathUtils.clamp(ball.position.x, -goalWidth / 2, goalWidth / 2);
            const impactY = THREE.MathUtils.clamp(ball.position.y, BALL_RADIUS * 0.6, goalHeight);
            tmp3.set(impactX, impactY, netPlaneZ);
            localImpact.copy(tmp3);
            netMesh.worldToLocal(localImpact);
            const impactForce = Math.min(6, state.velocity.length() + 1.2);
            applyNetImpulse(state.netSim, localImpact, impactForce);
            if (ball.position.z < netPlaneZ - BALL_RADIUS * 0.45) {
              ball.position.z = netPlaneZ - BALL_RADIUS * 0.45;
            }
            tmp.set(0, 0, 1);
            const approach = state.velocity.dot(tmp);
            if (approach < 0) {
              state.velocity.addScaledVector(tmp, -approach * (1.3 + impactForce * 0.12));
            }
            state.velocity.multiplyScalar(0.45);
            state.spin.multiplyScalar(0.6);
            state.netCooldown = 0.35;
          }
        }

        if (
          ball.position.z < goalZ - goalDepth - 4 ||
          ball.position.z > START_Z + 2 ||
          (state.velocity.length() < 0.18 && ball.position.y <= BALL_RADIUS + 0.002)
        ) {
          resetBall();
        }

        if (state.spin.lengthSq() > 1e-6) {
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

    const onPointerDown = (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (gameStateRef.current.gameOver) return;
      const pointer = getPointer(event);
      gestureRef.current.start = pointer;
      gestureRef.current.last = pointer;
      gestureRef.current.pointerId = event.pointerId;
      gestureRef.current.history = [pointer];
      aimLine.visible = true;
      updateAimLine();
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
      const dx = (pointer.x - gestureRef.current.start.x) / pointer.w;
      const dy = (pointer.y - gestureRef.current.start.y) / pointer.h;
      const direction = new THREE.Vector3(dx * 6, -dy * 4 + 1.2, -6).normalize();
      const startPoint = new THREE.Vector3().copy(ball.position).add(new THREE.Vector3(0, 0.1, 0));
      const endPoint = new THREE.Vector3().copy(startPoint).addScaledVector(direction, 2.5);
      aimLine.geometry.setFromPoints([startPoint, endPoint]);
      aimLine.computeLineDistances();
      aimLine.visible = true;
    };

    const onPointerUp = (event) => {
      if (gestureRef.current.pointerId !== event.pointerId) return;
      gestureRef.current.pointerId = null;
      aimLine.visible = false;
      const start = gestureRef.current.start;
      const end = gestureRef.current.last;
      gestureRef.current.start = null;
      gestureRef.current.last = null;
      const history = gestureRef.current.history ? [...gestureRef.current.history] : [];
      gestureRef.current.history = [];
      if (!start || !end || gameStateRef.current.gameOver) return;
      const dt = Math.max(16, end.t - start.t);
      const dx = (end.x - start.x) / end.w;
      const dy = (end.y - start.y) / end.h;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.02) return;
      if (history.length === 0 && start) history.push(start);
      if (history.length === 1) history.push(end);
      const dtSeconds = dt / 1000;
      const basePower = THREE.MathUtils.clamp((distance * 22) / dtSeconds, 2.4, 30);
      const power = basePower * SHOOT_POWER_SCALE;
      const launchVector = new THREE.Vector3(dx * 2.0, -dy * 1.1 + 0.45, -1);
      const maxElevation = 0.68;
      if (launchVector.y > maxElevation) {
        launchVector.y = maxElevation;
      }
      const direction = launchVector.normalize();
      state.velocity.copy(direction.multiplyScalar(power));
      const maxVerticalSpeed = Math.min(power * 0.48, MAX_VERTICAL_LAUNCH_SPEED);
      if (state.velocity.y > maxVerticalSpeed) {
        state.velocity.y = maxVerticalSpeed;
      }
      const verticalSpeed = -dy / Math.max(0.05, dtSeconds);
      const lateralSpeed = dx / Math.max(0.05, dtSeconds);
      const samples = history;
      const midIndex = Math.min(samples.length - 1, Math.max(1, Math.floor(samples.length / 2)));
      const early = samples[0];
      const mid = samples[midIndex];
      const late = samples[samples.length - 1];
      const earlyDx = (mid.x - early.x) / mid.w;
      const earlyDt = Math.max(0.05, (mid.t - early.t) / 1000);
      const earlyRate = earlyDt > 0 ? earlyDx / earlyDt : 0;
      const lateDx = (late.x - mid.x) / late.w;
      const lateDt = Math.max(0.05, (late.t - mid.t) / 1000);
      const lateRate = lateDt > 0 ? lateDx / lateDt : 0;
      const lateralChange = lateRate - earlyRate;
      let weightedLateralRate = 0;
      let totalWeight = 0;
      for (let i = 1; i < samples.length; i += 1) {
        const prev = samples[i - 1];
        const curr = samples[i];
        const segDx = (curr.x - prev.x) / curr.w;
        const segDt = Math.max(0.016, (curr.t - prev.t) / 1000);
        const segRate = segDt > 0 ? segDx / segDt : 0;
        const progress = i / Math.max(1, samples.length - 1);
        const weight = progress * segDt;
        weightedLateralRate += segRate * weight;
        totalWeight += weight;
      }
      const averageCurveRate = totalWeight > 0 ? weightedLateralRate / totalWeight : lateralSpeed;
      const intensity = THREE.MathUtils.clamp(distance / 0.65, 0, 1);
      const spinXDeg = THREE.MathUtils.clamp(verticalSpeed * 220, -540, 540);
      const spinYDeg = THREE.MathUtils.clamp(
        lateralSpeed * 110 + lateralChange * 260 + averageCurveRate * 200,
        -720,
        720
      );
      const spinZDeg = THREE.MathUtils.clamp(averageCurveRate * 120, -360, 360);
      const spinScale = SPIN_SCALE;
      state.spin.set(
        THREE.MathUtils.degToRad(spinXDeg * intensity * spinScale),
        THREE.MathUtils.degToRad(spinYDeg * intensity * spinScale),
        THREE.MathUtils.degToRad(spinZDeg * intensity * 0.6 * spinScale)
      );
      state.scored = false;
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
      pitchTexture.dispose();
      ballTexture.dispose();
      bumpMap.dispose();
      netTexture.dispose();
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
        <div className="rounded-full bg-black/50 px-3 py-1">Goals {score}</div>
      </div>
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 w-[90%] -translate-x-1/2 rounded-xl bg-black/50 px-4 py-3 text-center text-sm md:text-base">
        {message}
      </div>
      {gameOver && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900/90 p-6 text-center">
            <h3 className="text-xl font-semibold">Match Complete</h3>
            <p className="mt-2 text-sm text-white/70">Shots taken: {shots}</p>
            <p className="text-sm text-white/70">Goals scored: {score}</p>
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
