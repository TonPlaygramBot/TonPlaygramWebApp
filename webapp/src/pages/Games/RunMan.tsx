'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type Team = 'blue' | 'red';
type ActorKind = Team;
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
  leftForeArm?: THREE.Bone;
  rightForeArm?: THREE.Bone;
  leftHand?: THREE.Bone;
  rightHand?: THREE.Bone;
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

type MazeBox = {
  group: THREE.Group;
  pos: THREE.Vector3;
  hp: number;
  reward: 'health' | 'ammo' | 'weapon';
  weapon?: WeaponEntry;
  broken: boolean;
};

type Pickup = {
  kind: PickupKind;
  group: THREE.Group;
  pos: THREE.Vector3;
  taken: boolean;
  value: number;
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
    __resetMazeBattle?: () => void;
    __fireMazeBattle?: (aimDir?: THREE.Vector3) => void;
    __tapMazeBattle?: (clientX: number, clientY: number) => void;
    __meleeMazeBattle?: (kind: 'punch' | 'kick') => void;
    __swapMazeWeapon?: (weaponId: string) => void;
  }
}

const SOLDIER_URL = 'https://threejs.org/examples/models/gltf/Soldier.glb';

const CELL = 0.58;
const ROWS = 17;
const COLS = 17;
const MAZE_W = COLS * CELL;
const MAZE_H = ROWS * CELL;
const PLAYER_RADIUS = 0.16;
const PICKUP_RADIUS = 0.13;
const PLAYER_WALK_SPEED = 2.15;
const PLAYER_RUN_SPEED = 4.15;
const FIRST_PERSON_EYE_HEIGHT = 0.72;
const TOUCH_LOOK_SENSITIVITY = 0.0033;
const MOBILE_RENDER_SCALE = 1;
const DESKTOP_RENDER_SCALE = 1.6;
const MOBILE_MAX_POINT_LIGHTS = 3;
const WEAPON_PICKUP_TAP_RANGE = 1.35;
const AI_RUNNER_SPEED = 1.1;
const MAX_PLAYERS = 8;
const GROUND_Y = 0;
const DT_MAX = 1 / 30;
const GAME_TIME = 180;
const TMP = new THREE.Vector3();
const HUMAN_FPS_HANDS_NAME = 'human-character-fps-hands';

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
    'https://raw.githubusercontent.com/SAAAM-LLC/3D_model_bundle/main/SAM_ASSET-PISTOL-IN-HOLSTER.glb'
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
  }
];

const STARTER_WEAPON =
  WEAPONS.find((weapon) => weapon.id === 'poly-assault-rifle-01') ?? WEAPONS[0];

function getForwardFromYaw(yaw: number) {
  return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
}

function getRightFromYaw(yaw: number) {
  return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
}

function cloneWeaponModel(source: THREE.Object3D, height = 0.3) {
  const model = source.clone(true);
  normalizeModel(model, height, Math.PI / 2);
  shadow(model);
  return model;
}

function sampleHumanSkinMaterial(actor: Actor) {
  const fallbackMaterial = new THREE.MeshStandardMaterial({
    color: 0xf1c9a8,
    roughness: 0.72,
    metalness: 0.02
  });
  let sampled: THREE.Material | null = null;
  actor.model?.traverse((o) => {
    if (sampled) return;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    sampled =
      mats.find((m) => {
        const sm = m as THREE.MeshStandardMaterial;
        const name = `${m?.name ?? ''} ${mesh.name}`.toLowerCase();
        const color = sm.color;
        return (
          name.includes('skin') ||
          name.includes('hand') ||
          (color && color.r > color.b * 1.12 && color.g > color.b * 0.82)
        );
      }) ?? null;
  });
  if (!sampled) return fallbackMaterial;
  const clone = sampled.clone() as THREE.MeshStandardMaterial;
  clone.roughness = Math.max(0.62, clone.roughness ?? 0.72);
  return clone;
}

function makeCapsulePart(
  radius: number,
  length: number,
  material: THREE.Material
) {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, 8, 12),
    material
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

function makeHumanFpsHands(actor: Actor) {
  const skin = sampleHumanSkinMaterial(actor);
  const sleeve = new THREE.MeshStandardMaterial({
    color: actor.kind === 'blue' ? 0x1d69ff : 0xd92f2f,
    roughness: 0.76,
    metalness: 0.02
  });
  const rig = new THREE.Group();
  rig.name = HUMAN_FPS_HANDS_NAME;

  const leftForearm = makeCapsulePart(0.025, 0.25, sleeve);
  leftForearm.name = 'human-left-forearm-fps';
  leftForearm.position.set(-0.125, -0.125, -0.175);
  leftForearm.rotation.set(1.28, 0.26, -0.48);

  const leftHand = makeCapsulePart(0.038, 0.09, skin);
  leftHand.name = 'human-left-support-hand-fps';
  leftHand.position.set(-0.095, -0.122, -0.325);
  leftHand.rotation.set(1.2, 0.16, -0.42);

  const rightForearm = makeCapsulePart(0.027, 0.28, sleeve);
  rightForearm.name = 'human-right-forearm-fps';
  rightForearm.position.set(0.145, -0.14, -0.14);
  rightForearm.rotation.set(1.18, -0.2, 0.44);

  const rightHand = makeCapsulePart(0.04, 0.11, skin);
  rightHand.name = 'human-right-trigger-hand-fps';
  rightHand.position.set(0.108, -0.148, -0.295);
  rightHand.rotation.set(1.1, -0.14, 0.36);

  rig.add(leftForearm, leftHand, rightForearm, rightHand);
  rig.userData.parts = { leftForearm, leftHand, rightForearm, rightHand };
  return rig;
}

function poseHumanFpsHands(
  rig: THREE.Group,
  weapon: WeaponEntry,
  recoil: number
) {
  const parts = rig.userData.parts as Record<string, THREE.Mesh> | undefined;
  if (!parts) return;
  const pistol = weapon.weaponType === 'pistol';
  parts.leftForearm.visible = !pistol;
  parts.leftHand.visible = !pistol;
  const supportZ = -0.325;
  parts.leftHand.position.set(
    -0.095,
    -0.122 - recoil * 0.004,
    supportZ + recoil * 0.018
  );
  parts.leftHand.rotation.set(1.2 - recoil * 0.05, 0.16, -0.42);
  parts.leftForearm.position.set(-0.125, -0.125, supportZ + 0.15);
  parts.leftForearm.rotation.set(1.28 - recoil * 0.04, 0.26, -0.48);
  parts.rightHand.position.set(
    0.108,
    -0.148 - recoil * 0.006,
    -0.295 + recoil * 0.022
  );
  parts.rightHand.rotation.set(
    1.1 - recoil * 0.08,
    -0.14,
    0.36 + recoil * 0.06
  );
  parts.rightForearm.position.set(0.145, -0.14, -0.14 + recoil * 0.014);
  parts.rightForearm.rotation.set(1.18 - recoil * 0.05, -0.2, 0.44);
}

function loadWeaponModel(
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

function shadow<T extends THREE.Object3D>(
  o: T,
  enabled = true,
  cullable = true
) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = enabled;
      m.receiveShadow = enabled;
      m.frustumCulled = cullable;
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
    if (!b.leftArm && n.includes('leftarm') && !n.includes('forearm'))
      b.leftArm = bone;
    if (!b.rightArm && n.includes('rightarm') && !n.includes('forearm'))
      b.rightArm = bone;
    if (
      !b.leftForeArm &&
      (n.includes('leftforearm') ||
        n.includes('leftlowerarm') ||
        n.includes('leftelbow'))
    )
      b.leftForeArm = bone;
    if (
      !b.rightForeArm &&
      (n.includes('rightforearm') ||
        n.includes('rightlowerarm') ||
        n.includes('rightelbow'))
    )
      b.rightForeArm = bone;
    if (!b.leftHand && n.includes('lefthand')) b.leftHand = bone;
    if (!b.rightHand && n.includes('righthand')) b.rightHand = bone;
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
      if (m.color) m.color.lerp(tint, 0.34);
      m.needsUpdate = true;
    });
  });
}

function makeFallback(kind: ActorKind) {
  const group = new THREE.Group();
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

function createActor(
  scene: THREE.Scene,
  loader: GLTFLoader,
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
    radius: PLAYER_RADIUS,
    stun: 0,
    health: isUser ? 5 : 4,
    ammo: STARTER_WEAPON.ammo,
    weapon: STARTER_WEAPON,
    fireCooldown: 0,
    inventory: [STARTER_WEAPON],
    loaded: false
  };

  if (!isUser && id > 2) {
    actor.loaded = true;
    onLoaded();
    return actor;
  }

  const url = SOLDIER_URL;
  loader.setCrossOrigin('anonymous').load(
    url,
    (gltf) => {
      const model = gltf.scene;
      normalizeModel(model, 0.62, Math.PI);
      tintModel(model, kind);
      shadow(model);
      root.add(model);
      fallback.visible = false;
      actor.model = model;
      actor.bones = findBones(model);
      actor.mixer = new THREE.AnimationMixer(model);

      const clipByName = new Map(
        gltf.animations.map((clip) => [clip.name.toLowerCase(), clip])
      );
      const aliases: Record<AnimName, string[]> = {
        Idle: ['idle'],
        Walk: ['walk', 'walking'],
        Run: ['run', 'running']
      };

      (Object.keys(aliases) as AnimName[]).forEach((name) => {
        const clip = aliases[name].map((a) => clipByName.get(a)).find(Boolean);
        if (!clip || !actor.mixer) return;
        const action = actor.mixer.clipAction(clip);
        action.enabled = true;
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.setEffectiveWeight(name === 'Idle' ? 1 : 0);
        action.play();
        actor.actions[name] = action;
      });
      actor.loaded = true;
      onLoaded();
    },
    undefined,
    () => {
      actor.loaded = false;
      fallback.visible = true;
      onLoaded();
    }
  );

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
  const legs = meshes.slice(-2);
  const s = Math.sin(t) * Math.min(1.2, actor.speed);
  if (legs[0]) legs[0].rotation.x = s * 0.75;
  if (legs[1]) legs[1].rotation.x = -s * 0.75;
}

function updateActorAnimation(actor: Actor, dt: number) {
  actor.pos.y = GROUND_Y;
  actor.root.position.copy(actor.pos);
  if (actor.health <= 0) {
    actor.root.rotation.set(
      Math.PI / 2,
      Math.atan2(actor.dir.x, actor.dir.z),
      0
    );
    actor.mixer?.update(dt * 0.2);
    return;
  }
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

  if (actor.ammo > 0) {
    if (actor.bones.spine) actor.bones.spine.rotation.x += -0.04;
    if (actor.bones.rightArm) actor.bones.rightArm.rotation.x += -0.42;
    if (actor.bones.leftArm) actor.bones.leftArm.rotation.x += -0.2;
    if (actor.bones.rightForeArm) actor.bones.rightForeArm.rotation.x += -0.36;
    if (actor.bones.leftForeArm) actor.bones.leftForeArm.rotation.x += -0.3;
    if (actor.bones.rightHand) actor.bones.rightHand.rotation.z += 0.18;
    if (actor.bones.leftHand) actor.bones.leftHand.rotation.z += -0.18;
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
  dt: number,
  responsive = false
) {
  if (actor.stun > 0 || actor.health <= 0) {
    actor.vel.multiplyScalar(Math.pow(0.01, dt));
    actor.speed = 0;
    return;
  }

  if (dir.lengthSq() > 0.001) {
    dir.normalize();
    actor.targetDir.copy(dir);
    actor.vel.lerp(
      dir.clone().multiplyScalar(speed),
      1 - Math.pow(responsive ? 0.0000008 : 0.006, dt)
    );
  } else {
    actor.vel.multiplyScalar(Math.pow(responsive ? 0.0000002 : 0.001, dt));
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

function makeMaze(scene: THREE.Scene, shadowsEnabled = true) {
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

  const wallCount = MAZE.flat().filter((cell) => cell === 1).length;
  const pathCount = ROWS * COLS - wallCount;
  const wallMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL * 0.96, 0.62, CELL * 0.96),
    wallMat,
    wallCount
  );
  const capMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL * 0.98, 0.055, CELL * 0.98),
    topMat,
    wallCount
  );
  const tileMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(CELL * 0.9, 0.018, CELL * 0.9),
    pathMat,
    pathCount
  );
  const matrix = new THREE.Matrix4();
  let wallIndex = 0;
  let pathIndex = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = cellToWorld(r, c);
      if (MAZE[r][c] === 1) {
        matrix.makeTranslation(p.x, 0.31, p.z);
        wallMesh.setMatrixAt(wallIndex, matrix);
        matrix.makeTranslation(p.x, 0.645, p.z);
        capMesh.setMatrixAt(wallIndex, matrix);
        wallIndex += 1;
      } else {
        matrix.makeTranslation(p.x, 0.004, p.z);
        tileMesh.setMatrixAt(pathIndex, matrix);
        pathIndex += 1;
      }
    }
  }
  [wallMesh, capMesh, tileMesh].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = shadowsEnabled;
    mesh.receiveShadow = shadowsEnabled;
    mesh.frustumCulled = true;
    scene.add(mesh);
  });

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

function makeDiamond(color: number, value = 1, withLight = true) {
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
  group.add(shadow(mesh, false));
  if (withLight) {
    const glow = new THREE.PointLight(color, value > 1 ? 0.6 : 0.35, 1.1);
    glow.position.y = 0.18;
    group.add(glow);
  }
  return group;
}

function makeWeaponPickup(weapon: WeaponEntry, withLight = true) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.055, 0.075),
    mat(weapon.pickupColor, 0.4, 0.3)
  );
  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.025, 0.035),
    mat(0x111827, 0.35, 0.4)
  );
  barrel.position.x = 0.16;
  group.add(shadow(body, false), shadow(barrel, false));
  if (withLight) {
    const glow = new THREE.PointLight(weapon.pickupColor, 0.65, 1.1);
    glow.position.y = 0.2;
    group.add(glow);
  }
  group.rotation.y = Math.PI / 4;
  return group;
}

function createPickups(scene: THREE.Scene, withPickupLights = true) {
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
        const group = makeWeaponPickup(weapon, withPickupLights);
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
          special ? 3 : 1,
          withPickupLights && pickups.length < MOBILE_MAX_POINT_LIGHTS
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

function resetPickups(pickups: Pickup[]) {
  pickups.forEach((d) => {
    d.taken = false;
    d.group.visible = true;
  });
}

function collectPickups(actor: Actor, pickups: Pickup[]) {
  let score = 0;
  let ammo = 0;
  let weapon: WeaponEntry | undefined;
  pickups.forEach((p) => {
    if (p.taken) return;
    TMP.copy(p.pos).sub(actor.pos).setY(0);
    if (TMP.length() < actor.radius + PICKUP_RADIUS) {
      p.taken = true;
      p.group.visible = false;
      if (p.kind === 'diamond') {
        score += p.value;
        if (p.value >= 3)
          actor.health = Math.min(actor.isUser ? 6 : 4, actor.health + 1);
      } else {
        ammo += p.value;
        weapon = p.weapon;
        if (p.weapon && !actor.inventory.some((w) => w.id === p.weapon?.id))
          actor.inventory = [p.weapon, ...actor.inventory].slice(0, 5);
      }
    }
  });
  if (weapon) actor.weapon = weapon;
  actor.ammo += ammo;
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
    actor.root.rotation.set(0, 0, 0);
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

function makeWoodenBox(
  reward: MazeBox['reward'],
  weapon?: WeaponEntry,
  withLight = true
) {
  const group = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.34, 0.34),
    new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.82,
      metalness: 0.02
    })
  );
  box.position.y = 0.17;
  const straps = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.035, 0.37),
    new THREE.MeshStandardMaterial({ color: 0x3f2a1c, roughness: 0.9 })
  );
  straps.position.y = 0.34;
  group.add(shadow(box, false), shadow(straps, false));
  if (withLight) {
    const glow = new THREE.PointLight(
      reward === 'health'
        ? 0x22c55e
        : reward === 'weapon'
          ? 0xfacc15
          : 0x38bdf8,
      0.32,
      0.9
    );
    glow.position.y = 0.45;
    group.add(glow);
  }
  group.userData.reward = reward;
  group.userData.weaponId = weapon?.id;
  return group;
}

function createWoodenBoxes(scene: THREE.Scene, withBoxLights = true) {
  const cells = [
    [2, 1],
    [3, 11],
    [5, 3],
    [5, 9],
    [7, 8],
    [9, 7],
    [11, 15],
    [13, 5],
    [15, 13]
  ];
  return cells.map(([r, c], i) => {
    const reward: MazeBox['reward'] =
      i % 3 === 0 ? 'health' : i % 3 === 1 ? 'ammo' : 'weapon';
    const weapon =
      reward === 'weapon' ? WEAPONS[(i + 9) % WEAPONS.length] : undefined;
    const group = makeWoodenBox(reward, weapon, withBoxLights);
    const pos = cellToWorld(r, c).setY(0);
    group.position.copy(pos);
    scene.add(group);
    return {
      group,
      pos: pos.clone(),
      hp: reward === 'weapon' ? 3 : 2,
      reward,
      weapon,
      broken: false
    };
  });
}

function spawnBoxReward(scene: THREE.Scene, box: MazeBox, pickups: Pickup[]) {
  if (box.reward === 'health') {
    const group = makeDiamond(0x22c55e, 3, false);
    const pos = box.pos.clone().setY(0.24);
    group.position.copy(pos);
    scene.add(group);
    pickups.push({ kind: 'diamond', group, pos, taken: false, value: 3 });
  } else if (box.reward === 'ammo') {
    const group = makeDiamond(0x38bdf8, 2, false);
    const pos = box.pos.clone().setY(0.22);
    group.position.copy(pos);
    scene.add(group);
    pickups.push({ kind: 'diamond', group, pos, taken: false, value: 2 });
  } else if (box.weapon) {
    const group = makeWeaponPickup(box.weapon, false);
    const pos = box.pos.clone().setY(0.25);
    group.position.copy(pos);
    scene.add(group);
    pickups.push({
      kind: 'weapon',
      group,
      pos,
      taken: false,
      value: box.weapon.ammo,
      weapon: box.weapon
    });
  }
}

function damageBox(
  scene: THREE.Scene,
  box: MazeBox,
  damage: number,
  pickups: Pickup[]
) {
  if (box.broken) return false;
  box.hp -= damage;
  box.group.scale.setScalar(Math.max(0.78, 1 - (3 - box.hp) * 0.08));
  if (box.hp > 0) return true;
  box.broken = true;
  box.group.visible = false;
  spawnBoxReward(scene, box, pickups);
  return true;
}

function makeBlood(scene: THREE.Scene, pos: THREE.Vector3) {
  const blood = new THREE.Mesh(
    new THREE.CircleGeometry(0.23, 18),
    new THREE.MeshBasicMaterial({
      color: 0x7f1d1d,
      transparent: true,
      opacity: 0.82
    })
  );
  blood.rotation.x = -Math.PI / 2;
  blood.position.copy(pos).setY(0.013);
  scene.add(blood);
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
  boxes: MazeBox[],
  pickups: Pickup[],
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

    for (const box of boxes) {
      if (!box.broken && b.pos.distanceTo(box.pos.clone().setY(0.24)) < 0.32) {
        damageBox(scene, box, b.weapon.damage, pickups);
        b.active = false;
        b.mesh.visible = false;
        setStatus(`${b.ownerName} cracked a supply box!`);
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
        b.active = false;
        b.mesh.visible = false;
        if (enemy.health <= 0) {
          makeBlood(scene, enemy.pos);
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

function drawMiniMap(
  canvas: HTMLCanvasElement,
  user: Actor,
  actors: Actor[],
  boxes: MazeBox[],
  pickups: Pickup[]
) {
  const size = 124;
  if (canvas.width !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(2,6,23,0.78)';
  ctx.fillRect(0, 0, size, size);
  const pad = 5;
  const tile = (size - pad * 2) / COLS;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle =
        MAZE[r][c] === 1 ? 'rgba(148,163,184,0.72)' : 'rgba(15,23,42,0.62)';
      ctx.fillRect(
        pad + c * tile,
        pad + r * tile,
        Math.max(1, tile - 1),
        Math.max(1, tile - 1)
      );
    }
  }
  const dot = (pos: THREE.Vector3, color: string, radius: number) => {
    const cell = worldToCell(pos);
    ctx.beginPath();
    ctx.arc(
      pad + (cell.col + 0.5) * tile,
      pad + (cell.row + 0.5) * tile,
      radius,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = color;
    ctx.fill();
  };
  pickups.forEach((p) => {
    if (!p.taken && p.kind === 'weapon') dot(p.pos, '#facc15', 2);
  });
  boxes.forEach((b) => {
    if (!b.broken) dot(b.pos, '#a16207', 2);
  });
  actors.slice(1).forEach((a) => {
    if (a.health > 0) dot(a.pos, '#ef4444', 2.2);
  });
  dot(user.pos, '#38bdf8', 3.2);
}

export default function RunMan() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const moveBase = useRef<HTMLDivElement | null>(null);
  const moveKnob = useRef<HTMLDivElement | null>(null);
  const moveTouch = useRef<number | null>(null);
  const miniMapRef = useRef<HTMLCanvasElement | null>(null);
  const lookTouch = useRef<{
    id: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const input = useRef<InputState>({
    moveX: 0,
    moveY: 0,
    lookYaw: Math.PI / 2,
    lookPitch: -0.04
  });
  const [weaponSlots, setWeaponSlots] = useState<WeaponEntry[]>([
    STARTER_WEAPON
  ]);
  const [hud, setHud] = useState({
    alive: MAX_PLAYERS,
    ammo: STARTER_WEAPON.ammo,
    hp: 5,
    weapon: STARTER_WEAPON.shortName,
    time: GAME_TIME,
    status: 'The Maze Battle Royal is loading fast mode…'
  });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const lowPower =
      (window.matchMedia?.('(max-width: 860px), (pointer: coarse)').matches ??
        true) ||
      (navigator.hardwareConcurrency ?? 4) <= 4;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !lowPower,
      powerPreference: 'high-performance'
    });
    renderer.setClearColor(0x020617, 1);
    renderer.shadowMap.enabled = !lowPower;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x020617, lowPower ? 5.5 : 7, lowPower ? 12 : 18);

    const camera = new THREE.PerspectiveCamera(66, 1, 0.035, 70);
    camera.position.set(0, 5.2, 4.2);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, lowPower ? 0.74 : 0.54));
    const sun = new THREE.DirectionalLight(0xffffff, lowPower ? 0.92 : 1.25);
    sun.position.set(4, 9, 5);
    sun.castShadow = !lowPower;
    sun.shadow.mapSize.set(lowPower ? 512 : 1536, lowPower ? 512 : 1536);
    scene.add(sun);

    const cyanLight = new THREE.PointLight(
      0x00e5ff,
      lowPower ? 0.55 : 1.4,
      lowPower ? 5 : 11
    );
    cyanLight.position.set(0, 2.2, 0);
    scene.add(cyanLight);

    makeMaze(scene, !lowPower);
    makeMiniMap(scene);
    makePortal(scene, 1, 1, 0x1d69ff);
    makePortal(scene, 15, 15, 0xd92f2f);
    const pickups = createPickups(scene, !lowPower);
    const boxes = createWoodenBoxes(scene, !lowPower);
    const bullets: Bullet[] = [];

    const loader = new GLTFLoader();
    let loadedCount = 0;
    const onLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= MAX_PLAYERS)
        setHud((h) => ({
          ...h,
          status: 'The Maze Battle Royal: shoot, punch boxes, survive.'
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
    const raycaster = new THREE.Raycaster();
    const weaponRoot = new THREE.Group();
    const weaponModelMount = new THREE.Group();
    weaponModelMount.name = 'first-person-weapon-model-mount';
    const humanFpsHands = makeHumanFpsHands(user);
    weaponRoot.add(humanFpsHands, weaponModelMount);
    weaponRoot.position.set(0.18, -0.2, -0.42);
    camera.add(weaponRoot);
    scene.add(camera);
    let weaponKick = 0;

    const syncWeaponSlots = () => setWeaponSlots([...user.inventory]);
    const mountWeapon = (weapon: WeaponEntry) => {
      weaponModelMount.clear();
      poseHumanFpsHands(humanFpsHands, weapon, weaponKick);
      const fallback = makeWeaponPickup(weapon);
      fallback.scale.setScalar(0.62);
      fallback.rotation.set(0.1, Math.PI / 2, 0);
      weaponModelMount.add(fallback);
      loadWeaponModel(loader, weapon, (source) => {
        weaponModelMount.remove(fallback);
        const model = cloneWeaponModel(
          source,
          weapon.weaponType === 'pistol' ? 0.2 : 0.28
        );
        model.rotation.set(0.06, 0, -0.06);
        model.position.set(0.02, -0.02, 0.02);
        weaponModelMount.add(model);
      });
    };
    mountWeapon(user.weapon);

    let gameTime = GAME_TIME;
    let state: GameState = 'playing';
    let aiThink = 0;
    let aiFireThink = 0;
    let frame = 0;
    let last = performance.now();

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
        Math.min(
          lowPower ? MOBILE_RENDER_SCALE : DESKTOP_RENDER_SCALE,
          window.devicePixelRatio || 1
        )
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
      boxes.forEach((box) => {
        box.broken = false;
        box.hp = box.reward === 'weapon' ? 3 : 2;
        box.group.visible = true;
        box.group.scale.setScalar(1);
      });
      bullets.forEach((b) => {
        b.active = false;
        b.mesh.visible = false;
      });
      resetActors(actors);
      input.current.moveX = 0;
      input.current.moveY = 0;
      input.current.lookYaw = Math.PI / 2;
      input.current.lookPitch = -0.04;
      mountWeapon(user.weapon);
      syncWeaponSlots();
      setHud({
        alive: MAX_PLAYERS,
        ammo: STARTER_WEAPON.ammo,
        hp: 5,
        weapon: STARTER_WEAPON.shortName,
        time: GAME_TIME,
        status:
          'New Maze Battle Royal round. Break boxes for health, ammo, weapons.'
      });
    };
    window.__resetMazeBattle = resetGame;
    window.__fireMazeBattle = (aimDir?: THREE.Vector3) => {
      if (state !== 'playing') return;
      if (user.ammo <= 0 || user.fireCooldown > 0 || user.health <= 0) {
        setStatus('You need weapon ammo!');
        return;
      }
      user.ammo -= 1;
      user.fireCooldown = user.weapon.cooldown;
      if (aimDir && aimDir.lengthSq() > 0.001) {
        user.dir.copy(aimDir).setY(0).normalize();
        user.targetDir.copy(user.dir);
      }
      const muzzle = user.pos
        .clone()
        .addScaledVector(user.dir, 0.24)
        .setY(0.38);
      bullets.push(makeBullet(scene, user, muzzle, user.dir));
      weaponKick = 1;
      setStatus(`Fired ${user.weapon.shortName}!`);
      syncHud();
    };

    window.__swapMazeWeapon = (weaponId: string) => {
      const weapon = user.inventory.find((entry) => entry.id === weaponId);
      if (!weapon) return;
      user.weapon = weapon;
      mountWeapon(weapon);
      setStatus(`Quick swap: ${weapon.shortName}`);
      syncHud();
    };

    const aimDirFromScreen = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1)
      );
      raycaster.setFromCamera(pointer, camera);
      const targets: THREE.Object3D[] = [];
      actors.slice(1).forEach((actor) => {
        if (actor.health > 0 && actor.root.visible) targets.push(actor.root);
      });
      boxes.forEach((box) => {
        if (!box.broken) targets.push(box.group);
      });
      const hit = raycaster.intersectObjects(targets, true)[0];
      if (hit) {
        const enemy = actors.slice(1).find((actor) => {
          let found = false;
          actor.root.traverse((child) => {
            if (child === hit.object) found = true;
          });
          return found;
        });
        if (enemy) return enemy.pos.clone().sub(user.pos).setY(0).normalize();
        const box = boxes.find((entry) => {
          let found = false;
          entry.group.traverse((child) => {
            if (child === hit.object) found = true;
          });
          return found;
        });
        if (box) return box.pos.clone().sub(user.pos).setY(0).normalize();
      }
      return getForwardFromYaw(input.current.lookYaw);
    };

    const tapPickup = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1)
      );
      raycaster.setFromCamera(pointer, camera);
      const weapons = pickups.filter((p) => p.kind === 'weapon' && !p.taken);
      const hit = raycaster.intersectObjects(
        weapons.map((p) => p.group),
        true
      )[0];
      if (!hit) return false;
      const pickup = weapons.find((p) => {
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
      pickup.taken = true;
      pickup.group.visible = false;
      if (
        pickup.weapon &&
        !user.inventory.some((w) => w.id === pickup.weapon?.id)
      )
        user.inventory = [pickup.weapon, ...user.inventory].slice(0, 5);
      if (pickup.weapon) {
        user.weapon = pickup.weapon;
        user.ammo += pickup.value;
        mountWeapon(pickup.weapon);
        syncWeaponSlots();
        setStatus(`Picked ${pickup.weapon.shortName}.`);
        syncHud();
      }
      return true;
    };

    window.__tapMazeBattle = (clientX: number, clientY: number) => {
      if (state !== 'playing') return;
      if (tapPickup(clientX, clientY)) return;
      window.__fireMazeBattle?.(aimDirFromScreen(clientX, clientY));
    };

    window.__meleeMazeBattle = (kind: 'punch' | 'kick') => {
      const range = kind === 'kick' ? 0.62 : 0.48;
      const box = boxes.find(
        (entry) => !entry.broken && entry.pos.distanceTo(user.pos) < range
      );
      if (!box) {
        setStatus(`${kind === 'kick' ? 'Kick' : 'Punch'} near a wooden box.`);
        return;
      }
      damageBox(scene, box, kind === 'kick' ? 2 : 1, pickups);
      weaponKick = 0.65;
      setStatus(`${kind === 'kick' ? 'Kicked' : 'Punched'} a supply box.`);
    };

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
        tryMoveActor(
          user,
          userDir,
          THREE.MathUtils.lerp(PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, stickPower),
          dt,
          true
        );
        user.dir.copy(getForwardFromYaw(input.current.lookYaw));
        user.targetDir.copy(user.dir);

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
            AI_RUNNER_SPEED +
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
          const gain = collectPickups(actor, pickups);
          if (gain.score || gain.ammo) {
            const weaponMsg = gain.weapon
              ? `${actor.name} picked ${gain.weapon.shortName} +${gain.ammo} ammo`
              : gain.score >= 3
                ? `${actor.name} recovered life`
                : `${actor.name} found supplies`;
            if (actor.isUser && gain.weapon) {
              mountWeapon(gain.weapon);
              syncWeaponSlots();
            }
            setStatus(weaponMsg);
          }
        });

        updateBullets(bullets, dt, actors, boxes, pickups, scene, setStatus);

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
      weaponKick = Math.max(0, weaponKick - dt * 7);
      weaponRoot.position.z = -0.42 + weaponKick * 0.08;
      weaponRoot.rotation.x = -weaponKick * 0.08;
      poseHumanFpsHands(humanFpsHands, user.weapon, weaponKick);

      const eye = user.pos
        .clone()
        .add(new THREE.Vector3(0, FIRST_PERSON_EYE_HEIGHT, 0));
      const lookForward = getForwardFromYaw(input.current.lookYaw);
      const ahead = eye
        .clone()
        .addScaledVector(lookForward, 1.9)
        .add(new THREE.Vector3(0, Math.sin(input.current.lookPitch) * 1.1, 0));
      camera.position.lerp(eye, 1 - Math.pow(0.0005, dt));
      camera.lookAt(ahead);

      const mini = miniMapRef.current;
      if (mini && Math.floor(now / 150) !== Math.floor((now - dt * 1000) / 150))
        drawMiniMap(mini, user, actors, boxes, pickups);
      renderer.render(scene, camera);
    };

    loop();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      delete window.__resetMazeBattle;
      delete window.__fireMazeBattle;
      delete window.__tapMazeBattle;
      delete window.__meleeMazeBattle;
      delete window.__swapMazeWeapon;
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
    const deadZone = max * 0.045;
    const rawLen = Math.hypot(dx, dy);
    const len = Math.min(max, rawLen);
    const a = Math.atan2(dy, dx);
    const x = Math.cos(a) * len;
    const y = Math.sin(a) * len;
    knob.style.transform = `translate(${x}px, ${y}px)`;
    const normalized =
      rawLen < deadZone ? 0 : Math.min(1, (len - deadZone) / (max - deadZone));
    const boosted = normalized <= 0 ? 0 : Math.min(1, 0.28 + normalized * 0.72);
    input.current.moveX = Math.cos(a) * boosted;
    input.current.moveY = Math.sin(a) * boosted;
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
    if (Math.hypot(dx, dy) > 2) look.moved = true;
    input.current.lookYaw -= dx * TOUCH_LOOK_SENSITIVITY;
    input.current.lookPitch = THREE.MathUtils.clamp(
      input.current.lookPitch - dy * TOUCH_LOOK_SENSITIVITY * 0.7,
      -0.42,
      0.36
    );
  };

  const endLook = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const look = lookTouch.current;
    if (!look || look.id !== e.pointerId) return;
    lookTouch.current = null;
    if (!look.moved) window.__tapMazeBattle?.(e.clientX, e.clientY);
  };

  const resetGame = () => window.__resetMazeBattle?.();
  const fire = () => window.__fireMazeBattle?.();
  const punch = () => window.__meleeMazeBattle?.('punch');
  const kick = () => window.__meleeMazeBattle?.('kick');
  const swapWeapon = (weaponId: string) => window.__swapMazeWeapon?.(weaponId);

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

      <canvas
        ref={miniMapRef}
        width={124}
        height={124}
        style={{
          position: 'fixed',
          right: 12,
          top: 110,
          width: 124,
          height: 124,
          border: '1px solid rgba(148,163,184,0.42)',
          borderRadius: 16,
          background: 'rgba(2,6,23,0.72)',
          pointerEvents: 'none',
          boxShadow: '0 12px 30px rgba(0,0,0,0.35)'
        }}
      />

      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          width: 20,
          height: 20,
          transform: 'translate(-50%,-50%)',
          border: '2px solid rgba(255,255,255,0.82)',
          borderRadius: 999,
          boxShadow: '0 0 16px rgba(34,211,238,0.7)',
          pointerEvents: 'none'
        }}
      />

      <div
        style={{
          position: 'fixed',
          left: 16,
          right: 16,
          top: 82,
          padding: '7px 10px',
          border: '1px solid rgba(147,197,253,0.22)',
          borderRadius: 14,
          color: '#dbeafe',
          background: 'rgba(15,23,42,0.56)',
          fontFamily: 'system-ui,sans-serif',
          fontSize: 10.5,
          fontWeight: 850,
          textAlign: 'center',
          pointerEvents: 'none'
        }}
      >
        Fast mobile mode: left stick moves instantly · drag screen to look · tap
        or FIRE to shoot
      </div>

      <div
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 18,
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
          maxWidth: '58vw',
          overflowX: 'auto',
          pointerEvents: 'auto',
          padding: '4px'
        }}
      >
        {weaponSlots.map((weapon) => (
          <button
            key={weapon.id}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => swapWeapon(weapon.id)}
            style={{
              minWidth: 58,
              border: `1px solid ${hud.weapon === weapon.shortName ? 'rgba(252,211,77,0.95)' : 'rgba(255,255,255,0.28)'}`,
              borderRadius: 12,
              color: 'white',
              background:
                hud.weapon === weapon.shortName
                  ? 'rgba(180,83,9,0.86)'
                  : 'rgba(15,23,42,0.82)',
              padding: '7px 8px',
              fontSize: 10,
              fontWeight: 950,
              boxShadow: '0 8px 20px rgba(0,0,0,0.28)',
              whiteSpace: 'nowrap'
            }}
          >
            {weapon.shortName}
          </button>
        ))}
      </div>

      <button
        onClick={punch}
        style={{
          position: 'fixed',
          right: 22,
          bottom: 176,
          width: 66,
          height: 42,
          border: '1px solid rgba(255,255,255,0.35)',
          borderRadius: 16,
          color: 'white',
          background: 'rgba(15,23,42,0.78)',
          fontWeight: 950,
          pointerEvents: 'auto'
        }}
      >
        PUNCH
      </button>
      <button
        onClick={kick}
        style={{
          position: 'fixed',
          right: 94,
          bottom: 146,
          width: 58,
          height: 38,
          border: '1px solid rgba(255,255,255,0.32)',
          borderRadius: 16,
          color: 'white',
          background: 'rgba(15,23,42,0.72)',
          fontWeight: 950,
          fontSize: 12,
          pointerEvents: 'auto'
        }}
      >
        KICK
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
        MOVE
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
