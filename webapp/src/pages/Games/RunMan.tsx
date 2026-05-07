'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Team = 'blue' | 'red';
type ActorKind = Team | 'robot';
type PlayerId = number;
type WeaponType = 'pistol' | 'rifle' | 'sniper';

type WeaponEntry = {
  id: string;
  name: string;
  shortName: string;
  source: 'Quaternius' | 'Extra';
  weaponType: WeaponType;
  urls: string[];
  ammo: number;
  damage: number;
  cooldown: number;
  bulletSpeed: number;
  bulletLife: number;
  pickupColor: number;
};
type AnimName = 'Idle' | 'Walk' | 'Run';
type GameState = 'playing' | 'gameover';
type PickupKind = 'diamond' | 'weapon';
type CrateDropKind = 'health' | 'ammo' | 'weapon' | 'speed';

type Bones = {
  hips?: THREE.Bone;
  spine?: THREE.Bone;
  leftUpLeg?: THREE.Bone;
  leftLeg?: THREE.Bone;
  leftFoot?: THREE.Bone;
  rightUpLeg?: THREE.Bone;
  rightLeg?: THREE.Bone;
  rightFoot?: THREE.Bone;
  leftArm?: THREE.Bone;
  rightArm?: THREE.Bone;
};

type Actor = {
  id: PlayerId;
  name: string;
  isUser: boolean;
  kind: ActorKind;
  root: THREE.Group;
  model: THREE.Object3D | null;
  fallback: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  actions: Partial<Record<AnimName, THREE.AnimationAction>>;
  current: AnimName;
  bones: Bones;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  dir: THREE.Vector3;
  targetDir: THREE.Vector3;
  speed: number;
  radius: number;
  stun: number;
  health: number;
  ammo: number;
  weapon: WeaponEntry;
  fireCooldown: number;
  inventory: WeaponEntry[];
  loaded: boolean;
};

type InputState = {
  moveX: number;
  moveY: number;
  lookYaw: number;
  lookPitch: number;
};

type Pickup = {
  kind: PickupKind;
  group: THREE.Group;
  pos: THREE.Vector3;
  taken: boolean;
  value: number;
  weapon?: WeaponEntry;
};

type SupplyCrate = {
  group: THREE.Group;
  pos: THREE.Vector3;
  health: number;
  broken: boolean;
  dropKind: CrateDropKind;
  weapon?: WeaponEntry;
};

type Bullet = {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  ownerId: PlayerId;
  ownerName: string;
  ownerColor: number;
  weapon: WeaponEntry;
  life: number;
  active: boolean;
};

type MazeCell = 0 | 1;

declare global {
  interface Window {
    __resetRobotMaze?: () => void;
    __fireRobotMaze?: (aimDir?: THREE.Vector3) => void;
    __tapRobotMaze?: (clientX: number, clientY: number) => void;
    __swapRobotMazeWeapon?: (weaponId: string) => void;
  }
}

const SOLDIER_URL = 'https://threejs.org/examples/models/gltf/Soldier.glb';
const ROBOT_URL =
  'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

const CELL = 0.58;
const ROWS = 17;
const COLS = 17;
const MAZE_W = COLS * CELL;
const MAZE_H = ROWS * CELL;
const PLAYER_RADIUS = 0.16;
const ROBOT_RADIUS = 0.17;
const PICKUP_RADIUS = 0.13;
const CRATE_RADIUS = 0.24;
const PLAYER_WALK_SPEED = 1.28;
const PLAYER_RUN_SPEED = 2.2;
const FIRST_PERSON_EYE_HEIGHT = 0.68;
const TOUCH_LOOK_SENSITIVITY = 0.0042;
const WEAPON_PICKUP_TAP_RANGE = 1.35;
const ROBOT_SPEED = 1.1;
const MAX_PLAYERS = 8;
const TARGET_PIXEL_RATIO = 1.25;
const GROUND_Y = 0;
const DT_MAX = 1 / 30;
const GAME_TIME = 180;
const TMP = new THREE.Vector3();

function polyGlb(uuid: string) {
  return `https://static.poly.pizza/${uuid}.glb`;
}

const KNOWN_WORKING_GLB = {
  awp: 'https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb',
  awpRaw:
    'https://raw.githubusercontent.com/GarbajYT/godot-sniper-rifle/master/AWP.glb',
  mrtk: 'https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  mrtkRaw:
    'https://raw.githubusercontent.com/microsoft/MixedRealityToolkit/main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  mrtkMaster:
    'https://cdn.jsdelivr.net/gh/Microsoft/MixedRealityToolkit@master/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  pistolHolster:
    'https://cdn.jsdelivr.net/gh/SAAAM-LLC/3D_model_bundle@main/SAM_ASSET-PISTOL-IN-HOLSTER.glb',
  pistolHolsterRaw:
    'https://raw.githubusercontent.com/SAAAM-LLC/3D_model_bundle/main/SAM_ASSET-PISTOL-IN-HOLSTER.glb',
  fps: 'https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf',
  fpsRaw:
    'https://raw.githubusercontent.com/lando19/Guns-for-BJS-FPS-Game/main/main/scene.gltf'
};

const WEAPONS: WeaponEntry[] = [
  {
    id: 'poly-shotgun-01',
    name: 'Quaternius Shotgun',
    shortName: 'Shotgun',
    source: 'Quaternius',
    weaponType: 'rifle',
    urls: [polyGlb('032e6589-3188-41bc-b92b-e25528344275')],
    ammo: 5,
    damage: 2,
    cooldown: 0.52,
    bulletSpeed: 4.6,
    bulletLife: 1.05,
    pickupColor: 0xf59e0b
  },
  {
    id: 'poly-assault-rifle-01',
    name: 'Quaternius Assault Rifle',
    shortName: 'Assault',
    source: 'Quaternius',
    weaponType: 'rifle',
    urls: [polyGlb('b3e6be61-0299-4866-a227-58f5f3fe610b')],
    ammo: 14,
    damage: 1,
    cooldown: 0.18,
    bulletSpeed: 5.6,
    bulletLife: 1.15,
    pickupColor: 0x22c55e
  },
  {
    id: 'poly-pistol-01',
    name: 'Quaternius Pistol',
    shortName: 'Pistol',
    source: 'Quaternius',
    weaponType: 'pistol',
    urls: [polyGlb('3b53f0fe-f86e-451c-816d-6ab9bd265cdc')],
    ammo: 9,
    damage: 1,
    cooldown: 0.34,
    bulletSpeed: 5.0,
    bulletLife: 1.0,
    pickupColor: 0x93c5fd
  },
  {
    id: 'poly-revolver-01',
    name: 'Quaternius Heavy Revolver',
    shortName: 'Revolver',
    source: 'Quaternius',
    weaponType: 'pistol',
    urls: [polyGlb('9e728565-67a3-44db-9567-982320abff09')],
    ammo: 6,
    damage: 2,
    cooldown: 0.46,
    bulletSpeed: 5.35,
    bulletLife: 1.05,
    pickupColor: 0xf97316
  },
  {
    id: 'poly-sawed-off-01',
    name: 'Quaternius Sawed-Off Shotgun',
    shortName: 'Sawed-Off',
    source: 'Quaternius',
    weaponType: 'pistol',
    urls: [polyGlb('9a6ee0ee-068b-4774-8b0f-679c3cef0b6e')],
    ammo: 4,
    damage: 2,
    cooldown: 0.58,
    bulletSpeed: 4.4,
    bulletLife: 0.95,
    pickupColor: 0xfb923c
  },
  {
    id: 'poly-revolver-02',
    name: 'Quaternius Revolver Silver',
    shortName: 'Silver Rev',
    source: 'Quaternius',
    weaponType: 'pistol',
    urls: [polyGlb('7951b3b9-d3a5-4ec8-81b7-11111f1c8e88')],
    ammo: 7,
    damage: 2,
    cooldown: 0.43,
    bulletSpeed: 5.25,
    bulletLife: 1.05,
    pickupColor: 0xcbd5e1
  },
  {
    id: 'poly-shotgun-02',
    name: 'Quaternius Long Shotgun',
    shortName: 'Long Shot',
    source: 'Quaternius',
    weaponType: 'rifle',
    urls: [polyGlb('f71d6771-f512-4374-bd23-ba00b564db68')],
    ammo: 5,
    damage: 2,
    cooldown: 0.5,
    bulletSpeed: 4.75,
    bulletLife: 1.1,
    pickupColor: 0xfbbf24
  },
  {
    id: 'poly-shotgun-03',
    name: 'Quaternius Pump Shotgun',
    shortName: 'Pump',
    source: 'Quaternius',
    weaponType: 'rifle',
    urls: [polyGlb('08f27141-8e64-425a-9161-1bbd6956dfca')],
    ammo: 6,
    damage: 2,
    cooldown: 0.48,
    bulletSpeed: 4.85,
    bulletLife: 1.1,
    pickupColor: 0xeab308
  },
  {
    id: 'poly-smg-01',
    name: 'Quaternius Submachine Gun',
    shortName: 'SMG',
    source: 'Quaternius',
    weaponType: 'rifle',
    urls: [polyGlb('fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710')],
    ammo: 18,
    damage: 1,
    cooldown: 0.14,
    bulletSpeed: 5.4,
    bulletLife: 1.0,
    pickupColor: 0x38bdf8
  },
  {
    id: 'slot-10-ak47-gltf',
    name: 'AK47 GLTF',
    shortName: 'AK47',
    source: 'Extra',
    weaponType: 'rifle',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/AK47/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/AK47/scene.gltf',
      KNOWN_WORKING_GLB.awp,
      KNOWN_WORKING_GLB.awpRaw
    ],
    ammo: 16,
    damage: 1,
    cooldown: 0.16,
    bulletSpeed: 5.8,
    bulletLife: 1.15,
    pickupColor: 0x16a34a
  },
  {
    id: 'slot-11-krsv-gltf',
    name: 'KRSV GLTF',
    shortName: 'KRSV',
    source: 'Extra',
    weaponType: 'rifle',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/KRSV/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/KRSV/scene.gltf',
      KNOWN_WORKING_GLB.mrtk,
      KNOWN_WORKING_GLB.mrtkRaw
    ],
    ammo: 15,
    damage: 1,
    cooldown: 0.17,
    bulletSpeed: 5.65,
    bulletLife: 1.12,
    pickupColor: 0x14b8a6
  },
  {
    id: 'slot-12-smith-gltf',
    name: 'Smith GLTF',
    shortName: 'Smith',
    source: 'Extra',
    weaponType: 'pistol',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/Smith/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/Smith/scene.gltf',
      KNOWN_WORKING_GLB.pistolHolster,
      KNOWN_WORKING_GLB.pistolHolsterRaw
    ],
    ammo: 8,
    damage: 1,
    cooldown: 0.3,
    bulletSpeed: 5.1,
    bulletLife: 1.0,
    pickupColor: 0xa78bfa
  },
  {
    id: 'slot-13-mosin-gltf',
    name: 'Mosin GLTF',
    shortName: 'Mosin',
    source: 'Extra',
    weaponType: 'sniper',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Mosin/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Mosin/scene.gltf',
      KNOWN_WORKING_GLB.awp,
      KNOWN_WORKING_GLB.awpRaw
    ],
    ammo: 5,
    damage: 3,
    cooldown: 0.72,
    bulletSpeed: 7.0,
    bulletLife: 1.45,
    pickupColor: 0x818cf8
  },
  {
    id: 'slot-14-uzi-gltf',
    name: 'Uzi GLTF',
    shortName: 'Uzi',
    source: 'Extra',
    weaponType: 'rifle',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Uzi/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Uzi/scene.gltf',
      KNOWN_WORKING_GLB.mrtk,
      KNOWN_WORKING_GLB.mrtkMaster
    ],
    ammo: 20,
    damage: 1,
    cooldown: 0.12,
    bulletSpeed: 5.25,
    bulletLife: 0.95,
    pickupColor: 0x06b6d4
  },
  {
    id: 'slot-15-sigsauer-gltf',
    name: 'SigSauer GLTF',
    shortName: 'SigSauer',
    source: 'Extra',
    weaponType: 'pistol',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models3/SigSauer/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models3/SigSauer/scene.gltf',
      KNOWN_WORKING_GLB.pistolHolster,
      KNOWN_WORKING_GLB.pistolHolsterRaw
    ],
    ammo: 10,
    damage: 1,
    cooldown: 0.26,
    bulletSpeed: 5.25,
    bulletLife: 1.0,
    pickupColor: 0xf472b6
  },
  {
    id: 'slot-16-awp-glb',
    name: 'AWP Sniper GLB',
    shortName: 'AWP',
    source: 'Extra',
    weaponType: 'sniper',
    urls: [KNOWN_WORKING_GLB.awp, KNOWN_WORKING_GLB.awpRaw],
    ammo: 4,
    damage: 3,
    cooldown: 0.82,
    bulletSpeed: 7.4,
    bulletLife: 1.55,
    pickupColor: 0x60a5fa
  },
  {
    id: 'slot-17-mrtk-gun-glb',
    name: 'MRTK Gun GLB',
    shortName: 'MRTK',
    source: 'Extra',
    weaponType: 'rifle',
    urls: [
      KNOWN_WORKING_GLB.mrtk,
      KNOWN_WORKING_GLB.mrtkRaw,
      KNOWN_WORKING_GLB.mrtkMaster
    ],
    ammo: 12,
    damage: 1,
    cooldown: 0.2,
    bulletSpeed: 5.45,
    bulletLife: 1.05,
    pickupColor: 0x2dd4bf
  },
  {
    id: 'slot-18-fps-gun-gltf',
    name: 'FPS Gun GLTF',
    shortName: 'FPS Shotgun',
    source: 'Extra',
    weaponType: 'rifle',
    urls: [
      KNOWN_WORKING_GLB.fps,
      KNOWN_WORKING_GLB.fpsRaw,
      KNOWN_WORKING_GLB.awp,
      KNOWN_WORKING_GLB.awpRaw
    ],
    ammo: 5,
    damage: 2,
    cooldown: 0.54,
    bulletSpeed: 4.9,
    bulletLife: 1.08,
    pickupColor: 0xfacc15
  }
];

const STARTER_WEAPON = WEAPONS[17];

function getForwardFromYaw(yaw: number) {
  return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
}

function getRightFromYaw(yaw: number) {
  return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
}

function cloneWeaponModelForScene(
  source: THREE.Object3D,
  height: number,
  rotateY = Math.PI / 2
) {
  const model = source.clone(true);
  normalizeModel(model, height, rotateY);
  shadow(model);
  return model;
}

function loadFirstAvailableWeaponModel(
  loader: GLTFLoader,
  weapon: WeaponEntry,
  onLoaded: (model: THREE.Object3D) => void
) {
  let index = 0;
  const tryLoad = () => {
    const url = weapon.urls[index++];
    if (!url) return;
    loader
      .setCrossOrigin('anonymous')
      .load(url, (gltf) => onLoaded(gltf.scene), undefined, tryLoad);
  };
  tryLoad();
}

const MAZE: MazeCell[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
  [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1],
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

function mat(color: number, roughness = 0.78, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function shadow<T extends THREE.Object3D>(o: T) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
  });
  return o;
}

function clean(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function cellToWorld(row: number, col: number) {
  return new THREE.Vector3(
    (col - COLS / 2 + 0.5) * CELL,
    GROUND_Y,
    (row - ROWS / 2 + 0.5) * CELL
  );
}

function worldToCell(pos: THREE.Vector3) {
  const col = Math.floor(pos.x / CELL + COLS / 2);
  const row = Math.floor(pos.z / CELL + ROWS / 2);
  return { row, col };
}

function isWallCell(row: number, col: number) {
  if (row < 0 || col < 0 || row >= ROWS || col >= COLS) return true;
  return MAZE[row][col] === 1;
}

function findBones(model: THREE.Object3D): Bones {
  const b: Bones = {};
  model.traverse((o) => {
    const bone = o as THREE.Bone;
    if (!bone.isBone) return;
    const n = clean(bone.name);
    if (!b.hips && n.includes('hips')) b.hips = bone;
    if (!b.spine && n.includes('spine')) b.spine = bone;
    if (
      !b.leftUpLeg &&
      (n.includes('leftupleg') ||
        n.includes('leftthigh') ||
        n.includes('lthigh'))
    )
      b.leftUpLeg = bone;
    if (
      !b.rightUpLeg &&
      (n.includes('rightupleg') ||
        n.includes('rightthigh') ||
        n.includes('rthigh'))
    )
      b.rightUpLeg = bone;
    if (
      !b.leftLeg &&
      !n.includes('foot') &&
      !n.includes('upleg') &&
      (n.includes('leftleg') ||
        n.includes('leftcalf') ||
        n.includes('leftshin'))
    )
      b.leftLeg = bone;
    if (
      !b.rightLeg &&
      !n.includes('foot') &&
      !n.includes('upleg') &&
      (n.includes('rightleg') ||
        n.includes('rightcalf') ||
        n.includes('rightshin'))
    )
      b.rightLeg = bone;
    if (!b.leftFoot && n.includes('leftfoot')) b.leftFoot = bone;
    if (!b.rightFoot && n.includes('rightfoot')) b.rightFoot = bone;
    if (!b.leftArm && n.includes('leftarm')) b.leftArm = bone;
    if (!b.rightArm && n.includes('rightarm')) b.rightArm = bone;
  });
  return b;
}

function normalizeModel(
  model: THREE.Object3D,
  height = 0.62,
  rotateY = Math.PI
) {
  model.rotation.set(0, rotateY, 0);
  model.scale.setScalar(1);
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const h = Math.max(0.001, box.max.y - box.min.y);
  model.scale.setScalar(height / h);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
}

function tintModel(model: THREE.Object3D, kind: ActorKind) {
  const tint = new THREE.Color(
    kind === 'blue' ? 0x1d69ff : kind === 'red' ? 0xd92f2f : 0x84fffb
  );
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((raw) => {
      const m = raw as THREE.MeshStandardMaterial;
      if (m.color) m.color.lerp(tint, kind === 'robot' ? 0.42 : 0.34);
      if (kind === 'robot') {
        m.emissive = new THREE.Color(0x004d5d);
        m.emissiveIntensity = 0.22;
      }
      m.needsUpdate = true;
    });
  });
}

function makeFallback(kind: ActorKind) {
  const group = new THREE.Group();
  if (kind === 'robot') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.34, 0.12),
      mat(0x7dd3fc, 0.48, 0.22)
    );
    body.position.y = 0.42;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, 0.13, 0.13),
      mat(0xd9f99d, 0.4, 0.18)
    );
    head.position.y = 0.65;
    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.025, 0.015),
      mat(0x00ffcc, 0.25, 0.1)
    );
    eye.position.set(0, 0.66, -0.068);
    group.add(shadow(body), shadow(head), shadow(eye));
    return group;
  }
  const color = kind === 'blue' ? 0x1d69ff : 0xd92f2f;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.085, 0.3, 8, 14),
    mat(color)
  );
  body.position.y = 0.42;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    mat(0xf1d6bd)
  );
  head.position.y = 0.67;
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.035, 0.045),
    mat(0x111827, 0.44, 0.26)
  );
  gun.position.set(0.09, 0.45, -0.09);
  const leftLeg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.024, 0.23, 6, 8),
    mat(0x171717)
  );
  const rightLeg = leftLeg.clone();
  leftLeg.position.set(-0.04, 0.18, 0);
  rightLeg.position.set(0.04, 0.18, 0);
  group.add(
    shadow(body),
    shadow(head),
    shadow(gun),
    shadow(leftLeg),
    shadow(rightLeg)
  );
  return group;
}

function makeFpsHandsFallback(weapon: WeaponEntry) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({
    color: 0xd6a06f,
    roughness: 0.64
  });
  const glove = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.72
  });
  const metal = new THREE.MeshStandardMaterial({
    color: weapon.pickupColor,
    roughness: 0.48,
    metalness: 0.28,
    emissive: weapon.pickupColor,
    emissiveIntensity: 0.05
  });
  const leftArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.035, 0.36, 6, 8),
    skin
  );
  leftArm.position.set(-0.12, -0.02, 0.02);
  leftArm.rotation.set(1.15, -0.1, -0.22);
  const rightArm = leftArm.clone();
  rightArm.material = skin;
  rightArm.position.set(0.13, -0.03, 0.04);
  rightArm.rotation.set(1.12, 0.12, 0.25);
  const leftHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 10, 8),
    glove
  );
  leftHand.position.set(-0.055, -0.05, -0.19);
  const rightHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 10, 8),
    glove
  );
  rightHand.position.set(0.1, -0.055, -0.12);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.42), metal);
  gun.position.set(0.03, -0.04, -0.2);
  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.045, 0.22),
    mat(0x050505, 0.38, 0.45)
  );
  barrel.position.set(0.03, -0.035, -0.52);
  group.add(
    shadow(leftArm),
    shadow(rightArm),
    shadow(leftHand),
    shadow(rightHand),
    shadow(gun),
    shadow(barrel)
  );
  return group;
}

function createActor(
  scene: THREE.Scene,
  _loader: GLTFLoader,
  id: PlayerId,
  name: string,
  kind: ActorKind,
  start: THREE.Vector3,
  onLoaded: () => void,
  isUser = false
): Actor {
  const root = new THREE.Group();
  root.position.copy(start).setY(GROUND_Y);
  scene.add(root);

  const fallback = makeFallback(kind);
  root.add(fallback);

  const actor: Actor = {
    id,
    name,
    isUser,
    kind,
    root,
    model: null,
    fallback,
    mixer: null,
    actions: {},
    current: 'Idle',
    bones: {},
    pos: start.clone().setY(GROUND_Y),
    vel: new THREE.Vector3(),
    dir: new THREE.Vector3(0, 0, 1),
    targetDir: new THREE.Vector3(0, 0, 1),
    speed: 0,
    radius: kind === 'robot' ? ROBOT_RADIUS : PLAYER_RADIUS,
    stun: 0,
    health: isUser ? 6 : kind === 'robot' ? 2 : 4,
    ammo: STARTER_WEAPON.ammo + 24,
    weapon: STARTER_WEAPON,
    fireCooldown: 0,
    inventory: [STARTER_WEAPON],
    loaded: true
  };

  // Mobile performance: use built-in low-poly bodies immediately. Remote soldier/robot
  // GLTFs were removed from startup so the match reaches playable FPS fast.
  onLoaded();
  return actor;
}

function setAction(actor: Actor, next: AnimName, blend = 0.16) {
  if (actor.current === next || !actor.actions[next]) return;
  const prev = actor.actions[actor.current];
  const nextAction = actor.actions[next];
  if (prev && nextAction) {
    nextAction.enabled = true;
    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);
    prev.crossFadeTo(nextAction, blend, false);
    nextAction.play();
  }
  actor.current = next;
}

function updateFallbackWalk(actor: Actor) {
  const meshes = actor.fallback.children.filter(
    (o) => o instanceof THREE.Mesh
  ) as THREE.Mesh[];
  const t = performance.now() * 0.011;
  if (actor.kind === 'robot') {
    actor.fallback.rotation.y = Math.sin(t * 0.4) * 0.02;
    return;
  }
  const legs = meshes.slice(-2);
  const s = Math.sin(t) * Math.min(1.2, actor.speed);
  if (legs[0]) legs[0].rotation.x = s * 0.75;
  if (legs[1]) legs[1].rotation.x = -s * 0.75;
}

function updateActorAnimation(actor: Actor, dt: number) {
  actor.pos.y = GROUND_Y;
  actor.root.position.copy(actor.pos);
  if (actor.targetDir.lengthSq() > 0.001)
    actor.dir.lerp(actor.targetDir, 1 - Math.pow(0.002, dt)).normalize();
  actor.root.rotation.y = Math.atan2(actor.dir.x, actor.dir.z);

  const next: AnimName =
    actor.stun > 0
      ? 'Idle'
      : actor.speed > 1.2
        ? 'Run'
        : actor.speed > 0.06
          ? 'Walk'
          : 'Idle';
  setAction(actor, next);
  if (actor.actions.Walk)
    actor.actions.Walk.timeScale = THREE.MathUtils.clamp(
      actor.speed / 1.0,
      0.75,
      1.45
    );
  if (actor.actions.Run)
    actor.actions.Run.timeScale = THREE.MathUtils.clamp(
      actor.speed / 1.7,
      0.75,
      1.55
    );
  actor.mixer?.update(dt);

  if (actor.kind !== 'robot' && actor.ammo > 0) {
    if (actor.bones.spine) actor.bones.spine.rotation.x += -0.04;
    if (actor.bones.rightArm) actor.bones.rightArm.rotation.x += -0.42;
    if (actor.bones.leftArm) actor.bones.leftArm.rotation.x += -0.2;
  }

  updateFallbackWalk(actor);
  actor.stun = Math.max(0, actor.stun - dt);
  actor.fireCooldown = Math.max(0, actor.fireCooldown - dt);
}

function clampToMazeBounds(pos: THREE.Vector3) {
  const x = MAZE_W / 2 - CELL * 0.5;
  const z = MAZE_H / 2 - CELL * 0.5;
  pos.x = THREE.MathUtils.clamp(pos.x, -x, x);
  pos.z = THREE.MathUtils.clamp(pos.z, -z, z);
  pos.y = GROUND_Y;
}

function collidesWithMaze(pos: THREE.Vector3, radius: number) {
  const points = [
    [pos.x, pos.z],
    [pos.x + radius, pos.z],
    [pos.x - radius, pos.z],
    [pos.x, pos.z + radius],
    [pos.x, pos.z - radius],
    [pos.x + radius * 0.72, pos.z + radius * 0.72],
    [pos.x - radius * 0.72, pos.z + radius * 0.72],
    [pos.x + radius * 0.72, pos.z - radius * 0.72],
    [pos.x - radius * 0.72, pos.z - radius * 0.72]
  ];
  return points.some(([x, z]) => {
    const col = Math.floor(x / CELL + COLS / 2);
    const row = Math.floor(z / CELL + ROWS / 2);
    return isWallCell(row, col);
  });
}

function tryMoveActor(
  actor: Actor,
  dir: THREE.Vector3,
  speed: number,
  dt: number
) {
  if (actor.stun > 0 || actor.health <= 0) {
    actor.vel.multiplyScalar(Math.pow(0.01, dt));
    actor.speed = 0;
    return;
  }

  if (dir.lengthSq() > 0.001) {
    dir.normalize();
    actor.targetDir.copy(dir);
    actor.vel.lerp(dir.clone().multiplyScalar(speed), 1 - Math.pow(0.006, dt));
  } else {
    actor.vel.multiplyScalar(Math.pow(0.001, dt));
  }

  const old = actor.pos.clone();
  const next = actor.pos.clone().addScaledVector(actor.vel, dt);
  clampToMazeBounds(next);

  const tryX = actor.pos.clone();
  tryX.x = next.x;
  if (!collidesWithMaze(tryX, actor.radius)) actor.pos.x = tryX.x;
  else actor.vel.x = 0;

  const tryZ = actor.pos.clone();
  tryZ.z = next.z;
  if (!collidesWithMaze(tryZ, actor.radius)) actor.pos.z = tryZ.z;
  else actor.vel.z = 0;

  actor.speed = old.distanceTo(actor.pos) / Math.max(dt, 0.0001);
}

function cellNeighbors(row: number, col: number) {
  const dirs = [
    { row: row - 1, col, dir: new THREE.Vector3(0, 0, -1) },
    { row: row + 1, col, dir: new THREE.Vector3(0, 0, 1) },
    { row, col: col - 1, dir: new THREE.Vector3(-1, 0, 0) },
    { row, col: col + 1, dir: new THREE.Vector3(1, 0, 0) }
  ];
  return dirs.filter((d) => !isWallCell(d.row, d.col));
}

function chooseAiDir(actor: Actor, actors: Actor[]) {
  const targets = aliveActors(actors).filter(
    (candidate) => candidate.id !== actor.id
  );
  if (!targets.length) return new THREE.Vector3();
  const target = targets.reduce(
    (best, candidate) =>
      actor.pos.distanceTo(candidate.pos) < actor.pos.distanceTo(best.pos)
        ? candidate
        : best,
    targets[0]
  );
  const c = worldToCell(actor.pos);
  const t = worldToCell(target.pos);
  const neighbors = cellNeighbors(c.row, c.col);
  if (!neighbors.length) return new THREE.Vector3();

  let best = neighbors[0];
  let bestScore = Infinity;
  for (const n of neighbors) {
    const dist = Math.abs(n.row - t.row) + Math.abs(n.col - t.col);
    const world = cellToWorld(n.row, n.col);
    const score =
      dist + world.distanceTo(target.pos) * 0.28 + Math.random() * 0.26;
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best.dir.clone();
}

function makeMaze(scene: THREE.Scene) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(MAZE_W + 1.1, MAZE_H + 1.1),
    mat(0x080b16, 0.9, 0)
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.55,
    metalness: 0.12,
    emissive: 0x061122,
    emissiveIntensity: 0.25
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.45,
    metalness: 0.1,
    emissive: 0x0b2344,
    emissiveIntensity: 0.22
  });
  const pathMat = mat(0x172033, 0.92, 0.02);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = cellToWorld(r, c);
      if (MAZE[r][c] === 1) {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(CELL * 0.96, 0.62, CELL * 0.96),
          wallMat
        );
        wall.position.set(p.x, 0.31, p.z);
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(CELL * 0.98, 0.055, CELL * 0.98),
          topMat
        );
        cap.position.set(p.x, 0.645, p.z);
        scene.add(shadow(wall), shadow(cap));
      } else {
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(CELL * 0.9, 0.018, CELL * 0.9),
          pathMat
        );
        tile.position.set(p.x, 0.004, p.z);
        tile.receiveShadow = true;
        scene.add(tile);
      }
    }
  }

  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(
      new THREE.BoxGeometry(MAZE_W + 0.2, 0.06, MAZE_H + 0.2)
    ),
    new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.35
    })
  );
  border.position.y = 0.04;
  scene.add(border);
}

function makeDiamond(color: number, value = 1) {
  const group = new THREE.Group();
  const geo = new THREE.OctahedronGeometry(value > 1 ? 0.13 : 0.095, 0);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.18,
      metalness: 0.25,
      emissive: color,
      emissiveIntensity: 0.28
    })
  );
  mesh.rotation.y = Math.PI / 4;
  group.add(shadow(mesh));
  const glow = new THREE.PointLight(color, value > 1 ? 0.6 : 0.35, 1.1);
  glow.position.y = 0.18;
  group.add(glow);
  return group;
}

function makeWeaponPickup(weapon: WeaponEntry, _loader?: GLTFLoader) {
  const group = new THREE.Group();
  const fallback = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.055, 0.075),
    mat(weapon.pickupColor, 0.4, 0.3)
  );
  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.025, 0.035),
    mat(0x111827, 0.35, 0.4)
  );
  barrel.position.x = 0.16;
  fallback.add(shadow(body), shadow(barrel));
  const glow = new THREE.PointLight(weapon.pickupColor, 0.65, 1.1);
  glow.position.y = 0.2;
  group.add(fallback, glow);
  group.rotation.y = Math.PI / 4;

  // Pickup GLTF loading is intentionally skipped; the real GLTF is loaded only for
  // the equipped FPS weapon to keep maze startup fast on phones.
  return group;
}

function createPickups(scene: THREE.Scene, loader?: GLTFLoader) {
  const pickups: Pickup[] = [];
  const weaponCells = new Set([
    '1,3',
    '1,8',
    '1,13',
    '3,3',
    '3,7',
    '3,13',
    '5,1',
    '5,5',
    '5,8',
    '5,11',
    '5,15',
    '8,2',
    '8,8',
    '8,14',
    '11,3',
    '13,7',
    '13,13',
    '15,11'
  ]);

  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (MAZE[r][c] === 1) continue;
      const startSpot =
        (r === 1 && c === 1) || (r === 15 && c === 15) || (r === 8 && c === 8);
      if (startSpot) continue;

      const key = `${r},${c}`;
      if (weaponCells.has(key)) {
        const weapon =
          WEAPONS[
            pickups.filter((p) => p.kind === 'weapon').length % WEAPONS.length
          ];
        const group = makeWeaponPickup(weapon, loader);
        const pos = cellToWorld(r, c).setY(0.25);
        group.position.copy(pos);
        scene.add(group);
        pickups.push({
          kind: 'weapon',
          group,
          pos: pos.clone(),
          taken: false,
          value: weapon.ammo,
          weapon
        });
      } else {
        const special = (r + c) % 8 === 0;
        const group = makeDiamond(
          special ? 0xffd166 : 0x63e6ff,
          special ? 3 : 1
        );
        const pos = cellToWorld(r, c).setY(special ? 0.25 : 0.2);
        group.position.copy(pos);
        scene.add(group);
        pickups.push({
          kind: 'diamond',
          group,
          pos: pos.clone(),
          taken: false,
          value: special ? 3 : 1
        });
      }
    }
  }
  return pickups;
}

function makeSupplyCrate(dropKind: CrateDropKind) {
  const group = new THREE.Group();
  const color =
    dropKind === 'health'
      ? 0x22c55e
      : dropKind === 'ammo'
        ? 0xf59e0b
        : dropKind === 'speed'
          ? 0x38bdf8
          : 0xa78bfa;
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.32, 0.36),
    new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.74,
      metalness: 0.03
    })
  );
  box.position.y = 0.16;
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.045, 0.38),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.16
    })
  );
  stripe.position.y = 0.34;
  group.add(shadow(box), shadow(stripe));
  return group;
}

function createSupplyCrates(scene: THREE.Scene) {
  const crates: SupplyCrate[] = [];
  const cells = [
    [1, 11, 'health'],
    [3, 5, 'ammo'],
    [5, 13, 'weapon'],
    [7, 7, 'speed'],
    [9, 13, 'health'],
    [11, 1, 'ammo'],
    [13, 5, 'weapon'],
    [15, 9, 'speed']
  ] as const;
  cells.forEach(([row, col, dropKind], i) => {
    const weapon = WEAPONS[(i * 3 + 1) % WEAPONS.length];
    const group = makeSupplyCrate(dropKind);
    const pos = cellToWorld(row, col).setY(0);
    group.position.copy(pos);
    scene.add(group);
    crates.push({
      group,
      pos: pos.clone(),
      health: 3,
      broken: false,
      dropKind,
      weapon: dropKind === 'weapon' ? weapon : undefined
    });
  });
  return crates;
}

function resetSupplyCrates(crates: SupplyCrate[]) {
  crates.forEach((crate) => {
    crate.health = 3;
    crate.broken = false;
    crate.group.visible = true;
    crate.group.scale.setScalar(1);
  });
}

function applyCrateDrop(actor: Actor, crate: SupplyCrate) {
  if (crate.dropKind === 'health') {
    actor.health = Math.min(6, actor.health + 2);
    return 'Life recovery +2 HP';
  }
  if (crate.dropKind === 'ammo') {
    actor.ammo += 18;
    return 'Ammo cache +18';
  }
  if (crate.dropKind === 'speed') {
    actor.stun = 0;
    actor.vel.multiplyScalar(1.45);
    return 'Speed boost burst';
  }
  if (crate.weapon) {
    if (!actor.inventory.some((w) => w.id === crate.weapon?.id))
      actor.inventory = [crate.weapon, ...actor.inventory].slice(0, 4);
    actor.weapon = crate.weapon;
    actor.ammo += crate.weapon.ammo;
    return `${crate.weapon.shortName} unlocked`;
  }
  return 'Supply crate opened';
}

function damageCrate(crate: SupplyCrate, damage: number, actor: Actor) {
  if (crate.broken) return '';
  crate.health -= damage;
  crate.group.scale.setScalar(1 + Math.max(0, 3 - crate.health) * 0.04);
  if (crate.health > 0) return 'Wooden box cracked';
  crate.broken = true;
  crate.group.visible = false;
  return applyCrateDrop(actor, crate);
}

function resetPickups(pickups: Pickup[]) {
  pickups.forEach((d) => {
    d.taken = false;
    d.group.visible = true;
  });
}

function applyPickup(actor: Actor, pickup: Pickup) {
  pickup.taken = true;
  pickup.group.visible = false;
  if (pickup.kind === 'diamond')
    return {
      score: pickup.value,
      ammo: 0,
      weapon: undefined as WeaponEntry | undefined
    };
  if (pickup.weapon && !actor.inventory.some((w) => w.id === pickup.weapon?.id))
    actor.inventory = [pickup.weapon, ...actor.inventory].slice(0, 4);
  if (pickup.weapon) actor.weapon = pickup.weapon;
  actor.ammo += pickup.value;
  return { score: 0, ammo: pickup.value, weapon: pickup.weapon };
}

function collectPickups(
  actor: Actor,
  pickups: Pickup[],
  weaponMode: 'auto' | 'tap' = 'auto'
) {
  let score = 0;
  let ammo = 0;
  let weapon: WeaponEntry | undefined;
  pickups.forEach((p) => {
    if (p.taken || (weaponMode === 'tap' && p.kind === 'weapon')) return;
    TMP.copy(p.pos).sub(actor.pos).setY(0);
    if (TMP.length() < actor.radius + PICKUP_RADIUS) {
      const gain = applyPickup(actor, p);
      score += gain.score;
      ammo += gain.ammo;
      if (gain.weapon) weapon = gain.weapon;
    }
  });
  return { score, ammo, weapon };
}

function aliveActors(actors: Actor[]) {
  return actors.filter((actor) => actor.health > 0 && actor.root.visible);
}

function resetActors(actors: Actor[]) {
  const starts = [
    cellToWorld(15, 1),
    cellToWorld(1, 15),
    cellToWorld(15, 15),
    cellToWorld(1, 1),
    cellToWorld(8, 8),
    cellToWorld(1, 8),
    cellToWorld(15, 8),
    cellToWorld(8, 1)
  ];
  actors.forEach((actor, i) => {
    actor.pos.copy(starts[i % starts.length]);
    actor.vel.set(0, 0, 0);
    actor.dir.set(i % 2 ? -1 : 1, 0, i % 3 ? 0 : -1).normalize();
    actor.targetDir.copy(actor.dir);
    actor.stun = 0;
    actor.health = actor.isUser ? 5 : 4;
    actor.ammo = STARTER_WEAPON.ammo;
    actor.weapon = STARTER_WEAPON;
    actor.inventory = [STARTER_WEAPON];
    actor.root.visible = true;
  });
}

function makeMiniMap(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.position.set(0, 0.025, 0);
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.18
  });
  for (let c = 0; c <= COLS; c++) {
    const x = (c - COLS / 2) * CELL;
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, 0, -MAZE_H / 2),
          new THREE.Vector3(x, 0, MAZE_H / 2)
        ]),
        lineMat
      )
    );
  }
  for (let r = 0; r <= ROWS; r++) {
    const z = (r - ROWS / 2) * CELL;
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-MAZE_W / 2, 0, z),
          new THREE.Vector3(MAZE_W / 2, 0, z)
        ]),
        lineMat
      )
    );
  }
  scene.add(group);
}

function makePortal(
  scene: THREE.Scene,
  row: number,
  col: number,
  color: number
) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.018, 8, 32),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.55
    })
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const light = new THREE.PointLight(color, 0.8, 1.4);
  light.position.y = 0.25;
  g.add(light);
  g.position.copy(cellToWorld(row, col)).setY(0.08);
  scene.add(g);
}

function makeBloodBurst(pos: THREE.Vector3, heavy = false) {
  const group = new THREE.Group();
  const count = heavy ? 9 : 5;
  for (let i = 0; i < count; i++) {
    const drop = new THREE.Mesh(
      new THREE.SphereGeometry(heavy ? 0.028 : 0.02, 6, 4),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0x7f1d1d : 0xdc2626 })
    );
    drop.position.set(
      pos.x + (Math.random() - 0.5) * 0.22,
      0.18 + Math.random() * 0.32,
      pos.z + (Math.random() - 0.5) * 0.22
    );
    group.add(drop);
  }
  return group;
}

function makeBullet(
  scene: THREE.Scene,
  owner: Actor,
  pos: THREE.Vector3,
  dir: THREE.Vector3
): Bullet {
  const ownerColor = owner.isUser ? 0x93c5fd : 0xfca5a5;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(
      owner.weapon.weaponType === 'sniper' ? 0.052 : 0.045,
      12,
      8
    ),
    new THREE.MeshStandardMaterial({
      color: ownerColor,
      emissive: ownerColor,
      emissiveIntensity: 0.8
    })
  );
  mesh.position.copy(pos).setY(0.38);
  scene.add(mesh);
  return {
    mesh,
    pos: mesh.position.clone(),
    vel: dir.clone().normalize().multiplyScalar(owner.weapon.bulletSpeed),
    ownerId: owner.id,
    ownerName: owner.name,
    ownerColor,
    weapon: owner.weapon,
    life: owner.weapon.bulletLife,
    active: true
  };
}

function updateBullets(
  bullets: Bullet[],
  dt: number,
  actors: Actor[],
  crates: SupplyCrate[],
  scene: THREE.Scene,
  setStatus: (s: string) => void
) {
  bullets.forEach((b) => {
    if (!b.active) return;
    b.life -= dt;
    b.pos.addScaledVector(b.vel, dt);
    b.mesh.position.copy(b.pos);

    if (b.life <= 0 || collidesWithMaze(b.pos, 0.035)) {
      b.active = false;
      b.mesh.visible = false;
      return;
    }

    for (const crate of crates) {
      if (crate.broken) continue;
      if (b.pos.distanceTo(crate.pos.clone().setY(0.28)) < CRATE_RADIUS) {
        b.active = false;
        b.mesh.visible = false;
        const owner = actors.find((actor) => actor.id === b.ownerId);
        if (owner) setStatus(damageCrate(crate, b.weapon.damage, owner));
        return;
      }
    }

    for (const enemy of actors) {
      if (enemy.id === b.ownerId || enemy.health <= 0 || !enemy.root.visible)
        continue;
      if (
        b.pos.distanceTo(enemy.pos.clone().setY(0.38)) <
        enemy.radius + 0.08
      ) {
        enemy.health = Math.max(0, enemy.health - b.weapon.damage);
        enemy.stun = 0.75;
        const blood = makeBloodBurst(enemy.pos, enemy.health <= 0);
        scene.add(blood);
        setTimeout(() => scene.remove(blood), 520);
        b.active = false;
        b.mesh.visible = false;
        if (enemy.health <= 0) {
          enemy.root.rotation.x = Math.PI / 2;
          enemy.root.position.y = 0.05;
          setTimeout(() => {
            enemy.root.visible = false;
            enemy.pos.set(99, 0, 99);
          }, 430);
          setStatus(
            `${b.ownerName} eliminated ${enemy.name} with ${b.weapon.shortName}!`
          );
        } else {
          const knockback = enemy.pos
            .clone()
            .sub(b.pos)
            .setY(0)
            .normalize()
            .multiplyScalar(0.18);
          enemy.pos.add(knockback);
          setStatus(
            `${b.ownerName} hit ${enemy.name} with ${b.weapon.shortName}!`
          );
        }
        return;
      }
    }
  });
}

export default function RunMan() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const moveBase = useRef<HTMLDivElement | null>(null);
  const moveKnob = useRef<HTMLDivElement | null>(null);
  const moveTouch = useRef<number | null>(null);
  const input = useRef<InputState>({
    moveX: 0,
    moveY: 0,
    lookYaw: 0,
    lookPitch: -0.03
  });
  const lookTouch = useRef<{
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const [weaponSlots, setWeaponSlots] = useState<WeaponEntry[]>([
    STARTER_WEAPON
  ]);
  const [miniPos, setMiniPos] = useState(() => worldToCell(cellToWorld(15, 1)));
  const [hud, setHud] = useState({
    alive: MAX_PLAYERS,
    ammo: STARTER_WEAPON.ammo,
    hp: 5,
    weapon: STARTER_WEAPON.shortName,
    time: GAME_TIME,
    status: 'Loading The Maze Battle Royal fast-FPS arena…'
  });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x020617, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x020617, 7, 18);

    const camera = new THREE.PerspectiveCamera(66, 1, 0.025, 70);
    camera.position.set(0, 5.2, 4.2);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.54));
    const sun = new THREE.DirectionalLight(0xffffff, 1.25);
    sun.position.set(4, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const cyanLight = new THREE.PointLight(0x00e5ff, 1.4, 11);
    cyanLight.position.set(0, 2.2, 0);
    scene.add(cyanLight);

    makeMaze(scene);
    makeMiniMap(scene);
    makePortal(scene, 1, 1, 0x1d69ff);
    makePortal(scene, 15, 15, 0xd92f2f);
    const bullets: Bullet[] = [];

    const loader = new GLTFLoader();
    const pickups = createPickups(scene);
    const crates = createSupplyCrates(scene);
    let loadedCount = 0;
    const onLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= MAX_PLAYERS)
        setHud((h) => ({
          ...h,
          status: 'The Maze Battle Royal is ready. Break boxes, loot, survive.'
        }));
    };

    const starts = [
      cellToWorld(15, 1),
      cellToWorld(1, 15),
      cellToWorld(15, 15),
      cellToWorld(1, 1),
      cellToWorld(8, 8),
      cellToWorld(1, 8),
      cellToWorld(15, 8),
      cellToWorld(8, 1)
    ];
    const actors: Actor[] = [
      createActor(scene, loader, 0, 'You', 'blue', starts[0], onLoaded, true),
      ...Array.from({ length: MAX_PLAYERS - 1 }, (_, i) =>
        createActor(
          scene,
          loader,
          i + 1,
          `Runner ${i + 2}`,
          'red',
          starts[i + 1],
          onLoaded
        )
      )
    ];
    const user = actors[0];

    let gameTime = GAME_TIME;
    let state: GameState = 'playing';
    let aiThink = 0;
    let aiFireThink = 0;
    let frame = 0;
    let last = performance.now();
    let minimapTick = 0;
    let weaponKick = 0;
    const raycaster = new THREE.Raycaster();
    const weaponView = new THREE.Group();
    weaponView.position.set(0.22, -0.18, -0.45);
    weaponView.rotation.set(-0.06, Math.PI / 2, 0.03);
    camera.add(weaponView);
    scene.add(camera);

    const refreshWeaponView = (weapon: WeaponEntry) => {
      weaponView.clear();
      const fallback = makeFpsHandsFallback(weapon);
      fallback.scale.setScalar(0.82);
      fallback.rotation.set(0.06, 0, -0.02);
      weaponView.add(fallback);
      loadFirstAvailableWeaponModel(loader, weapon, (source) => {
        weaponView.clear();
        const model = cloneWeaponModelForScene(
          source,
          weapon.id === STARTER_WEAPON.id
            ? 0.34
            : weapon.weaponType === 'pistol'
              ? 0.18
              : 0.26,
          Math.PI / 2
        );
        model.rotation.set(0.08, 0, -0.08);
        weaponView.add(model);
      });
    };
    refreshWeaponView(user.weapon);
    const syncWeaponSlots = () => setWeaponSlots([...user.inventory]);

    const syncHud = (status?: string) =>
      setHud((h) => ({
        ...h,
        alive: aliveActors(actors).length,
        ammo: user.ammo,
        hp: Math.max(0, user.health),
        weapon: user.weapon.shortName,
        time: Math.ceil(gameTime),
        status: status ?? h.status
      }));
    const setStatus = (status: string) => syncHud(status);

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setPixelRatio(
        Math.min(TARGET_PIXEL_RATIO, window.devicePixelRatio || 1)
      );
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const resetGame = () => {
      gameTime = GAME_TIME;
      state = 'playing';
      resetPickups(pickups);
      resetSupplyCrates(crates);
      bullets.forEach((b) => {
        b.active = false;
        b.mesh.visible = false;
      });
      resetActors(actors);
      input.current.moveX = 0;
      input.current.moveY = 0;
      input.current.lookYaw = 0;
      input.current.lookPitch = -0.03;
      refreshWeaponView(user.weapon);
      syncWeaponSlots();
      setHud({
        alive: MAX_PLAYERS,
        ammo: STARTER_WEAPON.ammo,
        hp: 5,
        weapon: STARTER_WEAPON.shortName,
        time: GAME_TIME,
        status:
          'New Maze Battle Royal round. Break boxes, loot weapons, survive.'
      });
    };
    window.__resetRobotMaze = resetGame;
    window.__fireRobotMaze = (aimDir?: THREE.Vector3) => {
      if (state !== 'playing') return;
      if (user.ammo <= 0 || user.fireCooldown > 0 || user.health <= 0) {
        setStatus('You need weapon ammo!');
        return;
      }
      user.ammo -= 1;
      user.fireCooldown = user.weapon.cooldown;
      weaponKick = 0.16;
      const shotDir = aimDir?.clone().setY(0).normalize() ?? user.dir.clone();
      if (shotDir.lengthSq() > 0.001) {
        user.dir.copy(shotDir);
        user.targetDir.copy(shotDir);
      }
      const muzzle = user.pos
        .clone()
        .addScaledVector(user.dir, 0.24)
        .setY(0.38);
      bullets.push(makeBullet(scene, user, muzzle, user.dir));
      setStatus(`Fired ${user.weapon.shortName}!`);
      syncHud();
    };

    window.__swapRobotMazeWeapon = (weaponId: string) => {
      const weapon = user.inventory.find((entry) => entry.id === weaponId);
      if (!weapon) return;
      user.weapon = weapon;
      refreshWeaponView(weapon);
      setStatus(`Quick swapped to ${weapon.shortName}.`);
    };

    const aimDirFromScreen = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1)
      );
      raycaster.setFromCamera(pointer, camera);
      const enemyObjects: THREE.Object3D[] = [];
      actors.slice(1).forEach((actor) => {
        if (actor.health > 0 && actor.root.visible)
          enemyObjects.push(actor.root);
      });
      const enemyHit = raycaster.intersectObjects(enemyObjects, true)[0];
      if (enemyHit) {
        const target = actors.slice(1).find((actor) => {
          let found = false;
          actor.root.traverse((child) => {
            if (child === enemyHit.object) found = true;
          });
          return found;
        });
        if (target) return target.pos.clone().sub(user.pos).setY(0).normalize();
      }
      const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.38);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(ground, hit))
        return hit.sub(user.pos).setY(0).normalize();
      return raycaster.ray.direction.clone().setY(0).normalize();
    };

    const pickupWeaponFromScreen = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1)
      );
      raycaster.setFromCamera(pointer, camera);
      const weaponPickups = pickups.filter(
        (p) => p.kind === 'weapon' && !p.taken
      );
      const hit = raycaster.intersectObjects(
        weaponPickups.map((p) => p.group),
        true
      )[0];
      if (!hit) return false;
      const pickup = weaponPickups.find((p) => {
        let found = false;
        p.group.traverse((child) => {
          if (child === hit.object) found = true;
        });
        return found;
      });
      if (!pickup) return false;
      if (pickup.pos.distanceTo(user.pos) > WEAPON_PICKUP_TAP_RANGE) {
        setStatus(
          `Move closer to pick up ${pickup.weapon?.shortName ?? 'weapon'}.`
        );
        return true;
      }
      const gain = applyPickup(user, pickup);
      if (gain.weapon) {
        refreshWeaponView(gain.weapon);
        syncWeaponSlots();
        setStatus(
          `Picked ${gain.weapon.shortName} +${gain.ammo} ammo. Use quick swap.`
        );
        syncHud();
      }
      return true;
    };

    window.__tapRobotMaze = (clientX: number, clientY: number) => {
      if (state !== 'playing') return;
      if (pickupWeaponFromScreen(clientX, clientY)) return;
      window.__fireRobotMaze?.(aimDirFromScreen(clientX, clientY));
    };

    const meleeCrate = () => {
      const near = crates.find(
        (crate) =>
          !crate.broken &&
          crate.pos.distanceTo(user.pos) < CRATE_RADIUS + user.radius + 0.34
      );
      if (!near) {
        setStatus('No wooden box close enough to punch or kick.');
        return;
      }
      setStatus(damageCrate(near, 1, user));
      syncHud();
      syncWeaponSlots();
    };
    (
      window as typeof window & { __meleeMazeCrate?: () => void }
    ).__meleeMazeCrate = meleeCrate;

    const fireActor = (actor: Actor) => {
      if (
        state !== 'playing' ||
        actor.ammo <= 0 ||
        actor.fireCooldown > 0 ||
        actor.health <= 0
      )
        return;
      actor.ammo -= 1;
      actor.fireCooldown = actor.weapon.cooldown * 1.18;
      const muzzle = actor.pos
        .clone()
        .addScaledVector(actor.dir, 0.24)
        .setY(0.38);
      bullets.push(makeBullet(scene, actor, muzzle, actor.dir));
    };

    const loop = () => {
      frame = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(DT_MAX, (now - last) / 1000);
      last = now;

      pickups.forEach((d, i) => {
        if (!d.taken) {
          d.group.rotation.y += dt * (1.7 + (i % 5) * 0.12);
          d.group.position.y = d.pos.y + Math.sin(now * 0.004 + i) * 0.035;
        }
      });

      if (state === 'playing') {
        gameTime = Math.max(0, gameTime - dt);
        const forward = getForwardFromYaw(input.current.lookYaw);
        const right = getRightFromYaw(input.current.lookYaw);
        const userDir = forward
          .multiplyScalar(-input.current.moveY)
          .add(right.multiplyScalar(input.current.moveX));
        const stickPower = Math.min(
          1,
          Math.hypot(input.current.moveX, input.current.moveY)
        );
        const userSpeed = THREE.MathUtils.lerp(
          PLAYER_WALK_SPEED,
          PLAYER_RUN_SPEED,
          stickPower
        );
        tryMoveActor(user, userDir, userSpeed, dt);
        const lookDir = getForwardFromYaw(input.current.lookYaw);
        user.targetDir.copy(lookDir);
        user.dir.copy(lookDir);

        aiThink -= dt;
        if (aiThink <= 0) {
          aiThink = 0.22;
          actors.slice(1).forEach((actor) => {
            if (actor.health > 0)
              actor.targetDir.copy(chooseAiDir(actor, actors));
          });
        }
        actors.slice(1).forEach((actor, i) => {
          if (actor.health <= 0) return;
          const speed =
            ROBOT_SPEED +
            0.38 +
            i * 0.018 +
            Math.min(0.26, ((GAME_TIME - gameTime) / GAME_TIME) * 0.26);
          tryMoveActor(actor, actor.targetDir.clone(), speed, dt);
        });

        aiFireThink -= dt;
        if (aiFireThink <= 0) {
          aiFireThink = 0.42;
          actors.slice(1).forEach((actor) => {
            if (actor.health <= 0 || actor.ammo <= 0) return;
            const targets = aliveActors(actors).filter(
              (candidate) => candidate.id !== actor.id
            );
            const target = targets.reduce(
              (best, candidate) =>
                actor.pos.distanceTo(candidate.pos) <
                actor.pos.distanceTo(best.pos)
                  ? candidate
                  : best,
              targets[0]
            );
            if (
              target &&
              actor.pos.distanceTo(target.pos) < 2.35 &&
              Math.random() < 0.42
            ) {
              actor.targetDir.copy(
                target.pos.clone().sub(actor.pos).setY(0).normalize()
              );
              fireActor(actor);
            }
          });
        }

        actors.forEach((actor) => {
          if (actor.health <= 0) return;
          const gain = collectPickups(
            actor,
            pickups,
            actor.isUser ? 'tap' : 'auto'
          );
          if (gain.score || gain.ammo) {
            const weaponMsg = gain.weapon
              ? `${actor.name} picked ${gain.weapon.shortName} +${gain.ammo} ammo`
              : `${actor.name} +${gain.score}`;
            if (actor.isUser && gain.weapon) {
              refreshWeaponView(gain.weapon);
              syncWeaponSlots();
            }
            setStatus(weaponMsg);
          }
        });

        updateBullets(bullets, dt, actors, crates, scene, setStatus);

        actors.forEach((a) => {
          if (a.health <= 0) return;
          actors.forEach((b) => {
            if (a.id >= b.id || b.health <= 0) return;
            TMP.copy(a.pos).sub(b.pos).setY(0);
            if (
              TMP.length() < a.radius + b.radius &&
              a.stun <= 0 &&
              b.stun <= 0
            ) {
              const push =
                TMP.lengthSq() > 0.0001
                  ? TMP.normalize()
                  : new THREE.Vector3(1, 0, 0);
              a.pos.addScaledVector(push, 0.08);
              b.pos.addScaledVector(push, -0.08);
            }
          });
        });

        const alive = aliveActors(actors);
        if (alive.length <= 1 || user.health <= 0 || gameTime <= 0) {
          state = 'gameover';
          const winner =
            alive.length === 1
              ? alive[0]
              : alive.reduce(
                  (best, actor) => (actor.health > best.health ? actor : best),
                  alive[0] ?? user
                );
          const status =
            winner?.id === user.id
              ? 'You are the last man standing!'
              : `${winner?.name ?? 'No one'} wins. Last man standing!`;
          setHud({
            alive: alive.length,
            ammo: user.ammo,
            hp: Math.max(0, user.health),
            weapon: user.weapon.shortName,
            time: Math.ceil(gameTime),
            status
          });
        } else if (Math.ceil(gameTime) % 3 === 0) {
          syncHud();
        }
      }

      actors.forEach((actor) => updateActorAnimation(actor, dt));
      user.fallback.visible = false;
      if (user.model) user.model.visible = false;

      minimapTick -= dt;
      if (minimapTick <= 0) {
        minimapTick = 0.18;
        setMiniPos(worldToCell(user.pos));
      }
      weaponKick = Math.max(0, weaponKick - dt * 1.75);
      weaponView.position.z = -0.45 + weaponKick;
      weaponView.rotation.x = -0.06 - weaponKick * 0.8;

      const eye = user.pos
        .clone()
        .add(new THREE.Vector3(0, FIRST_PERSON_EYE_HEIGHT, 0));
      const lookForward = getForwardFromYaw(input.current.lookYaw);
      const ahead = eye
        .clone()
        .addScaledVector(lookForward, 1.9)
        .add(new THREE.Vector3(0, Math.sin(input.current.lookPitch) * 1.2, 0));
      camera.position.lerp(eye, 1 - Math.pow(0.0004, dt));
      camera.lookAt(ahead);

      renderer.render(scene, camera);
    };

    loop();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      delete window.__resetRobotMaze;
      delete window.__fireRobotMaze;
      delete window.__tapRobotMaze;
      delete window.__swapRobotMazeWeapon;
      delete (window as typeof window & { __meleeMazeCrate?: () => void })
        .__meleeMazeCrate;
      renderer.dispose();
    };
  }, []);

  const updateStick = (clientX: number, clientY: number) => {
    const base = moveBase.current;
    const knob = moveKnob.current;
    if (!base || !knob) return;
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const max = r.width * 0.44;
    const deadZone = max * 0.08;
    const rawLen = Math.hypot(dx, dy);
    const len = Math.min(max, rawLen);
    const a = Math.atan2(dy, dx);
    const x = Math.cos(a) * len;
    const y = Math.sin(a) * len;
    knob.style.transform = `translate(${x}px, ${y}px)`;
    const normalized =
      rawLen < deadZone ? 0 : Math.min(1, (len - deadZone) / (max - deadZone));
    input.current.moveX = Math.cos(a) * normalized;
    input.current.moveY = Math.sin(a) * normalized;
  };

  const endStick = () => {
    moveTouch.current = null;
    input.current.moveX = 0;
    input.current.moveY = 0;
    if (moveKnob.current)
      moveKnob.current.style.transform = 'translate(0px,0px)';
  };

  const beginLook = (e: React.PointerEvent<HTMLCanvasElement>) => {
    lookTouch.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: false
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const updateLook = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const look = lookTouch.current;
    if (!look || look.id !== e.pointerId) return;
    const dx = e.clientX - look.x;
    const dy = e.clientY - look.y;
    look.x = e.clientX;
    look.y = e.clientY;
    if (Math.hypot(e.clientX - look.startX, e.clientY - look.startY) > 8)
      look.moved = true;
    input.current.lookYaw -= dx * TOUCH_LOOK_SENSITIVITY;
    input.current.lookPitch = THREE.MathUtils.clamp(
      input.current.lookPitch - dy * TOUCH_LOOK_SENSITIVITY * 0.72,
      -0.42,
      0.38
    );
  };

  const endLook = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const look = lookTouch.current;
    if (!look || look.id !== e.pointerId) return;
    lookTouch.current = null;
    if (!look.moved) window.__tapRobotMaze?.(e.clientX, e.clientY);
  };

  const resetGame = () => window.__resetRobotMaze?.();
  const fire = () => window.__fireRobotMaze?.();
  const swapWeapon = (weaponId: string) =>
    window.__swapRobotMazeWeapon?.(weaponId);
  const melee = () =>
    (
      window as typeof window & { __meleeMazeCrate?: () => void }
    ).__meleeMazeCrate?.();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#020617',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none'
      }}
    >
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }}>
        <canvas
          ref={canvasRef}
          onPointerDown={beginLook}
          onPointerMove={updateLook}
          onPointerUp={endLook}
          onPointerCancel={() => {
            lookTouch.current = null;
          }}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          top: 0,
          padding: '10px 12px',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none',
          color: 'white',
          fontFamily: 'system-ui,sans-serif',
          textShadow: '0 2px 8px #000'
        }}
      >
        <div style={{ fontWeight: 950, fontSize: 12, lineHeight: 1.25 }}>
          THE MAZE BATTLE ROYAL · HP {hud.hp} · AMMO {hud.ammo} · {hud.weapon}
        </div>
        <div style={{ fontSize: 12, fontWeight: 900, textAlign: 'right' }}>
          👥 {hud.alive}/8 · ⏱ {hud.time}s
        </div>
        <div
          style={{
            gridColumn: '1 / 3',
            fontSize: 11,
            textAlign: 'center',
            lineHeight: 1.2
          }}
        >
          {hud.status}
        </div>
      </div>

      <button
        onClick={resetGame}
        style={{
          position: 'fixed',
          right: 14,
          top: 64,
          border: '1px solid rgba(255,255,255,0.28)',
          color: 'white',
          background: 'rgba(15,23,42,0.82)',
          borderRadius: 14,
          padding: '8px 12px',
          fontWeight: 900,
          pointerEvents: 'auto'
        }}
      >
        Reset
      </button>

      <div
        style={{
          position: 'fixed',
          right: 12,
          top: 112,
          width: 104,
          height: 104,
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          gap: 1,
          padding: 7,
          borderRadius: 16,
          border: '1px solid rgba(147,197,253,0.36)',
          background: 'rgba(2,6,23,0.72)',
          boxShadow: '0 14px 28px rgba(0,0,0,0.32)',
          pointerEvents: 'none'
        }}
      >
        {MAZE.flatMap((row, r) =>
          row.map((cell, c) => {
            const isPlayer = miniPos.row === r && miniPos.col === c;
            return (
              <div
                key={`${r}-${c}`}
                style={{
                  borderRadius: isPlayer ? 99 : 1,
                  background: isPlayer
                    ? '#38bdf8'
                    : cell
                      ? 'rgba(148,163,184,0.38)'
                      : 'rgba(15,23,42,0.58)',
                  boxShadow: isPlayer ? '0 0 8px #38bdf8' : 'none'
                }}
              />
            );
          })
        )}
      </div>

      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          width: 22,
          height: 22,
          transform: 'translate(-50%, -50%)',
          border: '2px solid rgba(255,255,255,0.78)',
          borderRadius: 999,
          boxShadow:
            '0 0 0 1px rgba(0,0,0,0.45), 0 0 16px rgba(34,211,238,0.5)',
          pointerEvents: 'none'
        }}
      />

      <div
        style={{
          position: 'fixed',
          left: 12,
          right: 12,
          top: 224,
          padding: '7px 10px',
          border: '1px solid rgba(147,197,253,0.24)',
          borderRadius: 14,
          color: '#dbeafe',
          background: 'rgba(15,23,42,0.58)',
          fontFamily: 'system-ui,sans-serif',
          fontSize: 10.5,
          fontWeight: 850,
          textAlign: 'center',
          pointerEvents: 'none'
        }}
      >
        Drag screen to look · tap target to shoot · tap weapons/boxes to loot
      </div>

      <div
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 18,
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
          pointerEvents: 'auto'
        }}
      >
        {weaponSlots.map((weapon) => (
          <button
            key={weapon.id}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => swapWeapon(weapon.id)}
            style={{
              minWidth: 54,
              border: `1px solid ${hud.weapon === weapon.shortName ? 'rgba(252,211,77,0.9)' : 'rgba(255,255,255,0.28)'}`,
              borderRadius: 12,
              color: 'white',
              background:
                hud.weapon === weapon.shortName
                  ? 'rgba(180,83,9,0.84)'
                  : 'rgba(15,23,42,0.78)',
              padding: '7px 8px',
              fontSize: 10,
              fontWeight: 950,
              boxShadow: '0 8px 20px rgba(0,0,0,0.28)'
            }}
          >
            {weapon.shortName}
          </button>
        ))}
      </div>

      <button
        onClick={melee}
        style={{
          position: 'fixed',
          right: 22,
          bottom: 166,
          width: 74,
          height: 74,
          border: '1px solid rgba(147,197,253,0.52)',
          borderRadius: 999,
          color: 'white',
          background: 'rgba(15,23,42,0.78)',
          fontWeight: 950,
          pointerEvents: 'auto',
          boxShadow: '0 14px 28px rgba(0,0,0,0.32)',
          fontSize: 12
        }}
      >
        PUNCH
      </button>

      <button
        onClick={fire}
        style={{
          position: 'fixed',
          right: 28,
          bottom: 54,
          width: 104,
          height: 104,
          border: '1px solid rgba(252,211,77,0.58)',
          borderRadius: 999,
          color: 'white',
          background: 'rgba(234,88,12,0.78)',
          fontWeight: 950,
          pointerEvents: 'auto',
          boxShadow: '0 18px 34px rgba(0,0,0,0.38)',
          fontSize: 16
        }}
      >
        FIRE
      </button>

      <div
        style={{
          position: 'fixed',
          left: 14,
          bottom: 14,
          color: '#93c5fd',
          fontFamily: 'system-ui,sans-serif',
          fontSize: 11,
          fontWeight: 900,
          textShadow: '0 2px 8px #000'
        }}
      >
        MOVE / RUN
      </div>
      <div
        ref={moveBase}
        onPointerDown={(e) => {
          moveTouch.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (moveTouch.current === e.pointerId)
            updateStick(e.clientX, e.clientY);
        }}
        onPointerUp={() => endStick()}
        onPointerCancel={() => endStick()}
        style={{
          position: 'fixed',
          left: 22,
          bottom: 34,
          width: 152,
          height: 152,
          borderRadius: 999,
          background: 'rgba(29,105,255,0.18)',
          border: '1px solid rgba(147,197,253,0.5)',
          pointerEvents: 'auto',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 18px 34px rgba(0,0,0,0.35)'
        }}
      >
        <div
          ref={moveKnob}
          style={{
            width: 62,
            height: 62,
            borderRadius: 999,
            background: 'rgba(147,197,253,0.96)',
            boxShadow: '0 8px 18px rgba(0,0,0,0.35)',
            transition: 'transform 45ms linear'
          }}
        />
      </div>
    </div>
  );
}
