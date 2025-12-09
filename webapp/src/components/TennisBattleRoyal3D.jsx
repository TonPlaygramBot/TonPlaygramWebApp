import React, { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getGameVolume, isGameMuted } from "../utils/sound.js";

const SOUND_SOURCES = {
  net: encodeURI("/assets/sounds/goal net origjinal (2).mp3"),
  kick: encodeURI("/assets/sounds/ball kick .mp3"),
  score: encodeURI("/assets/sounds/football-crowd-3-69245.mp3"),
  out: encodeURI("/assets/sounds/crowd-shocked-reaction-352766.mp3")
};

const BROADCAST_TECHNIQUES = [
  {
    id: 'orbit-dolly',
    label: 'Orbit Dolly',
    detail: 'Three.js orbit rail that hugs rallies from midcourt.',
    backMultiplier: 1.08,
    backOffset: 1.05,
    heightBoost: 0.48,
    leadTime: 0.32,
    followBlend: 0.72,
    cameraLerp: 5.1,
    lookLerp: 0.88,
    sideBias: 0.01,
    rig: { position: new THREE.Vector3(14, 3.4, 0), yaw: Math.PI / 2.3, scale: 1 }
  },
  {
    id: 'skybox-crane',
    label: 'Skybox Crane',
    detail: 'High jib shot with gentle easing for wide coverage.',
    backMultiplier: 1.16,
    backOffset: 1.45,
    heightBoost: 0.76,
    leadTime: 0.44,
    followBlend: 0.76,
    cameraLerp: 5.5,
    lookLerp: 0.9,
    sideBias: 0,
    rig: { position: new THREE.Vector3(0, 4.1, 21.5), yaw: 0, scale: 1.04 }
  },
  {
    id: 'drone-chase',
    label: 'Drone Chase',
    detail: 'Free-roam drone that banks slightly to track the ball arc.',
    backMultiplier: 1.12,
    backOffset: 1.22,
    heightBoost: 0.58,
    leadTime: 0.38,
    followBlend: 0.78,
    cameraLerp: 5.8,
    lookLerp: 0.93,
    sideBias: 0.04,
    rig: { position: new THREE.Vector3(-15, 3.1, -2), yaw: -Math.PI / 2.4, scale: 1 }
  },
  {
    id: 'sideline-truck',
    label: 'Sideline Truck',
    detail: 'Low track from photographer pit sliding along the baseline.',
    backMultiplier: 1.02,
    backOffset: 0.78,
    heightBoost: 0.32,
    leadTime: 0.3,
    followBlend: 0.7,
    cameraLerp: 5.2,
    lookLerp: 0.86,
    sideBias: 0.16,
    horizonLift: 0.06,
    rig: { position: new THREE.Vector3(19, 2.6, -6), yaw: Math.PI / 2.1, scale: 1.02 }
  },
  {
    id: 'dynamic-director',
    label: 'Dynamic Director',
    detail: 'Adaptive camera that reacts to rally heat and height.',
    backMultiplier: 1.1,
    backOffset: 1.1,
    heightBoost: 0.52,
    leadTime: 0.36,
    followBlend: 0.82,
    cameraLerp: 5.9,
    lookLerp: 0.95,
    sideBias: 0.02,
    horizonLift: 0.12,
    dynamicOrbit: {
      yawScale: 0.4,
      yawLimit: 0.5,
      pitchBase: 0.1,
      pitchRange: 0.28,
      pitchLimit: 0.52,
      heightBias: 0.38,
      smoothing: 3.8
    },
    rig: { position: new THREE.Vector3(0, 3.6, 18), yaw: 0, scale: 1.06 }
  }
];

const PHYSICS_PROFILES = [
  {
    id: 'arcade-spin',
    label: 'Arcade Spin',
    detail: 'Free-to-use arcade curve tuned for rapid topspin flicks.',
    gravity: -9.6,
    airDrag: 0.13,
    lift: 0.11,
    bounceRestitution: 0.8,
    courtFriction: 0.2,
    spinDamping: 0.86,
    spinSlip: 0.52,
    forceScale: 1.08,
    speedCap: 1.04,
    spinBias: 1.04
  },
  {
    id: 'street-tennis',
    label: 'Street Tennis',
    detail: 'Community mod with forgiving bounces and slower drives.',
    gravity: -9.35,
    airDrag: 0.16,
    lift: 0.09,
    bounceRestitution: 0.86,
    courtFriction: 0.26,
    spinDamping: 0.91,
    spinSlip: 0.58,
    forceScale: 0.95,
    speedCap: 0.96,
    spinBias: 1.06
  },
  {
    id: 'indoor-precision',
    label: 'Indoor Precision',
    detail: 'Low-drag bounce logic inspired by open-source simulator presets.',
    gravity: -10.1,
    airDrag: 0.09,
    lift: 0.07,
    bounceRestitution: 0.74,
    courtFriction: 0.16,
    spinDamping: 0.84,
    spinSlip: 0.46,
    forceScale: 1.06,
    speedCap: 1.05,
    spinBias: 0.96
  }
];

const TOUCH_TECHNIQUES = [
  {
    id: 'swipe-classic',
    label: 'Swipe Classic',
    detail: 'Standard drag from open-source mobile presets.',
    moveFollow: 0.42,
    minSwipeScale: 1,
    maxSwipeScale: 1,
    swipeSensitivity: 1,
    lateralAssist: 1,
    curveBias: 1,
    liftBias: 1,
    forceAssist: 1,
    aimAssist: 1
  },
  {
    id: 'flick-topspin',
    label: 'Flick Topspin',
    detail: 'Fast flick assist with extra lift and curve.',
    moveFollow: 0.5,
    minSwipeScale: 0.94,
    maxSwipeScale: 1.06,
    swipeSensitivity: 1.08,
    lateralAssist: 1.12,
    curveBias: 1.22,
    liftBias: 1.16,
    forceAssist: 1.04,
    aimAssist: 1.08,
    topspinBias: 1.18
  },
  {
    id: 'defense-block',
    label: 'Defense Block',
    detail: 'Controlled blocks with reduced lift and steadier aim.',
    moveFollow: 0.38,
    minSwipeScale: 1.04,
    maxSwipeScale: 0.96,
    swipeSensitivity: 0.92,
    lateralAssist: 0.92,
    curveBias: 0.9,
    liftBias: 0.8,
    forceAssist: 1.02,
    aimAssist: 1.14
  }
];

const BASE_PIVOT_POS = { x: 0, y: 0.1, z: -0.18 };
const BASE_PIVOT_ROT = { x: -0.28, y: 0, z: 0 };
const BASE_HEAD_ROT = { x: Math.PI / 2, y: 0, z: 0 };

const RACKET_ORIENTATIONS = [
  {
    id: 'balanced-baseline',
    label: 'Balanced Baseline',
    detail: 'Neutral, face-up setup for controlled rally timing.',
    pivotPosition: { x: 0, y: 0.12, z: -0.18 },
    pivotRotation: { x: -0.27, y: 0.02, z: 0.01 },
    headRotation: { x: Math.PI / 1.98, y: 0.02, z: 0.01 },
    depthOffset: -0.01,
    rollOffset: 0.02
  },
  {
    id: 'closed-drive',
    label: 'Closed Drive',
    detail: 'Forward lean with mild closure for skidding drives.',
    pivotPosition: { x: 0.02, y: 0.1, z: -0.16 },
    pivotRotation: { x: -0.36, y: 0.12, z: 0.06 },
    headRotation: { x: Math.PI / 1.82, y: 0.12, z: 0.1 },
    depthOffset: 0.02,
    rollOffset: 0.07
  },
  {
    id: 'lifted-topspin',
    label: 'Lifted Topspin',
    detail: 'Raised hoop with side tilt to invite heavy topspin.',
    pivotPosition: { x: -0.015, y: 0.15, z: -0.21 },
    pivotRotation: { x: -0.23, y: -0.08, z: -0.14 },
    headRotation: { x: Math.PI / 1.9, y: -0.06, z: -0.18 },
    depthOffset: -0.05,
    rollOffset: -0.08
  },
  {
    id: 'flat-punch',
    label: 'Flat Punch',
    detail: 'Deep reach with extra forward cant for flat returns.',
    pivotPosition: { x: 0.03, y: 0.09, z: -0.14 },
    pivotRotation: { x: -0.4, y: 0.18, z: 0.16 },
    headRotation: { x: Math.PI / 1.76, y: 0.2, z: 0.22 },
    depthOffset: -0.02,
    rollOffset: 0.12
  },
  {
    id: 'backhand-shield',
    label: 'Backhand Shield',
    detail: 'Backhand-ready flip with a slight upward spoon.',
    pivotPosition: { x: -0.03, y: 0.11, z: -0.17 },
    pivotRotation: { x: -0.31, y: Math.PI - 0.08, z: -0.04 },
    headRotation: { x: Math.PI / 1.96, y: Math.PI - 0.06, z: 0.14 },
    depthOffset: -0.08,
    rollOffset: 0.1
  },
  {
    id: 'touch-cradle',
    label: 'Touch Cradle',
    detail: 'Lowered handle with open face for soft drop pickups.',
    pivotPosition: { x: -0.018, y: 0.085, z: -0.12 },
    pivotRotation: { x: -0.2, y: -0.14, z: -0.12 },
    headRotation: { x: Math.PI / 2.04, y: -0.1, z: -0.16 },
    depthOffset: 0.01,
    rollOffset: -0.05
  },
  {
    id: 'net-poach',
    label: 'Net Poach',
    detail: 'High elbow tilt to attack floaters above the tape.',
    pivotPosition: { x: -0.005, y: 0.18, z: -0.19 },
    pivotRotation: { x: -0.22, y: 0.06, z: -0.1 },
    headRotation: { x: Math.PI / 1.88, y: 0.04, z: -0.12 },
    depthOffset: -0.02,
    rollOffset: -0.02
  },
  {
    id: 'lob-guard',
    label: 'Lob Guard',
    detail: 'Shielded hoop with elevated wrist for moonballs.',
    pivotPosition: { x: -0.04, y: 0.21, z: -0.24 },
    pivotRotation: { x: -0.18, y: -0.04, z: -0.2 },
    headRotation: { x: Math.PI / 1.86, y: -0.08, z: -0.24 },
    depthOffset: -0.06,
    rollOffset: -0.1
  },
  {
    id: 'sidecar-angle',
    label: 'Sidecar Angle',
    detail: 'Side-biased whip to carve crosscourt angles.',
    pivotPosition: { x: 0.06, y: 0.13, z: -0.18 },
    pivotRotation: { x: -0.26, y: 0.24, z: 0.18 },
    headRotation: { x: Math.PI / 1.9, y: 0.26, z: 0.24 },
    depthOffset: -0.03,
    rollOffset: 0.12
  },
  {
    id: 'steady-block',
    label: 'Steady Block',
    detail: 'Compact hold with extra stability for reaction volleys.',
    pivotPosition: { x: 0.01, y: 0.11, z: -0.13 },
    pivotRotation: { x: -0.29, y: 0.02, z: 0.03 },
    headRotation: { x: Math.PI / 1.94, y: 0.02, z: 0.08 },
    depthOffset: 0.01,
    rollOffset: 0.02
  }
];

const BASE_MIN_SWIPE = 220;
const BASE_MAX_SWIPE = 1400;
// Reduce the baseline strike force so ball launches are 20% softer overall
const BASE_HIT_FORCE = 4.6 * 0.35 * 0.8;
const BASE_SPEED_CAP = 22.5 * BASE_HIT_FORCE;
const BASE_TENNIS_DIMENSIONS = { length: 23.77, width: 9.2 };
const BASE_ARCADE_CAMERA = { height: 9, offset: 16 };
const BASE_ARCADE_APRON = 4;
const BASE_PLAYER_DEPTH = 1.5;
const SIMULATION_TICK = {
  baseStep: 1 / 120,
  maxSubsteps: 8,
  wallRebound: 0.7
};

function buildRoyalGrandstand() {
  const group = new THREE.Group();
  const seatMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x15306d,
    roughness: 0.3,
    metalness: 0.18,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25
  });
  const frameMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x2b303a,
    roughness: 0.55,
    metalness: 0.35
  });
  const concreteMaterial = new THREE.MeshStandardMaterial({
    color: 0x7b7b7b,
    roughness: 0.84,
    metalness: 0.05
  });

  const seatGeo = new THREE.BoxGeometry(1.25, 0.16, 1.1);
  const backGeo = new THREE.BoxGeometry(1.25, 0.82, 0.12);
  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);

  function buildTier(offsetX, baseY, depthOffset) {
    const tier = new THREE.Group();
    const seatsPerRow = 18;
    const rows = 8;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < seatsPerRow; c += 1) {
        if (Math.abs(c - seatsPerRow / 2) <= 0.5) continue;
        if (c < 2 || c > seatsPerRow - 3) continue;
        const x = offsetX + (c - seatsPerRow / 2) * 1.7;
        const y = baseY + r * 0.78;
        const z = depthOffset - r * 1.8;
        const seat = new THREE.Mesh(seatGeo, seatMaterial);
        seat.position.set(x, y, z);
        const back = new THREE.Mesh(backGeo, seatMaterial);
        back.position.set(x, y + 0.46, z - 0.55);
        const legL = new THREE.Mesh(legGeo, frameMaterial);
        legL.position.set(x - 0.55, y - 0.35, z + 0.35);
        const legR = legL.clone();
        legR.position.x = x + 0.55;
        tier.add(seat, back, legL, legR);
      }
      const tread = new THREE.Mesh(new THREE.BoxGeometry(32, 0.32, 1.7), concreteMaterial);
      tread.position.set(offsetX, baseY + r * 0.78 - 0.38, depthOffset - r * 1.8 - 0.85);
      tier.add(tread);
    }
    return tier;
  }

  const tiers = [
    { baseY: 0, depth: 0 },
    { baseY: 5.6, depth: -15 },
    { baseY: 11.2, depth: -30 },
    { baseY: 16.8, depth: -45 }
  ];
  tiers.forEach(({ baseY, depth }) => {
    group.add(buildTier(-15, baseY, depth));
    group.add(buildTier(15, baseY, depth));
    const walkway = new THREE.Mesh(new THREE.BoxGeometry(68, 0.42, 6), concreteMaterial);
    walkway.position.set(0, baseY - 0.44, depth - 6);
    walkway.receiveShadow = true;
    group.add(walkway);
  });

  const suiteHeight = tiers[tiers.length - 1].baseY + 0.78 * 7 + 1.2;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(72, 0.5, 14), concreteMaterial);
  deck.position.set(0, suiteHeight, -42);
  deck.castShadow = deck.receiveShadow = true;
  group.add(deck);

  const suiteMaterial = new THREE.MeshStandardMaterial({ color: 0x3a414d, roughness: 0.52, metalness: 0.45 });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xbfd9ff,
    roughness: 0.1,
    transmission: 0.85,
    transparent: true,
    opacity: 0.65,
    ior: 1.45
  });
  for (let i = -2; i <= 2; i += 1) {
    const x = i * 12;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 11), suiteMaterial);
    frame.position.set(x, suiteHeight + 2.3, -45);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), glassMaterial);
    glass.position.set(x, suiteHeight + 2.3, -39);
    group.add(frame, glass);
  }

  const roofMat = new THREE.MeshPhysicalMaterial({
    color: 0x1c2430,
    roughness: 0.34,
    metalness: 0.55,
    clearcoat: 0.35,
    clearcoatRoughness: 0.22,
    side: THREE.DoubleSide
  });
  const roofGeo = new THREE.PlaneGeometry(96, 110, 16, 8);
  const attr = roofGeo.attributes.position;
  for (let i = 0; i < attr.count; i += 1) {
    const x = attr.getX(i);
    const y = attr.getY(i);
    const arch = Math.pow(Math.max(0, 1 - (x / 48) ** 2), 1.1);
    const drop = Math.pow((y + 55) / 110, 1.6) * 8;
    attr.setZ(i, 9 + arch * 11 - drop);
  }
  attr.needsUpdate = true;
  roofGeo.computeVertexNormals();
  roofGeo.rotateX(-Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, suiteHeight + 6.4, -52);
  group.add(roof);

  group.scale.setScalar(0.35);
  group.position.y = 0.1;
  return group;
}

function buildCornerSlice() {
  const group = new THREE.Group();
  const seatMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x15306d,
    roughness: 0.3,
    metalness: 0.18,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25
  });
  const frameMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x2b303a,
    roughness: 0.55,
    metalness: 0.35
  });
  const concreteMaterial = new THREE.MeshStandardMaterial({
    color: 0x7b7b7b,
    roughness: 0.84,
    metalness: 0.05
  });
  const seatGeo = new THREE.BoxGeometry(0.95, 0.14, 0.88);
  const backGeo = new THREE.BoxGeometry(0.95, 0.72, 0.1);
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.68, 8);
  const rows = 5;
  const seatsBase = 7;
  for (let r = 0; r < rows; r += 1) {
    const seats = seatsBase - r;
    for (let c = 0; c < seats; c += 1) {
      const x = (c - (seats - 1) / 2) * 1.1 + r * 0.22;
      const y = r * 0.66;
      const z = r * 1.18;
      const seat = new THREE.Mesh(seatGeo, seatMaterial);
      seat.position.set(x, y, z);
      const back = new THREE.Mesh(backGeo, seatMaterial);
      back.position.set(x, y + 0.42, z - 0.42);
      const legL = new THREE.Mesh(legGeo, frameMaterial);
      legL.position.set(x - 0.42, y - 0.32, z + 0.24);
      const legR = legL.clone();
      legR.position.x = x + 0.42;
      group.add(seat, back, legL, legR);
    }
    const tread = new THREE.Mesh(new THREE.BoxGeometry(14 - r * 1.6, 0.3, 1.24), concreteMaterial);
    tread.position.set(r * 0.12, r * 0.66 - 0.3, r * 1.18 - 0.62);
    group.add(tread);
  }
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(10, 12, 0.4, 3), concreteMaterial);
  plate.rotation.y = Math.PI / 2;
  plate.position.set(0, -0.2, -1.6);
  group.add(plate);
  return group;
}

function buildGrandEntranceStairs({
  stepCount = 10,
  run = 0.42,
  rise = 0.2,
  width = 8.5,
  landingDepth = 1.4
} = {}) {
  const stairs = new THREE.Group();
  const treadMat = new THREE.MeshStandardMaterial({ color: 0xcdd5e0, roughness: 0.82, metalness: 0.12 });
  const riserMat = new THREE.MeshStandardMaterial({ color: 0xb3bdcc, roughness: 0.78, metalness: 0.18 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x8f9bb0, roughness: 0.7, metalness: 0.22 });

  for (let i = 0; i < stepCount; i += 1) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(run, rise * 0.95, width), treadMat);
    tread.position.set((i + 0.5) * run, (i + 0.5) * rise, 0);
    stairs.add(tread);

    const riser = new THREE.Mesh(new THREE.BoxGeometry(0.05, rise, width * 0.96), riserMat);
    riser.position.set((i + 1) * run, (i + 0.5) * rise, 0);
    stairs.add(riser);
  }

  const landing = new THREE.Mesh(new THREE.BoxGeometry(landingDepth, rise * 0.8, width * 1.02), treadMat);
  landing.position.set(stepCount * run + landingDepth / 2, stepCount * rise + (rise * 0.8) / 2, 0);
  stairs.add(landing);

  const sideHeight = stepCount * rise + rise * 0.8;
  const sideThickness = 0.16;
  const sideLength = stepCount * run + landingDepth;
  const sideGeo = new THREE.BoxGeometry(sideLength, sideHeight, sideThickness);
  const sideL = new THREE.Mesh(sideGeo, sideMat);
  sideL.position.set(sideLength / 2, sideHeight / 2, width / 2 + sideThickness / 2);
  const sideR = sideL.clone();
  sideR.position.z = -width / 2 - sideThickness / 2;
  stairs.add(sideL, sideR);

  const stringerGeo = new THREE.BoxGeometry(sideLength, rise * 0.6, sideThickness * 2.4);
  const stringerY = rise * 0.3;
  const stringerL = new THREE.Mesh(stringerGeo, sideMat);
  stringerL.position.set(sideLength / 2, stringerY, width / 2 - sideThickness * 0.9);
  const stringerR = stringerL.clone();
  stringerR.position.z = -width / 2 + sideThickness * 0.9;
  stairs.add(stringerL, stringerR);

  return stairs;
}

export default function TennisBattleRoyal3D({ playerName, stakeLabel, trainingMode = false }) {
  const containerRef = useRef(null);
  const playerLabel = playerName || 'You';
  const cpuLabel = 'CPU';
  const [configMenuOpen, setConfigMenuOpen] = useState(false);
  const [broadcastId, setBroadcastId] = useState(BROADCAST_TECHNIQUES[0].id);
  const [physicsId, setPhysicsId] = useState(PHYSICS_PROFILES[0].id);
  const [touchId, setTouchId] = useState(TOUCH_TECHNIQUES[0].id);
  const [racketOrientationId, setRacketOrientationId] = useState(RACKET_ORIENTATIONS[0].id);
  const broadcastProfileRef = useRef(BROADCAST_TECHNIQUES[0]);
  const physicsProfileRef = useRef(PHYSICS_PROFILES[0]);
  const touchProfileRef = useRef(TOUCH_TECHNIQUES[0]);
  const racketOrientationRef = useRef(RACKET_ORIENTATIONS[0]);
  const suffixParts = [];
  if (playerName) suffixParts.push(`${playerName} vs AI`);
  if (stakeLabel) suffixParts.push(`Stake ${stakeLabel}`);
  const matchTag = suffixParts.join(' · ');
    const introMessage = trainingMode ? 'Training · Swipe to start every serve' : 'Swipe & Hit';
  const [msg, setMsg] = useState(introMessage);
  const [hudInfo, setHudInfo] = useState(() => ({
    points: '0 - 0',
    games: '0 - 0',
    sets: '0 - 0',
    server: playerLabel,
    side: 'deuce',
    attempts: 2,
    playerSets: 0,
    cpuSets: 0,
    playerGames: 0,
    cpuGames: 0,
    playerPointLabel: '0',
    cpuPointLabel: '0'
  }));
  const trainingSteps = [
    {
      id: 'swipeServe',
      title: 'Serve with a swipe',
      detail: 'Swipe upward to launch the ball.'
    },
    {
      id: 'landServe',
      title: 'Ball in the service box',
      detail: 'Make sure the first bounce lands on the opponent’s side.'
    },
    {
      id: 'rallyHit',
      title: 'Play a rally',
      detail: 'Wait for the CPU return and hit the ball again.'
    },
    {
      id: 'winPoint',
      title: 'Win a point',
      detail: 'Keep the rally going until the CPU faults.'
    }
  ];
  const [trainingStatus, setTrainingStatus] = useState(() =>
    Object.fromEntries(trainingSteps.map((step) => [step.id, !trainingMode]))
  );
  const nextTrainingStep = trainingSteps.find((step) => !trainingStatus[step.id]);
  const trainingCompleted = !nextTrainingStep && trainingMode;
  const [taskToast, setTaskToast] = useState(() =>
    trainingMode
      ? {
          id: trainingSteps[0].id,
          title: `Detyra: ${trainingSteps[0].title}`,
          detail: trainingSteps[0].detail
        }
      : null
  );
  const lastTaskToastId = useRef(null);

  const audioRef = useRef({ net: null, kick: null, score: null, out: null });

  const applySoundSettings = useCallback(() => {
    const volume = getGameVolume();
    const muted = isGameMuted();
    Object.values(audioRef.current).forEach((audio) => {
      if (!audio) return;
      audio.volume = muted ? 0 : volume;
      audio.muted = muted;
    });
  }, []);

  useEffect(() => {
    const net = new Audio(SOUND_SOURCES.net);
    const kick = new Audio(SOUND_SOURCES.kick);
    const score = new Audio(SOUND_SOURCES.score);
    const out = new Audio(SOUND_SOURCES.out);
    audioRef.current = { net, kick, score, out };
    applySoundSettings();

    const handleVolume = () => applySoundSettings();
    const handleMute = () => applySoundSettings();
    window.addEventListener('gameVolumeChanged', handleVolume);
    window.addEventListener('gameMuteChanged', handleMute);

    return () => {
      window.removeEventListener('gameVolumeChanged', handleVolume);
      window.removeEventListener('gameMuteChanged', handleMute);
      Object.values(audioRef.current).forEach((audio) => {
        try {
          audio.pause();
        } catch (err) {}
      });
      audioRef.current = { net: null, kick: null, score: null, out: null };
    };
  }, [applySoundSettings]);

  const playSound = useCallback((key) => {
    const audio = audioRef.current[key];
    if (!audio || isGameMuted()) return;
    audio.currentTime = 0;
    audio.volume = getGameVolume();
    audio.play().catch(() => {});
  }, []);

  const playKickSound = useCallback(() => playSound('kick'), [playSound]);
  const playNetSound = useCallback(() => playSound('net'), [playSound]);
  const playScoreSound = useCallback(() => playSound('score'), [playSound]);
  const playOutSound = useCallback(() => playSound('out'), [playSound]);

  useEffect(() => {
    const profile = BROADCAST_TECHNIQUES.find((p) => p.id === broadcastId) || BROADCAST_TECHNIQUES[0];
    broadcastProfileRef.current = profile;
  }, [broadcastId]);

  useEffect(() => {
    physicsProfileRef.current = PHYSICS_PROFILES.find((p) => p.id === physicsId) || PHYSICS_PROFILES[0];
  }, [physicsId]);

  useEffect(() => {
    touchProfileRef.current = TOUCH_TECHNIQUES.find((p) => p.id === touchId) || TOUCH_TECHNIQUES[0];
  }, [touchId]);

  useEffect(() => {
    racketOrientationRef.current =
      RACKET_ORIENTATIONS.find((p) => p.id === racketOrientationId) || RACKET_ORIENTATIONS[0];
  }, [racketOrientationId]);

  useEffect(() => {
    if (!trainingMode) return undefined;
    const stepId = nextTrainingStep?.id || (trainingCompleted ? 'done' : null);
    if (!stepId || stepId === lastTaskToastId.current) return undefined;
    lastTaskToastId.current = stepId;
    const toastTitle = nextTrainingStep ? `Task: ${nextTrainingStep.title}` : 'Training complete';
    const toastDetail = nextTrainingStep
      ? nextTrainingStep.detail
      : 'Tasks complete, keep playing!';
    setTaskToast({ id: stepId, title: toastTitle, detail: toastDetail });
    const timer = setTimeout(() => setTaskToast(null), 4200);
    return () => clearTimeout(timer);
  }, [nextTrainingStep, trainingCompleted, trainingMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    let W = Math.max(1, container.clientWidth || window.innerWidth || 360);
    let H = Math.max(1, container.clientHeight || window.innerHeight || 640);
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    else renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.85;
    renderer.shadowMap.enabled = false;
    renderer.setClearColor(0x87ceeb, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    const isNarrow = Math.min(W, H) < 860;
    const camera = new THREE.PerspectiveCamera(isNarrow ? 64 : 60, W / H, 0.05, 800);
    const smoothCameraPos = new THREE.Vector3();
    const smoothCameraLook = new THREE.Vector3(0, 1.1, 0);
    smoothCameraPos.copy(camera.position);
    let smoothFov = camera.fov;
    let orbitYaw = 0;
    let orbitPitch = 0.18;

    const courtL = BASE_TENNIS_DIMENSIONS.length;
    const courtW = BASE_TENNIS_DIMENSIONS.width;
    const lengthScale = courtL / BASE_TENNIS_DIMENSIONS.length;
    const widthScale = courtW / BASE_TENNIS_DIMENSIONS.width;
    const courtScale = Math.max(lengthScale, widthScale);
    const halfW = courtW / 2;
    const halfL = courtL / 2;
    const SERVICE_LINE_Z = 6.4 * lengthScale;
    const SERVICE_BOX_INNER = 0.2 * widthScale;
    const apron = BASE_ARCADE_APRON * courtScale;

    const playerDepth = BASE_PLAYER_DEPTH * lengthScale;
    const playerZ = halfL - playerDepth;
    const cpuZ = -halfL + playerDepth;

    const baseCamBack = BASE_ARCADE_CAMERA.offset * lengthScale;
    const baseCamHeight = BASE_ARCADE_CAMERA.height * lengthScale;
    let camBack = baseCamBack;
    let camHeight = isNarrow ? baseCamHeight * 0.92 : baseCamHeight;
    const camBackRange = { min: halfL + apron * 0.98, max: halfL + apron * 1.7 };
    const camHeightRange = { min: baseCamHeight * 0.8, max: baseCamHeight * 1.1 };
    const cameraMinZ = halfL + apron * 0.62;
    const cameraMaxZ = halfL + apron * 2.05;
    const cameraSideLimit = halfW * 0.94;

    const hemi = new THREE.HemisphereLight(0xf2f6ff, 0xb7d4a8, 0.9);
    hemi.position.set(0, 60, 0);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff6cf, 1.45);
    sun.position.set(-28, 52, 24);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xcfd8ff, 0.55);
    fill.position.set(18, 22, -14);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xb5e7ff, 0.48);
    rim.position.set(-16, 18, -28);
    scene.add(rim);
    const bounce = new THREE.AmbientLight(0xe5f1ff, 0.2);
    scene.add(bounce);

    const maxAniso = renderer.capabilities.getMaxAnisotropy?.() || 8;
    const grassURL = 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg';

    const skyGeo = new THREE.SphereGeometry(420, 48, 32);
    const colors = [];
    const topColor = new THREE.Color(0x8fc9ff);
    const horizonColor = new THREE.Color(0xdaf1ff);
    const positionAttr = skyGeo.attributes.position;
    for (let i = 0; i < positionAttr.count; i += 1) {
      const y = positionAttr.getY(i);
      const t = THREE.MathUtils.clamp((y + 420) / 420, 0, 1);
      const color = topColor.clone().lerp(horizonColor, Math.pow(1 - t, 0.6));
      colors.push(color.r, color.g, color.b);
    }
    skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(
      skyGeo,
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })
    );
    sky.position.y = -18;
    scene.add(sky);

    const matGrass = new THREE.MeshStandardMaterial({
      color: 0x4fa94c,
      roughness: 0.9,
      metalness: 0.0,
      emissive: new THREE.Color('#1c5c22'),
      emissiveIntensity: 0.03
    });

    function loadDeshadowedGrass(url, onReady) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const aspect = img.height / img.width;
        const w = 1024;
        const h = Math.round(w * aspect);
        const base = document.createElement('canvas');
        base.width = w;
        base.height = h;
        const gb = base.getContext('2d');
        gb.drawImage(img, 0, 0, w, h);
        const small = document.createElement('canvas');
        small.width = Math.max(64, w >> 4);
        small.height = Math.max(64, h >> 4);
        const gs = small.getContext('2d');
        gs.imageSmoothingEnabled = true;
        gs.drawImage(base, 0, 0, small.width, small.height);
        const blur = document.createElement('canvas');
        blur.width = w;
        blur.height = h;
        const gl = blur.getContext('2d');
        gl.imageSmoothingEnabled = true;
        gl.drawImage(small, 0, 0, w, h);

        const src = gb.getImageData(0, 0, w, h);
        const low = gl.getImageData(0, 0, w, h);
        const d = src.data;
        const b = low.data;
        const eps = 1e-3;
        const target = 138;
        for (let i = 0; i < d.length; i += 4) {
          const L = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2];
          const k = target / (L + eps);
          d[i] = Math.max(0, Math.min(255, d[i] * k));
          d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * k));
          d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * k));
        }
        gb.putImageData(src, 0, 0);
        gb.globalCompositeOperation = 'overlay';
        gb.fillStyle = 'rgba(40,120,44,0.08)';
        gb.fillRect(0, 0, w, h);
        gb.globalCompositeOperation = 'source-over';

        const tex = new THREE.CanvasTexture(base);
        tex.anisotropy = Math.min(16, maxAniso);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
        else tex.colorSpace = THREE.SRGBColorSpace;
        tex.repeat.set(8, 18);
        onReady(tex);
      };
      img.src = url;
    }

    function courtLinesTex(w = 2048, h = 4096) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.clearRect(0, 0, w, h);
      const s = h / courtL;
      const lineW = 12;
      g.strokeStyle = '#ffffff';
      g.lineWidth = lineW;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      const X = (x) => w / 2 + x * s;
      const Z = (z) => h / 2 + z * s;
      const line = (x1, z1, x2, z2) => {
        g.beginPath();
        g.moveTo(X(x1), Z(z1));
        g.lineTo(X(x2), Z(z2));
        g.stroke();
      };
      const box = (x1, z1, x2, z2) => {
        line(x1, z1, x2, z1);
        line(x2, z1, x2, z2);
        line(x2, z2, x1, z2);
        line(x1, z2, x1, z1);
      };
      box(-halfW, -halfL, halfW, halfL);
      line(-halfW, -halfL, halfW, -halfL);
      line(-halfW, halfL, halfW, halfL);
      line(-halfW, -SERVICE_LINE_Z, halfW, -SERVICE_LINE_Z);
      line(-halfW, SERVICE_LINE_Z, halfW, SERVICE_LINE_Z);
      line(0, -SERVICE_LINE_Z, 0, SERVICE_LINE_Z);
      g.fillStyle = '#ffffff';
      const padLenM = 1.2;
      const padWideM = 0.2;
      const z0 = -padLenM / 2;
      const z1 = padLenM / 2;
      const pxW = padWideM * s;
      const hgt = Math.abs(Z(z1) - Z(z0));
      g.fillRect(X(-halfW - padWideM / 2), Math.min(Z(z0), Z(z1)), pxW, hgt);
      g.fillRect(X(halfW - padWideM / 2), Math.min(Z(z0), Z(z1)), pxW, hgt);
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = Math.min(16, maxAniso);
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.needsUpdate = true;
      return t;
    }

    const matLines = new THREE.MeshBasicMaterial({
      map: courtLinesTex(),
      transparent: true,
      opacity: 0.995,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      depthWrite: false
    });

    function trackTex(w = 1024, h = 1024) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#b33a2c';
      g.fillRect(0, 0, w, h);
      const dots = Math.floor(w * h * 0.004);
      for (let i = 0; i < dots; i += 1) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = Math.random() * 1.6 + 0.2;
        g.fillStyle = Math.random() < 0.5 ? 'rgba(255,190,180,0.35)' : 'rgba(40,12,10,0.35)';
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = Math.min(16, maxAniso);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace;
      else t.colorSpace = THREE.SRGBColorSpace;
      t.repeat.set(1, 1);
      return t;
    }
    const matTrack = new THREE.MeshStandardMaterial({ map: trackTex(), roughness: 0.96, metalness: 0.0 });

    const trackMesh = new THREE.Mesh(new THREE.PlaneGeometry(courtW + apron * 2, courtL + apron * 2), matTrack);
    trackMesh.rotation.x = -Math.PI / 2;
    trackMesh.position.y = -0.001;
    scene.add(trackMesh);

    const grassMesh = new THREE.Mesh(new THREE.PlaneGeometry(courtW, courtL), matGrass);
    grassMesh.rotation.x = -Math.PI / 2;
    grassMesh.position.y = 0.0;
    scene.add(grassMesh);

    const linesMesh = new THREE.Mesh(new THREE.PlaneGeometry(courtW, courtL), matLines);
    linesMesh.rotation.x = -Math.PI / 2;
    linesMesh.position.y = 0.002;
    scene.add(linesMesh);

    loadDeshadowedGrass(grassURL, (tex) => {
      matGrass.map = tex;
      matGrass.needsUpdate = true;
    });

    function tennisNetTex(w = 1024, h = 512, cell = 8, thickness = 2) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(18,18,18,0.96)';
      g.lineWidth = thickness;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      for (let y = cell; y <= h - cell; y += cell) {
        g.beginPath();
        g.moveTo(cell, y);
        g.lineTo(w - cell, y);
        g.stroke();
      }
      for (let x = cell; x <= w - cell; x += cell) {
        g.beginPath();
        g.moveTo(x, cell);
        g.lineTo(x, h - cell);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.06)';
      for (let y = cell; y <= h - cell; y += cell) {
        for (let x = cell; x <= w - cell; x += cell) {
          g.fillRect(x - 1, y - 1, 2, 2);
        }
      }
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = Math.min(8, maxAniso);
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    }

    const matTape = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const matPost = new THREE.MeshStandardMaterial({ color: 0xb7bcc7, roughness: 0.45, metalness: 0.35 });
    const netH = 0.914;
    const netW = courtW;
    const netTex = tennisNetTex(1024, 512, 7, 2);
    const netMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(netW, netH, 1, 1),
      new THREE.MeshStandardMaterial({ map: netTex, roughness: 0.8, metalness: 0.0, transparent: true, opacity: 1.0, color: 0xffffff })
    );
    netMesh.position.set(0, netH / 2, 0);
    scene.add(netMesh);
    const tapeH = 0.09;
    const topTape = new THREE.Mesh(new THREE.BoxGeometry(netW, tapeH, 0.02), matTape);
    topTape.position.set(0, netH - tapeH / 2, 0.005);
    scene.add(topTape);
    const botTape = new THREE.Mesh(new THREE.BoxGeometry(netW, tapeH, 0.02), matTape);
    botTape.position.set(0, tapeH / 2, 0.005);
    scene.add(botTape);
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.35, 16), matPost);
    postL.position.set(-netW / 2, 0.675, 0);
    scene.add(postL);
    const postR = postL.clone();
    postR.position.x = netW / 2;
    scene.add(postR);
    const capL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), matPost);
    capL.position.set(-netW / 2, 1.35, 0);
    scene.add(capL);
    const capR = capL.clone();
    capR.position.x = netW / 2;
    scene.add(capR);

    const stand = buildRoyalGrandstand();
    const baseGap = 8;
    const sideGap = 9;
    const north = stand.clone();
    north.position.z = -(halfL + baseGap);
    const south = stand.clone();
    south.rotation.y = Math.PI;
    south.position.z = halfL + baseGap;
    const east = stand.clone();
    east.rotation.y = -Math.PI / 2;
    east.position.x = halfW + sideGap;
    const west = stand.clone();
    west.rotation.y = Math.PI / 2;
    west.position.x = -(halfW + sideGap);
    const eastRear = stand.clone();
    eastRear.rotation.y = -Math.PI / 2;
    eastRear.position.x = halfW + sideGap + 7.8;
    const westRear = stand.clone();
    westRear.rotation.y = Math.PI / 2;
    westRear.position.x = -(halfW + sideGap + 7.8);
    scene.add(north, south, east, west, eastRear, westRear);

    const cornerNE = buildCornerSlice();
    cornerNE.position.set(halfW + sideGap - 0.6, 0, -(halfL + baseGap - 0.6));
    cornerNE.rotation.y = -Math.PI / 2;
    const cornerNW = buildCornerSlice();
    cornerNW.position.set(-(halfW + sideGap - 0.6), 0, -(halfL + baseGap - 0.6));
    cornerNW.rotation.y = Math.PI;
    const cornerSE = buildCornerSlice();
    cornerSE.position.set(halfW + sideGap - 0.6, 0, halfL + baseGap - 0.6);
    const cornerSW = buildCornerSlice();
    cornerSW.position.set(-(halfW + sideGap - 0.6), 0, halfL + baseGap - 0.6);
    cornerSW.rotation.y = Math.PI / 2;
    scene.add(cornerNE, cornerNW, cornerSE, cornerSW);

    const stairsEast = buildGrandEntranceStairs({ width: courtL + apron * 1.2 });
    stairsEast.position.set(halfW + apron + 0.4, 0, 0);
    const stairsWest = stairsEast.clone();
    stairsWest.rotation.y = Math.PI;
    stairsWest.position.set(-(halfW + apron + 0.4), 0, 0);
    scene.add(stairsEast, stairsWest);

    const ump = new THREE.Group();
    const legH = 1.45;
    const legR = 0.035;
    const span = 0.6;
    const legMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.6, metalness: 0.2 });
    for (let sx of [-1, 1]) {
      for (let sz of [-1, 1]) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR, legH, 12), legMat);
        cyl.position.set((sx * span) / 2, legH / 2, (sz * span) / 2);
        ump.add(cyl);
      }
    }
    const plat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.72), new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.7, metalness: 0.15 }));
    plat.position.y = legH + 0.03;
    ump.add(plat);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.6 }));
    seat.position.set(0, legH + 0.36, 0);
    ump.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.4, 0.04), new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.6 }));
    back.position.set(0, legH + 0.56, -0.18);
    ump.add(back);
    const ladder = new THREE.Group();
    const railMat = new THREE.MeshStandardMaterial({ color: 0xbfbfbf, roughness: 0.55 });
    const railL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 10), railMat);
    railL.position.set(-0.28, 0.6, 0.42);
    ladder.add(railL);
    const railR2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 10), railMat);
    railR2.position.set(0.28, 0.6, 0.42);
    ladder.add(railR2);
    for (let i = 0; i < 5; i += 1) {
      const y = 0.18 + i * 0.2;
      const step = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.52, 10), railMat);
      step.rotation.z = Math.PI / 2;
      step.position.set(0, y, 0.42);
      ladder.add(step);
    }
    ump.add(ladder);
    ump.position.set(halfW + 0.75, 0, 0.1);
    scene.add(ump);

    class EllipseCurve3D extends THREE.Curve {
      constructor(a = 0.74, b = 0.92) {
        super();
        this.a = a;
        this.b = b;
      }
      getPoint(t) {
        const ang = t * 2 * Math.PI;
        return new THREE.Vector3(this.a * Math.cos(ang), 0, this.b * Math.sin(ang));
      }
    }

    function buildRacketURT() {
      const g = new THREE.Group();
      const a = 0.74;
      const b = 0.92;
      const tubeRad = 0.032;
      const ellipse = new EllipseCurve3D(a, b);
      const hoopGeo = new THREE.TubeGeometry(ellipse, 220, tubeRad, 20, true);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.55, roughness: 0.38 });
      const hoop = new THREE.Mesh(hoopGeo, frameMat);
      g.add(hoop);
      const bump = new THREE.Mesh(new THREE.TorusGeometry(a * 0.985, 0.008, 10, 160), new THREE.MeshStandardMaterial({ color: 0x1a1f27, roughness: 0.6 }));
      bump.rotation.x = Math.PI / 2;
      bump.scale.z = b / a;
      bump.position.y = 0.009;
      g.add(bump);
      const strings = new THREE.Group();
      const sMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.35, metalness: 0.0 });
      const count = 22;
      const innerA = a - tubeRad * 1.05;
      const innerB = b - tubeRad * 1.05;
      const thick = 0.008;
      for (let i = -(count / 2); i <= count / 2; i += 1) {
        const x = (i * (innerA * 1.7)) / count;
        if (Math.abs(x) >= innerA) continue;
        const zmax = innerB * Math.sqrt(Math.max(0, 1 - (x / innerA) * (x / innerA)));
        const len = Math.max(0.02, zmax * 2 * 0.98);
        const geo = new THREE.BoxGeometry(thick, thick, len);
        const mesh = new THREE.Mesh(geo, sMat);
        mesh.position.set(x, 0, 0);
        strings.add(mesh);
      }
      for (let i = -(count / 2); i <= count / 2; i += 1) {
        const z = (i * (innerB * 1.7)) / count;
        if (Math.abs(z) >= innerB) continue;
        const xmax = innerA * Math.sqrt(Math.max(0, 1 - (z / innerB) * (z / innerB)));
        const len = Math.max(0.02, xmax * 2 * 0.98);
        const geo = new THREE.BoxGeometry(len, thick, thick);
        const mesh = new THREE.Mesh(geo, sMat);
        mesh.position.set(0, 0, z);
        strings.add(mesh);
      }
      g.add(strings);
      function beamBetween(p0, p1, sx = 0.06, sy = 0.1) {
        const d = new THREE.Vector3().subVectors(p1, p0);
        const L = d.length();
        const geo = new THREE.BoxGeometry(sx, sy, L);
        const m = new THREE.Mesh(geo, frameMat);
        const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
        m.position.copy(mid);
        const yaw = Math.atan2(d.x, d.z);
        m.rotation.set(0, yaw, 0);
        return m;
      }
      const alpha = 0.35;
      const thL = -Math.PI / 2 - alpha;
      const thR = -Math.PI / 2 + alpha;
      const innerA2 = a - tubeRad * 0.6;
      const innerB2 = b - tubeRad * 0.6;
      const pL = new THREE.Vector3(innerA2 * Math.cos(thL), 0, innerB2 * Math.sin(thL));
      const pR = new THREE.Vector3(innerA2 * Math.cos(thR), 0, innerB2 * Math.sin(thR));
      const joinZ = -(b + 0.55);
      const J = new THREE.Vector3(0, 0, joinZ);
      const armL = beamBetween(pL, J, 0.06, 0.1);
      const armR = beamBetween(pR, J, 0.06, 0.1);
      g.add(armL, armR);
      const handleLen = 2.1;
      const handleR = 0.11;
      const leather = new THREE.ShaderMaterial({
        uniforms: {
          uCol: { value: new THREE.Color('#2b2b2b') },
          uEdge: { value: new THREE.Color('#111') },
          uScale: { value: 24.0 }
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `precision mediump float; varying vec2 vUv; uniform vec3 uCol,uEdge; uniform float uScale; float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);} float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=h(i),b=h(i+vec2(1,0)),c=h(i+vec2(0,1)),d=h(i+vec2(1,1));float nx=mix(a,b,f.x)+(c-a)*f.y*(1.-f.x)+(d-b)*f.x*f.y;return nx;} void main(){ float t = n(vUv*uScale); vec3 col = mix(uEdge,uCol, smoothstep(0.45,0.9,t)); gl_FragColor=vec4(col,1.0);} `
      });
      const handleGeo = new THREE.CylinderGeometry(handleR * 0.9, handleR, handleLen, 40, 1, true);
      const handle = new THREE.Mesh(handleGeo, leather);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(0, 0, joinZ - (handleLen * 0.5 + 0.08));
      g.add(handle);
      const butt = new THREE.Mesh(new THREE.CylinderGeometry(handleR * 0.95, handleR * 0.95, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x0e1116, roughness: 0.8 }));
      butt.rotation.x = Math.PI / 2;
      butt.position.copy(handle.position);
      butt.position.z -= handleLen * 0.5 + 0.11;
      g.add(butt);
      const decalCanvas = document.createElement('canvas');
      const dctx = decalCanvas.getContext('2d');
      decalCanvas.width = 512;
      decalCanvas.height = 128;
      dctx.fillStyle = '#22262e';
      dctx.fillRect(0, 0, 512, 128);
      dctx.font = '700 72px system-ui';
      dctx.fillStyle = '#f4f6fa';
      dctx.textAlign = 'center';
      dctx.fillText('OS‑Racquet', 256, 88);
      const decalTex = new THREE.CanvasTexture(decalCanvas);
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.18), new THREE.MeshBasicMaterial({ map: decalTex, transparent: true }));
      decal.position.set(0, 0.08, 0.55);
      g.add(decal);
      return g;
    }

    function buildBallURT() {
      const felt = new THREE.ShaderMaterial({
        uniforms: {
          uA: { value: new THREE.Color('#e6ff3b') },
          uB: { value: new THREE.Color('#cfe93a') },
          uExp: { value: 1.85 }
        },
        vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP=position; vN=normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `precision mediump float; varying vec3 vP; varying vec3 vN; uniform vec3 uA,uB; uniform float uExp; float h(vec3 p){return fract(sin(dot(p,vec3(27.1,57.7,12.4)))*43758.5453);} float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); float a=h(i), b=h(i+vec3(1,0,0)), c=h(i+vec3(0,1,0)), d=h(i+vec3(1,1,0)); float e=h(i+vec3(0,0,1)), f2=h(i+vec3(1,0,1)), g=h(i+vec3(0,1,1)), h2=h(i+vec3(1,1,1)); float nx=mix(a,b,f.x)+(c-a)*f.y*(1.0-f.x)+(d-b)*f.x*f.y; float ny=mix(e,f2,f.x)+(g-e)*f.y*(1.0-f.x)+(h2-f2)*f.x*f.y; return mix(nx,ny,f.z);} float fbm(vec3 p){ float v=0.,amp=0.5; for(int i=0;i<6;i++){ v+=amp*n(p); p*=2.02; amp*=0.5;} return v;} vec3 aces(vec3 x){const float A=2.51,B=0.03,C=2.43,D=0.59,E=0.14; vec3 y=max(vec3(0.0),x*uExp); return clamp((y*(A*y+B))/(y*(C*y+D)+E),0.0,1.0);} void main(){ float f=fbm(vP*7.0+normalize(vN)*2.0); vec3 col=mix(uA,uB,smoothstep(0.35,0.8,f)); gl_FragColor=vec4(aces(col),1.0); }`,
        lights: false
      });
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.26, 48, 36), felt);
      const seamMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      const band = new THREE.TorusGeometry(0.26, 0.008, 12, 96);
      const s1 = new THREE.Mesh(band, seamMat);
      s1.rotation.y = Math.PI / 2;
      ball.add(s1);
      const s2 = new THREE.Mesh(band, seamMat);
      s2.rotation.x = Math.PI / 3;
      ball.add(s2);
      return ball;
    }

    function makeRacket() {
      const root = new THREE.Group();
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 0.1, -0.18);
      headPivot.rotation.x = -0.28;
      root.add(headPivot);
      const urt = buildRacketURT();
      urt.rotation.x = Math.PI / 2;
      urt.position.y = 1.0;
      headPivot.add(urt);
      root.userData = { headPivot, head: urt, swing: 0, swingLR: 0 };
      root.scale.setScalar(0.608);
      return root;
    }

    const ballR = 0.076 * 2.0;
    const ball = buildBallURT();
    const s = ballR / 0.26;
    ball.scale.setScalar(s);
    scene.add(ball);
    const initialPhysics = physicsProfileRef.current;
    const physics = {
      gravity: initialPhysics.gravity,
      airDrag: initialPhysics.airDrag,
      lift: initialPhysics.lift,
      bounceRestitution: initialPhysics.bounceRestitution,
      courtFriction: initialPhysics.courtFriction,
      spinDamping: initialPhysics.spinDamping,
      spinSlip: initialPhysics.spinSlip,
      forceScale: initialPhysics.forceScale,
      speedCap: initialPhysics.speedCap,
      spinBias: initialPhysics.spinBias
    };

    const sC = document.createElement('canvas');
    sC.width = sC.height = 96;
    const sg = sC.getContext('2d');
    const rg = sg.createRadialGradient(48, 48, 8, 48, 48, 46);
    rg.addColorStop(0, 'rgba(0,0,0,0.35)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = rg;
    sg.fillRect(0, 0, 96, 96);
    const sT = new THREE.CanvasTexture(sC);
    const sM = new THREE.SpriteMaterial({ map: sT, transparent: true, depthWrite: false });
    const shadow = new THREE.Sprite(sM);
    shadow.scale.set(ballR * 10, ballR * 10, 1);
    shadow.position.y = 0.01;
    scene.add(shadow);

    const trailN = 14;
    const trailGeom = new THREE.BufferGeometry();
    const trailPos = new Float32Array(trailN * 3);
    trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    const trail = new THREE.Line(
      trailGeom,
      new THREE.LineBasicMaterial({ transparent: true, opacity: 0.44, color: 0xfff45a, linewidth: 2 })
    );
    scene.add(trail);
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = haloCanvas.height = 256;
    const hctx = haloCanvas.getContext('2d');
    const hGrad = hctx.createRadialGradient(128, 128, 16, 128, 128, 128);
    hGrad.addColorStop(0, 'rgba(255, 255, 140, 0.95)');
    hGrad.addColorStop(0.35, 'rgba(255, 227, 92, 0.55)');
    hGrad.addColorStop(1, 'rgba(255, 227, 92, 0.0)');
    hctx.fillStyle = hGrad;
    hctx.fillRect(0, 0, 256, 256);
    const haloTex = new THREE.CanvasTexture(haloCanvas);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false })
    );
    halo.renderOrder = 2;
    halo.scale.setScalar(ballR * 8.5);
    ball.add(halo);
    function updateTrail() {
      for (let i = trailN - 1; i > 0; i -= 1) {
        trailPos[i * 3 + 0] = trailPos[(i - 1) * 3 + 0];
        trailPos[i * 3 + 1] = trailPos[(i - 1) * 3 + 1];
        trailPos[i * 3 + 2] = trailPos[(i - 1) * 3 + 2];
      }
      trailPos[0] = ball.position.x;
      trailPos[1] = ball.position.y;
      trailPos[2] = ball.position.z;
      trailGeom.attributes.position.needsUpdate = true;
    }

    const hitRing = new THREE.Mesh(new THREE.RingGeometry(ballR * 0.86, ballR * 1.12, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    hitRing.rotation.x = -Math.PI / 2;
    hitRing.position.y = 0.002;
    scene.add(hitRing);
    let hitTTL = 0;

    const player = makeRacket();
    player.position.set(0, 0, playerZ);
    player.rotation.y = Math.PI;
    scene.add(player);
    const cpu = makeRacket();
    cpu.position.set(0, 0, cpuZ);
    cpu.rotation.y = 0;
    scene.add(cpu);

    let hitForceMultiplier = BASE_HIT_FORCE;
    let outgoingSpeedCap = BASE_SPEED_CAP;

    const state = {
      gravity: physics.gravity,
      drag: 0.24,
      cor: 0.8,
      fric: 0.18,
      live: false,
      serveBy: 'player',
      serveSide: 'deuce',
      attempts: 2,
      awaitingServeBounce: false,
      rallyStarted: false,
      bounceSide: null,
      matchOver: false,
      score: {
        points: { player: 0, cpu: 0 },
        games: { player: 0, cpu: 0 },
        sets: { player: 0, cpu: 0 }
      }
    };

    function syncPhysicsProfile() {
      const profile = physicsProfileRef.current;
      physics.gravity = profile.gravity;
      physics.airDrag = profile.airDrag;
      physics.lift = profile.lift;
      physics.bounceRestitution = profile.bounceRestitution;
      physics.courtFriction = profile.courtFriction;
      physics.spinDamping = profile.spinDamping;
      physics.spinSlip = profile.spinSlip;
      physics.forceScale = profile.forceScale;
      physics.speedCap = profile.speedCap;
      physics.spinBias = profile.spinBias;
      hitForceMultiplier = BASE_HIT_FORCE * (physics.forceScale ?? 1);
      outgoingSpeedCap = BASE_SPEED_CAP * (physics.speedCap ?? 1);
      state.gravity = physics.gravity;
    }
    const pos = new THREE.Vector3(0, ballR + 0.01, playerZ - 1.0);
    const vel = new THREE.Vector3();
    const spin = new THREE.Vector3();
    const tmpVec = new THREE.Vector3();
    const tangentVel = new THREE.Vector3();
    const spinSurfaceVel = new THREE.Vector3();
    const cameraLook = new THREE.Vector3();
    const cameraTarget = new THREE.Vector3();
    let playerSwing = null;
    let cpuSwing = null;
    function respondToCourtImpact(impactSpeed) {
      const incoming = Math.max(0, impactSpeed);
      const restitution = physics.bounceRestitution ?? 0.92;
      vel.y = incoming * restitution;

      tangentVel.set(vel.x, 0, vel.z);
      spinSurfaceVel.set(-spin.z * ballR, 0, spin.x * ballR);
      const slipBlend = THREE.MathUtils.clamp((physics.spinSlip ?? 0.52) * 0.7, 0, 1);
      tangentVel.addScaledVector(spinSurfaceVel, slipBlend);
      const friction = THREE.MathUtils.clamp(1 - (physics.courtFriction ?? 0.18) * 0.65, 0.6, 0.98);
      tangentVel.multiplyScalar(friction);
      if (tangentVel.lengthSq() < 0.01) tangentVel.set(0, 0, 0);
      vel.x = tangentVel.x;
      vel.z = tangentVel.z;

      const spinDamping = THREE.MathUtils.clamp(physics.spinDamping ?? 0.86, 0.6, 1);
      spin.multiplyScalar(spinDamping);
    }
    let lastHitter = 'player';
    ball.position.copy(pos);

    const opponentOf = (id) => (id === 'player' ? 'cpu' : 'player');
    const POINT_LABELS = ['0', '15', '30', '40'];
    const GAMES_TO_WIN = 4;
    const SETS_TO_WIN = 2;

    function resetRally() {
      state.awaitingServeBounce = false;
      state.rallyStarted = false;
      state.bounceSide = null;
      spin.set(0, 0, 0);
    }

    function formatPoints() {
      const p = state.score.points.player;
      const c = state.score.points.cpu;
      if (p >= 3 && c >= 3) {
        if (p === c) return 'Deuce';
        if (p === c + 1) return `Adv ${playerLabel}`;
        if (c === p + 1) return `Adv ${cpuLabel}`;
      }
      const left = POINT_LABELS[Math.min(p, 3)];
      const right = POINT_LABELS[Math.min(c, 3)];
      return `${playerLabel} ${left} – ${cpuLabel} ${right}`;
    }

    function pointLabelFor(playerKey) {
      const opponentKey = opponentOf(playerKey);
      const me = state.score.points[playerKey];
      const opp = state.score.points[opponentKey];
      if (me >= 3 && opp >= 3) {
        if (me === opp) return '40';
        if (me === opp + 1) return 'AD';
        return '40';
      }
      return POINT_LABELS[Math.min(me, 3)];
    }

    function updateHud() {
      setHudInfo({
        points: formatPoints(),
        games: `${state.score.games.player} - ${state.score.games.cpu}`,
        sets: `${state.score.sets.player} - ${state.score.sets.cpu}`,
        server: state.serveBy === 'player' ? playerLabel : cpuLabel,
        side: state.serveSide,
        attempts: state.attempts,
        playerSets: state.score.sets.player,
        cpuSets: state.score.sets.cpu,
        playerGames: state.score.games.player,
        cpuGames: state.score.games.cpu,
        playerPointLabel: pointLabelFor('player'),
        cpuPointLabel: pointLabelFor('cpu')
      });
    }

    function serviceBoxFor(server) {
      const receive = opponentOf(server);
      const sign = state.serveSide === 'deuce' ? 1 : -1;
      const minX = sign > 0 ? SERVICE_BOX_INNER : -halfW + SERVICE_BOX_INNER;
      const maxX = sign > 0 ? halfW - SERVICE_BOX_INNER : -SERVICE_BOX_INNER;
      const minZ = receive === 'player' ? 0.15 : -SERVICE_LINE_Z + 0.15;
      const maxZ = receive === 'player' ? SERVICE_LINE_Z - 0.15 : -0.15;
      return { minX, maxX, minZ, maxZ };
    }

    function inBox(x, z, box, pad = 0.08) {
      return (
        x >= box.minX - pad &&
        x <= box.maxX + pad &&
        z >= box.minZ - pad &&
        z <= box.maxZ + pad
      );
    }

    function rotateServeSide() {
      state.serveSide = state.serveSide === 'deuce' ? 'ad' : 'deuce';
    }

    function resetForNextPoint() {
      state.attempts = 2;
      resetRally();
      updateHud();
    }

    let matchResetTO = null;

    function handleGameWin(winner, reason = '') {
      const loser = opponentOf(winner);
      const prefix = reason ? `${reason} · ` : '';
      state.score.points.player = 0;
      state.score.points.cpu = 0;
      state.score.games[winner] += 1;
      state.serveSide = 'deuce';
      resetForNextPoint();
      const label = winner === 'player' ? playerLabel : cpuLabel;
      let announce = `${prefix}Game ${label}`;
      const gW = state.score.games[winner];
      const gL = state.score.games[loser];
      if (gW >= GAMES_TO_WIN && gW >= gL + 2) {
        state.score.sets[winner] += 1;
        announce += ` · Set ${label}`;
        state.score.games.player = 0;
        state.score.games.cpu = 0;
        const sW = state.score.sets[winner];
        if (sW >= SETS_TO_WIN) {
          announce += ` · Match ${label}`;
          state.matchOver = true;
          updateHud();
          setMsg(formatMsg(announce));
          if (matchResetTO) {
            try {
              clearTimeout(matchResetTO);
            } catch {}
          }
          matchResetTO = setTimeout(() => {
            state.matchOver = false;
            state.score.points.player = 0;
            state.score.points.cpu = 0;
            state.score.games.player = 0;
            state.score.games.cpu = 0;
            state.score.sets.player = 0;
            state.score.sets.cpu = 0;
            state.serveBy = 'player';
            state.serveSide = 'deuce';
            resetForNextPoint();
            prepareServe('player');
          }, 3600);
          return;
        }
      }
      state.serveBy = opponentOf(state.serveBy);
      updateHud();
      prepareServe(state.serveBy, { announce });
    }

    function awardPoint(winner, reason = '') {
      if (state.matchOver) return;
      const loser = opponentOf(winner);
      const pts = state.score.points;
      const prefix = reason ? `${reason} · ` : '';
      if (pts[winner] >= 3 && pts[loser] >= 3) {
        if (pts[winner] === pts[loser]) {
          pts[winner] += 1;
          rotateServeSide();
          resetForNextPoint();
          const label = winner === 'player' ? playerLabel : cpuLabel;
          prepareServe(state.serveBy, { announce: `${prefix}Adv ${label}` });
          return;
        }
        if (pts[winner] === pts[loser] + 1) {
          handleGameWin(winner, reason);
          return;
        }
        pts[loser] = Math.max(0, pts[loser] - 1);
        rotateServeSide();
        resetForNextPoint();
        prepareServe(state.serveBy, { announce: `${prefix}Deuce` });
        return;
      }
      pts[winner] += 1;
      if (pts[winner] >= 4 && pts[winner] >= pts[loser] + 2) {
        handleGameWin(winner, reason);
        return;
      }
      rotateServeSide();
      resetForNextPoint();
      const label = winner === 'player' ? playerLabel : cpuLabel;
      prepareServe(state.serveBy, { announce: `${prefix}Point ${label}` });
    }

    function finishPoint(winner, reason = '') {
      const normalizedReason = reason.toLowerCase();
      state.live = false;
      resetRally();
      if (normalizedReason.includes('out')) {
        playOutSound();
      } else if (normalizedReason.includes('net')) {
        playNetSound();
      } else {
        playScoreSound();
      }
      awardPoint(winner, reason);
      if (trainingMode && winner === 'player') markTrainingStep('winPoint');
    }

    function registerFault(server, reason) {
      const normalizedReason = reason.toLowerCase();
      const notifyFault = () => {
        if (normalizedReason.includes('net')) playNetSound();
        else if (normalizedReason.includes('out')) playOutSound();
      };
      state.live = false;
      state.awaitingServeBounce = false;
      if (state.matchOver) return;
      state.attempts = Math.max(0, state.attempts - 1);
      if (state.attempts <= 0) {
        const winner = opponentOf(server);
        finishPoint(winner, `${reason} · Double Fault`);
        return;
      }
      notifyFault();
      updateHud();
      const announce = state.attempts === 1 ? `${reason} · 2nd` : reason;
      prepareServe(server, { resetAttempts: false, announce });
    }

    function solveShot(from, to, g, tSec) {
      const t = tSec;
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const dy = to.y - from.y;
      const vx = dx / t;
      const vz = dz / t;
      const vy = (dy - 0.5 * g * t * t) / t;
      return new THREE.Vector3(vx, vy, vz);
    }
    function ensureNetClear(from, v, g, netY, margin = ballR * 0.8) {
      const vz = v.z;
      const dzToNet = 0 - from.z;
      if (Math.abs(vz) < 1e-4) return v;
      const tNet = dzToNet / vz;
      if (tNet <= 0) return v;
      const yNet = from.y + v.y * tNet + 0.5 * g * tNet * tNet;
      const need = netY + margin;
      if (yNet < need) {
        v.y += (need - yNet) / Math.max(0.15, tNet);
      }
      return v;
    }

    function clampNetSpan(from, v, singlesLimit = halfW - 0.32) {
      const vz = v.z;
      if (Math.abs(vz) < 1e-4) return v;
      const tNet = (0 - from.z) / vz;
      if (tNet <= 0) return v;
      const netX = from.x + v.x * tNet;
      const limit = Math.max(0.2, singlesLimit);
      const span = Math.abs(netX);
      if (span > limit) {
        const scale = limit / Math.max(span, 1e-4);
        v.x *= scale;
      }
      return v;
    }

    function lerpBlend(alphaPerStep, dt) {
      return 1 - Math.pow(1 - alphaPerStep, dt / FIXED);
    }

    function placeCamera(dt = 0) {
      const broadcastProfile = broadcastProfileRef.current || BROADCAST_TECHNIQUES[0];
      const pivot = new THREE.Vector3(0, 1.05 + (broadcastProfile.horizonLift ?? 0), 0);
      const orbitNormal = new THREE.Vector3(0, 1, 0);
      const followStrength = broadcastProfile.followBlend ?? 0.7;
      const rigYaw = broadcastProfile.rig?.yaw ?? 0;
      const rigDir = new THREE.Vector3(Math.sin(rigYaw), 0, Math.cos(rigYaw));
      const leadTime = broadcastProfile.leadTime ?? 0.32;
      const leadPos = ball.position.clone().addScaledVector(vel, leadTime);
      const yLift = THREE.MathUtils.lerp(
        camHeight,
        camHeight * (broadcastProfile.heightBoost ?? 0.5),
        Math.min((ball.position.y - 0.8) * 0.35, 1)
      );
      const depthLead = state.live ? THREE.MathUtils.clamp(vel.z * 0.24, -2.8, 4.2) : 0;
      const backOffset = camBack * (broadcastProfile.backMultiplier ?? 1) + (broadcastProfile.backOffset ?? 0);
      const baseTarget = new THREE.Vector3(
        THREE.MathUtils.clamp(ball.position.x * 0.92 + (broadcastProfile.sideBias ?? 0), -halfW, halfW),
        yLift,
        Math.max(leadPos.z + depthLead, 0)
      );
      cameraTarget.copy(baseTarget).addScaledVector(rigDir, -backOffset);
      cameraTarget.y = Math.max(cameraTarget.y, 1.15);
      const maxDepth = halfL - playerZ + camBack * 0.45;
      cameraTarget.z = THREE.MathUtils.clamp(cameraTarget.z, cameraMinZ, maxDepth);

      const targetFromPivot = cameraTarget.clone().sub(pivot);
      targetFromPivot.applyAxisAngle(orbitNormal, orbitYaw);
      targetFromPivot.y = Math.max(targetFromPivot.y + orbitPitch * 0.8, 1.2);
      const targetWithOrbit = pivot.clone().add(targetFromPivot);
      const cameraBlend = lerpBlend((broadcastProfile.cameraLerp ?? 5.2) / 10, dt || FIXED);
      smoothCameraPos.lerp(targetWithOrbit, cameraBlend);
      camera.position.copy(smoothCameraPos);

      const lookOffset = cameraLook.set(
        ball.position.x,
        Math.max(ballR * 1.5, ball.position.y),
        Math.max(ball.position.z, 0)
      );
      const lookFromPivot = lookOffset.sub(pivot);
      lookFromPivot.applyAxisAngle(orbitNormal, orbitYaw * 0.95);
      lookFromPivot.y = Math.max(lookFromPivot.y + orbitPitch * 0.6, 0.9);
      const lookWithOrbit = pivot.clone().add(lookFromPivot);
      const lookBlend = lerpBlend((broadcastProfile.lookLerp ?? followStrength), dt || FIXED);
      smoothCameraLook.lerp(lookWithOrbit, lookBlend);
      camera.lookAt(smoothCameraLook);

      if (broadcastProfile.dynamicOrbit) {
        const dyn = broadcastProfile.dynamicOrbit;
        const targetYaw = THREE.MathUtils.clamp((ball.position.x / halfW) * (dyn.yawLimit ?? 0.5), -dyn.yawLimit, dyn.yawLimit);
        orbitYaw = THREE.MathUtils.damp(orbitYaw, targetYaw * (dyn.yawScale ?? 0.4), dyn.smoothing ?? 3.5, dt || FIXED);
        const heightRatio = THREE.MathUtils.clamp(ball.position.y / 3.2, 0, 1);
        const targetPitch = THREE.MathUtils.clamp(
          (dyn.pitchBase ?? 0.1) + heightRatio * (dyn.pitchRange ?? 0.28),
          -(dyn.pitchLimit ?? 0.52),
          dyn.pitchLimit ?? 0.52
        );
        orbitPitch = THREE.MathUtils.damp(orbitPitch, targetPitch, dyn.smoothing ?? 3.5, dt || FIXED);
      }

      const targetFov = THREE.MathUtils.clamp(60 + Math.abs(vel.z) * 0.12 + Math.abs(ball.position.y - 1.2) * 1.5, 58, 74);
      smoothFov = THREE.MathUtils.damp(smoothFov, targetFov, 3.5, dt || FIXED);
      camera.fov = smoothFov;
      camera.updateProjectionMatrix();
    }

    function inSinglesX(x) {
      return Math.abs(x) <= halfW - 0.05;
    }

    let cpuSrvTO = null;
    let playerSrvTO = null;
    const markTrainingStep = (id) => {
      if (!trainingMode) return;
      setTrainingStatus((prev) => {
        if (prev[id]) return prev;
        return { ...prev, [id]: true };
      });
    };

    const formatMsg = (base) => (trainingMode ? `Training · ${base}` : base);

    function prepareServe(by, options = {}) {
      const { resetAttempts = true, announce } = options;
      state.serveBy = by;
      if (resetAttempts) state.attempts = 2;
      state.live = false;
      resetRally();
      playerSwing = null;
      cpuSwing = null;
      const idleX = state.serveSide === 'deuce' ? halfW - 0.4 : -halfW + 0.4;
      if (by === 'player') {
        const serveZ = halfL - 0.92;
        player.position.set(idleX, 0, serveZ);
        const tossX = idleX;
        const tossZ = serveZ - 0.28;
        pos.set(tossX, 1.36, tossZ);
      } else {
        const serveZ = -halfL + 0.92;
        cpu.position.set(-idleX, 0, serveZ);
        const tossX = -idleX;
        const tossZ = serveZ + 0.28;
        pos.set(tossX, 1.36, tossZ);
      }
      vel.set(0, 0, 0);
      spin.set(0, 0, 0);
      ball.position.copy(pos);
      shadow.position.set(pos.x, 0.01, pos.z);
      ball.visible = true;
      shadow.visible = true;
      for (let i = 0; i < trailN; i += 1) {
        trailPos[i * 3 + 0] = pos.x;
        trailPos[i * 3 + 1] = pos.y;
        trailPos[i * 3 + 2] = pos.z;
      }
      trailGeom.attributes.position.needsUpdate = true;
      const serverLabel = by === 'player' ? playerLabel : cpuLabel;
      const sideLabel = state.serveSide === 'deuce' ? 'D' : 'Ad';
      const base = `Serve ${sideLabel} · ${serverLabel}`;
      const text = announce ? `${announce} · ${base}` : base;
      setMsg(formatMsg(text));
      lastHitter = by;
      updateHud();
      if (cpuSrvTO) {
        try {
          clearTimeout(cpuSrvTO);
        } catch {}
        cpuSrvTO = null;
      }
      if (playerSrvTO) {
        try {
          clearTimeout(playerSrvTO);
        } catch {}
        playerSrvTO = null;
      }
      if (by === 'cpu') {
        cpuSrvTO = setTimeout(() => {
          if (state.live || state.matchOver) return;
          const box = serviceBoxFor('cpu');
          const tx = THREE.MathUtils.lerp(box.minX, box.maxX, 0.5 + THREE.MathUtils.randFloatSpread(0.18));
          const tz = THREE.MathUtils.lerp(box.minZ, box.maxZ, 0.5 + THREE.MathUtils.randFloatSpread(0.12));
          const to = new THREE.Vector3(tx, ballR + 0.06, tz);
          let v0 = solveShot(pos.clone(), to, state.gravity, THREE.MathUtils.randFloat(0.92, 1.05));
          v0 = ensureNetClear(pos.clone(), v0, state.gravity, netH, ballR * 1.08);
          v0.multiplyScalar(1.04);
          clampNetSpan(pos.clone(), v0);
          cpuSwing = {
            normal: v0.clone().normalize(),
            speed: v0.length(),
            ttl: 0.38,
            extraSpin: craftCpuSpin(v0.z, 0.7, tx / halfW),
            friction: 0.22,
            restitution: 1.08,
            reach: ballR + 0.34,
            force: 0.92
          };
          setMsg(formatMsg(`Serve · ${cpuLabel}`));
          cpu.userData.swing = 1.05;
          cpu.userData.swingLR = THREE.MathUtils.clamp((tx - cpu.position.x) / halfW, -1, 1);
          lastHitter = 'cpu';
        }, 650);
      } else {
        playerSrvTO = setTimeout(() => {
          if (state.live || state.matchOver || state.serveBy !== 'player') return;
          const box = serviceBoxFor('player');
          const tx = THREE.MathUtils.randFloat(box.minX, box.maxX);
          const tz = THREE.MathUtils.randFloat(box.minZ, box.maxZ);
          const to = new THREE.Vector3(tx, ballR + 0.06, tz);
          let v0 = solveShot(pos.clone(), to, state.gravity, THREE.MathUtils.randFloat(0.94, 1.06));
          v0 = ensureNetClear(pos.clone(), v0, state.gravity, netH, ballR * 1.08);
          v0.multiplyScalar(1.02);
          clampNetSpan(pos.clone(), v0);
          playerSwing = {
            normal: v0.clone().normalize(),
            speed: v0.length(),
            ttl: 0.36,
            extraSpin: new THREE.Vector3(
              THREE.MathUtils.randFloat(18, 30) * Math.sign(v0.z || -1),
              THREE.MathUtils.randFloatSpread(6),
              THREE.MathUtils.randFloatSpread(3.2)
            ),
            friction: 0.26,
            restitution: 1.08,
            reach: ballR + 0.34,
            force: 0.94
          };
          pos.y = Math.max(pos.y, 1.32);
          setMsg(formatMsg(`Serve · ${playerLabel}`));
          player.userData.swing = 0.65;
          player.userData.swingLR = THREE.MathUtils.clamp((tx - player.position.x) / halfW, -1, 1);
          lastHitter = 'player';
        }, 1100);
      }
    }

    const el = renderer.domElement;
    el.style.touchAction = 'none';
    let usingTouch = false;
    let touching = false;
    let pinchActive = false;
    let pinchStartDist = 0;
    let pinchStartBack = camBack;
    let pinchStartHeight = camHeight;
    let pinchStartMid = { x: 0, y: 0 };
    let orbitStartYaw = 0;
    let orbitStartPitch = 0;
    let sx = 0;
    let sy = 0;
    let lx = 0;
    let ly = 0;
    let st = 0;
    let swipeSamples = [];
    const playerMoveTarget = new THREE.Vector2(0, playerZ);

    const playerCourtMinZ = 0.85;
    const playerCourtMaxZ = halfL + apron * 0.35;
    const cpuCourtMinZ = -playerCourtMaxZ;
    const cpuCourtMaxZ = -playerCourtMinZ;

    function clampX(x) {
      return THREE.MathUtils.clamp(x, -halfW + ballR * 2, halfW - ballR * 2);
    }

    function clampZ(z, minZ, maxZ) {
      return THREE.MathUtils.clamp(z, minZ, maxZ);
    }

    function getViewportScale() {
      const rect = renderer.domElement.getBoundingClientRect();
      return THREE.MathUtils.clamp(Math.min(rect.width || 1, rect.height || 1) / 900, 0.72, 1.18);
    }

    function screenToCourt(clientX) {
      const rect = renderer.domElement.getBoundingClientRect();
      const normX = (clientX - rect.left) / rect.width;
      return clampX((normX - 0.5) * courtW);
    }

    function screenToCourtZ(clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      const normY = THREE.MathUtils.clamp((clientY - rect.top) / rect.height, 0, 1);
      const targetLocalZ = normY * (playerCourtMaxZ - playerCourtMinZ) + playerCourtMinZ;
      return clampZ(targetLocalZ, playerCourtMinZ, playerCourtMaxZ);
    }

    const MIN_SWIPE_SPEED = BASE_MIN_SWIPE;
    const MAX_SWIPE_SPEED = BASE_MAX_SWIPE;

    function swipeToShot(distX, distY, swipeTime, towardsEnemy = true) {
      const lateralScale = courtW / BASE_TENNIS_DIMENSIONS.width;
      const forwardScale = courtL / BASE_TENNIS_DIMENSIONS.length;
      const touchProfile = touchProfileRef.current;

      const forwardMin = 4.8 * forwardScale;
      const forwardMax = 14.2 * forwardScale;
      const liftMin = 3.2;
      const liftMax = 9.4;
      const lateralClampBase = 1.6 * lateralScale * (touchProfile?.lateralAssist ?? 1);
      const lateralScaleFactor = 0.22 * (touchProfile?.lateralAssist ?? 1);

      const minSpeed = MIN_SWIPE_SPEED * (touchProfile?.minSwipeScale ?? 1);
      const maxSpeed = MAX_SWIPE_SPEED * (touchProfile?.maxSwipeScale ?? 1);
      const swipeT = Math.max(swipeTime, 0.06);
      const speed = (Math.hypot(distX, distY) / swipeT) * (touchProfile?.swipeSensitivity ?? 1);
      const clampedSpeed = THREE.MathUtils.clamp(speed, minSpeed * 0.6, maxSpeed * 1.05);
      const normalized = THREE.MathUtils.clamp((clampedSpeed - minSpeed * 0.6) / (maxSpeed * 1.05 - minSpeed * 0.6), 0, 1);

      const forward = THREE.MathUtils.lerp(forwardMin, forwardMax, normalized) * (touchProfile?.forceAssist ?? 1);
      const lift = THREE.MathUtils.lerp(liftMin, liftMax, normalized) * (touchProfile?.liftBias ?? 1);
      const lateralInfluence = THREE.MathUtils.clamp(distX / Math.max(Math.abs(distY), 60), -lateralClampBase, lateralClampBase);
      const lateral = THREE.MathUtils.clamp(lateralInfluence * forward * lateralScaleFactor, -3.1 * lateralScale, 3.1 * lateralScale);
      const curve = THREE.MathUtils.clamp(lateralInfluence * 140 * (touchProfile?.curveBias ?? 1), -180, 180);

      const direction = towardsEnemy ? -1 : 1;
      return { forward: direction * forward, lift, lateral, curve, normalized };
    }

    function shotToSwing(shot, contactPos) {
      const touchProfile = touchProfileRef.current;
      const depthScale = THREE.MathUtils.clamp((playerCourtMaxZ - playerCourtMinZ) / halfL, 0.82, 1.18);
      const courtScale = THREE.MathUtils.clamp(courtL / 23.77, 0.86, 1.16);
      const aimAssist = THREE.MathUtils.clamp(touchProfile.aimAssist ?? 1, 0.82, 1.28);
      const viewScale = getViewportScale();
      const aimTightness = THREE.MathUtils.lerp(0.74, 0.9, THREE.MathUtils.clamp(viewScale, 0.72, 1));
      const dir = new THREE.Vector3(shot.lateral, shot.lift, shot.forward * depthScale);
      const speed = dir.length();
      const normal = dir.normalize();
      const sideCurve = shot.curve ?? 0;
      const topspin =
        THREE.MathUtils.lerp(6, 20, shot.normalized) * (touchProfile.topspinBias ?? 1) * (physics.spinBias ?? 1) * depthScale;
      const curveAim = normal.clone();
      const contactBias = contactPos ? THREE.MathUtils.clamp((contactPos.x / halfW) * 0.18, -0.18, 0.18) : 0;
      curveAim.x += THREE.MathUtils.clamp(sideCurve * 0.01 * aimAssist + contactBias, -0.32, 0.32);
      curveAim.x = THREE.MathUtils.clamp(curveAim.x, -0.36 * aimTightness, 0.36 * aimTightness);
      const forwardBias = contactPos ? THREE.MathUtils.clamp((contactPos.z / halfL) * 0.14, -0.12, 0.18) : 0;
      curveAim.z = Math.sign(curveAim.z || -1) * Math.max(Math.abs(curveAim.z + forwardBias), 0.62 + (depthScale - 1) * 0.18);
      const forceAssist = (touchProfile.forceAssist ?? 1) * (physics.forceScale ?? 1) * courtScale * 0.94;
      const liftBoost =
        -0.08 +
        ((touchProfile.liftBias ?? 1) - 1) * 0.35 +
        (depthScale - 1) * 0.12 +
        (contactPos ? Math.max(0, contactPos.y - ballR) * 0.1 : 0);
      const aimBias = THREE.MathUtils.lerp(0.68, 0.95, Math.min(1, shot.normalized + 0.12 + Math.abs(contactBias) * 0.3));
      return {
        normal,
        speed: speed * THREE.MathUtils.clamp(courtScale, 0.9, 1.14),
        ttl: 0.34,
        extraSpin: new THREE.Vector3(sideCurve * 0.2, sideCurve * 0.55, topspin * Math.sign(shot.forward || -1)),
        friction: 0.2,
        restitution: 1.08,
        reach: ballR + 0.8,
        force: Math.min(
          1.2,
          shot.normalized * forceAssist * (0.95 + (shot.swipeSpeed || 0) / (MAX_SWIPE_SPEED * 5.6)) * depthScale
        ),
        power: shot.normalized,
        aimDirection: curveAim.normalize(),
        aimBias,
        liftBoost
      };
    }

    function recordSwipeSample(x, y) {
      const now = performance.now();
      swipeSamples.push({ x, y, t: now });
      if (swipeSamples.length > 12) swipeSamples.shift();
    }

    function onDown(e) {
      if (usingTouch && e.pointerType === 'touch') return;
      touching = true;
      const targetX = screenToCourt(e.clientX);
      const targetZ = screenToCourtZ(e.clientY);
      playerMoveTarget.set(targetX, targetZ);
      player.position.x = targetX;
      player.position.z = targetZ;
      sx = lx = e.clientX;
      sy = ly = e.clientY;
      st = performance.now();
      swipeSamples = [];
      recordSwipeSample(sx, sy);
      player.userData.swing = -0.55;
      player.userData.swingLR = 0;
    }
    function onMove(e) {
      if (!touching) return;
      if (usingTouch && e.pointerType === 'touch') return;
      lx = e.clientX;
      ly = e.clientY;
      recordSwipeSample(lx, ly);
      const targetX = screenToCourt(e.clientX);
      const targetZ = screenToCourtZ(e.clientY);
      playerMoveTarget.set(targetX, targetZ);
      const follow = touchProfileRef.current.moveFollow ?? 0.4;
      const viewFollow = follow * THREE.MathUtils.lerp(0.92, 1.12, getViewportScale() - 0.72);
      player.position.x += (targetX - player.position.x) * viewFollow;
      player.position.z += (targetZ - player.position.z) * viewFollow;
    }

    function ensureCrossCourtTrajectory(hitter) {
      const g = state.gravity;
      const a = 0.5 * g;
      const b = vel.y;
      const c = pos.y - ballR;
      const disc = b * b - 4 * a * c;
      if (disc < 0) return;
      const landT = Math.max(0.06, (-b - Math.sqrt(disc)) / (2 * a));
      const landingZ = pos.z + vel.z * landT;
      const aimingOpponent = hitter === 'player' ? landingZ < -0.2 : landingZ > 0.2;
      if (aimingOpponent) return;
      const pushDir = hitter === 'player' ? -1 : 1;
      const extraForward = Math.max(3.6, Math.abs(landingZ) * 0.18 + 2.8);
      vel.z += pushDir * extraForward;
      vel.y = Math.max(vel.y, 3.0 + extraForward * 0.14);
      ensureNetClear(pos.clone(), vel, g, netH, ballR * 0.95);
      clampNetSpan(pos.clone(), vel);
    }

    function tryApplySwing(hitter, swing, racketPos) {
      if (!swing) return false;
      const reach = (swing.reach ?? ballR + 0.8) + 0.22;
      const toBall = tmpVec.subVectors(pos, racketPos);
      if (toBall.lengthSq() > reach * reach) return false;

      const normal = swing.normal.clone().normalize();
      const swingVel = normal.clone().multiplyScalar(swing.speed);
      const relVel = vel.clone().sub(swingVel);
      const closing = relVel.dot(normal) < 0.12 || !state.live;
      if (!closing) return false;

      const vn = relVel.dot(normal);
      const impulse = -(1 + swing.restitution) * vn * hitForceMultiplier;
      vel.addScaledVector(normal, impulse);
      vel.addScaledVector(swingVel, 0.32 * hitForceMultiplier);

      const tangent = relVel.sub(normal.clone().multiplyScalar(vn));
      if (tangent.lengthSq() > 1e-5) {
        const friction = swing.friction ?? 0.25;
        vel.addScaledVector(tangent, -friction);
        const spinDir = new THREE.Vector3().crossVectors(normal, tangent).normalize();
        const spinGain = THREE.MathUtils.clamp(tangent.length() * 3.2, 0, 64) * (physics.spinBias ?? 1);
        spin.addScaledVector(spinDir, spinGain);
      }
      if (swing.extraSpin) spin.add(swing.extraSpin.clone().multiplyScalar(physics.spinBias ?? 1));
      if (swing.aimDirection) {
        const currentSpeed = vel.length();
        const aimBlend = THREE.MathUtils.clamp(
          swing.aimBias ?? THREE.MathUtils.lerp(0.68, 0.95, swing.force || 0.5),
          0.45,
          0.95
        );
        const blended = vel
          .clone()
          .normalize()
          .lerp(swing.aimDirection.clone().normalize(), aimBlend)
          .normalize();
        vel.copy(blended.multiplyScalar(currentSpeed));
      }

      ensureCrossCourtTrajectory(hitter);

      const baseLift = state.live ? 1.9 : 2.5;
      const minUpward = baseLift + (swing.force ?? 0.5) * 1.45 + (swing.liftBoost ?? 0);
      if (vel.y < minUpward) {
        vel.y = minUpward;
      }

      const capped = THREE.MathUtils.clamp(vel.length(), 0, outgoingSpeedCap);
      if (vel.length() > capped) {
        vel.setLength(capped);
      }

      if (!state.live && state.serveBy === hitter) state.awaitingServeBounce = true;
      state.live = true;
      state.rallyStarted = true;
      state.bounceSide = null;
      lastHitter = hitter;
      hitTTL = 1.0;
      hitRing.position.set(pos.x, 0.002, pos.z);
      playKickSound();
      if (trainingMode && hitter === 'player' && state.live) {
        markTrainingStep('rallyHit');
      }
      return true;
    }

    function craftCpuSpin(directionZ, aggression = 0.55, sideBias = 0) {
      const bias = THREE.MathUtils.clamp(sideBias, -1, 1);
      const forwardSign = Math.sign(directionZ === 0 ? -1 : directionZ);
      const top = THREE.MathUtils.lerp(16, 44, aggression);
      const side = THREE.MathUtils.lerp(2, 9, aggression);
      const randSide = THREE.MathUtils.randFloatSpread(side * 0.22);
      const randTwist = THREE.MathUtils.randFloatSpread(3.2);
      const spinVec = new THREE.Vector3(forwardSign * top, bias * side + randSide, randTwist);
      return spinVec.multiplyScalar(physics.spinBias ?? 1);
    }
    function onUp(evt, { fromTouch = false } = {}) {
      if (!touching) return;
      if (!fromTouch && usingTouch && evt?.pointerType === 'touch') return;
      touching = false;
      const endX = evt?.clientX ?? lx;
      const endY = evt?.clientY ?? ly;
      const now = performance.now();
      recordSwipeSample(endX, endY);
      const endSample = { x: endX, y: endY, t: now };
      const windowStart = endSample.t - 160;
      let first = swipeSamples.length ? swipeSamples[0] : { x: sx, y: sy, t: st };
      for (let i = swipeSamples.length - 1; i >= 0; i -= 1) {
        if (swipeSamples[i].t <= windowStart) {
          first = swipeSamples[i];
          break;
        }
      }
      const distX = endSample.x - first.x;
      const distY = first.y - endSample.y;
      if (distY < 18) return;
      const duration = Math.max((endSample.t - first.t) / 1000, 0.08);
      if (!state.live) {
        if (state.serveBy === 'player') {
          const shot = swipeToShot(distX, distY, duration, true);
          playerSwing = shotToSwing(shot, pos.clone());
          markTrainingStep('swipeServe');
          setMsg(formatMsg(`Serve · ${playerLabel}`));
          player.userData.swing = 0.65 + 0.95 * (playerSwing.force || 0.5);
          player.userData.swingLR = THREE.MathUtils.clamp(playerSwing.normal.x * 2.2, -1, 1);
          lastHitter = 'player';
          if (playerSrvTO) {
            try {
              clearTimeout(playerSrvTO);
            } catch {}
            playerSrvTO = null;
          }
        }
      } else {
        const ballOnPlayerSide = pos.z > -0.4;
        const horizontalReach =
          Math.abs(pos.z - (playerZ - 0.78)) < 4.6 || pos.z > playerZ - 1.4;
        const reachableHeight = pos.y <= 3.6;
        if (ballOnPlayerSide && horizontalReach && reachableHeight) {
          const shot = swipeToShot(distX, distY, duration, true);
          playerSwing = shotToSwing(shot, pos.clone());
          player.userData.swing = 0.62 + 0.9 * (playerSwing.force || 0.5);
          player.userData.swingLR = THREE.MathUtils.clamp(playerSwing.normal.x * 2.2, -1, 1);
          lastHitter = 'player';
        }
      }
    }
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);

    function onTouchStart(e) {
      usingTouch = true;
      if (e.touches.length === 2) {
        pinchActive = true;
        pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartMid = {
          x: (e.touches[0].clientX + e.touches[1].clientX) * 0.5,
          y: (e.touches[0].clientY + e.touches[1].clientY) * 0.5
        };
        pinchStartBack = camBack;
        pinchStartHeight = camHeight;
        orbitStartYaw = orbitYaw;
        orbitStartPitch = orbitPitch;
        touching = false;
        return;
      }
      pinchActive = false;
      const t = e.touches[0];
      if (!t) return;
      onDown({ clientX: t.clientX, clientY: t.clientY });
    }
    function onTouchMove(e) {
      if (pinchActive && e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const midX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) * 0.5;
        const scale = THREE.MathUtils.clamp(dist / Math.max(1, pinchStartDist), 0.6, 1.6);
        camBack = THREE.MathUtils.clamp(pinchStartBack / scale, camBackRange.min, camBackRange.max);
        camHeight = THREE.MathUtils.clamp(pinchStartHeight / scale, camHeightRange.min, camHeightRange.max);
        const dx = (midX - pinchStartMid.x) / Math.max(240, W);
        const dy = (midY - pinchStartMid.y) / Math.max(240, H);
        orbitYaw = THREE.MathUtils.clamp(orbitStartYaw + dx * Math.PI * 0.38, -Math.PI / 6, Math.PI / 6);
        orbitPitch = THREE.MathUtils.clamp(orbitStartPitch - dy * 1.1, -0.25, 0.48);
        return;
      }
      const t = e.touches[0];
      if (!t) return;
      onMove({ clientX: t.clientX, clientY: t.clientY });
    }
    function onTouchEnd(e) {
      const t = e.changedTouches[0];
      if (!t) {
        usingTouch = false;
        return;
      }
      if (pinchActive && e.touches.length < 2) {
        pinchActive = false;
        usingTouch = e.touches.length > 0;
        touching = false;
        return;
      }
      onUp({ clientX: t.clientX, clientY: t.clientY, pointerType: 'touch' }, { fromTouch: true });
      usingTouch = false;
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    let cpuWind = 0;
    let cpuPlan = null;
    function cpuTryHit(dt) {
      if (!state.live) {
        if (state.serveBy === 'cpu' && !cpuSwing && !cpuSrvTO && !state.matchOver) {
          prepareServe('cpu');
        }
        cpuWind = Math.max(0, cpuWind - dt);
        cpu.position.x = THREE.MathUtils.damp(cpu.position.x, 0, 4.2, dt);
        cpu.position.z = THREE.MathUtils.damp(cpu.position.z, clampZ(cpuZ, cpuCourtMinZ, cpuCourtMaxZ), 3.5, dt);
        return;
      }
      const approaching = vel.z < 0;
      if (!approaching) {
        cpuWind = Math.max(0, cpuWind - dt);
        cpu.position.x = THREE.MathUtils.damp(cpu.position.x, 0, 4.5, dt);
        cpu.position.z = THREE.MathUtils.damp(cpu.position.z, clampZ(cpuZ - 0.25, cpuCourtMinZ, cpuCourtMaxZ), 4.0, dt);
        return;
      }
      const vz = Math.min(-0.001, vel.z);
      const t = THREE.MathUtils.clamp((pos.z - cpuZ) / vz, 0.06, 1.4);
      const predictedX = pos.x + vel.x * t;
      const clampX = THREE.MathUtils.clamp(predictedX, -halfW * 0.92, halfW * 0.92);
      const aerialA = 0.5 * state.gravity;
      const aerialB = vel.y;
      const aerialC = pos.y - ballR;
      const disc = aerialB * aerialB - 4 * aerialA * aerialC;
      const landT = disc > 0 ? Math.max(0.05, Math.min(1.6, (-aerialB - Math.sqrt(disc)) / (2 * aerialA))) : t;
      const landZ = pos.z + vel.z * landT;
      const clampLandingZ = THREE.MathUtils.clamp(landZ, cpuCourtMinZ, cpuCourtMaxZ);
      cpu.position.x = THREE.MathUtils.damp(cpu.position.x, clampX, 7.2, dt);
      const strikeZ = clampZ(Math.max(cpuZ + 0.6, Math.min(clampLandingZ, pos.z + 0.55)), cpuCourtMinZ, cpuCourtMaxZ);
      const targetZ = THREE.MathUtils.lerp(cpuZ, strikeZ, 0.62);
      cpu.position.z = THREE.MathUtils.damp(cpu.position.z, targetZ, 6.2, dt);

      const interceptY = pos.y + vel.y * t + 0.5 * state.gravity * t * t;
      const bounceConfirmed = state.bounceSide === 'cpu' || !state.awaitingServeBounce;
      const planningWindow = bounceConfirmed ? 0.55 : 0.28;
      const heightAllowance = bounceConfirmed ? 3.05 : 2.35;
      const close = t < planningWindow && Math.abs(predictedX - cpu.position.x) < 1.6 && interceptY <= heightAllowance;
      const readyAfterBounce = bounceConfirmed && !cpuPlan && landT < 0.7 && interceptY <= 3.2;
      const emergencyBlock = t < 0.22 && interceptY < 2.2 && Math.abs(predictedX - cpu.position.x) < 2.4;
      if ((close || readyAfterBounce) && cpuWind <= 0 && !cpuPlan) {
        const playerDepth = THREE.MathUtils.clamp(player.position.z / (halfL + apron), 0, 1);
        const aggression = THREE.MathUtils.clamp(Math.max(Math.abs(player.position.x) / halfW, 0.45 + playerDepth * 0.25), 0.35, 0.92);
        const anticipation = THREE.MathUtils.clamp(playerMoveTarget.x - player.position.x, -1.2, 1.2);
        const corner = player.position.x > 0 ? -halfW + 0.35 : halfW - 0.35;
        const mix = THREE.MathUtils.lerp(predictedX, corner, aggression + Math.abs(anticipation) * 0.3);
        const tx = THREE.MathUtils.clamp(mix + anticipation * 0.45, -halfW + 0.28, halfW - 0.28);
        const dropShot = landT < 0.36 && player.position.z > halfL - 1.2;
        const netRush = player.position.z < halfL * 0.45;
        const lobShot = netRush && interceptY > 1.65;
        let tz = dropShot
          ? halfL - 0.42
          : lobShot
            ? halfL - 0.35
            : THREE.MathUtils.mapLinear(Math.min(halfW, Math.abs(player.position.x)), 0, halfW, halfL - 1.7, halfL - 0.82);
        if (!dropShot && !lobShot && player.position.z < halfL - 2.4) tz = halfL - 0.7;
        tz = THREE.MathUtils.clamp(tz + THREE.MathUtils.randFloatSpread(lobShot ? 0.08 : 0.14), halfL - 1.75, halfL - 0.45);
        cpuPlan = { tx, tz, dropShot, lobShot, aggression, bias: THREE.MathUtils.clamp((tx - player.position.x) / halfW, -1, 1) };
        cpuWind = 0.08 + Math.random() * 0.05;
        cpu.userData.swing = -0.7;
      } else if (emergencyBlock && cpuWind <= 0 && !cpuPlan) {
        const tx = THREE.MathUtils.clamp(predictedX, -halfW + 0.4, halfW - 0.4);
        const tz = THREE.MathUtils.clamp(pos.z + 0.2, cpuCourtMinZ + 0.4, cpuCourtMaxZ - 0.4);
        cpuPlan = { tx, tz, dropShot: false, lobShot: false, aggression: 0.38, bias: 0 };
        cpuWind = 0.04;
        cpu.userData.swing = -0.4;
      }
      if (cpuWind > 0) {
        cpuWind -= dt;
        if (cpuWind <= 0 && cpuPlan) {
          const targetHeight = ballR + (cpuPlan.dropShot ? 0.02 : cpuPlan.lobShot ? 0.18 : 0.12);
          const to = new THREE.Vector3(cpuPlan.tx, targetHeight, cpuPlan.tz);
          let v0 = solveShot(
            pos.clone(),
            to,
            state.gravity,
            THREE.MathUtils.randFloat(cpuPlan.dropShot ? 0.55 : cpuPlan.lobShot ? 0.82 : 0.72, cpuPlan.lobShot ? 1.05 : 0.92)
          );
          if (cpuPlan.lobShot) {
            v0.y += 2.1;
            v0.multiplyScalar(0.94);
          }
          v0 = ensureNetClear(pos.clone(), v0, state.gravity, netH, ballR * (cpuPlan.lobShot ? 1.05 : 0.9));
          clampNetSpan(pos.clone(), v0);
          const aggression = THREE.MathUtils.clamp(
            cpuPlan.dropShot ? 0.25 : cpuPlan.lobShot ? 0.48 : Math.abs(player.position.x) / halfW + 0.22,
            0.4,
            0.92
          );
          const bias = cpuPlan.bias ?? THREE.MathUtils.clamp((cpuPlan.tx - player.position.x) / halfW, -1, 1);
          cpuSwing = {
            normal: v0.clone().normalize(),
            speed: v0.length(),
            ttl: cpuPlan.dropShot ? 0.32 : cpuPlan.lobShot ? 0.36 : 0.28,
            extraSpin: craftCpuSpin(v0.z * (cpuPlan.dropShot ? 0.45 : cpuPlan.lobShot ? 0.35 : 1), aggression, bias),
            friction: cpuPlan.dropShot ? 0.32 : 0.24,
            restitution: cpuPlan.lobShot ? 1.02 : 1.08,
            reach: ballR + 0.34
          };
          cpu.userData.swing = 1.18;
          cpu.userData.swingLR = THREE.MathUtils.clamp((cpuPlan.tx - cpu.position.x) / halfW + (cpuPlan.lobShot ? 0.1 : 0), -1, 1);
          state.bounceSide = null;
          state.rallyStarted = true;
          lastHitter = 'cpu';
          cpuPlan = null;
        }
      }
    }

    const adPanels = [];
    function makeAdTexture(line1 = 'TonPlaygram · the future of peer‑to‑peer crypto gaming', line2 = 'Earn · Play · Compete · Secure · Instant Payouts') {
      const w = 1024;
      const h = 256;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#111827');
      grad.addColorStop(1, '#0ea5a1');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.font = '700 44px system-ui,Segoe UI,Arial';
      g.fillStyle = '#ffffff';
      g.textBaseline = 'middle';
      const block = `${line1}   •   ${line2}   •   `;
      let x = 20;
      for (let i = 0; i < 6; i += 1) {
        g.fillText(block, x, h * 0.52);
        x += g.measureText(block).width + 40;
      }
      const t = new THREE.CanvasTexture(c);
      t.anisotropy = Math.min(8, maxAniso);
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.repeat.set(4, 1);
      return t;
    }
    function makeBillboard(width, height, speed = 0.06, pos = new THREE.Vector3(), rotY = 0) {
      const tex = makeAdTexture();
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      const geo = new THREE.PlaneGeometry(width, height);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.rotation.y = rotY;
      scene.add(mesh);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x7c818c, roughness: 0.6, metalness: 0.2 });
      const postH = height + 0.4;
      const cyl = new THREE.CylinderGeometry(0.04, 0.04, postH, 10);
      const p1 = new THREE.Mesh(cyl, postMat);
      const p2 = new THREE.Mesh(cyl, postMat);
      p1.position.set(pos.x - width / 2 + 0.15 * Math.cos(rotY), (postH / 2) * 0.98, pos.z - (width / 2) * Math.sin(rotY));
      p2.position.set(pos.x + width / 2 - 0.15 * Math.cos(rotY), (postH / 2) * 0.98, pos.z + (width / 2) * Math.sin(rotY));
      scene.add(p1);
      scene.add(p2);
      adPanels.push({ mesh, tex, speed });
    }

    const apronSize = apron;
    const outerX = halfW + apronSize;
    const outerZ = halfL + apronSize;
    const offset = 0.25;
    const bbH = 1.1;
    const sideLenZ = courtL + 2 * apronSize;
    const endLenX = courtW + 2 * apronSize;
    makeBillboard(sideLenZ, bbH, 0.055, new THREE.Vector3(-outerX - offset, bbH / 2, 0), Math.PI / 2);
    makeBillboard(endLenX, bbH, 0.07, new THREE.Vector3(0, bbH / 2, -outerZ - offset), 0);
    makeBillboard(sideLenZ, bbH, 0.055, new THREE.Vector3(outerX + offset, bbH / 2, 0), -Math.PI / 2);

    function advanceBallState(dt) {
      const prevZ = pos.z;
      const prevY = pos.y;
      const drag = Math.exp(-(physics.airDrag ?? 0.13) * dt);
      vel.multiplyScalar(drag);
      const magnus = new THREE.Vector3().crossVectors(spin, vel).multiplyScalar((physics.lift ?? 0.1) * dt);
      vel.add(magnus);
      vel.y += (state.gravity ?? physics.gravity) * dt;
      pos.addScaledVector(vel, dt);
      const spinDamp = Math.pow(physics.spinDamping ?? 0.86, dt / SIMULATION_TICK.baseStep);
      spin.multiplyScalar(spinDamp);

      if (Math.abs(pos.x) > halfW - ballR * 1.2) {
        pos.x = clampX(pos.x);
        vel.x *= -SIMULATION_TICK.wallRebound;
      }

      if (pos.y <= ballR) {
        pos.y = ballR;
        if (vel.y < 0) respondToCourtImpact(Math.abs(vel.y));
        hitTTL = 1.0;
        hitRing.position.set(pos.x, 0.002, pos.z);
        const side = pos.z >= 0 ? 'player' : 'cpu';
        if (state.awaitingServeBounce) {
          if (side !== opponentOf(state.serveBy)) {
            registerFault(state.serveBy, 'Fault · Side');
            return false;
          }
          const box = serviceBoxFor(state.serveBy);
          if (!inBox(pos.x, pos.z, box)) {
            registerFault(state.serveBy, 'Fault · Box');
            return false;
          }
          state.awaitingServeBounce = false;
          state.rallyStarted = true;
          state.bounceSide = side;
          markTrainingStep('landServe');
        } else {
          if (state.bounceSide === side) {
            finishPoint(opponentOf(side), 'Double Bounce');
            return false;
          }
          state.rallyStarted = true;
          state.bounceSide = side;
        }

        if (!inSinglesX(pos.x) || Math.abs(pos.z) > halfL + 0.05) {
          finishPoint(opponentOf(side), 'Out');
          return false;
        }
      }

      const crossedNet = (prevZ > 0 && pos.z <= 0) || (prevZ < 0 && pos.z >= 0);
      if (crossedNet) {
        const tCross = (0 - prevZ) / ((pos.z - prevZ) || 1e-6);
        const yCross = THREE.MathUtils.lerp(prevY, pos.y, THREE.MathUtils.clamp(tCross, 0, 1));
        if (yCross < netH + ballR * 0.45) {
          if (state.awaitingServeBounce && lastHitter === state.serveBy) {
            registerFault(state.serveBy, 'Fault · Net');
          } else {
            finishPoint(opponentOf(lastHitter), 'Net');
          }
          return false;
        }
      }

      if (!inSinglesX(pos.x) || pos.z > halfL + 0.6 || pos.z < -halfL - 0.6) {
        if (state.awaitingServeBounce && lastHitter === state.serveBy) {
          registerFault(state.serveBy, 'Fault · Out');
        } else {
          finishPoint(opponentOf(lastHitter), 'Out');
        }
        return false;
      }

      return true;
    }

    function simulateBallMotion(dt) {
      const steps = Math.min(SIMULATION_TICK.maxSubsteps, Math.max(1, Math.ceil(dt / SIMULATION_TICK.baseStep)));
      const stepDt = Math.min(dt / steps, SIMULATION_TICK.baseStep);
      for (let i = 0; i < steps; i += 1) {
        if (!advanceBallState(stepDt)) return false;
      }
      return true;
    }

    const FIXED = SIMULATION_TICK.baseStep;
    let acc = 0;
    let last = performance.now();
    let raf = 0;
    function applyRacketPose(racket, swingAmt = 0, lateral = 0, leanDir = 1) {
      if (!racket?.userData?.headPivot) return;
      const orient = racketOrientationRef.current || RACKET_ORIENTATIONS[0];
      const pivot = racket.userData.headPivot;
      const swing = swingAmt || 0;
      const lr = THREE.MathUtils.clamp(lateral || 0, -1, 1);
      const contactRise = THREE.MathUtils.clamp((pos.y - ballR) * 0.12, 0, 0.4);
      const pivotPos = orient.pivotPosition || BASE_PIVOT_POS;
      const pivotRot = orient.pivotRotation || BASE_PIVOT_ROT;
      const headRot = orient.headRotation || BASE_HEAD_ROT;
      const depthOffset = orient.depthOffset || 0;
      const rollOffset = orient.rollOffset || 0;

      pivot.rotation.x = pivotRot.x - 0.52 * swing - contactRise * 0.4;
      pivot.rotation.y = pivotRot.y + 0.12 * lr * leanDir + swing * 0.08 * leanDir;
      pivot.rotation.z = pivotRot.z + rollOffset - 0.3 * lr * swing + contactRise * 0.2 * leanDir;
      pivot.position.set(
        pivotPos.x,
        pivotPos.y + 0.06 * swing + contactRise * 0.25,
        pivotPos.z + depthOffset - 0.08 * swing * leanDir + contactRise * 0.12
      );
      if (racket.userData.head) {
        racket.userData.head.rotation.set(
          headRot.x + swing * 0.22 - contactRise * 0.2,
          headRot.y,
          headRot.z + lr * 0.08 * leanDir
        );
      }
    }

    function step(dt) {
      syncPhysicsProfile();
      const servingPlayer = !state.live && state.serveBy === 'player';
      const serveHomeZ = halfL - 0.92;
      const serveHomeX = state.serveSide === 'deuce' ? halfW - 0.45 : -halfW + 0.45;
      const playerHasInput = touching;
      let desiredX = player.position.x;
      let desiredZ = player.position.z;
      if (playerHasInput) {
        desiredX = playerMoveTarget.x;
        desiredZ = playerMoveTarget.y;
      } else if (state.live && vel.z > 0) {
        const strikeZ = clampZ(Math.min(playerZ - 0.4, pos.z - 0.3), playerCourtMinZ, playerCourtMaxZ);
        const t = Math.max(0.05, (playerZ - pos.z) / (vel.z || 1e-6));
        const predX = pos.x + vel.x * t;
        desiredX = THREE.MathUtils.clamp(predX, -halfW, halfW);
        desiredZ = THREE.MathUtils.lerp(strikeZ, playerZ, 0.25);
      } else {
        const homeX = servingPlayer ? serveHomeX : 0;
        desiredX = homeX;
        desiredZ = servingPlayer ? serveHomeZ : playerZ - 0.3;
      }
      desiredZ = clampZ(desiredZ, playerCourtMinZ, playerCourtMaxZ);
      const playerDamp = playerHasInput ? 12 : state.live ? 8 : 5;
      player.position.x = THREE.MathUtils.damp(player.position.x, desiredX, playerDamp, dt);
      player.position.z = THREE.MathUtils.damp(player.position.z, desiredZ, playerDamp, dt);
      const groundedY = 0;
      player.position.y = THREE.MathUtils.damp(player.position.y, groundedY, 10, dt);
      cpu.position.y = THREE.MathUtils.damp(cpu.position.y, groundedY, 10, dt);

      if (playerSwing) {
        const racketPos = new THREE.Vector3(
          THREE.MathUtils.lerp(player.position.x, pos.x, 0.35),
          THREE.MathUtils.clamp(pos.y, ballR * 1.05, 2.0),
          player.position.z - 0.62
        );
        if (tryApplySwing('player', playerSwing, racketPos)) {
          playerSwing.ttl = 0;
        }
        playerSwing.ttl -= dt;
        if (playerSwing.ttl <= 0) playerSwing = null;
      }
      if (cpuSwing) {
        const racketPos = new THREE.Vector3(
          THREE.MathUtils.lerp(cpu.position.x, pos.x, 0.35),
          THREE.MathUtils.clamp(pos.y, ballR * 1.05, 2.0),
          cpu.position.z + 0.62
        );
        if (tryApplySwing('cpu', cpuSwing, racketPos)) {
          cpuSwing.ttl = 0;
        }
        cpuSwing.ttl -= dt;
        if (cpuSwing.ttl <= 0) cpuSwing = null;
      }

      let ps = player.userData.swing || 0;
      let plrLR = THREE.MathUtils.clamp(player.userData.swingLR || 0, -1, 1);
      let cs = cpu.userData.swing || 0;
      let cpuLR = THREE.MathUtils.clamp(cpu.userData.swingLR || 0, -1, 1);

      if (state.live) {
        if (!simulateBallMotion(dt)) {
          return;
        }
        player.userData.swing *= Math.exp(-5.0 * dt);
        cpu.userData.swing *= Math.exp(-5.0 * dt);
        ps = player.userData.swing || 0;
        plrLR = THREE.MathUtils.clamp(player.userData.swingLR || 0, -1, 1);
        cs = cpu.userData.swing || 0;
        cpuLR = THREE.MathUtils.clamp(cpu.userData.swingLR || 0, -1, 1);
      }

      applyRacketPose(player, ps, plrLR, 1);
      applyRacketPose(cpu, cs, cpuLR, -1);

      ball.position.copy(pos);
      shadow.position.set(pos.x, 0.01, pos.z);
      updateTrail();
      if (hitTTL > 0) {
        hitTTL -= dt;
        hitRing.material.opacity = Math.max(0, hitTTL) * 0.9;
      }
      cpuTryHit(dt);
      placeCamera(dt);
    }

    function animate() {
      const now = performance.now();
      let dt = (now - last) / 1000;
      last = now;
      acc += dt;
      acc = Math.min(acc, 0.25);
      while (acc >= FIXED) {
        step(FIXED);
        acc -= FIXED;
      }
      for (const p of adPanels) {
        p.tex.offset.x = (p.tex.offset.x + p.speed * dt) % 1;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }

    loadDeshadowedGrass(grassURL, (tex) => {
      matGrass.map = tex;
      matGrass.needsUpdate = true;
    });
    prepareServe('player');
    animate();

    function onResize() {
      W = Math.max(1, container.clientWidth || window.innerWidth || 1);
      H = Math.max(1, container.clientHeight || window.innerHeight || 1);
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);

    console.assert(Math.abs(new THREE.Vector3(0, 0, 1).length() - 1) < 1e-6, 'vec length test');
    console.assert(inSinglesX(0.0) && inSinglesX(halfW - 0.06) && !inSinglesX(halfW + 0.1), 'bounds X test');

    return () => {
      try {
        cancelAnimationFrame(raf);
      } catch {
      }
      window.removeEventListener('resize', onResize);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      if (cpuSrvTO) {
        try {
          clearTimeout(cpuSrvTO);
        } catch {}
      }
      if (playerSrvTO) {
        try {
          clearTimeout(playerSrvTO);
        } catch {}
      }
      if (matchResetTO) {
        try {
          clearTimeout(matchResetTO);
        } catch {}
      }
      try {
        container.removeChild(renderer.domElement);
      } catch {}
      renderer.dispose();
    };
  }, [playerLabel, playKickSound, playNetSound, playOutSound, playScoreSound, setHudInfo]);

  const serveAttemptLabel = hudInfo.attempts >= 2 ? '1st serve' : hudInfo.attempts === 1 ? '2nd serve' : 'Serve reset';
  const scoreboardRows = [
    {
      label: playerLabel,
      sets: hudInfo.playerSets,
      games: hudInfo.playerGames,
      points: hudInfo.playerPointLabel,
      isServer: hudInfo.server === playerLabel
    },
    {
      label: cpuLabel,
      sets: hudInfo.cpuSets,
      games: hudInfo.cpuGames,
      points: hudInfo.cpuPointLabel,
      isServer: hudInfo.server === cpuLabel
    }
  ];
  const activeTrainingStepId = trainingMode ? nextTrainingStep?.id : null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #e1f1ff 0%, #f5f9ff 45%, #ffffff 100%)'
      }}
    >
      <div ref={containerRef} style={{ flex: 1, minHeight: 560, height: '100%', width: '100%' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              color: '#f8fafc',
              borderRadius: 18,
              padding: '14px 20px 16px',
              boxShadow: '0 22px 44px rgba(15, 23, 42, 0.38)',
              minWidth: 260,
              fontFamily: 'ui-sans-serif, system-ui'
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '140px repeat(3, minmax(42px, auto))',
                columnGap: 14,
                rowGap: 8,
                alignItems: 'center'
              }}
            >
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, opacity: 0.75 }}>Players</div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, opacity: 0.75 }}>Sets</div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, opacity: 0.75 }}>Games</div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.4, opacity: 0.75 }}>Points</div>
              {scoreboardRows.map((row) => (
                <React.Fragment key={row.label}>
                  <div style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: row.isServer ? '#facc15' : 'rgba(148, 163, 184, 0.65)',
                        boxShadow: row.isServer ? '0 0 8px rgba(250, 204, 21, 0.65)' : 'none'
                      }}
                    />
                    {row.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, justifySelf: 'center' }}>{row.sets}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, justifySelf: 'center' }}>{row.games}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, justifySelf: 'center' }}>{row.points}</div>
                </React.Fragment>
              ))}
            </div>
            {matchTag ? (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  opacity: 0.6,
                  textAlign: 'center'
                }}
              >
                {matchTag}
              </div>
            ) : null}
          </div>
          <div
            style={{
              background: 'rgba(241, 245, 249, 0.95)',
              color: '#0f172a',
              borderRadius: 999,
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              boxShadow: '0 12px 24px rgba(15, 23, 42, 0.18)'
            }}
          >
            {msg} · {serveAttemptLabel} · Court {hudInfo.side === 'deuce' ? 'D' : 'Ad'}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            pointerEvents: 'auto'
          }}
        >
          <button
            type="button"
            onClick={() => setConfigMenuOpen((p) => !p)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              border: '1px solid rgba(148, 163, 184, 0.5)',
              background: 'rgba(15, 23, 42, 0.82)',
              color: '#e2e8f0',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 14px 28px rgba(15, 23, 42, 0.3)',
              cursor: 'pointer'
            }}
            aria-label="Open configuration"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.33 1.82V22a2 2 0 1 1-4 0v-.18A1.65 1.65 0 0 0 8.6 19.4a1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33H2a2 2 0 1 1 0-4h.18A1.65 1.65 0 0 0 4.6 9.6a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82V2a2 2 0 1 1 4 0v.18A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .33-1.82V2a2 2 0 1 1 4 0v.18a1.65 1.65 0 0 0 .6 1 1.65 1.65 0 0 0 1.82.33h.06a2 2 0 1 1 0 4h-.06a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-.6 1c0 .39.14.77.4 1.07Z" />
            </svg>
          </button>
        </div>
        {configMenuOpen ? (
          <div
            style={{
              position: 'absolute',
              top: 70,
              right: 18,
              width: 360,
              maxWidth: 'calc(100% - 32px)',
              background: 'rgba(255,255,255,0.98)',
              color: '#0f172a',
              borderRadius: 16,
              boxShadow: '0 22px 38px rgba(15, 23, 42, 0.28)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              pointerEvents: 'auto',
              maxHeight: '72vh',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              scrollbarWidth: 'thin'
            }}
          >
            {[
              { title: 'Broadcast Techniques', data: BROADCAST_TECHNIQUES, active: broadcastId, setter: setBroadcastId },
              { title: 'Ball Logic & Physics', data: PHYSICS_PROFILES, active: physicsId, setter: setPhysicsId },
              {
                title: 'Racket Orientation',
                data: RACKET_ORIENTATIONS,
                active: racketOrientationId,
                setter: setRacketOrientationId
              },
              { title: 'Touch Control Modes', data: TOUCH_TECHNIQUES, active: touchId, setter: setTouchId }
            ].map((section) => (
              <div key={section.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>{section.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {section.data.map((opt) => {
                    const active = section.active === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => section.setter(opt.id)}
                        style={{
                          border: active ? '2px solid #2563eb' : '1px solid rgba(148, 163, 184, 0.6)',
                          background: active ? 'rgba(37, 99, 235, 0.12)' : 'rgba(241, 245, 249, 0.8)',
                          borderRadius: 12,
                          padding: '10px 12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          boxShadow: active ? '0 10px 22px rgba(37, 99, 235, 0.25)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{opt.label}</span>
                          {active ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{opt.detail}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {trainingMode && (
        <div style={{ position: 'absolute', bottom: 24, left: 24, pointerEvents: 'auto', maxWidth: 320 }}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              color: '#f8fafc',
              borderRadius: 16,
              padding: '14px 16px',
              boxShadow: '0 22px 36px rgba(15, 23, 42, 0.32)',
              fontFamily: 'ui-sans-serif, system-ui'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 700 }}>Training Tasks</span>
              <span style={{ fontSize: 11, opacity: 0.75 }}>{trainingCompleted ? 'Completed' : 'In progress'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {trainingSteps.map((step) => {
                const done = trainingStatus[step.id];
                const isActive = activeTrainingStepId === step.id && !done;
                return (
                  <div key={step.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        marginTop: 3,
                        background: done ? '#22c55e' : isActive ? '#facc15' : 'rgba(226, 232, 240, 0.7)',
                        boxShadow: done
                          ? '0 0 10px rgba(34, 197, 94, 0.6)'
                          : isActive
                            ? '0 0 10px rgba(250, 204, 21, 0.65)'
                            : 'none'
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>
                        {step.title}
                        {isActive ? (
                          <span
                            style={{
                              marginLeft: 6,
                              background: 'rgba(250, 204, 21, 0.16)',
                              color: '#facc15',
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 999
                            }}
                          >
                            Aktive
                          </span>
                        ) : null}
                      </span>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>{step.detail}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {trainingMode && taskToast && (
        <div
          style={{
            position: 'absolute',
            bottom: 22,
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none'
          }}
        >
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.92)',
              color: '#f8fafc',
              borderRadius: 14,
              padding: '12px 16px',
              boxShadow: '0 18px 32px rgba(15, 23, 42, 0.35)',
              minWidth: 240,
              textAlign: 'center',
              fontFamily: 'ui-sans-serif, system-ui'
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.2 }}>{taskToast.title}</div>
            <div style={{ fontSize: 12, opacity: 0.82, marginTop: 4 }}>{taskToast.detail}</div>
          </div>
        </div>
      )}
      
    </div>
  );
}
