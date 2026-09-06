import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import type {
  BowlingState,
  ThrowInput
} from '../../../../shared/bowling/engine';

function disposeObject(object: THREE.Object3D) {
  const seen = new Set<unknown>();
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.geometry) return;
    if (!seen.has(mesh.geometry)) {
      mesh.geometry.dispose();
      seen.add(mesh.geometry);
    }
    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]) {
      if (!material || seen.has(material)) continue;
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture && !seen.has(value)) {
          value.dispose();
          seen.add(value);
        }
      material.dispose();
      seen.add(material);
    }
  });
}
type PlayerAction = 'idle' | 'approach' | 'throw' | 'recover';
type BallReturnState = 'idle' | 'toPit' | 'hidden' | 'returning';

type HudState = {
  power: number;
  status: string;
  activePlayer: number;
  p1: number;
  p2: number;
  frame: number;
  roll: number;
};

type ThrowIntent = {
  power: number;
  releaseX: number;
  targetX: number;
  hook: number;
  speed: number;
};

type ControlState = {
  active: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  intent: ThrowIntent | null;
};

type BowlingFrame = { rolls: number[]; cumulative: number | null };
type ScorePlayer = { name: string; frames: BowlingFrame[]; total: number };

type HumanRig = {
  root: THREE.Group;
  modelRoot: THREE.Group;
  fallback: THREE.Group;
  shadow: THREE.Mesh;
  model: THREE.Object3D | null;
  pos: THREE.Vector3;
  yaw: number;
  action: PlayerAction;
  approachT: number;
  throwT: number;
  recoverT: number;
  walkCycle: number;
  approachFrom: THREE.Vector3;
  approachTo: THREE.Vector3;
};

type BallState = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  held: boolean;
  rolling: boolean;
  inGutter: boolean;
  hook: number;
  returnState: BallReturnState;
  returnT: number;
};

type PinState = {
  root: THREE.Group;
  start: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  tilt: number;
  tiltDir: THREE.Vector3;
  angularVel: number;
  standing: boolean;
  knocked: boolean;
};

const HUMAN_URL = '/assets/bowling-royal/bowler.glb';
const HDRI_URL = '/assets/bowling-royal/studio.hdr';
const OAK = {
  diff: '/assets/bowling-royal/wood.jpg',
  rough: '/assets/bowling-royal/wood-rough.jpg',
  normal: '/assets/bowling-royal/wood-normal.jpg'
};

const UP = new THREE.Vector3(0, 1, 0);

const CFG = {
  laneY: 0.08,
  laneHalfW: 1.56,
  gutterHalfW: 2.08,
  playerStartZ: 7.15,
  approachStopZ: 4.95,
  foulZ: 4.55,
  arrowsZ: 0.95,
  pinDeckZ: -10.75,
  backStopZ: -13.15,
  ballR: 0.18,
  pinR: 0.17,
  pinToppleThreshold: 0.58,
  approachDuration: 0.56,
  throwDuration: 0.9,
  recoverDuration: 0.28,
  releaseT: 0.56
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => t * t * (3 - 2 * t);

function enableShadow(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });
  return obj;
}

function setTexRepeat(tex: THREE.Texture, rx: number, ry: number) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.anisotropy = 8;
}

function loadOakMaterial(
  loader: THREE.TextureLoader,
  repeatX: number,
  repeatY: number
) {
  const diff = loader.load(OAK.diff, undefined, undefined, () => {
    material.map = makeFallbackWoodMaterial().map;
    material.needsUpdate = true;
  });
  const rough = loader.load(OAK.rough);
  const normal = loader.load(OAK.normal);
  diff.colorSpace = THREE.SRGBColorSpace;
  setTexRepeat(diff, repeatX, repeatY);
  setTexRepeat(rough, repeatX, repeatY);
  setTexRepeat(normal, repeatX, repeatY);
  const material = new THREE.MeshPhysicalMaterial({
    map: diff,
    roughnessMap: rough,
    normalMap: normal,
    roughness: 0.22,
    metalness: 0.02,
    clearcoat: 1,
    clearcoatRoughness: 0.055,
    reflectivity: 0.92
  });
  return material;
}

function makeFallbackWoodMaterial() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#d3a365';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(110,65,28,0.12)' : 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, Math.random() * 512, 512, 1 + Math.random() * 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.1, 8.2);
  return new THREE.MeshPhysicalMaterial({
    map: tex,
    roughness: 0.24,
    metalness: 0.02,
    clearcoat: 1,
    clearcoatRoughness: 0.08
  });
}

function normalizeHuman(model: THREE.Object3D, targetHeight: number) {
  model.rotation.set(0, Math.PI, 0);
  model.position.set(0, 0, 0);
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const h = Math.max(0.001, box.max.y - box.min.y);
  model.scale.setScalar(targetHeight / h);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.add(new THREE.Vector3(-center.x, -box.min.y, -center.z));
}

function makeFallbackHuman(color: number) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({
    color: 0xecc5a2,
    roughness: 0.82
  });
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
  const pants = new THREE.MeshStandardMaterial({
    color: 0x1f232c,
    roughness: 0.84
  });
  const shoes = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.56
  });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 18), skin);
  head.position.y = 1.62;
  g.add(head);
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.54, 6, 14),
    shirt
  );
  torso.position.y = 1.05;
  g.add(torso);
  const leftLeg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.07, 0.52, 4, 10),
    pants
  );
  leftLeg.position.set(-0.12, 0.35, 0);
  g.add(leftLeg);
  const rightLeg = leftLeg.clone();
  rightLeg.position.x = 0.12;
  g.add(rightLeg);
  const leftArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.055, 0.42, 4, 10),
    skin
  );
  leftArm.position.set(-0.32, 1.16, 0);
  leftArm.rotation.z = 0.22;
  g.add(leftArm);
  const rightArm = leftArm.clone();
  rightArm.position.set(0.32, 1.16, 0.06);
  rightArm.rotation.z = -0.18;
  g.add(rightArm);
  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.28), shoes);
  shoeL.position.set(-0.12, 0.03, -0.02);
  g.add(shoeL);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.12;
  g.add(shoeR);
  enableShadow(g);
  return g;
}

function addHuman(
  scene: THREE.Scene,
  start: THREE.Vector3,
  accent: number
): HumanRig {
  const root = new THREE.Group();
  const modelRoot = new THREE.Group();
  const fallback = makeFallbackHuman(accent);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 32),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  modelRoot.position.copy(start);
  modelRoot.add(fallback);
  shadow.position.set(start.x, CFG.laneY + 0.01, start.z);
  scene.add(root, modelRoot, shadow);

  const rig: HumanRig = {
    root,
    modelRoot,
    fallback,
    shadow,
    model: null,
    pos: start.clone(),
    yaw: 0,
    action: 'idle',
    approachT: 0,
    throwT: 0,
    recoverT: 0,
    walkCycle: 0,
    approachFrom: start.clone(),
    approachTo: start.clone()
  };

  new GLTFLoader().setCrossOrigin('anonymous').load(
    HUMAN_URL,
    (gltf) => {
      const model = gltf.scene;
      if (scene.userData.disposed) {
        disposeObject(model);
        return;
      }
      normalizeHuman(model, 1.82);
      enableShadow(model);
      rig.model = model;
      rig.fallback.visible = false;
      rig.modelRoot.add(model);
    },
    undefined,
    () => {
      rig.fallback.visible = true;
    }
  );

  return rig;
}

function syncHuman(rig: HumanRig) {
  rig.modelRoot.position.copy(rig.pos);
  rig.modelRoot.rotation.y = rig.yaw;
  rig.shadow.position.set(rig.pos.x, CFG.laneY + 0.01, rig.pos.z);
}

function getHeldBallWorldPosition(rig: HumanRig) {
  let local = new THREE.Vector3(0.34, 0.94, 0.16);
  if (rig.action === 'approach') {
    const s = Math.sin(rig.walkCycle);
    local = new THREE.Vector3(0.36, 0.82 + Math.abs(s) * 0.05, 0.14 + s * 0.09);
  } else if (rig.action === 'throw') {
    const t = clamp01(rig.throwT);
    if (t < 0.38) {
      const k = easeInOut(t / 0.38);
      local = new THREE.Vector3(
        lerp(0.34, 0.44, k),
        lerp(0.86, 0.55, k),
        lerp(0.16, 0.68, k)
      );
    } else if (t < CFG.releaseT) {
      const k = easeInOut((t - 0.38) / (CFG.releaseT - 0.38));
      local = new THREE.Vector3(
        lerp(0.44, 0.22, k),
        lerp(0.55, 0.42, k),
        lerp(0.68, -0.58, k)
      );
    } else {
      const k = easeOutCubic((t - CFG.releaseT) / (1 - CFG.releaseT));
      local = new THREE.Vector3(
        lerp(0.22, 0.16, k),
        lerp(0.42, 1.42, k),
        lerp(-0.58, -0.32, k)
      );
    }
  } else if (rig.action === 'recover') {
    const k = clamp01(rig.recoverT);
    local = new THREE.Vector3(0.24, lerp(1.18, 0.96, k), lerp(0.44, 0.18, k));
  }
  return local.applyAxisAngle(UP, rig.yaw).add(rig.pos);
}

function makeBallTexture(colors: [string, string, string]) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.scale(0.5, 0.5);
  const grad = ctx.createRadialGradient(320, 260, 30, 512, 512, 560);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.44, colors[1]);
  grad.addColorStop(1, colors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.globalAlpha = 0.13;
  for (let i = 0; i < 110; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : colors[1];
    ctx.beginPath();
    ctx.arc(
      Math.random() * 1024,
      Math.random() * 1024,
      14 + Math.random() * 70,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 38; i++) {
    ctx.strokeStyle = i % 2 ? colors[0] : 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 8 + Math.random() * 18;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 1024, Math.random() * 1024);
    for (let j = 0; j < 5; j++)
      ctx.lineTo(Math.random() * 1024, Math.random() * 1024);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(420, 380, 28, 0, Math.PI * 2);
  ctx.arc(495, 430, 28, 0, Math.PI * 2);
  ctx.arc(395, 492, 26, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBallMaterial(colors: [string, string, string]) {
  return new THREE.MeshPhysicalMaterial({
    map: makeBallTexture(colors),
    roughness: 0.08,
    metalness: 0.01,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    reflectivity: 1,
    envMapIntensity: 1.4
  });
}

function createActiveBall() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(CFG.ballR, 32, 24),
    makeBallMaterial(['#9ee7ff', '#2d88ff', '#0d1d50'])
  );
  enableShadow(mesh);
  const pos = new THREE.Vector3(0.4, CFG.laneY + 0.82, CFG.playerStartZ);
  mesh.position.copy(pos);
  return {
    mesh,
    pos,
    vel: new THREE.Vector3(),
    held: true,
    rolling: false,
    inGutter: false,
    hook: 0,
    returnState: 'idle',
    returnT: 0
  } as BallState;
}

function createPinMesh() {
  const root = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({
    color: 0xf8f5ef,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.08
  });
  const red = new THREE.MeshPhysicalMaterial({
    color: 0xcc2b2b,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.1
  });
  const points = [
    new THREE.Vector2(0.045, 0),
    new THREE.Vector2(0.09, 0.06),
    new THREE.Vector2(0.085, 0.2),
    new THREE.Vector2(0.16, 0.36),
    new THREE.Vector2(0.14, 0.5),
    new THREE.Vector2(0.068, 0.62),
    new THREE.Vector2(0.076, 0.7),
    new THREE.Vector2(0.038, 0.74),
    new THREE.Vector2(0, 0.74)
  ];
  root.add(new THREE.Mesh(new THREE.LatheGeometry(points, 24), white));
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.072, 0.035, 40),
    red
  );
  stripe.position.y = 0.615;
  root.add(stripe);
  enableShadow(root);
  return root;
}

function createPins(scene: THREE.Scene) {
  const pins: PinState[] = [];
  const positions = [
    [0, 0],
    [-0.32, -0.56],
    [0.32, -0.56],
    [-0.64, -1.12],
    [0, -1.12],
    [0.64, -1.12],
    [-0.96, -1.68],
    [-0.32, -1.68],
    [0.32, -1.68],
    [0.96, -1.68]
  ];
  for (const [x, dz] of positions) {
    const root = createPinMesh();
    const start = new THREE.Vector3(x, CFG.laneY + 0.09, CFG.pinDeckZ + dz);
    root.position.copy(start);
    scene.add(root);
    pins.push({
      root,
      start: start.clone(),
      pos: start.clone(),
      vel: new THREE.Vector3(),
      tilt: 0,
      tiltDir: new THREE.Vector3(0, 0, -1),
      angularVel: 0,
      standing: true,
      knocked: false
    });
  }
  return pins;
}

function resetPins(pins: PinState[]) {
  for (const pin of pins) {
    pin.pos.copy(pin.start);
    pin.vel.set(0, 0, 0);
    pin.tilt = 0;
    pin.tiltDir.set(0, 0, -1);
    pin.angularVel = 0;
    pin.standing = true;
    pin.knocked = false;
    pin.root.visible = true;
    pin.root.position.copy(pin.pos);
    pin.root.rotation.set(0, 0, 0);
  }
}

function createEnvironment(scene: THREE.Scene, loader: THREE.TextureLoader) {
  const group = new THREE.Group();
  scene.add(group);
  let laneMat: THREE.Material;
  let woodMat: THREE.Material;
  try {
    laneMat = loadOakMaterial(loader, 1.05, 8.5);
    woodMat = loadOakMaterial(loader, 0.72, 3.2);
  } catch {
    laneMat = makeFallbackWoodMaterial();
    woodMat = makeFallbackWoodMaterial();
  }

  const gutterMat = new THREE.MeshStandardMaterial({
    color: 0x262f3a,
    roughness: 0.38,
    metalness: 0.2
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x4a5462,
    roughness: 0.34,
    metalness: 0.74
  });
  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x101216,
    roughness: 0.84
  });

  // Arena removed: no walls, no ceiling, and no extra room floor.
  // The bowling game objects below are kept exactly as the playable lane setup.

  const approach = new THREE.Mesh(new THREE.PlaneGeometry(4.9, 4.25), woodMat);
  approach.rotation.x = -Math.PI / 2;
  approach.position.set(0, CFG.laneY - 0.005, 7.35);
  group.add(approach);
  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.laneHalfW * 2, 18.72),
    laneMat
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, CFG.laneY, -4.2);
  lane.receiveShadow = true;
  group.add(lane);
  const oil = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.laneHalfW * 2 - 0.06, 13.4),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      roughness: 0.04,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      reflectivity: 1
    })
  );
  oil.rotation.x = -Math.PI / 2;
  oil.position.set(0, CFG.laneY + 0.002, -2.7);
  group.add(oil);
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(CFG.laneHalfW * 2 + 0.5, 0.13, 2.52),
    woodMat
  );
  deck.position.set(0, CFG.laneY + 0.02, CFG.pinDeckZ - 0.75);
  group.add(deck);
  const gutterL = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.14, 19.1),
    gutterMat
  );
  gutterL.position.set(-1.94, CFG.laneY, -4.2);
  group.add(gutterL);
  const gutterR = gutterL.clone();
  gutterR.position.x = 1.94;
  group.add(gutterR);
  const capL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 19.5), woodMat);
  capL.position.set(-2.24, CFG.laneY + 0.07, -4.2);
  group.add(capL);
  const capR = capL.clone();
  capR.position.x = 2.24;
  group.add(capR);
  const foulLine = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.018, 0.055),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42 })
  );
  foulLine.position.set(0, CFG.laneY + 0.012, CFG.foulZ);
  group.add(foulLine);
  const arrowMat = new THREE.MeshStandardMaterial({
    color: 0x2d4f80,
    roughness: 0.44
  });
  for (let i = -2; i <= 2; i++) {
    const tri = new THREE.Shape();
    tri.moveTo(0, 0.22);
    tri.lineTo(-0.11, -0.16);
    tri.lineTo(0.11, -0.16);
    tri.lineTo(0, 0.22);
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(tri), arrowMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(i * 0.46, CFG.laneY + 0.012, CFG.arrowsZ);
    group.add(mesh);
  }
  const pinsetter = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 0.8, 1.25),
    metalMat
  );
  pinsetter.position.set(0, 0.32, CFG.backStopZ + 0.18);
  group.add(pinsetter);

  const tableTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.64, 0.08, 1.72),
    woodMat
  );
  tableTop.position.set(2.02, 0.76, 6.35);
  group.add(tableTop);
  const legGeom = new THREE.BoxGeometry(0.1, 0.7, 0.1);
  for (const sx of [-0.68, 0.68]) {
    for (const sz of [-0.7, 0.7]) {
      const leg = new THREE.Mesh(legGeom, blackMat);
      leg.position.set(2.02 + sx, 0.37, 6.35 + sz);
      group.add(leg);
    }
  }
  const returnBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.4, 1.55),
    woodMat
  );
  returnBase.position.set(1.67, 0.2, 5.92);
  group.add(returnBase);
  const returnCover = new THREE.Mesh(
    new THREE.CylinderGeometry(0.33, 0.33, 0.84, 28, 1, false, 0, Math.PI),
    metalMat
  );
  returnCover.rotation.z = Math.PI / 2;
  returnCover.position.set(1.67, 0.52, 5.92);
  group.add(returnCover);
  const sideChannel = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.18, 9.9),
    metalMat
  );
  sideChannel.position.set(1.86, 0.16, 1.05);
  group.add(sideChannel);

  const rackColors: [string, string, string][] = [
    ['#ffa3bf', '#cf245d', '#4f0822'],
    ['#9ee7ff', '#2d88ff', '#0d1d50'],
    ['#ffe59b', '#f57e09', '#5a2c00']
  ];
  for (let i = 0; i < 3; i++) {
    const rb = new THREE.Mesh(
      new THREE.SphereGeometry(CFG.ballR, 24, 16),
      makeBallMaterial(rackColors[i])
    );
    rb.position.set(2.02, 0.96, 5.82 + i * 0.44);
    enableShadow(rb);
    group.add(rb);
  }

  // 3D overhead monitor already removed so it no longer blocks or distracts the camera.
  enableShadow(group);
}

function startApproach(rig: HumanRig, intent: ThrowIntent) {
  rig.action = 'approach';
  rig.approachT = 0;
  rig.throwT = 0;
  rig.recoverT = 0;
  rig.walkCycle = 0;
  rig.approachFrom.copy(rig.pos);
  rig.approachTo.set(
    clamp(intent.releaseX - 0.28, -1.3, 1.1),
    CFG.laneY,
    CFG.approachStopZ
  );
}

function updateHuman(rig: HumanRig, ball: BallState, dt: number) {
  if (rig.action === 'approach') {
    rig.approachT = clamp01(rig.approachT + dt / CFG.approachDuration);
    rig.walkCycle += dt * 16.8;
    rig.pos.lerpVectors(
      rig.approachFrom,
      rig.approachTo,
      easeInOut(rig.approachT)
    );
    if (rig.model) {
      rig.model.position.y = Math.abs(Math.sin(rig.walkCycle)) * 0.046;
      rig.model.rotation.x = 0.035;
      rig.model.rotation.z = Math.sin(rig.walkCycle) * 0.02;
    }
    if (rig.approachT >= 1) {
      rig.action = 'throw';
      rig.throwT = 0.001;
    }
  } else if (rig.action === 'throw') {
    rig.throwT += dt / CFG.throwDuration;
    if (rig.model) {
      const t = clamp01(rig.throwT);
      rig.model.position.y = 0;
      rig.model.rotation.x =
        t < 0.55
          ? lerp(0, 0.18, t / 0.55)
          : lerp(0.18, -0.05, (t - 0.55) / 0.45);
      rig.model.rotation.z =
        t < 0.45
          ? lerp(0, -0.04, t / 0.45)
          : lerp(-0.04, 0.02, (t - 0.45) / 0.55);
    }
    if (rig.throwT >= 1) {
      rig.action = 'recover';
      rig.recoverT = 0.001;
      rig.throwT = 0;
    }
  } else if (rig.action === 'recover') {
    rig.recoverT += dt / CFG.recoverDuration;
    if (rig.model) {
      rig.model.rotation.x = lerp(-0.05, 0, clamp01(rig.recoverT));
      rig.model.rotation.z *= 0.82;
    }
    if (rig.recoverT >= 1) {
      rig.recoverT = 0;
      rig.action = 'idle';
    }
  } else if (rig.model) {
    rig.model.position.y *= 0.82;
    rig.model.rotation.x *= 0.82;
    rig.model.rotation.z *= 0.82;
  }
  rig.yaw = 0;
  syncHuman(rig);
  if (ball.held) {
    ball.pos.copy(getHeldBallWorldPosition(rig));
    ball.mesh.position.copy(ball.pos);
  }
}

function updateCamera(
  camera: THREE.PerspectiveCamera,
  ball: BallState,
  player: HumanRig,
  dt: number
) {
  let desired: THREE.Vector3;
  let look: THREE.Vector3;
  if (ball.rolling) {
    const lead = ball.vel.clone().setY(0);
    if (lead.lengthSq() < 0.001) lead.set(0, 0, -1);
    lead.normalize();
    desired = ball.pos
      .clone()
      .addScaledVector(lead, -4.85)
      .add(new THREE.Vector3(0, 2.45, 0.82));
    look = ball.pos
      .clone()
      .addScaledVector(lead, 2.15)
      .add(new THREE.Vector3(0, 0.34, 0));
  } else if (
    player.action === 'approach' ||
    player.action === 'throw' ||
    player.action === 'recover'
  ) {
    desired = player.pos.clone().add(new THREE.Vector3(0, 2.55, 3.72));
    look = player.pos.clone().add(new THREE.Vector3(0, 0.85, -1.7));
  } else {
    desired = new THREE.Vector3(0, 2.9, 10.8);
    look = new THREE.Vector3(0, CFG.laneY + 0.74, -2.6);
  }
  camera.position.lerp(desired, 1 - Math.exp(-5.1 * dt));
  const currentLook = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(camera.quaternion)
    .multiplyScalar(8)
    .add(camera.position);
  currentLook.lerp(look, 1 - Math.exp(-7 * dt));
  camera.lookAt(currentLook);
}

export function createBowlingView(canvas: HTMLCanvasElement) {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
  } catch {
    return createSoftwareView(canvas);
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#090d18');
  scene.fog = new THREE.Fog('#090d18', 24, 55);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.05, 90);
  camera.position.set(0, 3.4, 11.6);
  camera.lookAt(0, 0.8, -3);
  scene.add(new THREE.HemisphereLight(0xd8edff, 0x503923, 2));
  const key = new THREE.DirectionalLight(0xfff0dc, 3);
  key.position.set(-3, 8, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {
    left: -5,
    right: 5,
    top: 15,
    bottom: -15,
    near: 0.5,
    far: 40
  });
  key.shadow.bias = -0.0003;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x84d8ff, 1.5);
  fill.position.set(4, 5, -9);
  scene.add(fill);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let environment: THREE.WebGLRenderTarget | null = null;
  new RGBELoader().load(
    HDRI_URL,
    (hdr) => {
      if (!scene.userData.disposed) {
        environment = pmrem.fromEquirectangular(hdr);
        scene.environment = environment.texture;
      }
      hdr.dispose();
    },
    undefined,
    () => {}
  );
  createEnvironment(scene, new THREE.TextureLoader());
  const pins = createPins(scene);
  const player = addHuman(
    scene,
    new THREE.Vector3(0, CFG.laneY, CFG.playerStartZ),
    0x228de6
  );
  const ball = createActiveBall();
  scene.add(ball.mesh);
  const aimGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3()
  ]);
  const aimLine = new THREE.Line(
    aimGeometry,
    new THREE.LineBasicMaterial({
      color: 0x81e4ff,
      transparent: true,
      opacity: 0.85
    })
  );
  scene.add(aimLine);
  let priorPhase = '',
    priorTurn = 0,
    fpsTime = 0,
    frames = 0,
    pixelRatio = Math.min(devicePixelRatio || 1, 1.65);
  const bones = new Map<THREE.Bone, THREE.Quaternion>();
  let width = 0,
    height = 0;
  function resize() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    width = w;
    height = h;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.7 ? 54 : 46;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  return {
    reduced: false,
    draw(s: BowlingState, dt: number, aim: ThrowInput | null) {
      resize();
      fpsTime += dt;
      frames++;
      if (fpsTime > 4) {
        if (frames / fpsTime < 34 && pixelRatio > 1) {
          pixelRatio = 1;
          width = 0;
          resize();
        }
        fpsTime = 0;
        frames = 0;
      }
      if (s.turn !== priorTurn) {
        player.pos.set(0, CFG.laneY, CFG.playerStartZ);
        player.action = 'idle';
        player.approachT = player.throwT = player.recoverT = 0;
        priorTurn = s.turn;
      }
      if (s.phase === 'approach' && priorPhase !== 'approach' && s.intent)
        startApproach(player, { ...s.intent, speed: 0 });
      ball.held = s.phase === 'ready' || s.phase === 'approach';
      ball.rolling = s.phase === 'rolling';
      updateHuman(player, ball, dt);
      if (!ball.held) {
        const previous = ball.pos.clone();
        ball.pos.lerp(new THREE.Vector3(...s.ball.p), 1 - Math.exp(-24 * dt));
        ball.vel.copy(ball.pos).sub(previous).divideScalar(Math.max(dt, 0.001));
        ball.mesh.position.copy(ball.pos);
        ball.mesh.quaternion.slerp(
          new THREE.Quaternion(...s.ball.q),
          1 - Math.exp(-22 * dt)
        );
      }
      ball.mesh.visible = s.ball.visible;
      s.pins.forEach((p, i) => {
        pins[i].root.visible = p.visible;
        if (s.phase === 'ready' || s.turn !== priorTurn) {
          pins[i].root.position.set(...p.p);
          pins[i].root.quaternion.set(...p.q);
        } else {
          pins[i].root.position.lerp(
            new THREE.Vector3(...p.p),
            1 - Math.exp(-24 * dt)
          );
          pins[i].root.quaternion.slerp(
            new THREE.Quaternion(...p.q),
            1 - Math.exp(-24 * dt)
          );
        }
      });
      const swing =
        player.action === 'approach'
          ? Math.sin(player.walkCycle) * 0.55
          : player.action === 'throw'
            ? Math.sin(player.throwT * Math.PI * 2) * 1.3
            : 0;
      // Animate actual arm/leg joints on loaded humanoids and the lightweight fallback.
      if (player.model && !bones.size)
        player.model.traverse((o) => {
          if ((o as THREE.Bone).isBone)
            bones.set(o as THREE.Bone, o.quaternion.clone());
        });
      for (const [bone, rest] of bones) {
        const name = bone.name.toLowerCase();
        if (/^(right|left)(arm|forearm)$/.test(name)) {
          const right = name.startsWith('right');
          const t = player.throwT;
          const forward =
            player.action === 'throw'
              ? t < 0.38
                ? lerp(0.1, 0.9, t / 0.38)
                : t < 0.62
                  ? lerp(0.9, -1.1, (t - 0.38) / 0.24)
                  : lerp(-1.1, -0.1, (t - 0.62) / 0.38)
              : player.action === 'approach'
                ? swing * 0.6
                : -0.1;
          const direction = new THREE.Vector3(
            right ? 0.05 : -0.1,
            -1,
            right ? forward : -forward * 0.25
          ).normalize();
          bone.parent?.updateWorldMatrix(true, false);
          const parentRotation =
            bone.parent?.getWorldQuaternion(new THREE.Quaternion()).invert() ||
            new THREE.Quaternion();
          bone.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.applyQuaternion(parentRotation)
          );
        } else {
          const rx =
            /upleg|thigh/.test(name) && player.action === 'approach'
              ? (/right/.test(name) ? 1 : -1) * swing * 0.45
              : 0;
          bone.quaternion
            .copy(rest)
            .multiply(
              new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0))
            );
        }
      }
      if (ball.held && player.model) {
        player.model.updateWorldMatrix(true, true);
        const hand = player.model.getObjectByName('RightHand');
        if (hand) {
          hand.getWorldPosition(ball.pos);
          ball.pos.y -= 0.06;
          ball.mesh.position.copy(ball.pos);
        }
      }
      player.fallback.children[4].rotation.x = -swing * 0.55;
      player.fallback.children[5].rotation.x = swing;
      player.fallback.children[2].rotation.x = swing * 0.35;
      player.fallback.children[3].rotation.x = -swing * 0.35;
      aimLine.visible = !!aim && s.phase === 'ready';
      if (aim) {
        const p = aimGeometry.getAttribute('position');
        p.setXYZ(0, aim.releaseX, 0.13, 4.3);
        p.setXYZ(1, aim.targetX, 0.13, -10.5);
        p.needsUpdate = true;
      }
      updateCamera(camera, ball, player, dt);
      renderer.render(scene, camera);
      priorPhase = s.phase;
    },
    dispose() {
      scene.userData.disposed = true;
      observer.disconnect();
      environment?.dispose();
      pmrem.dispose();
      disposeObject(scene);
      renderer.dispose();
    }
  };
}

/** Same simulation remains playable when WebGL is unavailable. */
function createSoftwareView(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  return {
    reduced: true,
    dispose() {},
    draw(s: BowlingState, _dt: number, aim: ThrowInput | null) {
      if (!ctx) return;
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.fillStyle = '#090d18';
      ctx.fillRect(0, 0, w, h);
      const project = (x: number, z: number, y = 0) => {
        const t = (5 - z) / 19;
        const spread = (1 - t * 0.72) * w * 0.2;
        return [
          w / 2 + x * spread,
          h * 0.83 - t * h * 0.58 - y * spread
        ] as const;
      };
      const a = project(-1.56, 4.55),
        b = project(1.56, 4.55),
        c = project(1.56, -13.5),
        d = project(-1.56, -13.5);
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.lineTo(...c);
      ctx.lineTo(...d);
      ctx.closePath();
      ctx.fillStyle = '#c69755';
      ctx.fill();
      ctx.strokeStyle = '#816039';
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let i = -7; i <= 7; i++) {
        const a = project(i * 0.2, 4.55),
          b = project(i * 0.2, -13.5);
        ctx.beginPath();
        ctx.moveTo(...a);
        ctx.lineTo(...b);
        ctx.strokeStyle = '#ad8248';
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
      if (aim) {
        ctx.strokeStyle = '#82e3ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(...project(aim.releaseX, 4.4));
        ctx.lineTo(...project(aim.targetX, -10.75));
        ctx.stroke();
      }
      s.pins.forEach((p) => {
        if (!p.visible) return;
        const [x, y] = project(p.p[0], p.p[2], p.p[1] + 0.4);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-p.q[2] * 2);
        ctx.fillStyle = '#fbf5e5';
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d43842';
        ctx.fillRect(-3, -6, 6, 3);
        ctx.restore();
      });
      const bp =
        s.phase === 'ready' || s.phase === 'approach'
          ? [0.2, 0.25, 4.3]
          : s.ball.p;
      if (s.ball.visible) {
        const [x, y] = project(bp[0], bp[2], bp[1]);
        const r = Math.max(4, (1 - ((5 - bp[2]) / 19) * 0.72) * w * 0.04);
        const g = ctx.createRadialGradient(
          x - r * 0.3,
          y - r * 0.4,
          1,
          x,
          y,
          r
        );
        g.addColorStop(0, '#8bd5ff');
        g.addColorStop(0.4, '#2580d7');
        g.addColorStop(1, '#0c2048');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
}
