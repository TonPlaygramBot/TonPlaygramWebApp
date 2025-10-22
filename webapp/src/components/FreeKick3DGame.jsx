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

    const backNet = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalHeight), netMaterial);
    const leftNet = new THREE.Mesh(new THREE.PlaneGeometry(goalDepth, goalHeight), netMaterial);
    const rightNet = leftNet.clone();
    const roofNet = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalDepth), netMaterial);
    backNet.position.set(0, goalHeight / 2, goalZ - goalDepth);
    leftNet.position.set(-goalWidth / 2, goalHeight / 2, goalZ - goalDepth / 2);
    leftNet.rotation.y = Math.PI / 2;
    rightNet.position.set(goalWidth / 2, goalHeight / 2, goalZ - goalDepth / 2);
    rightNet.rotation.y = -Math.PI / 2;
    roofNet.position.set(0, goalHeight, goalZ - goalDepth / 2);
    roofNet.rotation.x = Math.PI / 2;
    goal.add(backNet, leftNet, rightNet, roofNet);

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
    for (let i = 0; i < 3; i += 1) {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.9, 4, 8), wallMaterial);
      body.castShadow = true;
      body.receiveShadow = true;
      body.position.set((i - 1) * 0.8, 1.1, goalZ + 5.0);
      wallGroup.add(body);
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
    const spinAxis = new THREE.Vector3();
    const spinStep = new THREE.Vector3();

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
      disposed: false
    };

    const resetBall = () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
      state.velocity.set(0, 0, 0);
      state.spin.set(0, 0, 0);
      state.scored = false;
      ball.position.set(0, BALL_RADIUS, START_Z);
      ball.rotation.set(0, 0, 0);
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

        if (!state.scored && state.velocity.z < 0 && state.goalAABB.containsPoint(ball.position)) {
          state.scored = true;
          applyGoalCelebration();
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
      const power = basePower * 0.25; // reduce launch power by 50%
      const direction = new THREE.Vector3(dx * 2.0, -dy * 1.4 + 0.6, -1).normalize();
      state.velocity.copy(direction.multiplyScalar(power));
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
      const spinScale = 1.5; // increase applied spin by 50%
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
