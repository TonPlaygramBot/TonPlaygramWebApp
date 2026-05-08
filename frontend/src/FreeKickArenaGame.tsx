import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type ShotPhase = 'aiming' | 'charging' | 'flying' | 'goal' | 'saved' | 'missed';
type UpgradeKey = 'curve' | 'power' | 'focus';
type TechniqueKey = 'top-left-whip' | 'top-right-finesse' | 'bottom-left-drill' | 'bottom-right-swerve' | 'knuckle-dip';
type Technique = { key: TechniqueKey; label: string; target: { x: number; y: number }; curveBias: number; charge: number; note: string };

type BallRuntime = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  active: boolean;
};

type KeeperRuntime = {
  group: THREE.Group;
  diveVelocity: number;
  targetX: number;
};

type SceneRuntime = {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  ball: BallRuntime;
  keeper: KeeperRuntime;
  aimLine: THREE.Line;
  ghostLine: THREE.Line;
  goalFlash: THREE.PointLight;
  animatedHumans: THREE.Group[];
  kicker: THREE.Group;
  kickUntil: number;
  celebrateUntil: number;
};

const GAME_WIDTH = 12;
const GOAL_Z = -27.6;
const BALL_START = new THREE.Vector3(0, 0.32, 10.5);
const GOAL_WIDTH = 7.6;
const GOAL_HEIGHT = 3.05;
const WALL_Z = -8.6;
const WALL_WIDTH = 5.7;
const GRAVITY = -10.6;
const DRAG = 0.988;

const TECHNIQUES: Technique[] = [
  { key: 'top-left-whip', label: 'AI Top Left Whip', target: { x: -3.05, y: 2.72 }, curveBias: 1.18, charge: 0.82, note: 'high curl to the top-left corner' },
  { key: 'top-right-finesse', label: 'AI Top Right Finesse', target: { x: 3.05, y: 2.68 }, curveBias: -1.08, charge: 0.78, note: 'far-post bend to the top-right corner' },
  { key: 'bottom-left-drill', label: 'AI Bottom Left Drill', target: { x: -3.18, y: 0.74 }, curveBias: 0.52, charge: 0.92, note: 'grounded grass-cutter to the bottom-left corner' },
  { key: 'bottom-right-swerve', label: 'AI Bottom Right Swerve', target: { x: 3.18, y: 0.74 }, curveBias: -0.58, charge: 0.9, note: 'low late swerve to the bottom-right corner' },
  { key: 'knuckle-dip', label: 'AI Knuckle Dip', target: { x: 0.12, y: 2.45 }, curveBias: 0.08, charge: 0.96, note: 'central dipping power shot' },
];

const SKIN_PALETTE = ['#f2b389', '#8d5524', '#c68642', '#ffdbac', '#d6a06f'];
const HAIR_PALETTE = ['#111827', '#3b2416', '#facc15', '#7c2d12', '#e5e7eb'];

const upgradeCopy: Record<UpgradeKey, { label: string; description: string }> = {
  curve: { label: 'Curve Boots', description: 'More bend around the wall.' },
  power: { label: 'Power Laces', description: 'Harder strikes and longer range.' },
  focus: { label: 'Focus Vision', description: 'More precise targeting guide.' },
};

const clamp = THREE.MathUtils.clamp;

const makeMaterial = (color: string, roughness = 0.72, metalness = 0.05) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function createPlayer(color: string, shorts: string, seed = 0) {
  const group = new THREE.Group();
  const skin = makeMaterial(SKIN_PALETTE[seed % SKIN_PALETTE.length], 0.65);
  const kit = makeMaterial(color, 0.68);
  const shortMat = makeMaterial(shorts, 0.7);
  const boot = makeMaterial('#121826', 0.55);
  const hair = makeMaterial(HAIR_PALETTE[seed % HAIR_PALETTE.length], 0.55);
  const face = makeMaterial('#020617', 0.45);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.86, 8, 16), kit);
  body.position.y = 1.45;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 18), skin);
  head.position.y = 2.22;
  group.add(head);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.245, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairCap.position.set(0, 2.31, -0.01);
  group.add(hairCap);

  [-0.07, 0.07].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), face);
    eye.position.set(x, 2.25, 0.22);
    group.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.012), face);
    brow.position.set(x, 2.31, 0.218);
    brow.rotation.z = x < 0 ? 0.12 : -0.12;
    group.add(brow);
  });

  const shortsMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.38), shortMat);
  shortsMesh.position.y = 0.92;
  group.add(shortsMesh);

  [-0.2, 0.2].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.68, 6, 10), skin);
    leg.position.set(x, 0.48, 0);
    group.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.36), boot);
    foot.position.set(x, 0.11, -0.08);
    foot.name = x < 0 ? 'leftFoot' : 'rightFoot';
    group.add(foot);
  });

  group.userData.baseY = group.position.y;
  group.userData.seed = seed;
  group.userData.leftLeg = group.children.find((child) => child instanceof THREE.Mesh && child.position.x < 0 && child.position.y < 0.6);
  group.userData.rightLeg = group.children.find((child) => child instanceof THREE.Mesh && child.position.x > 0 && child.position.y < 0.6);
  return group;
}

function createStadium(scene: THREE.Scene) {
  scene.background = new THREE.Color('#08111f');
  scene.fog = new THREE.Fog('#08111f', 24, 70);

  const hemi = new THREE.HemisphereLight('#c7e8ff', '#183015', 1.25);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#ffffff', 2.7);
  sun.position.set(-8, 18, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 55;
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);

  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 48, 1, 1),
    new THREE.MeshStandardMaterial({ color: '#17733b', roughness: 0.9 }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  scene.add(pitch);

  for (let i = 0; i < 9; i += 1) {
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 48 / 9),
      new THREE.MeshStandardMaterial({ color: i % 2 ? '#1f8b49' : '#166d37', roughness: 0.92 }),
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.z = -24 + (i + 0.5) * (48 / 9);
    stripe.position.y = 0.003;
    stripe.receiveShadow = true;
    scene.add(stripe);
  }

  const lineMat = new THREE.LineBasicMaterial({ color: '#dff7ff', transparent: true, opacity: 0.72 });
  const addLine = (points: THREE.Vector3[]) => scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMat));
  addLine([new THREE.Vector3(-GAME_WIDTH / 2, 0.03, GOAL_Z + 0.5), new THREE.Vector3(GAME_WIDTH / 2, 0.03, GOAL_Z + 0.5)]);
  addLine([new THREE.Vector3(-4.8, 0.03, -16), new THREE.Vector3(4.8, 0.03, -16)]);
  addLine([new THREE.Vector3(-4.8, 0.03, -16), new THREE.Vector3(-4.8, 0.03, GOAL_Z + 0.5)]);
  addLine([new THREE.Vector3(4.8, 0.03, -16), new THREE.Vector3(4.8, 0.03, GOAL_Z + 0.5)]);

  const arc = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 38 }, (_, i) => {
      const a = Math.PI * (i / 37);
      return new THREE.Vector3(Math.cos(a) * 3.1, 0.035, -16 + Math.sin(a) * 3.1);
    })),
    lineMat,
  );
  scene.add(arc);

  const goalMat = makeMaterial('#f8fafc', 0.35, 0.05);
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, GOAL_HEIGHT, 16);
  const leftPost = new THREE.Mesh(postGeo, goalMat);
  leftPost.position.set(-GOAL_WIDTH / 2, GOAL_HEIGHT / 2, GOAL_Z);
  const rightPost = leftPost.clone();
  rightPost.position.x = GOAL_WIDTH / 2;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GOAL_WIDTH, 16), goalMat);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, GOAL_HEIGHT, GOAL_Z);
  scene.add(leftPost, rightPost, bar);

  const net = new THREE.GridHelper(GOAL_WIDTH, 12, '#dbeafe', '#7dd3fc');
  net.rotation.x = Math.PI / 2;
  net.position.set(0, GOAL_HEIGHT / 2, GOAL_Z - 0.48);
  net.scale.y = GOAL_HEIGHT / GOAL_WIDTH;
  scene.add(net);

  const crowdMatA = makeMaterial('#233352', 0.8);
  const crowdMatB = makeMaterial('#6d1d3b', 0.8);
  for (let row = 0; row < 5; row += 1) {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(24, 0.45, 1.2), row % 2 ? crowdMatA : crowdMatB);
    stand.position.set(0, 1.2 + row * 0.48, GOAL_Z - 4 - row * 0.7);
    scene.add(stand);
  }

  [-12.5, 12.5].forEach((x) => [-24, 24].forEach((z) => {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 7.5, 10), makeMaterial('#334155', 0.5, 0.25));
    tower.position.set(x, 3.75, z);
    const lamp = new THREE.PointLight('#dbeafe', 5.4, 42);
    lamp.position.set(x, 7.7, z);
    scene.add(tower, lamp);
  }));


    // Field perimeter netting and connected corner lamp posts make the arena feel enclosed instead of empty.
  const fenceMat = makeMaterial('#94a3b8', 0.5, 0.18);
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 20; i += 1) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), fenceMat);
      post.position.set(side * 14.3, 0.65, -28 + i * 2.95);
      scene.add(post);
    }
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 58), fenceMat);
    topRail.position.set(side * 14.3, 1.28, 0);
    scene.add(topRail);
  });
  [-29, 29].forEach((z) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(28.5, 0.04, 0.035), fenceMat);
    rail.position.set(0, 1.28, z);
    scene.add(rail);
  });

  // Reserve benches for both teams, visible on the side of the pitch in portrait view.
  [-1, 1].forEach((side) => {
    const shelter = new THREE.Mesh(new THREE.BoxGeometry(4.9, 1.45, 1.25), makeMaterial(side < 0 ? '#1d4ed8' : '#b91c1c', 0.58));
    shelter.position.set(side * 11.8, 0.72, 5.5);
    scene.add(shelter);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.16, 0.55), makeMaterial('#1e293b', 0.62));
    bench.position.set(side * 11.8, 0.42, 5.5);
    scene.add(bench);
    for (let i = 0; i < 4; i += 1) {
      const reserve = createPlayer(side < 0 ? '#2563eb' : '#dc2626', '#0f172a', 50 + i + (side > 0 ? 10 : 0));
      reserve.scale.setScalar(0.62);
      reserve.position.set(side * 11.8 + (i - 1.5) * 0.75, 0.18, 5.55);
      reserve.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(reserve);
    }
  });

  // Connected stair blocks on both sides and angled corner pieces, matching the existing stand language.
  [-1, 1].forEach((side) => {
    for (let row = 0; row < 7; row += 1) {
      const stair = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 1.25), makeMaterial(row % 2 ? '#334155' : '#475569', 0.82));
      stair.position.set(side * 17.4, 1.05 + row * 0.36, -18 + row * 0.45);
      stair.rotation.y = side * 0.05;
      scene.add(stair);
    }
    [-1, 1].forEach((corner) => {
      const cornerStair = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.32, 1.2), makeMaterial('#3f4b5f', 0.82));
      cornerStair.position.set(side * 15.6, 1.22, corner * 26.2);
      cornerStair.rotation.y = side * corner * 0.78;
      scene.add(cornerStair);
    });
  });

  // Stylized spectators with varied skin, hair, eyes and eyebrows.
  for (let i = 0; i < 64; i += 1) {
    const side = i % 2 ? -1 : 1;
    const row = Math.floor(i / 12);
    const spectator = createPlayer(['#ef4444', '#2563eb', '#facc15', '#22c55e', '#a855f7'][i % 5], '#111827', i);
    spectator.scale.setScalar(0.5);
    spectator.position.set(side * (15.8 + row * 0.34), 1.62 + row * 0.29, -21 + (i % 12) * 3.6);
    spectator.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    spectator.userData.spectator = true;
    spectator.userData.basePosition = spectator.position.clone();
    scene.add(spectator);
  }
}

function createWall(scene: THREE.Scene) {
  for (let i = 0; i < 5; i += 1) {
    const defender = createPlayer('#eab308', '#172554', 80 + i);
    defender.position.set(-WALL_WIDTH / 2 + i * (WALL_WIDTH / 4), 0, WALL_Z + Math.sin(i) * 0.15);
    defender.rotation.y = Math.PI;
    defender.scale.setScalar(0.92);
    scene.add(defender);
  }
}

function createRuntime(mount: HTMLDivElement): SceneRuntime {
  const scene = new THREE.Scene();
  createStadium(scene);
  createWall(scene);

  const camera = new THREE.PerspectiveCamera(46, mount.clientWidth / mount.clientHeight, 0.1, 120);
  camera.position.set(0, 7.5, 18);
  camera.lookAt(0, 1.2, -10);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth, mount.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  mount.appendChild(renderer.domElement);

  const animatedHumans: THREE.Group[] = [];

  const player = createPlayer('#2563eb', '#0f172a', 100);
  player.position.set(-1.35, 0, 9.8);
  player.rotation.y = -0.32;
  player.userData.role = 'kicker';
  player.userData.basePosition = player.position.clone();
  scene.add(player);
  animatedHumans.push(player);

  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 32, 32),
    new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.48, metalness: 0.02 }),
  );
  ballMesh.position.copy(BALL_START);
  ballMesh.castShadow = true;
  scene.add(ballMesh);

  const seamMat = new THREE.LineBasicMaterial({ color: '#0f172a', transparent: true, opacity: 0.72 });
  for (let i = 0; i < 3; i += 1) {
    const seam = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 48 }, (_, p) => {
        const a = (Math.PI * 2 * p) / 47;
        return new THREE.Vector3(Math.cos(a) * 0.285, Math.sin(a) * 0.285, 0);
      })),
      seamMat,
    );
    seam.rotation.set(i === 0 ? Math.PI / 2 : 0, i === 1 ? Math.PI / 2 : 0, i === 2 ? Math.PI / 2 : 0);
    ballMesh.add(seam);
  }

  const keeperGroup = createPlayer('#22c55e', '#052e16');
  keeperGroup.position.set(0, 0, GOAL_Z + 0.55);
  keeperGroup.scale.setScalar(1.08);
  keeperGroup.rotation.y = 0;
  keeperGroup.userData.role = 'keeper';
  keeperGroup.userData.basePosition = keeperGroup.position.clone();
  scene.add(keeperGroup);

  animatedHumans.push(keeperGroup);

  // Complete 22-player layout: 10 teammates plus 10 opponents (including the visible wall), plus a black-uniform referee.
  const teammatePositions = [
    [-5.2, 5.2], [-2.7, 2.3], [2.5, 1.2], [5.4, 5.3], [-6.1, -4.2], [-3.2, -11.5], [3.3, -12.2], [6.2, -5.1], [-1.4, -18.3], [1.9, -20.1],
  ];
  teammatePositions.forEach(([x, z], i) => {
    const teammate = createPlayer('#2563eb', '#0f172a', 110 + i);
    teammate.scale.setScalar(0.86);
    teammate.position.set(x, 0, z);
    teammate.rotation.y = Math.PI + THREE.MathUtils.randFloatSpread(0.3);
    teammate.userData.role = 'teammate';
    teammate.userData.basePosition = teammate.position.clone();
    scene.add(teammate);
    animatedHumans.push(teammate);
  });

  const opponentPositions = [[-6.4, -15.3], [6.1, -15.1], [-4.8, -20.5], [4.9, -20.7], [0, -2.5]];
  opponentPositions.forEach(([x, z], i) => {
    const opponent = createPlayer('#eab308', '#172554', 130 + i);
    opponent.scale.setScalar(0.88);
    opponent.position.set(x, 0, z);
    opponent.rotation.y = THREE.MathUtils.randFloatSpread(0.35);
    opponent.userData.role = 'opponent';
    opponent.userData.basePosition = opponent.position.clone();
    scene.add(opponent);
    animatedHumans.push(opponent);
  });

  const referee = createPlayer('#050505', '#050505', 160);
  referee.scale.setScalar(0.88);
  referee.position.set(6.7, 0, 1.4);
  referee.rotation.y = -0.6;
  referee.userData.role = 'referee';
  referee.userData.basePosition = referee.position.clone();
  const refBadge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.012), makeMaterial('#f8fafc', 0.5));
  refBadge.position.set(0.13, 1.68, 0.31);
  referee.add(refBadge);
  scene.add(referee);
  animatedHumans.push(referee);

  scene.traverse((object) => {
    if (object instanceof THREE.Group && object.userData.spectator) animatedHumans.push(object);
  });


  const aimLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([BALL_START, new THREE.Vector3(0, 1.8, -14)]),
    new THREE.LineBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.95 }),
  );
  scene.add(aimLine);

  const ghostLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([BALL_START, BALL_START.clone()]),
    new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.55 }),
  );
  scene.add(ghostLine);

  const goalFlash = new THREE.PointLight('#facc15', 0, 18);
  goalFlash.position.set(0, 2, GOAL_Z + 1);
  scene.add(goalFlash);

  return {
    renderer,
    camera,
    scene,
    ball: { mesh: ballMesh, velocity: new THREE.Vector3(), spin: new THREE.Vector3(), active: false },
    keeper: { group: keeperGroup, diveVelocity: 0, targetX: 0 },
    aimLine,
    ghostLine,
    goalFlash,
    animatedHumans,
    kicker: player,
    kickUntil: 0,
    celebrateUntil: 0,
  };
}

function predictTrajectory(targetX: number, targetY: number, charge: number, curve: number, power: number) {
  const start = BALL_START.clone();
  const goalPoint = new THREE.Vector3(targetX, targetY, GOAL_Z);
  const direction = goalPoint.sub(start).normalize();
  const lowShot = targetY < 1.05;
  const shotPower = 20 + charge * 9.5 + power * 1.55;
  const lift = lowShot ? 1.7 + charge * 0.72 : 5.8 + targetY * 1.15 + charge * 2.25;
  const velocity = new THREE.Vector3(direction.x * shotPower, lift, direction.z * shotPower);
  const spin = new THREE.Vector3(curve * 1.15, 0, 0);
  const points: THREE.Vector3[] = [];
  const pos = start.clone();
  for (let i = 0; i < 42; i += 1) {
    const dt = 0.045;
    velocity.x += spin.x * dt * (1.5 + i * 0.012);
    velocity.y += GRAVITY * dt;
    velocity.multiplyScalar(0.996);
    pos.addScaledVector(velocity, dt);
    if (pos.y < 0.28) {
      pos.y = 0.28;
      velocity.y *= -0.16;
      velocity.x *= 0.985;
      velocity.z *= 0.985;
    }
    points.push(pos.clone());
    if (pos.z < GOAL_Z - 0.5) break;
  }
  return points;
}


function chooseTechnique(wind: number, focusLevel: number, lastIndex: number) {
  const ranked = TECHNIQUES.map((tech, index) => {
    const windHelp = Math.sign(tech.curveBias || 1) === Math.sign(-wind || 1) ? 0.16 : -0.06;
    const cornerValue = Math.abs(tech.target.x) * 0.08 + (tech.target.y > 2 ? 0.14 : 0.1);
    const focusNoise = (6 - focusLevel) * 0.025 * Math.sin(index * 2.31 + lastIndex);
    return { tech, score: cornerValue + windHelp + focusLevel * 0.03 - focusNoise - (index === lastIndex ? 0.18 : 0) };
  });
  return ranked.sort((a, b) => b.score - a.score)[0].tech;
}

function animateHuman(human: THREE.Group, now: number, celebrating: boolean, kickActive: boolean) {
  const t = now * 0.001 + (human.userData.seed ?? 0);
  const base = human.userData.basePosition as THREE.Vector3 | undefined;
  if (base) human.position.y = base.y;
  if (human.userData.spectator) {
    human.position.y = (base?.y ?? human.position.y) + (celebrating ? Math.abs(Math.sin(t * 8)) * 0.24 : Math.sin(t * 2.1) * 0.025);
    human.rotation.z = Math.sin(t * 3.2) * (celebrating ? 0.08 : 0.02);
    return;
  }
  const leftLeg = human.userData.leftLeg as THREE.Object3D | undefined;
  const rightLeg = human.userData.rightLeg as THREE.Object3D | undefined;
  if (human.userData.role === 'kicker') {
    human.position.y = 0; // keep plant foot grounded: never lift the shooter into the air.
    if (leftLeg) leftLeg.rotation.x = kickActive ? 0.55 + Math.sin(t * 22) * 0.12 : -0.08;
    if (rightLeg) rightLeg.rotation.x = kickActive ? -1.05 + Math.sin(t * 24) * 0.18 : 0.04;
    human.rotation.z = kickActive ? -0.04 : 0;
    return;
  }
  if (celebrating && (human.userData.role === 'teammate' || human.userData.role === 'keeper')) {
    human.position.y = (base?.y ?? 0) + Math.abs(Math.sin(t * 7)) * 0.1;
    human.rotation.z = Math.sin(t * 6) * 0.08;
  } else {
    if (leftLeg) leftLeg.rotation.x = Math.sin(t * 1.4) * 0.06;
    if (rightLeg) rightLeg.rotation.x = -Math.sin(t * 1.4) * 0.06;
  }
}

export default function FreeKickArenaGame() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const targetRef = useRef({ ...TECHNIQUES[0].target });
  const chargeRef = useRef(TECHNIQUES[0].charge);
  const phaseRef = useRef<ShotPhase>('aiming');
  const upgradesRef = useRef<Record<UpgradeKey, number>>({ curve: 1, power: 1, focus: 1 });
  const streakRef = useRef(0);
  const pointerActiveRef = useRef(false);
  const settledAtRef = useRef(0);
  const techniqueIndexRef = useRef(0);
  const techniqueRef = useRef<Technique>(TECHNIQUES[0]);

  const [phase, setPhase] = useState<ShotPhase>('aiming');
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(120);
  const [streak, setStreak] = useState(0);
  const [charge, setCharge] = useState(chargeRef.current);
  const [target, setTarget] = useState(targetRef.current);
  const windRef = useRef(THREE.MathUtils.randFloat(-0.75, 0.75));
  const [wind, setWindState] = useState(windRef.current);
  const [technique, setTechnique] = useState(techniqueRef.current);
  const [message, setMessage] = useState('AI selected a grounded free-kick technique. Drag to adjust, hold SHOOT, release to strike.');
  const [upgrades, setUpgrades] = useState<Record<UpgradeKey, number>>(upgradesRef.current);

  const upgradeEntries = useMemo(() => Object.entries(upgradeCopy) as Array<[UpgradeKey, { label: string; description: string }]>, []);

  const setPhaseState = (next: ShotPhase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const applyTechnique = (next: Technique) => {
    techniqueRef.current = next;
    targetRef.current = { ...next.target };
    chargeRef.current = next.charge;
    setTechnique(next);
    setTarget({ ...next.target });
    setCharge(next.charge);
    setMessage(`${next.label}: ${next.note}. Player stays grounded with a planted support foot.`);
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const runtime = createRuntime(mount);
    runtimeRef.current = runtime;
    let raf = 0;
    let last = performance.now();
    let chargeDirection = 1;

    const resize = () => {
      runtime.camera.aspect = mount.clientWidth / mount.clientHeight;
      runtime.camera.updateProjectionMatrix();
      runtime.renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', resize);

    const pickNextTechnique = () => {
      const next = chooseTechnique(windRef.current, upgradesRef.current.focus, techniqueIndexRef.current);
      techniqueIndexRef.current = TECHNIQUES.findIndex((item) => item.key === next.key);
      applyTechnique(next);
    };

    const resetBall = () => {
      runtime.ball.active = false;
      runtime.ball.velocity.set(0, 0, 0);
      runtime.ball.spin.set(0, 0, 0);
      runtime.ball.mesh.position.copy(BALL_START);
      runtime.keeper.group.position.x = 0;
      runtime.keeper.targetX = 0;
      runtime.keeper.diveVelocity = 0;
      runtime.goalFlash.intensity = 0;
      setPhaseState('aiming');
      pickNextTechnique();
    };

    const shoot = () => {
      if (phaseRef.current !== 'charging' && phaseRef.current !== 'aiming') return;
      const { x, y } = targetRef.current;
      const levels = upgradesRef.current;
      const imperfect = (1.2 - levels.focus * 0.16) * (1 - chargeRef.current) * THREE.MathUtils.randFloatSpread(0.7);
      const currentWind = windRef.current;
      const aimedX = x + imperfect + currentWind * 0.42;
      const currentTechnique = techniqueRef.current;
      const aimedY = y + THREE.MathUtils.randFloatSpread(0.18 / levels.focus);
      const techniqueCurve = currentTechnique.curveBias * (0.62 + levels.curve * 0.22) + x * 0.17 + currentWind * 0.2;
      const points = predictTrajectory(aimedX, aimedY, chargeRef.current, techniqueCurve, levels.power);
      const first = points[1] ?? new THREE.Vector3(aimedX, aimedY, GOAL_Z);
      runtime.ball.velocity.copy(first.clone().sub(BALL_START).multiplyScalar(1 / 0.045));
      runtime.ball.spin.set(techniqueCurve * 2.25, 0, -x * 4.2);
      runtime.ball.active = true;
      runtime.kickUntil = performance.now() + 620;
      runtime.keeper.targetX = clamp(aimedX + THREE.MathUtils.randFloatSpread(1.15 - levels.focus * 0.12), -3.05, 3.05);
      setPhaseState('flying');
      setMessage(`Grounded strike: ${currentTechnique.label} bending toward ${currentTechnique.note}.`);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerActiveRef.current || phaseRef.current === 'flying') return;
      const rect = runtime.renderer.domElement.getBoundingClientRect();
      const nx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const ny = clamp((event.clientY - rect.top) / rect.height, 0, 1);
      const next = { x: (nx - 0.5) * GOAL_WIDTH * 0.88, y: 0.85 + (1 - ny) * 2.35 };
      targetRef.current = next;
      setTarget(next);
    };
    const onPointerDown = (event: PointerEvent) => {
      pointerActiveRef.current = true;
      onPointerMove(event);
    };
    const onPointerUp = () => {
      pointerActiveRef.current = false;
    };

    runtime.renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    (window as any).freeKickShoot = shoot;
    (window as any).freeKickReset = resetBall;
    (window as any).freeKickAiTechnique = pickNextTechnique;

    const animate = (now: number) => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;

      if (phaseRef.current === 'charging') {
        const nextCharge = clamp(chargeRef.current + chargeDirection * dt * 0.72, 0.18, 1);
        chargeRef.current = nextCharge;
        setCharge(nextCharge);
        if (nextCharge >= 0.995 || nextCharge <= 0.185) chargeDirection *= -1;
      }

      const levels = upgradesRef.current;
      const predicted = predictTrajectory(targetRef.current.x, targetRef.current.y, chargeRef.current, techniqueRef.current.curveBias * (0.62 + levels.curve * 0.22) + targetRef.current.x * 0.17 + windRef.current * 0.2, levels.power);
      runtime.ghostLine.geometry.dispose();
      runtime.ghostLine.geometry = new THREE.BufferGeometry().setFromPoints(predicted.filter((_, i) => i % 3 === 0));
      const aimEnd = new THREE.Vector3(targetRef.current.x, targetRef.current.y, GOAL_Z);
      runtime.aimLine.geometry.dispose();
      runtime.aimLine.geometry = new THREE.BufferGeometry().setFromPoints([BALL_START, aimEnd]);

      runtime.keeper.group.position.x = THREE.MathUtils.damp(runtime.keeper.group.position.x, runtime.keeper.targetX, 4.5, dt);
      runtime.keeper.group.rotation.z = THREE.MathUtils.damp(runtime.keeper.group.rotation.z, -runtime.keeper.group.position.x * 0.12, 5, dt);

      if (runtime.ball.active) {
        runtime.ball.velocity.x += (runtime.ball.spin.x + windRef.current * 0.92) * dt;
        runtime.ball.velocity.y += GRAVITY * dt;
        runtime.ball.velocity.multiplyScalar(DRAG);
        runtime.ball.mesh.position.addScaledVector(runtime.ball.velocity, dt);
        runtime.ball.mesh.rotation.x += runtime.ball.velocity.z * dt * 1.4;
        runtime.ball.mesh.rotation.z += runtime.ball.velocity.x * dt * 1.6;
        if (runtime.ball.mesh.position.y < 0.28) {
          runtime.ball.mesh.position.y = 0.28;
          runtime.ball.velocity.y *= -0.16;
          runtime.ball.velocity.x *= 0.985;
          runtime.ball.velocity.z *= 0.985;
        }

        if (runtime.ball.mesh.position.z < WALL_Z + 0.45 && runtime.ball.mesh.position.z > WALL_Z - 0.45 && Math.abs(runtime.ball.mesh.position.x) < WALL_WIDTH / 2 && runtime.ball.mesh.position.y < 2.25) {
          runtime.ball.active = false;
          settledAtRef.current = now + 1050;
          setPhaseState('saved');
          streakRef.current = 0;
          setStreak(0);
          setMessage('Blocked by the wall. Aim higher or add more curve.');
        }

        const keeperDistance = runtime.ball.mesh.position.distanceTo(new THREE.Vector3(runtime.keeper.group.position.x, 1.35, GOAL_Z + 0.35));
        if (keeperDistance < 1.08 && runtime.ball.mesh.position.y < 2.65) {
          runtime.ball.active = false;
          settledAtRef.current = now + 1150;
          setPhaseState('saved');
          streakRef.current = 0;
          setStreak(0);
          setMessage('Keeper save! Upgrade Focus Vision to reduce readable shots.');
        }

        if (runtime.ball.mesh.position.z <= GOAL_Z) {
          const inside = Math.abs(runtime.ball.mesh.position.x) < GOAL_WIDTH / 2 - 0.24 && runtime.ball.mesh.position.y > 0.35 && runtime.ball.mesh.position.y < GOAL_HEIGHT;
          runtime.ball.active = false;
          settledAtRef.current = now + 1300;
          if (inside) {
            const placementBonus = Math.round((Math.abs(runtime.ball.mesh.position.x) + runtime.ball.mesh.position.y) * 14);
            const earned = 35 + placementBonus + streakRef.current * 10;
            streakRef.current += 1;
            setStreak(streakRef.current);
            setScore((value) => value + 100 + placementBonus);
            setCoins((value) => value + earned);
            setPhaseState('goal');
            runtime.goalFlash.intensity = 7;
            runtime.celebrateUntil = performance.now() + 2400;
            setMessage(`GOAL! +${earned} coins for placement, curve and streak pressure.`);
          } else {
            streakRef.current = 0;
            setStreak(0);
            setPhaseState('missed');
            setMessage('Missed the frame. Pull the target back inside the posts.');
          }
        }

        if (runtime.ball.mesh.position.y < 0.18 || runtime.ball.mesh.position.z < GOAL_Z - 4 || Math.abs(runtime.ball.mesh.position.x) > 8) {
          runtime.ball.active = false;
          settledAtRef.current = now + 950;
          setPhaseState('missed');
          streakRef.current = 0;
          setStreak(0);
          setMessage('The shot lost shape. Balance charge, wind and bend.');
        }
      }

      if (!runtime.ball.active && phaseRef.current !== 'aiming' && settledAtRef.current > 0 && now > settledAtRef.current) {
        windRef.current = THREE.MathUtils.randFloat(-0.9, 0.9);
        setWindState(windRef.current);
        resetBall();
      }

      runtime.animatedHumans.forEach((human) => animateHuman(human, now, now < runtime.celebrateUntil, now < runtime.kickUntil));
      runtime.goalFlash.intensity = THREE.MathUtils.damp(runtime.goalFlash.intensity, 0, 3.5, dt);
      const cinematicZ = phaseRef.current === 'flying' ? 16.2 : 18;
      const cinematicY = phaseRef.current === 'flying' ? 6.3 : 7.5;
      runtime.camera.position.lerp(new THREE.Vector3(runtime.ball.mesh.position.x * 0.18, cinematicY, cinematicZ), 0.045);
      runtime.camera.lookAt(runtime.ball.mesh.position.x * 0.25, 1.35, -11.5);
      runtime.renderer.render(runtime.scene, runtime.camera);
    };
    raf = requestAnimationFrame(animate);
    pickNextTechnique();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      runtime.renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      runtime.renderer.dispose();
      mount.innerHTML = '';
      delete (window as any).freeKickShoot;
      delete (window as any).freeKickReset;
      delete (window as any).freeKickAiTechnique;
    };
  }, []);

  const beginCharge = () => {
    if (phaseRef.current !== 'aiming') return;
    setPhaseState('charging');
    setMessage(`Charging ${technique.label}. Release for ${technique.note}.`);
  };

  const releaseShot = () => {
    (window as any).freeKickShoot?.();
  };

  const buyUpgrade = (key: UpgradeKey) => {
    const current = upgradesRef.current[key];
    const cost = 90 + current * 70;
    if (coins < cost || current >= 5) return;
    const next = { ...upgradesRef.current, [key]: current + 1 };
    upgradesRef.current = next;
    setUpgrades(next);
    setCoins((value) => value - cost);
    setMessage(`${upgradeCopy[key].label} upgraded to level ${current + 1}. AI corner selection and shot response improved.`);
  };

  const phaseLabel = phase === 'goal' ? 'GOAL' : phase === 'saved' ? 'SAVED' : phase === 'missed' ? 'MISS' : phase === 'charging' ? 'CHARGE' : phase === 'flying' ? 'FLIGHT' : 'AIM';

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%', overflow: 'hidden', background: '#020617', color: '#fff', fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', touchAction: 'none' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(2,6,23,.22), rgba(2,6,23,0) 38%, rgba(2,6,23,.78))' }} />

      <section style={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'grid', gap: 10, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <div style={{ padding: '10px 12px', borderRadius: 18, background: 'rgba(15,23,42,.74)', border: '1px solid rgba(255,255,255,.12)', backdropFilter: 'blur(14px)' }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, color: '#7dd3fc', fontWeight: 900 }}>FREE KICK ARENA</div>
            <div style={{ fontSize: 20, fontWeight: 1000, lineHeight: 1.05 }}>Pro Curve Duel</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, minWidth: 172 }}>
            {[['Score', score], ['Coins', coins], ['Streak', `${streak}x`]].map(([label, value]) => (
              <div key={label} style={{ textAlign: 'center', padding: '8px 7px', borderRadius: 14, background: 'rgba(15,23,42,.74)', border: '1px solid rgba(255,255,255,.11)' }}>
                <div style={{ fontSize: 9, color: '#cbd5e1', fontWeight: 800 }}>{label}</div>
                <div style={{ fontSize: 15, color: label === 'Coins' ? '#facc15' : '#fff', fontWeight: 1000 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ padding: '8px 10px', borderRadius: 999, background: 'rgba(14,165,233,.18)', border: '1px solid rgba(125,211,252,.32)', fontWeight: 900, fontSize: 12 }}>Wind {wind >= 0 ? '→' : '←'} {Math.abs(wind).toFixed(1)}</div>
          <div style={{ padding: '8px 12px', borderRadius: 999, background: phase === 'goal' ? 'rgba(34,197,94,.86)' : phase === 'saved' || phase === 'missed' ? 'rgba(239,68,68,.78)' : 'rgba(250,204,21,.92)', color: phase === 'aiming' || phase === 'charging' ? '#172033' : '#fff', fontWeight: 1000, fontSize: 12, letterSpacing: 1 }}>{phaseLabel}</div>
        </div>
      </section>

      <div style={{ position: 'absolute', left: `calc(50% + ${(target.x / (GOAL_WIDTH / 2)) * 39}vw)`, top: `${31 - ((target.y - 0.85) / 2.35) * 13}vh`, width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: 999, border: '2px solid #facc15', boxShadow: '0 0 24px rgba(250,204,21,.88), inset 0 0 14px rgba(250,204,21,.45)', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: 15, top: -8, width: 2, height: 48, background: 'rgba(250,204,21,.68)' }} />
        <div style={{ position: 'absolute', top: 15, left: -8, height: 2, width: 48, background: 'rgba(250,204,21,.68)' }} />
      </div>

      <section style={{ position: 'absolute', left: 12, right: 12, bottom: 12, display: 'grid', gap: 10 }}>
        <div style={{ padding: 12, borderRadius: 20, background: 'rgba(15,23,42,.78)', border: '1px solid rgba(255,255,255,.12)', backdropFilter: 'blur(14px)', boxShadow: '0 18px 54px rgba(0,0,0,.35)' }}>
          <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.35, minHeight: 34 }}>{message}</div>
          <div style={{ marginTop: 10, height: 12, borderRadius: 999, background: 'rgba(148,163,184,.2)', overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)' }}>
            <div style={{ width: `${charge * 100}%`, height: '100%', borderRadius: 999, background: charge > 0.82 ? 'linear-gradient(90deg,#f97316,#ef4444)' : 'linear-gradient(90deg,#22c55e,#facc15)', boxShadow: '0 0 18px rgba(250,204,21,.6)' }} />
          </div>
          <button
            type="button"
            onPointerDown={beginCharge}
            onPointerUp={releaseShot}
            onPointerCancel={releaseShot}
            disabled={phase === 'flying'}
            style={{ marginTop: 10, width: '100%', border: 0, borderRadius: 18, padding: '16px 18px', color: '#07111f', background: phase === 'flying' ? '#64748b' : 'linear-gradient(135deg,#fef08a,#facc15 45%,#fb923c)', fontSize: 17, fontWeight: 1000, letterSpacing: 1.2, boxShadow: '0 12px 30px rgba(250,204,21,.28)' }}
          >
            HOLD & RELEASE TO SHOOT
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {upgradeEntries.map(([key, item]) => {
            const level = upgrades[key];
            const cost = 90 + level * 70;
            const capped = level >= 5;
            return (
              <button
                key={key}
                type="button"
                onClick={() => buyUpgrade(key)}
                disabled={capped || coins < cost}
                style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 16, padding: '9px 7px', textAlign: 'left', background: capped ? 'rgba(34,197,94,.26)' : coins >= cost ? 'rgba(30,41,59,.86)' : 'rgba(15,23,42,.58)', color: '#fff' }}
              >
                <div style={{ fontSize: 10, color: '#7dd3fc', fontWeight: 1000 }}>LV {level}/5</div>
                <div style={{ fontSize: 11, fontWeight: 1000, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</div>
                <div style={{ fontSize: 9, color: '#cbd5e1', minHeight: 22 }}>{item.description}</div>
                <div style={{ marginTop: 4, fontSize: 10, color: capped ? '#86efac' : '#facc15', fontWeight: 900 }}>{capped ? 'MAXED' : `${cost} coins`}</div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
