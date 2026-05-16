'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  GLTFLoader,
  type GLTF
} from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { clone as cloneScene } from 'three/examples/jsm/utils/SkeletonUtils.js';

type WeaponClass =
  | 'pistol'
  | 'revolver'
  | 'shotgun'
  | 'rifle'
  | 'smg'
  | 'sniper';
type GamePhase = 'loading' | 'pick' | 'shoot' | 'results';
type ViewMode = 'tables' | 'range' | 'results';
type ControllerType = 'USER' | 'AI';
type MatchMode = 'ai' | 'online';
type RangeDistance = 'standard' | 'swat' | 'nature' | 'moving';
type RangeScene = 'indoor' | 'swat' | 'nature' | 'moving';
type TargetStyle = 'silhouette' | 'hostage' | 'gong' | 'runner';

type WeaponEntry = {
  id: string;
  name: string;
  shortName: string;
  urls: string[];
  weaponClass: WeaponClass;
};

type WeaponStats = {
  mag: number;
  fireDelay: number;
  reloadMs: number;
  recoil: number;
  spread: number;
  damage: number;
  pellets: number;
  fairPellets: number;
  bulletSpeed: number;
  shellPower: number;
};

type CharacterSpec = {
  name: string;
  urls: string[];
  scale: number;
  yaw: number;
  fallbackColor: string;
};

type LaneRuntime = {
  laneIndex: number;
  playerId: number;
  controller: ControllerType;
  root: THREE.Group;
  visual: THREE.Object3D | null;
  mixer: THREE.AnimationMixer | null;
  weaponMount: THREE.Group;
  tableGroup: THREE.Group;
  heldWeapon: THREE.Object3D | null;
  muzzle: THREE.Object3D | null;
  shellPort: THREE.Object3D | null;
  aiNextShotAt: number;
  aiAim: THREE.Vector2;
  activeWeaponIndex: number;
  pickupLift: number;
};

type TableWeaponRuntime = {
  root: THREE.Group;
  model: THREE.Object3D;
  card: THREE.Mesh;
  weaponIndex: number;
  laneIndex: number;
};

type BulletHole = {
  mesh: THREE.Mesh;
  points: number;
  label: string;
};

type PaperTargetRuntime = {
  laneIndex: number;
  root: THREE.Group;
  paper: THREE.Mesh;
  score: number;
  hits: number;
  holes: BulletHole[];
  labelSprite: THREE.Sprite;
  winnerRing: THREE.Mesh;
  startX: number;
  startY: number;
  startZ: number;
  resultZ: number;
  movementAmplitude: number;
  movementSpeed: number;
  movementPhase: number;
  targetStyle: TargetStyle;
};

type BulletRuntime = {
  root: THREE.Object3D;
  spinGroup: THREE.Object3D;
  trail: THREE.Object3D;
  wake: THREE.Object3D | null;
  start: THREE.Vector3;
  end: THREE.Vector3;
  muzzle: THREE.Vector3;
  inside: THREE.Vector3;
  dir: THREE.Vector3;
  right: THREE.Vector3;
  pos: THREE.Vector3;
  t: number;
  age: number;
  speed: number;
  spin: number;
  cinematic: boolean;
  launched: boolean;
  prelaunch: number;
  life: number;
  flightQuat: THREE.Quaternion;
  impacted: boolean;
  impactAge: number;
};

type ShellRuntime = {
  root: THREE.Object3D;
  pos: THREE.Vector3;
  start: THREE.Vector3;
  end: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number;
  age: number;
  launched: boolean;
  grounded: boolean;
  hitPlayed: boolean;
  pre: number;
};

type ServicePistolTextureMaps = {
  diff: THREE.Texture;
  normal: THREE.Texture;
  rough: THREE.Texture;
  metal: THREE.Texture;
  ao: THREE.Texture;
};

type AmmoTemplates = {
  bullet: THREE.Object3D;
  shell: THREE.Object3D;
  source: string;
};

type ShotEffectRuntime = {
  root: THREE.Object3D;
  age: number;
  life: number;
  velocity?: THREE.Vector3;
};

const USER_LANE = 0;
const LANE_COUNT = 4;
const SHOTS_PER_PLAYER = 5;
const PICK_SECONDS = 5;
const TARGET_HALF_WIDTH = 1.05 / 2;
const TARGET_HALF_HEIGHT = 1.58 / 2;
const LANE_X = [-4.9, -1.65, 1.65, 4.9];
const TABLE_Z = 2.35;
const TABLE_TOP_Y = 0.94;
const TARGET_Z = -21.8;
const PRELAUNCH = 1.25;
const BULLET_SPIN = 245;
const SERVICE_PISTOL_AIM = {
  mount: new THREE.Vector3(0.34, 1.27, -0.12),
  muzzle: new THREE.Vector3(0.01, -0.035, -1.21),
  shellPort: new THREE.Vector3(0.46, 0.04, -0.44)
};

const RANGE_DISTANCE_CONFIG: Record<
  RangeDistance,
  {
    label: string;
    targetZ: number;
    subtitle: string;
    scene: RangeScene;
    targetStyle: TargetStyle;
    moving: boolean;
  }
> = {
  standard: {
    label: 'Closed-door lanes',
    targetZ: TARGET_Z,
    subtitle: 'Indoor precision range with controlled lighting',
    scene: 'indoor',
    targetStyle: 'silhouette',
    moving: false
  },
  swat: {
    label: 'SWAT building',
    targetZ: -28.8,
    subtitle: 'Empty-building room clearing with doors and cover',
    scene: 'swat',
    targetStyle: 'hostage',
    moving: false
  },
  nature: {
    label: 'Nature range',
    targetZ: -34.8,
    subtitle: 'Outdoor Poly Haven forest range with long sight lines',
    scene: 'nature',
    targetStyle: 'gong',
    moving: false
  },
  moving: {
    label: 'Moving rails',
    targetZ: -31.4,
    subtitle: 'Motorized lateral targets for tracking practice',
    scene: 'moving',
    targetStyle: 'runner',
    moving: true
  }
};

const OVER_SHOULDER_OFFSET = new THREE.Vector3(0.5, 1.72, 4.85);
const OVER_SHOULDER_LOOK = new THREE.Vector3(0.05, 1.38, -12.5);

const HDRI_URL =
  'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr';

const POLYHAVEN_ASSETS = {
  securityCamera01:
    'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/security_camera_01/security_camera_01_1k.gltf',
  servicePistol:
    'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/service_pistol/service_pistol_1k.gltf',
  woodenCrate02:
    'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/wooden_crate_02/wooden_crate_02_1k.gltf',
  treeStump01:
    'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/tree_stump_01/tree_stump_01_1k.gltf',
  firTree01:
    'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/fir_tree_01/fir_tree_01_1k.gltf'
};

const SERVICE_PISTOL_TEXTURES = {
  diff: 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/service_pistol/service_pistol_diff_2k.jpg',
  normal:
    'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/service_pistol/service_pistol_nor_gl_2k.jpg',
  rough:
    'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/service_pistol/service_pistol_rough_2k.jpg',
  metal:
    'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/service_pistol/service_pistol_metal_2k.jpg',
  ao: 'https://dl.polyhaven.org/file/ph-assets/Models/jpg/2k/service_pistol/service_pistol_ao_2k.jpg'
};

const TEXTURES = {
  floor: {
    diff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/concrete_floor_02/concrete_floor_02_diff_4k.jpg',
    normal:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/concrete_floor_02/concrete_floor_02_nor_gl_4k.jpg',
    rough:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/concrete_floor_02/concrete_floor_02_rough_4k.jpg',
    ao: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/concrete_floor_02/concrete_floor_02_ao_4k.jpg'
  },
  wall: {
    diff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/concrete/concrete_diff_4k.jpg',
    normal:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/concrete/concrete_nor_gl_4k.jpg',
    rough:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/concrete/concrete_rough_4k.jpg',
    ao: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/concrete/concrete_ao_4k.jpg'
  },
  metal: {
    diff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/metal_plate/metal_plate_diff_4k.jpg',
    normal:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/metal_plate/metal_plate_nor_gl_4k.jpg',
    rough:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/metal_plate/metal_plate_rough_4k.jpg',
    metal:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/metal_plate/metal_plate_metal_4k.jpg'
  },
  table: {
    diff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/dark_wood/dark_wood_diff_4k.jpg',
    normal:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/dark_wood/dark_wood_nor_gl_4k.jpg',
    rough:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/dark_wood/dark_wood_rough_4k.jpg',
    ao: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/dark_wood/dark_wood_ao_4k.jpg'
  },
  forest: {
    diff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/forest_ground_04/forest_ground_04_diff_4k.jpg',
    normal:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/forest_ground_04/forest_ground_04_nor_gl_4k.jpg',
    rough:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/forest_ground_04/forest_ground_04_rough_4k.jpg',
    ao: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/forest_ground_04/forest_ground_04_ao_4k.jpg'
  },
  plaster: {
    diff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/plastered_wall/plastered_wall_diff_4k.jpg',
    normal:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/plastered_wall/plastered_wall_nor_gl_4k.jpg',
    rough:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/plastered_wall/plastered_wall_rough_4k.jpg',
    ao: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/plastered_wall/plastered_wall_ao_4k.jpg'
  },
  asphalt: {
    diff: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/asphalt_02/asphalt_02_diff_4k.jpg',
    normal:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/asphalt_02/asphalt_02_nor_gl_4k.jpg',
    rough:
      'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/asphalt_02/asphalt_02_rough_4k.jpg',
    ao: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/asphalt_02/asphalt_02_ao_4k.jpg'
  }
};

const KNOWN = {
  fps: 'https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf',
  fpsRaw:
    'https://raw.githubusercontent.com/lando19/Guns-for-BJS-FPS-Game/main/main/scene.gltf',
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

function polyGlb(uuid: string) {
  return `https://static.poly.pizza/${uuid}.glb`;
}

const WEAPONS: WeaponEntry[] = [
  {
    id: 'q-shotgun-1',
    name: 'Quaternius Shotgun',
    shortName: 'Shotgun',
    weaponClass: 'shotgun',
    urls: [polyGlb('032e6589-3188-41bc-b92b-e25528344275')]
  },
  {
    id: 'q-assault',
    name: 'Quaternius Assault Rifle',
    shortName: 'Assault',
    weaponClass: 'rifle',
    urls: [polyGlb('b3e6be61-0299-4866-a227-58f5f3fe610b')]
  },
  {
    id: 'q-pistol',
    name: 'Quaternius Pistol',
    shortName: 'Pistol',
    weaponClass: 'pistol',
    urls: [polyGlb('3b53f0fe-f86e-451c-816d-6ab9bd265cdc')]
  },
  {
    id: 'q-heavy-revolver',
    name: 'Quaternius Heavy Revolver',
    shortName: 'Heavy Rev',
    weaponClass: 'revolver',
    urls: [polyGlb('9e728565-67a3-44db-9567-982320abff09')]
  },
  {
    id: 'q-sawed-off',
    name: 'Quaternius Sawed-Off Shotgun',
    shortName: 'Sawed-Off',
    weaponClass: 'shotgun',
    urls: [polyGlb('9a6ee0ee-068b-4774-8b0f-679c3cef0b6e')]
  },
  {
    id: 'q-silver-revolver',
    name: 'Quaternius Revolver Silver',
    shortName: 'Silver Rev',
    weaponClass: 'revolver',
    urls: [polyGlb('7951b3b9-d3a5-4ec8-81b7-11111f1c8e88')]
  },
  {
    id: 'q-long-shotgun',
    name: 'Quaternius Long Shotgun',
    shortName: 'Long Shotgun',
    weaponClass: 'shotgun',
    urls: [polyGlb('f71d6771-f512-4374-bd23-ba00b564db68')]
  },
  {
    id: 'q-pump-shotgun',
    name: 'Quaternius Pump Shotgun',
    shortName: 'Pump',
    weaponClass: 'shotgun',
    urls: [polyGlb('08f27141-8e64-425a-9161-1bbd6956dfca')]
  },
  {
    id: 'q-smg',
    name: 'Quaternius Submachine Gun',
    shortName: 'SMG',
    weaponClass: 'smg',
    urls: [polyGlb('fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710')]
  },
  {
    id: 'ak47',
    name: 'AK47 GLTF',
    shortName: 'AK47',
    weaponClass: 'rifle',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/AK47/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/AK47/scene.gltf',
      KNOWN.awp,
      KNOWN.awpRaw
    ]
  },
  {
    id: 'krsv',
    name: 'KRSV GLTF',
    shortName: 'KRSV',
    weaponClass: 'rifle',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/KRSV/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/KRSV/scene.gltf',
      KNOWN.mrtk,
      KNOWN.mrtkRaw
    ]
  },
  {
    id: 'smith',
    name: 'Smith GLTF',
    shortName: 'Smith',
    weaponClass: 'pistol',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/Smith/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/Smith/scene.gltf',
      KNOWN.pistolHolster,
      KNOWN.pistolHolsterRaw
    ]
  },
  {
    id: 'mosin',
    name: 'Mosin GLTF',
    shortName: 'Mosin',
    weaponClass: 'sniper',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Mosin/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Mosin/scene.gltf',
      KNOWN.awp,
      KNOWN.awpRaw
    ]
  },
  {
    id: 'uzi',
    name: 'Uzi GLTF',
    shortName: 'Uzi',
    weaponClass: 'smg',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Uzi/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Uzi/scene.gltf',
      KNOWN.mrtk,
      KNOWN.mrtkMaster
    ]
  },
  {
    id: 'sigsauer',
    name: 'SigSauer GLTF',
    shortName: 'SigSauer',
    weaponClass: 'pistol',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models3/SigSauer/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models3/SigSauer/scene.gltf',
      KNOWN.pistolHolster,
      KNOWN.pistolHolsterRaw
    ]
  },
  {
    id: 'service-pistol',
    name: 'Poly Haven Service Pistol',
    shortName: 'Service',
    weaponClass: 'pistol',
    urls: [POLYHAVEN_ASSETS.servicePistol, KNOWN.pistolHolster]
  },
  {
    id: 'awp',
    name: 'AWP Sniper GLB',
    shortName: 'AWP',
    weaponClass: 'sniper',
    urls: [KNOWN.awp, KNOWN.awpRaw]
  },
  {
    id: 'mrtk',
    name: 'MRTK Gun GLB',
    shortName: 'MRTK',
    weaponClass: 'rifle',
    urls: [KNOWN.mrtk, KNOWN.mrtkRaw, KNOWN.mrtkMaster]
  },
  {
    id: 'fps',
    name: 'FPS Gun GLTF',
    shortName: 'FPS Shotgun',
    weaponClass: 'shotgun',
    urls: [KNOWN.fps, KNOWN.fpsRaw, KNOWN.awp, KNOWN.awpRaw]
  }
];

const STATS: Record<WeaponClass, WeaponStats> = {
  pistol: {
    mag: 12,
    fireDelay: 210,
    reloadMs: 950,
    recoil: 0.35,
    spread: 0.013,
    damage: 34,
    pellets: 1,
    fairPellets: 1,
    bulletSpeed: 5.2,
    shellPower: 0.95
  },
  revolver: {
    mag: 6,
    fireDelay: 430,
    reloadMs: 1150,
    recoil: 0.55,
    spread: 0.011,
    damage: 60,
    pellets: 1,
    fairPellets: 1,
    bulletSpeed: 5.4,
    shellPower: 1.05
  },
  shotgun: {
    mag: 7,
    fireDelay: 670,
    reloadMs: 1300,
    recoil: 0.85,
    spread: 0.05,
    damage: 18,
    pellets: 1,
    fairPellets: 1,
    bulletSpeed: 4.2,
    shellPower: 1.3
  },
  rifle: {
    mag: 30,
    fireDelay: 115,
    reloadMs: 1180,
    recoil: 0.28,
    spread: 0.017,
    damage: 27,
    pellets: 1,
    fairPellets: 1,
    bulletSpeed: 5.6,
    shellPower: 1.0
  },
  smg: {
    mag: 34,
    fireDelay: 85,
    reloadMs: 1000,
    recoil: 0.2,
    spread: 0.024,
    damage: 20,
    pellets: 1,
    fairPellets: 1,
    bulletSpeed: 5.0,
    shellPower: 0.82
  },
  sniper: {
    mag: 5,
    fireDelay: 900,
    reloadMs: 1500,
    recoil: 1.05,
    spread: 0.005,
    damage: 100,
    pellets: 1,
    fairPellets: 1,
    bulletSpeed: 6.6,
    shellPower: 1.25
  }
};

const CHARACTERS: CharacterSpec[] = [
  {
    name: 'Soldier',
    urls: ['https://threejs.org/examples/models/gltf/Soldier.glb'],
    scale: 1.7,
    yaw: Math.PI,
    fallbackColor: '#e5e7eb'
  },
  {
    name: 'Cesium Man',
    urls: [
      'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb',
      'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb'
    ],
    scale: 1.68,
    yaw: Math.PI,
    fallbackColor: '#93c5fd'
  },
  {
    name: 'Robot Expressive',
    urls: [
      'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb'
    ],
    scale: 1.62,
    yaw: Math.PI,
    fallbackColor: '#fca5a5'
  },
  {
    name: 'Xbot',
    urls: ['https://threejs.org/examples/models/gltf/Xbot.glb'],
    scale: 1.7,
    yaw: Math.PI,
    fallbackColor: '#86efac'
  }
];

function statsFor(entry: WeaponEntry) {
  return STATS[entry.weaponClass];
}

function parentFolder(url: string) {
  return url.slice(0, url.lastIndexOf('/') + 1);
}

function isAbsoluteOrDataUrl(url: string) {
  return (
    /^(https?:)?\/\//i.test(url) ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  );
}

function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeLoaderForUrl(modelUrl: string) {
  const baseFolder = parentFolder(modelUrl);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((resourceUrl) =>
    isAbsoluteOrDataUrl(resourceUrl)
      ? resourceUrl
      : new URL(resourceUrl, baseFolder).toString()
  );
  const loader = new GLTFLoader(manager);
  loader.setCrossOrigin('anonymous');
  return loader;
}

async function loadGLTF(name: string, urls: string[]): Promise<GLTF> {
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const loader = makeLoaderForUrl(url);
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        const timer = window.setTimeout(
          () => reject(new Error(`Timeout loading ${name}`)),
          24000
        );
        loader.load(
          url,
          (loaded) => {
            window.clearTimeout(timer);
            resolve(loaded);
          },
          undefined,
          (error) => {
            window.clearTimeout(timer);
            reject(error);
          }
        );
      });
      return gltf;
    } catch (error) {
      lastError = error;
      console.warn('GLTF source failed:', name, url, error);
    }
  }
  throw lastError ?? new Error(`All URLs failed for ${name}`);
}

function loadTexture(
  loader: THREE.TextureLoader,
  url: string,
  color = false,
  repeat: [number, number] = [1, 1]
) {
  const tex = loader.load(url, undefined, undefined, () =>
    console.warn('Texture failed:', url)
  );
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function loadServicePistolTexture(
  loader: THREE.TextureLoader,
  url: string,
  colorSpace: THREE.ColorSpace = THREE.NoColorSpace
) {
  const tex = loader.load(url, undefined, undefined, () =>
    console.warn('Service pistol texture failed:', url)
  );
  tex.colorSpace = colorSpace;
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function makeServicePistolTextureMaps(
  loader: THREE.TextureLoader
): ServicePistolTextureMaps {
  return {
    diff: loadServicePistolTexture(
      loader,
      SERVICE_PISTOL_TEXTURES.diff,
      THREE.SRGBColorSpace
    ),
    normal: loadServicePistolTexture(loader, SERVICE_PISTOL_TEXTURES.normal),
    rough: loadServicePistolTexture(loader, SERVICE_PISTOL_TEXTURES.rough),
    metal: loadServicePistolTexture(loader, SERVICE_PISTOL_TEXTURES.metal),
    ao: loadServicePistolTexture(loader, SERVICE_PISTOL_TEXTURES.ao)
  };
}

function applyServicePistolTextureMaps(
  root: THREE.Object3D,
  maps: ServicePistolTextureMaps | null
) {
  if (!maps) return;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as any).isMesh && !(mesh as any).isSkinnedMesh) return;
    if (mesh.geometry?.attributes?.uv && !mesh.geometry.attributes.uv2) {
      mesh.geometry.setAttribute('uv2', mesh.geometry.attributes.uv.clone());
    }
    const sourceMaterials = Array.isArray((mesh as any).material)
      ? (mesh as any).material
      : (mesh as any).material
        ? [(mesh as any).material]
        : [new THREE.MeshStandardMaterial()];
    const texturedMaterials = sourceMaterials.map(
      (material: THREE.Material) => {
        const mat = material.clone() as THREE.MeshStandardMaterial;
        mat.map = maps.diff;
        mat.normalMap = maps.normal;
        mat.roughnessMap = maps.rough;
        mat.metalnessMap = maps.metal;
        mat.aoMap = maps.ao;
        mat.metalness = Math.max(mat.metalness ?? 0.55, 0.48);
        mat.roughness = Math.min(Math.max(mat.roughness ?? 0.38, 0.24), 0.68);
        mat.needsUpdate = true;
        return mat;
      }
    );
    (mesh as any).material = Array.isArray((mesh as any).material)
      ? texturedMaterials
      : texturedMaterials[0];
  });
}

function makePbrMaterial(
  loader: THREE.TextureLoader,
  maps: {
    diff: string;
    normal: string;
    rough: string;
    ao?: string;
    metal?: string;
  },
  repeat: [number, number],
  fallback: string,
  metalness = 0
) {
  const mat = new THREE.MeshStandardMaterial({
    color: fallback,
    roughness: 0.78,
    metalness
  });
  mat.map = loadTexture(loader, maps.diff, true, repeat);
  mat.normalMap = loadTexture(loader, maps.normal, false, repeat);
  mat.roughnessMap = loadTexture(loader, maps.rough, false, repeat);
  if (maps.ao) mat.aoMap = loadTexture(loader, maps.ao, false, repeat);
  if (maps.metal) {
    mat.metalnessMap = loadTexture(loader, maps.metal, false, repeat);
    mat.metalness = 1;
  }
  return mat;
}

function configureModel(root: THREE.Object3D, renderer: THREE.WebGLRenderer) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as any).isMesh && !(mesh as any).isSkinnedMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    const materials = Array.isArray((mesh as any).material)
      ? (mesh as any).material
      : (mesh as any).material
        ? [(mesh as any).material]
        : [];

    materials.forEach((material: any) => {
      const keys = [
        'map',
        'emissiveMap',
        'normalMap',
        'roughnessMap',
        'metalnessMap',
        'aoMap',
        'alphaMap'
      ];
      keys.forEach((key) => {
        const tex = material[key] as THREE.Texture | undefined;
        if (!tex?.isTexture) return;
        if (key === 'map' || key === 'emissiveMap')
          tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        tex.needsUpdate = true;
      });
      material.needsUpdate = true;
    });
  });
}

function getRenderableBounds(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let has = false;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!(mesh as any).isMesh && !(mesh as any).isSkinnedMesh) return;
    const b = new THREE.Box3().setFromObject(obj);
    if (!Number.isFinite(b.min.x)) return;
    box.union(b);
    has = true;
  });
  return has ? box : null;
}

function centerRoot(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = getRenderableBounds(root);
  if (!box) return;
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.y -= center.y;
  root.position.z -= center.z;
  root.updateMatrixWorld(true);
}

function normalizeToLength(root: THREE.Object3D, targetLength: number) {
  root.updateMatrixWorld(true);
  const box = getRenderableBounds(root);
  if (!box) return;
  const size = box.getSize(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(max) || max <= 0) return;
  root.scale.setScalar(targetLength / max);
  root.updateMatrixWorld(true);
  centerRoot(root);
}

function groundObject(root: THREE.Object3D, groundY = 0) {
  root.updateMatrixWorld(true);
  const box = getRenderableBounds(root);
  if (!box) return;
  root.position.y += groundY - box.min.y;
  root.updateMatrixWorld(true);
}

function orientWeaponForward(root: THREE.Object3D) {
  centerRoot(root);
  root.rotation.set(0, Math.PI, 0);
  root.rotation.x += -0.035;
  root.rotation.z += 0.012;
  root.updateMatrixWorld(true);
  centerRoot(root);
}

function cloneRenderable(root: THREE.Object3D) {
  const cloned = cloneScene(root);
  cloned.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as any).isMesh && !(mesh as any).isSkinnedMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  });
  return cloned;
}

function isNineMmWeapon(entry: WeaponEntry) {
  return (
    entry.weaponClass === 'pistol' ||
    entry.weaponClass === 'smg' ||
    entry.id === 'q-pistol' ||
    entry.id === 'service-pistol' ||
    entry.id === 'smith' ||
    entry.id === 'sigsauer' ||
    entry.id === 'uzi'
  );
}

function usesRifleCinematic(entry: WeaponEntry) {
  return entry.weaponClass === 'rifle' || entry.weaponClass === 'sniper';
}

function labelOf(object: THREE.Object3D) {
  const mesh = object as THREE.Mesh;
  const materials = Array.isArray((mesh as any).material)
    ? (mesh as any).material
    : (mesh as any).material
      ? [(mesh as any).material]
      : [];
  return `${object.name || ''} ${materials.map((m: any) => m?.name || '').join(' ')}`.toLowerCase();
}

function scoreLabel(label: string, words: string[], reject: string[] = []) {
  if (reject.some((word) => label.includes(word))) return -999;
  return words.reduce(
    (sum, word, index) => sum + (label.includes(word) ? 24 - index : 0),
    0
  );
}

function bestMesh(
  root: THREE.Object3D,
  words: string[],
  reject: string[] = []
) {
  let best: THREE.Mesh | null = null;
  let bestScore = -Infinity;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (
      (!(mesh as any).isMesh && !(mesh as any).isSkinnedMesh) ||
      !child.visible
    )
      return;
    const score = scoreLabel(labelOf(child), words, reject);
    if (score > bestScore) {
      best = mesh;
      bestScore = score;
    }
  });
  return bestScore > 0 ? best : null;
}

function materialFrom(
  object: THREE.Object3D | null,
  fallback = 0xc48a35,
  maps: ServicePistolTextureMaps | null = null
) {
  let found: THREE.Material | null = null;
  object?.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (found || (!(mesh as any).isMesh && !(mesh as any).isSkinnedMesh))
      return;
    found = Array.isArray((mesh as any).material)
      ? (mesh as any).material.find(Boolean)
      : (mesh as any).material;
  });
  const foundMaterial = found as
    | (THREE.Material & { clone?: () => THREE.Material })
    | null;
  const mat = foundMaterial?.clone
    ? (foundMaterial.clone() as THREE.MeshStandardMaterial)
    : new THREE.MeshStandardMaterial({ color: fallback });
  if (maps) {
    mat.map = maps.diff;
    mat.normalMap = maps.normal;
    mat.roughnessMap = maps.rough;
    mat.metalnessMap = maps.metal;
    mat.aoMap = maps.ao;
  }
  mat.metalness = Math.max(mat.metalness ?? 0.5, 0.48);
  mat.roughness = Math.min(Math.max(mat.roughness ?? 0.38, 0.24), 0.68);
  mat.needsUpdate = true;
  return mat;
}

function splitMesh(
  mesh: THREE.Mesh | null,
  keep: 'front' | 'back',
  size: number,
  maps: ServicePistolTextureMaps | null = null
) {
  if (!mesh?.geometry?.attributes?.position) return null;
  const source = mesh.geometry.index
    ? mesh.geometry.toNonIndexed()
    : mesh.geometry.clone();
  const pos = source.attributes.position;
  const nor = source.attributes.normal;
  const uv = source.attributes.uv;
  const box = new THREE.Box3().setFromBufferAttribute(
    pos as THREE.BufferAttribute
  );
  const dims = box.getSize(new THREE.Vector3());
  const axis =
    dims.x >= dims.y && dims.x >= dims.z ? 0 : dims.y >= dims.z ? 1 : 2;
  const min = axis === 0 ? box.min.x : axis === 1 ? box.min.y : box.min.z;
  const max = axis === 0 ? box.max.x : axis === 1 ? box.max.y : box.max.z;
  const cut = min + (max - min) * 0.52;
  const p: number[] = [];
  const n: number[] = [];
  const u: number[] = [];
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i += 3) {
    let avg = 0;
    for (let j = 0; j < 3; j += 1) {
      v.fromBufferAttribute(pos as THREE.BufferAttribute, i + j);
      avg += axis === 0 ? v.x : axis === 1 ? v.y : v.z;
    }
    avg /= 3;
    const choose = keep === 'front' ? avg >= cut : avg < cut;
    if (!choose) continue;
    for (let j = 0; j < 3; j += 1) {
      p.push(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j));
      if (nor) n.push(nor.getX(i + j), nor.getY(i + j), nor.getZ(i + j));
      if (uv) u.push(uv.getX(i + j), uv.getY(i + j));
    }
  }

  if (p.length < 9) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  if (n.length)
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  else geo.computeVertexNormals();
  if (u.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(
      geo,
      materialFrom(mesh, keep === 'front' ? 0xb66b35 : 0xc48a35, maps)
    )
  );
  normalizeToLength(group, size);
  return group;
}

function findAmmoCarrier(root: THREE.Object3D) {
  const modelBox = getRenderableBounds(root);
  if (!modelBox) return null;
  const diag = modelBox.getSize(new THREE.Vector3()).length() || 1;
  const modelCenter = modelBox.getCenter(new THREE.Vector3());
  const candidates: { child: THREE.Mesh; score: number }[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (
      (!(mesh as any).isMesh && !(mesh as any).isSkinnedMesh) ||
      !child.visible
    )
      return;
    const label = labelOf(child);
    if (
      /magazine|\bmag\b|slide|grip|trigger|barrel|frame|receiver|sight|rail|screw|bolt/.test(
        label
      )
    )
      return;
    const box = new THREE.Box3().setFromObject(child);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const sorted = [size.x, size.y, size.z].sort((a, b) => a - b);
    const rel = sorted[2] / diag;
    if (rel > 0.38 || rel < 0.018) return;
    const longRatio = sorted[2] / Math.max(sorted[0], 0.0001);
    const score =
      scoreLabel(label, [
        'cartridge',
        'round',
        'ammo',
        'bullet',
        'shell',
        'casing',
        'case',
        'brass',
        'projectile'
      ]) +
      Math.min(longRatio, 8) * 2.2 +
      (center.distanceTo(modelCenter) / diag) * 12;
    candidates.push({ child: mesh, score });
  });
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.child ?? null;
}

function addRoundedRearCap(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = getRenderableBounds(root);
  if (!box) return;
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y) * 0.36;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x59616a,
    roughness: 0.36,
    metalness: 0.78
  });
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.82, radius * 0.72, radius * 0.32, 44),
    mat.clone()
  );
  base.rotation.x = Math.PI / 2;
  base.position.z = box.max.z - radius * 0.48;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 28), mat);
  dome.scale.set(1, 1, 0.58);
  dome.position.z = box.max.z - radius * 0.28;
  root.add(base, dome);
  centerRoot(root);
}

function bulletTipIsAtPositiveZ(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const vertices: THREE.Vector3[] = [];
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const position = mesh.geometry?.attributes?.position as
      | THREE.BufferAttribute
      | undefined;
    if (!(mesh as any).isMesh || !position) return;
    const matrix = new THREE.Matrix4().multiplyMatrices(
      inverseRoot,
      mesh.matrixWorld
    );
    const v = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      v.fromBufferAttribute(position, i).applyMatrix4(matrix);
      vertices.push(v.clone());
    }
  });
  if (vertices.length < 8) return false;
  let minZ = Infinity;
  let maxZ = -Infinity;
  vertices.forEach((v) => {
    minZ = Math.min(minZ, v.z);
    maxZ = Math.max(maxZ, v.z);
  });
  const span = Math.max(maxZ - minZ, 0.0001);
  const slice = span * 0.28;
  let minRadius = 0;
  let minCount = 0;
  let maxRadius = 0;
  let maxCount = 0;
  vertices.forEach((v) => {
    const radius = Math.hypot(v.x, v.y);
    if (v.z <= minZ + slice) {
      minRadius += radius;
      minCount += 1;
    }
    if (v.z >= maxZ - slice) {
      maxRadius += radius;
      maxCount += 1;
    }
  });
  if (!minCount || !maxCount) return false;
  return maxRadius / maxCount < minRadius / minCount;
}

function orientBulletTipForward(root: THREE.Object3D) {
  centerRoot(root);
  root.updateMatrixWorld(true);
  // Bullet visuals fly along local -Z after alignToDirection().  If the
  // extracted GLB/split projectile has its smaller nose on +Z, flip it so the
  // head exits the barrel nose-first instead of backwards.
  if (bulletTipIsAtPositiveZ(root)) {
    root.rotateY(Math.PI);
    centerRoot(root);
  }
}

function makeFallbackBulletHead(maps: ServicePistolTextureMaps | null = null) {
  const mat = materialFrom(null, 0xb66b35, maps);
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.06, 48),
    mat
  );
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.012;
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, 0.06, 48),
    mat.clone()
  );
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -0.048;
  group.add(body, tip);
  addRoundedRearCap(group);
  return group;
}

function makeBulletHead(
  source: THREE.Object3D | null,
  maps: ServicePistolTextureMaps | null = null
) {
  if (!source) return makeFallbackBulletHead(maps);
  const group = new THREE.Group();
  group.add(cloneRenderable(source));
  applyServicePistolTextureMaps(group, maps);
  centerRoot(group);
  group.updateMatrixWorld(true);
  const size = new THREE.Box3()
    .setFromObject(group)
    .getSize(new THREE.Vector3());
  const axis =
    size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  if (axis === 'x') group.rotation.y = -Math.PI / 2;
  if (axis === 'y') group.rotation.x = Math.PI / 2;
  orientBulletTipForward(group);
  normalizeToLength(group, 0.135);
  orientBulletTipForward(group);
  addRoundedRearCap(group);
  return group;
}

function makeShell(
  source: THREE.Mesh | null,
  maps: ServicePistolTextureMaps | null = null
) {
  const split = splitMesh(source, 'back', 0.22, maps);
  if (split) return split;
  const group = new THREE.Group();
  const mat = materialFrom(source, 0xc9953d, maps);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.074, 0.28, 48),
    mat
  );
  body.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.082, 0.03, 48),
    mat.clone()
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.z = 0.155;
  const primer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.008, 32),
    new THREE.MeshStandardMaterial({
      color: 0x1c1711,
      roughness: 0.65,
      metalness: 0.18
    })
  );
  primer.rotation.x = Math.PI / 2;
  primer.position.z = -0.146;
  group.add(body, rim, primer);
  return group;
}

function extractServicePistolAmmo(
  root: THREE.Object3D,
  maps: ServicePistolTextureMaps | null = null
): AmmoTemplates {
  applyServicePistolTextureMaps(root, maps);
  const explicitBullet = bestMesh(
    root,
    ['bullet_head', 'bullet head', 'projectile', 'bullet', 'round'],
    [
      'shell',
      'casing',
      'case',
      'magazine',
      'mag',
      'slide',
      'grip',
      'barrel',
      'trigger'
    ]
  );
  const explicitShell = bestMesh(
    root,
    ['shell', 'casing', 'case', 'brass'],
    [
      'bullet_head',
      'bullet head',
      'projectile',
      'magazine',
      'mag',
      'slide',
      'grip',
      'barrel',
      'trigger'
    ]
  );

  if (explicitBullet && explicitShell) {
    return {
      bullet: makeBulletHead(explicitBullet, maps),
      shell: makeShell(explicitShell, maps),
      source: 'service pistol GLB bullet head + shell'
    };
  }

  const carrier = findAmmoCarrier(root);
  if (carrier) {
    const splitBullet = splitMesh(carrier, 'front', 0.135, maps);
    return {
      bullet: makeBulletHead(splitBullet || carrier, maps),
      shell: makeShell(carrier, maps),
      source: 'service pistol GLB split cartridge'
    };
  }

  return {
    bullet: makeFallbackBulletHead(maps),
    shell: makeShell(null, maps),
    source: 'fallback 9mm cartridge'
  };
}

function createFallbackAmmoTemplates(
  maps: ServicePistolTextureMaps | null = null
): AmmoTemplates {
  return {
    bullet: makeFallbackBulletHead(maps),
    shell: makeShell(null, maps),
    source: 'fallback 9mm cartridge'
  };
}

function alignToDirection(object: THREE.Object3D, dir: THREE.Vector3) {
  object.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, -1),
    dir.clone().normalize()
  );
}

function spawnMuzzleEffects(
  scene: THREE.Scene,
  position: THREE.Vector3,
  dir: THREE.Vector3,
  effects: ShotEffectRuntime[],
  power = 1
) {
  const flash = new THREE.Group();
  const fireMat = new THREE.MeshStandardMaterial({
    color: 0xff8a1c,
    emissive: 0xff8a1c,
    emissiveIntensity: 1.8 * power,
    roughness: 0.22,
    metalness: 0.05,
    transparent: true,
    opacity: 1
  });
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.08 * power, 12, 8),
    fireMat.clone()
  );
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.14 * power, 0.5 * power, 7),
    fireMat.clone()
  );
  cone.rotation.x = -Math.PI / 2;
  cone.position.z = -0.24 * power;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.16 * power, 0.014 * power, 8, 28),
    new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xffd166,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 1
    })
  );
  ring.rotation.x = Math.PI / 2;
  flash.add(core, cone, ring);
  flash.position.copy(position);
  alignToDirection(flash, dir);
  scene.add(flash);
  effects.push({ root: flash, age: 0, life: 0.08 });

  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(dir, up).normalize();
  for (let i = 0; i < 4; i += 1) {
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(0.03 + i * 0.004, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0x8b8f94,
        roughness: 0.92,
        transparent: true,
        opacity: 0.28
      })
    );
    smoke.position.copy(position).addScaledVector(dir, 0.05 + i * 0.018);
    scene.add(smoke);
    effects.push({
      root: smoke,
      age: 0,
      life: 0.75,
      velocity: dir
        .clone()
        .multiplyScalar(0.55 + i * 0.08)
        .add(up.clone().multiplyScalar(0.2))
        .add(right.clone().multiplyScalar((Math.random() - 0.5) * 0.22))
    });
  }
}

function makeWake() {
  const group = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.15, 0.62, 48, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xbff5ff,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  cone.rotation.x = Math.PI / 2;
  cone.position.z = 0.34;
  group.add(cone);

  for (let strand = 0; strand < 4; strand += 1) {
    const points: THREE.Vector3[] = [];
    const phase = (strand / 4) * Math.PI * 2;
    for (let i = 0; i < 32; i += 1) {
      const t = i / 31;
      const radius = 0.024 + t * 0.09;
      const angle = phase + t * Math.PI * 4.4;
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          0.04 + t * 0.62
        )
      );
    }
    group.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: 0xe8fcff,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        })
      )
    );
  }

  for (let i = 0; i < 2; i += 1) {
    const shock = new THREE.Mesh(
      new THREE.TorusGeometry(0.105 + i * 0.085, 0.0035, 8, 56),
      new THREE.MeshBasicMaterial({
        color: 0xd7fbff,
        transparent: true,
        opacity: 0.11,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      })
    );
    shock.rotation.x = Math.PI / 2;
    shock.position.z = 0.14 + i * 0.16;
    group.add(shock);
  }

  group.visible = false;
  return group;
}

function layWeaponFlatOnTable(root: THREE.Object3D) {
  centerRoot(root);
  root.rotation.set(Math.PI / 2, Math.PI / 2, -Math.PI / 2);
  root.updateMatrixWorld(true);
  const box = getRenderableBounds(root);
  if (!box) return;
  root.position.y += 0.038 - box.min.y;
  root.updateMatrixWorld(true);
}

function pickAiWeaponIndex(aiOrder: number, allowedIndices?: number[]) {
  const preferred: WeaponClass[][] = [
    ['sniper', 'rifle'],
    ['rifle', 'smg'],
    ['pistol', 'revolver', 'shotgun']
  ];
  const classes = preferred[aiOrder % preferred.length];
  const allowed = allowedIndices?.length
    ? allowedIndices
    : WEAPONS.map((_, index) => index);
  const candidates = allowed
    .map((index) => ({ weapon: WEAPONS[index], index }))
    .filter(({ weapon }) => classes.includes(weapon.weaponClass));
  const pool = candidates.length
    ? candidates
    : allowed.map((index) => ({ weapon: WEAPONS[index], index }));
  return pool[Math.floor(Math.random() * pool.length)].index;
}

function makeFallbackCharacter(color = '#e5e7eb') {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({
    color: '#9ca3af',
    roughness: 0.82,
    metalness: 0.06
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.95,
    metalness: 0.02
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: '#111827',
    roughness: 0.9,
    metalness: 0.02
  });

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.72, 0.24),
    shirtMat
  );
  torso.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), skinMat);
  head.position.y = 1.72;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.58, 0.12), skinMat);
  armL.position.set(-0.28, 1.2, 0);
  const armR = armL.clone();
  armR.position.x = 0.28;
  const legL = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.84, 0.16),
    pantsMat
  );
  legL.position.set(-0.1, 0.42, 0);
  const legR = legL.clone();
  legR.position.x = 0.1;

  g.add(torso, head, armL, armR, legL, legR);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  groundObject(g, 0);
  return g;
}

function makeFallbackWeapon(entry: WeaponEntry) {
  const group = new THREE.Group();
  const accentByClass: Record<WeaponClass, string> = {
    pistol: '#94a3b8',
    revolver: '#c084fc',
    shotgun: '#f97316',
    rifle: '#38bdf8',
    smg: '#22c55e',
    sniper: '#facc15'
  };
  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#171923',
    roughness: 0.55,
    metalness: 0.55
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.86,
    metalness: 0.1
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentByClass[entry.weaponClass],
    roughness: 0.42,
    metalness: 0.45
  });

  const longGun =
    entry.weaponClass === 'rifle' ||
    entry.weaponClass === 'shotgun' ||
    entry.weaponClass === 'sniper';
  const bodyLength = longGun
    ? entry.weaponClass === 'sniper'
      ? 1.25
      : 0.98
    : 0.54;
  const barrelLength = longGun
    ? entry.weaponClass === 'shotgun'
      ? 0.68
      : 0.86
    : 0.34;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.18, bodyLength),
    bodyMat
  );
  body.position.z = -0.18;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, barrelLength, 16),
    accentMat
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -bodyLength / 2 - barrelLength / 2 + 0.05;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.36, 0.16), gripMat);
  grip.position.set(0, -0.25, 0.08);
  grip.rotation.x = -0.34;
  const trigger = new THREE.Mesh(
    new THREE.TorusGeometry(0.075, 0.012, 8, 18),
    accentMat
  );
  trigger.rotation.x = Math.PI / 2;
  trigger.position.set(0, -0.11, -0.03);

  group.add(body, barrel, grip, trigger);

  if (longGun) {
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.18, 0.34),
      gripMat
    );
    stock.position.z = bodyLength / 2 + 0.1;
    group.add(stock);
  }

  if (entry.weaponClass === 'sniper') {
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.42, 16),
      accentMat
    );
    scope.rotation.z = Math.PI / 2;
    scope.position.set(0, 0.16, -0.2);
    group.add(scope);
  }

  group.userData.isFallbackWeapon = true;
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return group;
}

function createWeaponIconCanvas(entry: WeaponEntry) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(15,23,42,.92)';
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 9;

  const longGun =
    entry.weaponClass === 'rifle' ||
    entry.weaponClass === 'shotgun' ||
    entry.weaponClass === 'sniper';

  if (longGun) {
    const barrelEnd = entry.weaponClass === 'sniper' ? 226 : 206;
    ctx.fillRect(58, 54, 96, 24);
    ctx.fillRect(20, 60, 44, 18);
    ctx.fillRect(148, 60, barrelEnd - 148, 10);
    ctx.fillRect(76, 77, 22, 34);
    if (entry.weaponClass === 'shotgun') {
      ctx.fillRect(150, 76, 56, 7);
    }
    if (entry.weaponClass === 'sniper') {
      ctx.fillRect(92, 36, 60, 13);
      ctx.fillRect(102, 47, 10, 12);
      ctx.fillRect(135, 47, 10, 12);
    }
  } else {
    ctx.fillRect(66, 52, 92, 28);
    ctx.fillRect(154, 60, 52, 10);
    ctx.fillRect(84, 76, 24, 42);
    ctx.beginPath();
    ctx.arc(126, 82, 12, 0, Math.PI * 2);
    ctx.stroke();
    if (entry.weaponClass === 'revolver') {
      ctx.beginPath();
      ctx.arc(120, 65, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeRect(8, 8, 240, 112);
  ctx.fillStyle = '#fde68a';
  ctx.font = 'bold 20px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(entry.shortName, 128, 26);
  return canvas;
}

function createWeaponIconTexture(entry: WeaponEntry) {
  const tex = new THREE.CanvasTexture(createWeaponIconCanvas(entry));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function weaponIconDataUri(entry: WeaponEntry) {
  if (typeof document === 'undefined') return '';
  return createWeaponIconCanvas(entry).toDataURL('image/png');
}

function createTargetTexture(style: TargetStyle = 'silhouette') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const paperGradient = ctx.createLinearGradient(0, 0, 512, 768);
  paperGradient.addColorStop(0, style === 'gong' ? '#dbeafe' : '#faf7f2');
  paperGradient.addColorStop(1, style === 'gong' ? '#94a3b8' : '#e7e0d4');
  ctx.fillStyle = paperGradient;
  ctx.fillRect(0, 0, 512, 768);
  ctx.strokeStyle = 'rgba(30,30,30,.4)';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 496, 752);

  if (style === 'gong') {
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.arc(256, 360, 178, 0, Math.PI * 2);
    ctx.fill();
    ['#6b7280', '#d1d5db', '#f97316', '#ef4444'].forEach((color, index) => {
      ctx.beginPath();
      ctx.arc(256, 360, 148 - index * 34, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = index === 3 ? 18 : 14;
      ctx.stroke();
    });
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 34px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('STEEL', 256, 126);
    ctx.fillText('100', 256, 372);
  } else {
    ctx.fillStyle = '#222222';
    ctx.beginPath();
    ctx.arc(256, 160, style === 'runner' ? 56 : 68, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    if (style === 'runner') {
      ctx.moveTo(188, 238);
      ctx.lineTo(330, 238);
      ctx.lineTo(374, 500);
      ctx.lineTo(302, 500);
      ctx.lineTo(332, 694);
      ctx.lineTo(282, 704);
      ctx.lineTo(244, 544);
      ctx.lineTo(196, 690);
      ctx.lineTo(150, 672);
      ctx.lineTo(210, 504);
      ctx.lineTo(144, 446);
      ctx.closePath();
    } else {
      ctx.moveTo(162, 246);
      ctx.lineTo(350, 246);
      ctx.lineTo(390, 442);
      ctx.lineTo(330, 690);
      ctx.lineTo(286, 690);
      ctx.lineTo(256, 560);
      ctx.lineTo(226, 690);
      ctx.lineTo(182, 690);
      ctx.lineTo(122, 442);
      ctx.closePath();
    }
    ctx.fill();

    if (style === 'hostage') {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(74, 268, 120, 292);
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 28px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('NO', 134, 390);
      ctx.fillText('SHOOT', 134, 426);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 7;
      ctx.strokeRect(74, 268, 120, 292);
    } else {
      ctx.beginPath();
      ctx.moveTo(166, 286);
      ctx.lineTo(84, 420);
      ctx.lineTo(122, 446);
      ctx.lineTo(204, 340);
      ctx.closePath();
      ctx.fill();
    }

    ctx.beginPath();
    ctx.moveTo(346, 286);
    ctx.lineTo(428, 420);
    ctx.lineTo(390, 446);
    ctx.lineTo(308, 340);
    ctx.closePath();
    ctx.fill();

    const ringY = style === 'runner' ? 412 : 356;
    const rings = [
      { r: 92, color: '#6b7280', w: 14 },
      { r: 68, color: '#d1d5db', w: 10 },
      { r: 44, color: '#9ca3af', w: 8 },
      { r: 22, color: '#ef4444', w: 10 }
    ];
    rings.forEach((ring) => {
      ctx.beginPath();
      ctx.arc(256, ringY, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.w;
      ctx.stroke();
    });
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(256, ringY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 22px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('100', 256, ringY + 8);
    ctx.fillStyle = style === 'hostage' ? '#38bdf8' : '#22c55e';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText(style === 'hostage' ? 'SWAT' : '95', 256, 166);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createLabelSprite(text: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Sprite();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,.72)';
  ctx.fillRect(16, 18, 480, 124);
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 18, 480, 124);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 42px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 80);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.1, 0.65, 1);
  return sprite;
}

function updateLabelSprite(sprite: THREE.Sprite, text: string) {
  const tex = (sprite.material as THREE.SpriteMaterial).map as
    | THREE.CanvasTexture
    | undefined;
  const canvas = tex?.image as HTMLCanvasElement | undefined;
  if (!canvas) return;
  const texture = tex;
  const ctx = canvas.getContext('2d');
  if (!ctx || !texture) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,.72)';
  ctx.fillRect(16, 18, 480, 124);
  ctx.strokeStyle = 'rgba(255,255,255,.22)';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 18, 480, 124);
  ctx.fillStyle = 'white';
  ctx.font = 'bold 42px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 80);
  texture.needsUpdate = true;
}

function createPaperTarget(
  laneIndex: number,
  targetZ = TARGET_Z,
  targetStyle: TargetStyle = 'silhouette',
  moving = false
): PaperTargetRuntime {
  const root = new THREE.Group();
  const railMat = new THREE.MeshStandardMaterial({
    color: '#555f69',
    roughness: 0.7,
    metalness: 0.28
  });

  const topBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.06, 0.07),
    railMat
  );
  topBar.position.set(0, 2.56, 0);
  topBar.castShadow = true;
  root.add(topBar);

  const hanger = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 1.0, 0.06),
    railMat
  );
  hanger.position.set(0, 2.02, 0);
  hanger.castShadow = true;
  root.add(hanger);

  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.06), railMat);
  clip.position.set(0, 1.56, 0);
  clip.castShadow = true;
  root.add(clip);

  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 1.58),
    new THREE.MeshStandardMaterial({
      map: createTargetTexture(targetStyle),
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide
    })
  );
  paper.position.set(0, 0.84, 0);
  paper.castShadow = true;
  paper.receiveShadow = true;
  root.add(paper);

  const winnerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.92, 0.03, 12, 48),
    new THREE.MeshBasicMaterial({
      color: '#facc15',
      transparent: true,
      opacity: 0
    })
  );
  winnerRing.position.set(0, 0.84, 0.04);
  root.add(winnerRing);

  const labelSprite = createLabelSprite(`Lane ${laneIndex + 1}`);
  labelSprite.position.set(0, 2.95, 0);
  root.add(labelSprite);

  root.position.set(LANE_X[laneIndex], 0.65, targetZ);

  return {
    laneIndex,
    root,
    paper,
    score: 0,
    hits: 0,
    holes: [],
    labelSprite,
    winnerRing,
    startX: LANE_X[laneIndex],
    startY: 0.65,
    startZ: targetZ,
    resultZ: -4.1,
    movementAmplitude: moving ? 0.72 + laneIndex * 0.14 : 0,
    movementSpeed: moving ? 0.95 + laneIndex * 0.18 : 0,
    movementPhase: laneIndex * Math.PI * 0.5,
    targetStyle
  };
}

function createBulletHole(localPoint: THREE.Vector3, points: number) {
  const size = 0.03 + Math.random() * 0.018;
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(size, 18),
    new THREE.MeshBasicMaterial({
      color: points >= 90 ? '#3f0a0a' : points >= 70 ? '#7f1d1d' : '#111111',
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  mesh.position.set(localPoint.x, localPoint.y, 0.006 + Math.random() * 0.002);
  return mesh;
}

function makePointedRifleBullet(
  longGun: boolean,
  shotgun: boolean,
  cinematic: boolean
) {
  if (shotgun) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(0.034, 10, 10),
      new THREE.MeshStandardMaterial({
        color: '#d9b56d',
        roughness: 0.32,
        metalness: 0.86,
        emissive: '#3b2508',
        emissiveIntensity: cinematic ? 0.16 : 0.06
      })
    );
  }

  if (!longGun) {
    return new THREE.Mesh(
      new THREE.CapsuleGeometry(0.016, 0.1, 4, 10),
      new THREE.MeshStandardMaterial({
        color: '#e7d7a2',
        roughness: 0.32,
        metalness: 0.86,
        emissive: '#3b2508',
        emissiveIntensity: cinematic ? 0.16 : 0.06
      })
    );
  }

  const mat = new THREE.MeshStandardMaterial({
    color: '#d7b572',
    roughness: 0.28,
    metalness: 0.9,
    emissive: '#3b2508',
    emissiveIntensity: cinematic ? 0.18 : 0.07
  });
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.019, 0.16, 32),
    mat
  );
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.015;
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.018, 0.095, 32),
    mat.clone()
  );
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -0.112;
  group.add(body, tip);
  return group;
}

function createBullet(
  scene: THREE.Scene,
  start: THREE.Vector3,
  end: THREE.Vector3,
  cinematic: boolean,
  speed: number,
  weapon: WeaponEntry,
  ammoTemplates: AmmoTemplates
) {
  const dir = end.clone().sub(start).normalize();
  const right = new THREE.Vector3(1, 0, 0);
  const inside = start.clone().addScaledVector(dir, -0.53);
  const nineMm = isNineMmWeapon(weapon);
  const longGun = usesRifleCinematic(weapon);
  const shotgun = weapon.weaponClass === 'shotgun';
  const root = new THREE.Group();
  const spinGroup = new THREE.Group();

  let visual: THREE.Object3D;
  if (nineMm) {
    visual = cloneRenderable(ammoTemplates.bullet);
    visual.scale.multiplyScalar(cinematic ? 1.08 : 1);
    orientBulletTipForward(visual);
  } else {
    visual = makePointedRifleBullet(longGun, shotgun, cinematic);
  }

  spinGroup.add(visual);
  root.add(spinGroup);
  alignToDirection(root, dir);
  root.position.copy(cinematic && nineMm ? inside : start);

  const length = Math.min(1.2, start.distanceTo(end));
  const trail = new THREE.Mesh(
    new THREE.CylinderGeometry(
      nineMm ? 0.005 : 0.007,
      nineMm ? 0.005 : 0.007,
      length,
      8
    ),
    new THREE.MeshBasicMaterial({
      color: nineMm ? '#e8fcff' : '#ffb84d',
      transparent: true,
      opacity: nineMm ? 0.38 : 0.58,
      depthWrite: false,
      blending: nineMm ? THREE.AdditiveBlending : THREE.NormalBlending
    })
  );
  trail.position.copy(start);
  trail.rotation.x = Math.PI / 2;
  const wake = nineMm || longGun ? makeWake() : null;
  if (wake) {
    wake.position.copy(root.position);
    wake.quaternion.copy(root.quaternion);
  }

  scene.add(root, trail);
  if (wake) scene.add(wake);

  return {
    root,
    spinGroup,
    trail,
    wake,
    start,
    end,
    muzzle: start.clone(),
    inside,
    dir,
    right,
    pos: root.position.clone(),
    t: 0,
    age: 0,
    speed: cinematic ? (nineMm ? 0.48 : longGun ? 0.62 : speed) : speed,
    spin: 0,
    cinematic,
    launched: !(cinematic && nineMm),
    prelaunch: nineMm ? PRELAUNCH : 0,
    life: cinematic ? (nineMm ? 8.5 : longGun ? 6.2 : 4.2) : 1.2,
    flightQuat: root.quaternion.clone(),
    impacted: false,
    impactAge: 0
  } as BulletRuntime;
}

function createShell(
  scene: THREE.Scene,
  position: THREE.Vector3,
  power: number,
  weapon: WeaponEntry,
  ammoTemplates: AmmoTemplates,
  dir = new THREE.Vector3(0, 0, -1),
  right = new THREE.Vector3(1, 0, 0),
  up = new THREE.Vector3(0, 1, 0),
  cinematic = false
) {
  const nineMm = isNineMmWeapon(weapon);
  let root: THREE.Object3D;
  if (nineMm) {
    root = cloneRenderable(ammoTemplates.shell);
    root.scale.multiplyScalar(cinematic ? 3 : 2.2);
  } else {
    const shotgun = weapon.weaponClass === 'shotgun';
    const longGun = usesRifleCinematic(weapon);
    const shellRadius = shotgun ? 0.04 : longGun ? 0.024 : 0.026;
    const shellLength = shotgun ? 0.22 : longGun ? 0.24 : 0.145;
    root = new THREE.Mesh(
      new THREE.CylinderGeometry(shellRadius, shellRadius, shellLength, 18),
      new THREE.MeshStandardMaterial({
        color: shotgun ? '#8b1e24' : '#d0a044',
        roughness: shotgun ? 0.36 : 0.34,
        metalness: shotgun ? 0.46 : 0.92
      })
    );
    root.rotation.z = Math.PI / 2;
  }

  const shellStart = position
    .clone()
    .addScaledVector(right, -0.1)
    .addScaledVector(up, -0.01)
    .addScaledVector(dir, 0.02);
  const shellOut = position
    .clone()
    .addScaledVector(right, 0.5 * power)
    .addScaledVector(up, 0.22 * power)
    .addScaledVector(dir, 0.08);
  root.position.copy(cinematic && nineMm ? shellStart : shellOut);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) mesh.castShadow = true;
  });
  scene.add(root);

  return {
    root,
    pos: root.position.clone(),
    start: shellStart,
    end: shellOut,
    vel: right
      .clone()
      .multiplyScalar(1.25 * power)
      .add(up.clone().multiplyScalar(0.82 * power))
      .add(dir.clone().multiplyScalar(0.12)),
    spin: new THREE.Vector3(
      4 + Math.random() * 2,
      6 + Math.random() * 2,
      4 + Math.random() * 2
    ),
    life: nineMm ? 45 : 24,
    age: 0,
    launched: !(cinematic && nineMm),
    grounded: false,
    hitPlayed: false,
    pre: nineMm ? 0.18 : 0
  } as ShellRuntime;
}

function createFallbackSecurityCamera() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#c7c9cc',
    roughness: 0.58,
    metalness: 0.5
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: '#05070a',
    roughness: 0.18,
    metalness: 0.2,
    emissive: '#0f172a',
    emissiveIntensity: 0.25
  });

  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.22, 0.64),
    bodyMat
  );
  housing.position.z = -0.12;
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.045, 0.74),
    bodyMat
  );
  hood.position.set(0, 0.13, -0.12);
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.055, 24),
    lensMat
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.z = -0.47;
  const mount = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.42, 16),
    bodyMat
  );
  mount.rotation.z = Math.PI / 2;
  mount.position.set(0, 0, 0.34);
  const wallPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.36, 0.04),
    bodyMat
  );
  wallPlate.position.z = 0.58;

  group.add(housing, hood, lens, mount, wallPlate);
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return group;
}

function addBox(
  scene: THREE.Scene,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: THREE.Vector3,
  scale = new THREE.Vector3(1, 1, 1),
  rotation = new THREE.Euler()
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.scale.copy(scale);
  mesh.rotation.copy(rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addDoorFrame(
  scene: THREE.Scene,
  x: number,
  z: number,
  wallMat: THREE.Material,
  metalMat: THREE.Material,
  label: string
) {
  const jambGeo = new THREE.BoxGeometry(0.14, 2.45, 0.16);
  addBox(scene, jambGeo, wallMat, new THREE.Vector3(x - 0.62, 1.23, z));
  addBox(scene, jambGeo, wallMat, new THREE.Vector3(x + 0.62, 1.23, z));
  addBox(
    scene,
    new THREE.BoxGeometry(1.38, 0.16, 0.16),
    wallMat,
    new THREE.Vector3(x, 2.52, z)
  );
  const door = addBox(
    scene,
    new THREE.BoxGeometry(1.08, 2.15, 0.08),
    metalMat,
    new THREE.Vector3(x + 0.28, 1.1, z + 0.12),
    new THREE.Vector3(1, 1, 1),
    new THREE.Euler(0, 0.42, 0)
  );
  door.name = label;
  return door;
}

function addScenarioTrainingGeometry(
  scene: THREE.Scene,
  rangeConfig: (typeof RANGE_DISTANCE_CONFIG)[RangeDistance],
  wallMat: THREE.Material,
  laneMat: THREE.Material,
  tableMat: THREE.Material,
  metalMat: THREE.Material,
  forestMat: THREE.Material,
  plasterMat: THREE.Material,
  asphaltMat: THREE.Material
) {
  const sceneType = rangeConfig.scene;

  if (sceneType === 'swat') {
    for (let room = 0; room < 3; room += 1) {
      const z = -8.4 - room * 6.4;
      addBox(
        scene,
        new THREE.BoxGeometry(13.0, 0.14, 0.22),
        plasterMat,
        new THREE.Vector3(0, 2.45, z)
      );
      addBox(
        scene,
        new THREE.BoxGeometry(0.18, 2.35, 5.6),
        plasterMat,
        new THREE.Vector3(-3.1, 1.18, z - 2.65)
      );
      addBox(
        scene,
        new THREE.BoxGeometry(0.18, 2.35, 5.6),
        plasterMat,
        new THREE.Vector3(3.1, 1.18, z - 2.65)
      );
      addDoorFrame(
        scene,
        -1.2,
        z,
        plasterMat,
        metalMat,
        `SWAT close-door ${room + 1}A`
      );
      addDoorFrame(
        scene,
        1.2,
        z - 2.8,
        plasterMat,
        metalMat,
        `SWAT close-door ${room + 1}B`
      );
      addBox(
        scene,
        new THREE.BoxGeometry(1.4, 0.9, 0.9),
        tableMat,
        new THREE.Vector3(-5.05, 0.45, z - 2.2)
      );
      addBox(
        scene,
        new THREE.BoxGeometry(1.1, 1.2, 0.65),
        laneMat,
        new THREE.Vector3(5.05, 0.6, z - 3.3)
      );
    }
    return;
  }

  if (sceneType === 'nature') {
    const outdoorGround = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 78),
      forestMat
    );
    outdoorGround.rotation.x = -Math.PI / 2;
    outdoorGround.position.set(0, 0.011, -25);
    outdoorGround.receiveShadow = true;
    scene.add(outdoorGround);

    for (let i = 0; i < 14; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -4 - i * 3.8;
      addBox(
        scene,
        new THREE.CylinderGeometry(0.18, 0.28, 2.4, 12),
        tableMat,
        new THREE.Vector3(side * (7.6 + (i % 3) * 1.1), 1.2, z)
      );
      addBox(
        scene,
        new THREE.ConeGeometry(1.3, 3.1, 10),
        laneMat,
        new THREE.Vector3(side * (7.6 + (i % 3) * 1.1), 3.35, z)
      );
    }

    for (let i = 0; i < 7; i += 1) {
      addBox(
        scene,
        new THREE.BoxGeometry(1.75, 0.75, 0.55),
        metalMat,
        new THREE.Vector3(
          -6.1 + i * 2.0,
          0.38,
          rangeConfig.targetZ + 4.6 + (i % 2) * 0.75
        )
      );
    }
    return;
  }

  if (sceneType === 'moving') {
    const asphaltStrip = new THREE.Mesh(
      new THREE.PlaneGeometry(15.8, 62),
      asphaltMat
    );
    asphaltStrip.rotation.x = -Math.PI / 2;
    asphaltStrip.position.set(0, 0.016, -18.5);
    asphaltStrip.receiveShadow = true;
    scene.add(asphaltStrip);

    for (let i = 0; i < 5; i += 1) {
      const z = -8 - i * 5.4;
      addBox(
        scene,
        new THREE.BoxGeometry(13.4, 0.12, 0.12),
        metalMat,
        new THREE.Vector3(0, 2.96, z)
      );
      addBox(
        scene,
        new THREE.BoxGeometry(0.12, 0.42, 0.12),
        metalMat,
        new THREE.Vector3(-6.1, 2.76, z)
      );
      addBox(
        scene,
        new THREE.BoxGeometry(0.12, 0.42, 0.12),
        metalMat,
        new THREE.Vector3(6.1, 2.76, z)
      );
    }
  }
}

function addPolyHavenProp(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  url: string,
  position: THREE.Vector3,
  length: number,
  yaw = 0,
  fallback?: THREE.Object3D,
  isDisposed: () => boolean = () => false
) {
  const slot = fallback ?? new THREE.Group();
  slot.position.copy(position);
  slot.rotation.y = yaw;
  if (fallback) scene.add(slot);

  void loadGLTF('Poly Haven training prop', [url])
    .then((gltf) => {
      if (isDisposed()) return;
      const prop = cloneScene(gltf.scene);
      configureModel(prop, renderer);
      normalizeToLength(prop, length);
      groundObject(prop, 0);
      prop.position.copy(position);
      prop.rotation.y = yaw;
      if (fallback) {
        scene.remove(slot);
        disposeObject(slot);
      }
      scene.add(prop);
    })
    .catch((error) => {
      if (!isDisposed())
        console.warn(
          'Poly Haven prop failed, keeping procedural fallback:',
          url,
          error
        );
    });
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!(mesh as any).isMesh && !(mesh as any).isSkinnedMesh) return;
    mesh.geometry?.dispose?.();
    const materials = Array.isArray((mesh as any).material)
      ? (mesh as any).material
      : (mesh as any).material
        ? [(mesh as any).material]
        : [];
    materials.forEach((mat: any) => mat?.dispose?.());
  });
}

export default function ShootingRange() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [phase, setPhase] = useState<GamePhase>('loading');
  const [viewMode, setViewMode] = useState<ViewMode>('tables');
  const [status, setStatus] = useState('Loading...');
  const [pickTimer, setPickTimer] = useState(PICK_SECONDS);
  const [selectedWeapon, setSelectedWeapon] = useState(0);
  const [ammo, setAmmo] = useState(STATS[WEAPONS[0].weaponClass].mag);
  const [laneScores, setLaneScores] = useState([0, 0, 0, 0]);
  const [shotsLeft, setShotsLeft] = useState([
    SHOTS_PER_PLAYER,
    SHOTS_PER_PLAYER,
    SHOTS_PER_PLAYER,
    SHOTS_PER_PLAYER
  ]);
  const [winnerText, setWinnerText] = useState('');
  const [userLane, setUserLane] = useState(USER_LANE);
  const [lastHitText, setLastHitText] = useState('');

  const queryConfig = useMemo(() => {
    if (typeof window === 'undefined')
      return {
        mode: 'ai' as MatchMode,
        playerCount: LANE_COUNT,
        playerName: 'Player',
        playerFlag: '',
        aiFlag: '',
        distance: 'standard' as RangeDistance
      };
    const params = new URLSearchParams(window.location.search);
    const parsedPlayers = Number(params.get('players') || LANE_COUNT);
    const requestedDistance = params.get('distance') as RangeDistance | null;
    const distance: RangeDistance =
      requestedDistance && requestedDistance in RANGE_DISTANCE_CONFIG
        ? requestedDistance
        : 'standard';
    return {
      mode:
        params.get('mode') === 'online'
          ? ('online' as MatchMode)
          : ('ai' as MatchMode),
      playerCount: Math.min(
        LANE_COUNT,
        Math.max(2, Number.isFinite(parsedPlayers) ? parsedPlayers : LANE_COUNT)
      ),
      playerName: params.get('name') || 'Player',
      playerFlag: params.get('flag') || '',
      aiFlag: params.get('aiFlag') || '',
      distance
    };
  }, []);

  const phaseRef = useRef<GamePhase>('loading');
  const viewModeRef = useRef<ViewMode>('tables');
  const selectedWeaponRef = useRef(0);
  const ammoRef = useRef(STATS[WEAPONS[0].weaponClass].mag);
  const shotsLeftRef = useRef([
    SHOTS_PER_PLAYER,
    SHOTS_PER_PLAYER,
    SHOTS_PER_PLAYER,
    SHOTS_PER_PLAYER
  ]);
  const laneScoresRef = useRef([0, 0, 0, 0]);
  const userLaneRef = useRef(USER_LANE);
  const winnerLaneRef = useRef<number | null>(null);

  const aimRef = useRef(new THREE.Vector2(0, 0));
  const fireLockRef = useRef(0);
  const recoilRef = useRef(0);
  const reloadRef = useRef(false);
  const followUntilRef = useRef(0);

  const lanesRef = useRef<LaneRuntime[]>([]);
  const paperTargetsRef = useRef<PaperTargetRuntime[]>([]);
  const bulletsRef = useRef<BulletRuntime[]>([]);
  const shellsRef = useRef<ShellRuntime[]>([]);
  const shotEffectsRef = useRef<ShotEffectRuntime[]>([]);
  const weaponSourcesRef = useRef<(THREE.Object3D | null)[]>([]);
  const ammoTemplatesRef = useRef<AmmoTemplates | null>(null);
  const tableWeaponsRef = useRef<TableWeaponRuntime[]>([]);
  const pickTargetsRef = useRef<THREE.Object3D[]>([]);

  const actionsRef = useRef({
    fire: () => {},
    reload: () => {},
    next: () => {},
    prev: () => {},
    tables: () => {},
    range: () => {},
    restart: () => {},
    select: (_index: number) => {}
  });

  const selectedEntry = useMemo(
    () => WEAPONS[selectedWeapon],
    [selectedWeapon]
  );
  const selectedStats = useMemo(() => statsFor(selectedEntry), [selectedEntry]);
  const weaponIconUris = useMemo(
    () => WEAPONS.map((entry) => weaponIconDataUri(entry)),
    []
  );

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);
  useEffect(() => {
    selectedWeaponRef.current = selectedWeapon;
  }, [selectedWeapon]);
  useEffect(() => {
    ammoRef.current = ammo;
  }, [ammo]);

  function setPhaseSafe(next: GamePhase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function audioContext() {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    return Ctx ? new Ctx() : null;
  }

  function makeNoiseBuffer(ctx: AudioContext, seconds: number) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    return buffer;
  }

  function playShot(power: number, weapon?: WeaponEntry) {
    try {
      const ctx = audioContext();
      if (!ctx) return;
      const weaponClass = weapon?.weaponClass ?? 'pistol';
      const longGun = weaponClass === 'rifle' || weaponClass === 'sniper';
      const shotgun = weaponClass === 'shotgun';
      const smg = weaponClass === 'smg';
      const duration = shotgun ? 0.34 : longGun ? 0.24 : smg ? 0.13 : 0.16;

      const noise = ctx.createBufferSource();
      noise.buffer = makeNoiseBuffer(ctx, duration);
      const crackFilter = ctx.createBiquadFilter();
      crackFilter.type = 'bandpass';
      crackFilter.frequency.setValueAtTime(
        longGun ? 1850 : shotgun ? 720 : 1250,
        ctx.currentTime
      );
      crackFilter.Q.setValueAtTime(longGun ? 1.9 : 1.25, ctx.currentTime);
      const crackGain = ctx.createGain();
      crackGain.gain.setValueAtTime(
        (shotgun ? 0.42 : longGun ? 0.34 : 0.24) * power,
        ctx.currentTime
      );
      crackGain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + duration
      );
      noise.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(ctx.destination);

      const thump = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thump.type = shotgun ? 'sawtooth' : 'triangle';
      thump.frequency.setValueAtTime(
        shotgun ? 82 : longGun ? 118 : 150,
        ctx.currentTime
      );
      thump.frequency.exponentialRampToValueAtTime(
        shotgun ? 31 : 42,
        ctx.currentTime + duration
      );
      thumpGain.gain.setValueAtTime(
        (shotgun ? 0.22 : 0.14) * power,
        ctx.currentTime
      );
      thumpGain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + duration * 0.9
      );
      thump.connect(thumpGain);
      thumpGain.connect(ctx.destination);

      const metal = ctx.createOscillator();
      const metalGain = ctx.createGain();
      metal.type = 'square';
      metal.frequency.setValueAtTime(
        longGun ? 510 : 390,
        ctx.currentTime + 0.018
      );
      metalGain.gain.setValueAtTime(0.025 * power, ctx.currentTime + 0.018);
      metalGain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.09
      );
      metal.connect(metalGain);
      metalGain.connect(ctx.destination);

      noise.start();
      thump.start();
      metal.start(ctx.currentTime + 0.018);
      noise.stop(ctx.currentTime + duration);
      thump.stop(ctx.currentTime + duration);
      metal.stop(ctx.currentTime + 0.11);
    } catch {}
  }

  function playShellImpact(power = 1) {
    try {
      const ctx = audioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [1480, 2350, 3260].forEach((frequency, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(
          frequency + Math.random() * 140,
          now + index * 0.012
        );
        gain.gain.setValueAtTime(
          (0.035 * power) / (index + 1),
          now + index * 0.012
        );
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          now + 0.18 + index * 0.035
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + index * 0.012);
        osc.stop(now + 0.22 + index * 0.035);
      });
    } catch {}
  }

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let raf = 0;
    let pickInterval: number | null = null;
    const rangeConfig = RANGE_DISTANCE_CONFIG[queryConfig.distance];
    const activeTargetZ = rangeConfig.targetZ;

    ammoTemplatesRef.current = createFallbackAmmoTemplates();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#111827');
    scene.fog = new THREE.Fog(
      '#111827',
      18,
      rangeConfig.scene === 'nature' ? 118 : 86
    );

    const camera = new THREE.PerspectiveCamera(
      62,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.05,
      200
    );
    camera.position.set(
      LANE_X[USER_LANE] + OVER_SHOULDER_OFFSET.x,
      OVER_SHOULDER_OFFSET.y,
      OVER_SHOULDER_OFFSET.z
    );
    camera.lookAt(
      new THREE.Vector3(
        LANE_X[USER_LANE] + OVER_SHOULDER_LOOK.x,
        OVER_SHOULDER_LOOK.y,
        OVER_SHOULDER_LOOK.z
      )
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.26;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    const hdr = new RGBELoader();
    hdr.setDataType(THREE.HalfFloatType);
    hdr.load(
      HDRI_URL,
      (map) => {
        map.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = map;
      },
      undefined,
      () => {
        console.warn('HDRI failed');
      }
    );

    scene.add(new THREE.AmbientLight(0xa8c6ff, 0.54));
    scene.add(new THREE.HemisphereLight(0xe7f2ff, 0x33271d, 1.05));

    const keyLight = new THREE.DirectionalLight(0xffffff, 4.4);
    keyLight.position.set(8, 10, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x9cc8ff, 0.72);
    fillLight.position.set(-7, 5, -6);
    scene.add(fillLight);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    const servicePistolTextureMaps =
      makeServicePistolTextureMaps(textureLoader);
    ammoTemplatesRef.current = createFallbackAmmoTemplates(
      servicePistolTextureMaps
    );
    const floorMat = makePbrMaterial(
      textureLoader,
      TEXTURES.floor,
      [7, 20],
      '#5b5e63',
      0.02
    );
    const wallMat = makePbrMaterial(
      textureLoader,
      TEXTURES.wall,
      [4, 10],
      '#7b786e',
      0.03
    );
    const laneMat = makePbrMaterial(
      textureLoader,
      TEXTURES.metal,
      [3, 8],
      '#202833',
      1
    );
    const tableMat = makePbrMaterial(
      textureLoader,
      TEXTURES.table,
      [2, 1],
      '#0d1117',
      0.08
    );
    const metalMat = makePbrMaterial(
      textureLoader,
      TEXTURES.metal,
      [2, 6],
      '#48515a',
      1
    );
    const forestMat = makePbrMaterial(
      textureLoader,
      TEXTURES.forest,
      [8, 18],
      '#36533b',
      0.01
    );
    const plasterMat = makePbrMaterial(
      textureLoader,
      TEXTURES.plaster,
      [5, 3],
      '#b7b0a4',
      0.01
    );
    const asphaltMat = makePbrMaterial(
      textureLoader,
      TEXTURES.asphalt,
      [5, 16],
      '#2d3034',
      0.02
    );

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 68), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = rangeConfig.scene === 'nature' ? -20 : -18;
    floor.receiveShadow = true;
    scene.add(floor);

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.25,
        4.2,
        rangeConfig.scene === 'nature' ? 22 : 62
      ),
      wallMat
    );
    leftWall.position.set(-7.6, 2.1, rangeConfig.scene === 'nature' ? -3 : -18);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = leftWall.clone();
    rightWall.position.x = 7.6;
    scene.add(rightWall);

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 6.2, 0.25),
      wallMat
    );
    backWall.position.set(0, 3.05, activeTargetZ - 10.4);
    backWall.receiveShadow = true;
    scene.add(backWall);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.2, 62), wallMat);
    roof.position.set(0, 5.2, -18);
    roof.receiveShadow = true;
    roof.castShadow = true;
    roof.visible = rangeConfig.scene !== 'nature';
    scene.add(roof);

    const darkBackstop = new THREE.Mesh(
      new THREE.BoxGeometry(14, 2.6, 1.2),
      laneMat
    );
    darkBackstop.position.set(0, 1.3, activeTargetZ - 8.9);
    darkBackstop.rotation.x = -0.25;
    darkBackstop.receiveShadow = true;
    darkBackstop.castShadow = true;
    scene.add(darkBackstop);

    addScenarioTrainingGeometry(
      scene,
      rangeConfig,
      wallMat,
      laneMat,
      tableMat,
      metalMat,
      forestMat,
      plasterMat,
      asphaltMat
    );

    const propFallbackMat = new THREE.MeshStandardMaterial({
      color: '#8b5e34',
      roughness: 0.78,
      metalness: 0.08
    });
    [-5.7, 5.7, -3.2, 3.2].forEach((x, index) => {
      const crateFallback = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.72, 0.78),
        propFallbackMat.clone()
      );
      addPolyHavenProp(
        scene,
        renderer,
        POLYHAVEN_ASSETS.woodenCrate02,
        new THREE.Vector3(x, 0, -7.5 - index * 5.4),
        1.15,
        index * 0.5,
        crateFallback,
        () => disposed
      );
    });

    if (rangeConfig.scene === 'nature') {
      [-8.2, 8.2, -9.6, 9.6].forEach((x, index) => {
        addPolyHavenProp(
          scene,
          renderer,
          POLYHAVEN_ASSETS.firTree01,
          new THREE.Vector3(x, 0, -10 - index * 8.2),
          6.2 + (index % 2) * 1.2,
          index * 0.45,
          undefined,
          () => disposed
        );
      });
      [-4.5, 0, 4.5].forEach((x, index) => {
        addPolyHavenProp(
          scene,
          renderer,
          POLYHAVEN_ASSETS.treeStump01,
          new THREE.Vector3(x, 0, rangeConfig.targetZ + 8 + index * 1.1),
          1.35,
          index * 0.7,
          undefined,
          () => disposed
        );
      });
    }

    const securityCameraAnchors = [
      {
        position: new THREE.Vector3(-7.18, 4.64, 2.15),
        lookAt: new THREE.Vector3(-3.9, 2.0, -5.8)
      },
      {
        position: new THREE.Vector3(7.18, 4.64, 2.15),
        lookAt: new THREE.Vector3(3.9, 2.0, -5.8)
      },
      {
        position: new THREE.Vector3(-7.18, 4.64, activeTargetZ - 9.75),
        lookAt: new THREE.Vector3(-3.9, 1.65, activeTargetZ + 1.7)
      },
      {
        position: new THREE.Vector3(7.18, 4.64, activeTargetZ - 9.75),
        lookAt: new THREE.Vector3(3.9, 1.65, activeTargetZ + 1.7)
      }
    ];
    const securityCameras: {
      root: THREE.Object3D;
      position: THREE.Vector3;
      lookAt: THREE.Vector3;
    }[] = securityCameraAnchors.map(({ position, lookAt }) => {
      const cameraObject = createFallbackSecurityCamera();
      cameraObject.position.copy(position);
      cameraObject.lookAt(lookAt);
      cameraObject.scale.setScalar(0.72);
      scene.add(cameraObject);
      return { root: cameraObject, position, lookAt };
    });

    void loadGLTF('Security Camera 01', [POLYHAVEN_ASSETS.securityCamera01])
      .then((gltf) => {
        if (disposed) return;
        securityCameras.forEach((cameraSlot) => {
          const loadedCamera = cloneScene(gltf.scene);
          configureModel(loadedCamera, renderer);
          normalizeToLength(loadedCamera, 0.58);
          centerRoot(loadedCamera);
          loadedCamera.position.copy(cameraSlot.position);
          loadedCamera.lookAt(cameraSlot.lookAt);
          scene.remove(cameraSlot.root);
          disposeObject(cameraSlot.root);
          scene.add(loadedCamera);
          cameraSlot.root = loadedCamera;
        });
      })
      .catch((error) => {
        console.warn('Security Camera 01 failed, keeping fallback:', error);
      });

    for (let lane = 0; lane < LANE_COUNT; lane += 1) {
      const x = LANE_X[lane];

      const boothBench = new THREE.Mesh(
        new THREE.BoxGeometry(2.55, 0.16, 1.15),
        tableMat
      );
      boothBench.position.set(x, TABLE_TOP_Y, TABLE_Z);
      boothBench.castShadow = true;
      boothBench.receiveShadow = true;
      scene.add(boothBench);

      const boothShelf = new THREE.Mesh(
        new THREE.BoxGeometry(2.55, 0.11, 0.78),
        metalMat
      );
      boothShelf.position.set(x, 0.55, TABLE_Z);
      boothShelf.castShadow = true;
      boothShelf.receiveShadow = true;
      scene.add(boothShelf);

      const leftDivider = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 2.15, 1.26),
        laneMat
      );
      leftDivider.position.set(x - 1.48, 1.36, TABLE_Z);
      leftDivider.castShadow = true;
      leftDivider.receiveShadow = true;
      scene.add(leftDivider);

      const rightDivider = leftDivider.clone();
      rightDivider.position.x = x + 1.48;
      scene.add(rightDivider);

      const boothHead = new THREE.Mesh(
        new THREE.BoxGeometry(2.55, 0.14, 0.95),
        metalMat
      );
      boothHead.position.set(x, 4.45, 1.1);
      boothHead.castShadow = true;
      scene.add(boothHead);

      const targetRail = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 50),
        metalMat
      );
      targetRail.position.set(x, 4.72, -16.6);
      targetRail.castShadow = true;
      scene.add(targetRail);

      const leftLine = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.012, 48),
        new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.8 })
      );
      leftLine.position.set(x - 1.48, 0.02, -16.4);
      scene.add(leftLine);

      const rightLine = leftLine.clone();
      rightLine.position.x = x + 1.48;
      scene.add(rightLine);

      const redCenter = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.012, 48),
        new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.8 })
      );
      redCenter.position.set(x, 0.022, -16.2);
      scene.add(redCenter);

      const yellowFireLine = new THREE.Mesh(
        new THREE.BoxGeometry(2.45, 0.014, 0.12),
        new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.82 })
      );
      yellowFireLine.position.set(x, 0.024, 1.95);
      scene.add(yellowFireLine);
    }

    for (let i = 0; i < 7; i += 1) {
      const z = 1.6 - i * 6.3;
      const lampBar = new THREE.Mesh(
        new THREE.BoxGeometry(13.8, 0.08, 0.28),
        metalMat
      );
      lampBar.position.set(0, 4.56, z);
      lampBar.castShadow = true;
      scene.add(lampBar);

      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(12.7, 0.02, 0.12),
        new THREE.MeshBasicMaterial({ color: '#eef6ff' })
      );
      glow.position.set(0, 4.49, z);
      scene.add(glow);

      const light = new THREE.PointLight(0xf7fbff, 4.2, 12, 1.4);
      light.position.set(0, 4.34, z);
      scene.add(light);
    }

    const targets = Array.from({ length: LANE_COUNT }, (_, i) =>
      createPaperTarget(
        i,
        activeTargetZ,
        rangeConfig.targetStyle,
        rangeConfig.moving
      )
    );
    targets.forEach((t) => scene.add(t.root));
    paperTargetsRef.current = targets;

    const tpcCoinMaterial = new THREE.MeshStandardMaterial({
      color: '#facc15',
      emissive: '#f59e0b',
      emissiveIntensity: 0.48,
      roughness: 0.32,
      metalness: 0.8
    });
    const tpcCoins = Array.from({ length: 44 }, () => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.025, 24),
        tpcCoinMaterial.clone()
      );
      mesh.visible = false;
      mesh.castShadow = true;
      scene.add(mesh);
      return { mesh, velocity: new THREE.Vector3(), life: 0 };
    });

    const raycaster = new THREE.Raycaster();
    const shotRaycaster = new THREE.Raycaster();
    const crosshairNdc = new THREE.Vector2(0, 0);
    const pointer = new THREE.Vector2();

    function buildCharacters() {
      const randomizedLanes = shuffle([0, 1, 2, 3]);
      const humanLaneIndex = randomizedLanes[0];
      userLaneRef.current = humanLaneIndex;
      setUserLane(humanLaneIndex);
      const lanes: LaneRuntime[] = [];

      for (
        let playerId = 0;
        playerId < queryConfig.playerCount;
        playerId += 1
      ) {
        const laneIndex = randomizedLanes[playerId];
        const x = LANE_X[laneIndex];
        const root = new THREE.Group();
        root.position.set(x, 0, 3.05);
        scene.add(root);

        const spec = CHARACTERS[playerId];
        const visual = makeFallbackCharacter(spec.fallbackColor);
        visual.rotation.y = Math.PI;
        root.add(visual);

        const weaponMount = new THREE.Group();
        weaponMount.position.set(0.34, 1.27, -0.12);
        weaponMount.rotation.set(0.02, -0.03, 0.1);
        root.add(weaponMount);

        lanes[laneIndex] = {
          laneIndex,
          playerId,
          controller: playerId === 0 ? 'USER' : 'AI',
          root,
          visual,
          mixer: null,
          weaponMount,
          tableGroup: new THREE.Group(),
          heldWeapon: null,
          muzzle: null,
          shellPort: null,
          aiNextShotAt: 0,
          aiAim: new THREE.Vector2(0, 0),
          activeWeaponIndex: laneIndex,
          pickupLift: 0
        };
      }

      lanesRef.current = lanes;

      CHARACTERS.forEach((spec, playerId) => {
        void loadGLTF(spec.name, spec.urls)
          .then((loaded) => {
            if (disposed) return;
            const lane = lanesRef.current.find(
              (candidate) => candidate?.playerId === playerId
            );
            if (!lane) return;

            const loadedVisual = cloneScene(loaded.scene);
            configureModel(loadedVisual, renderer);
            normalizeToLength(loadedVisual, spec.scale);
            groundObject(loadedVisual, 0);
            loadedVisual.rotation.y = spec.yaw;

            if (lane.visual) {
              lane.root.remove(lane.visual);
              disposeObject(lane.visual);
            }
            lane.root.add(loadedVisual);
            lane.visual = loadedVisual;

            if (loaded.animations?.length) {
              const mixer = new THREE.AnimationMixer(loadedVisual);
              const idle =
                loaded.animations.find((a) => /idle/i.test(a.name)) ||
                loaded.animations.find((a) => /walk|run/i.test(a.name)) ||
                loaded.animations[0];
              mixer.clipAction(idle).play();
              lane.mixer = mixer;
            }
          })
          .catch((error) => {
            console.warn(
              'Character model failed, keeping fallback:',
              spec.name,
              error
            );
          });
      });
    }

    function setHeldWeapon(
      laneIndex: number,
      weaponIndex: number,
      lift = true
    ) {
      const lane = lanesRef.current[laneIndex];
      const source = weaponSourcesRef.current[weaponIndex];
      if (!lane || !source) return;

      if (lane.heldWeapon) {
        lane.weaponMount.remove(lane.heldWeapon);
        disposeObject(lane.heldWeapon);
      }

      const entry = WEAPONS[weaponIndex];
      const nineMm = isNineMmWeapon(entry);
      const held = cloneRenderable(source);
      configureModel(held, renderer);
      normalizeToLength(held, nineMm ? 1.95 : 1.14);
      if (nineMm) {
        orientWeaponForward(held);
        held.rotation.y += Math.PI / 2;
        held.position.set(0, -0.12, -0.02);
      } else {
        orientWeaponForward(held);
        held.position.set(-0.03, -0.02, -0.2);
        held.rotation.x += -0.05;
        held.rotation.z += 0.02;
      }

      lane.weaponMount.add(held);
      lane.heldWeapon = held;
      lane.activeWeaponIndex = weaponIndex;
      lane.pickupLift = lift ? 1 : 0;

      const muzzle = new THREE.Object3D();
      muzzle.position.copy(
        nineMm
          ? SERVICE_PISTOL_AIM.muzzle
          : new THREE.Vector3(0.02, 0.02, -0.95)
      );
      held.add(muzzle);

      const shellPort = new THREE.Object3D();
      shellPort.position.copy(
        nineMm
          ? SERVICE_PISTOL_AIM.shellPort
          : new THREE.Vector3(0.12, 0.03, -0.42)
      );
      held.add(shellPort);

      lane.muzzle = muzzle;
      lane.shellPort = shellPort;

      if (laneIndex === userLaneRef.current) {
        selectedWeaponRef.current = weaponIndex;
        setSelectedWeapon(weaponIndex);
        const st = statsFor(WEAPONS[weaponIndex]);
        ammoRef.current = st.mag;
        setAmmo(st.mag);
      }
    }

    function highlightTableSelection() {
      tableWeaponsRef.current.forEach((tw) => {
        const selected =
          tw.laneIndex === userLaneRef.current &&
          tw.weaponIndex === selectedWeaponRef.current;
        tw.root.position.y = selected ? TABLE_TOP_Y + 0.05 : TABLE_TOP_Y + 0.03;
        (tw.card.material as THREE.MeshStandardMaterial).color.set(
          selected
            ? '#38506d'
            : tw.laneIndex === userLaneRef.current
              ? '#243042'
              : '#1c1c1c'
        );
      });
    }

    function loadWeaponsAndTables() {
      weaponSourcesRef.current = WEAPONS.map((entry) =>
        makeFallbackWeapon(entry)
      );
      tableWeaponsRef.current = [];
      pickTargetsRef.current = [];

      buildCharacters();

      const randomizedSlots = shuffle(
        WEAPONS.map((_, index) => ({
          tableIndex: index % LANE_COUNT,
          localIndex: Math.floor(index / LANE_COUNT)
        }))
      );

      WEAPONS.forEach((entry, index) => {
        const slot = randomizedSlots[index] ?? {
          tableIndex: index % LANE_COUNT,
          localIndex: Math.floor(index / LANE_COUNT)
        };
        const tableIndex = slot.tableIndex;
        const group = new THREE.Group();
        group.userData.pickWeaponIndex = index;

        const model = cloneScene(
          weaponSourcesRef.current[index] as THREE.Object3D
        );
        configureModel(model, renderer);
        normalizeToLength(model, 0.72);
        layWeaponFlatOnTable(model);
        group.add(model);

        const card = new THREE.Mesh(
          new THREE.BoxGeometry(1.08, 0.035, 0.5),
          new THREE.MeshStandardMaterial({
            color: '#1c1c1c',
            roughness: 0.84,
            metalness: 0.14
          })
        );
        card.position.y = -0.018;
        card.receiveShadow = true;
        group.add(card);

        const icon = new THREE.Mesh(
          new THREE.PlaneGeometry(0.42, 0.21),
          new THREE.MeshBasicMaterial({
            map: createWeaponIconTexture(entry),
            transparent: true,
            depthWrite: false
          })
        );
        icon.rotation.x = -Math.PI / 2;
        icon.position.set(0, 0.007, 0.17);
        group.add(icon);

        const localIndex = slot.localIndex;
        const col = localIndex % 2;
        const row = Math.floor(localIndex / 2);

        group.position.set(
          LANE_X[tableIndex] + (col === 0 ? -0.46 : 0.46),
          TABLE_TOP_Y + 0.03,
          TABLE_Z - 0.28 + row * 0.25
        );

        scene.add(group);
        tableWeaponsRef.current.push({
          root: group,
          card,
          model,
          weaponIndex: index,
          laneIndex: tableIndex
        });
        pickTargetsRef.current.push(group);

        void loadGLTF(entry.name, entry.urls)
          .then((gltf) => {
            if (disposed) return;
            configureModel(gltf.scene, renderer);
            if (entry.id === 'service-pistol') {
              ammoTemplatesRef.current = extractServicePistolAmmo(
                gltf.scene,
                servicePistolTextureMaps
              );
            }
            weaponSourcesRef.current[index] = gltf.scene;

            const tableWeapon = tableWeaponsRef.current.find(
              (tw) => tw.weaponIndex === index
            );
            if (tableWeapon) {
              tableWeapon.root.remove(tableWeapon.model);
              disposeObject(tableWeapon.model);

              const loadedTableModel = cloneScene(gltf.scene);
              configureModel(loadedTableModel, renderer);
              normalizeToLength(loadedTableModel, 0.72);
              layWeaponFlatOnTable(loadedTableModel);
              tableWeapon.root.add(loadedTableModel);
              tableWeapon.model = loadedTableModel;
            }

            lanesRef.current.forEach((lane) => {
              if (!lane || lane.activeWeaponIndex !== index) return;
              setHeldWeapon(lane.laneIndex, index, false);
            });
          })
          .catch((error) => {
            console.warn(
              'Weapon model failed, keeping fallback:',
              entry.name,
              error
            );
          });
      });

      const firstUserTableWeapon = tableWeaponIndicesForUser()[0] ?? 0;
      setHeldWeapon(userLaneRef.current, firstUserTableWeapon, false);
      highlightTableSelection();

      lanesRef.current.forEach((lane) => {
        if (!lane || lane.controller !== 'AI') return;
        const chosen = pickAiWeaponIndex(
          lane.playerId - 1,
          tableWeaponIndicesForLane(lane.laneIndex)
        );
        setHeldWeapon(lane.laneIndex, chosen, false);
      });

      startPickPhase();
    }

    function startPickPhase() {
      setPhaseSafe('pick');
      setViewMode('tables');
      setStatus('Pick a weapon from your lane table');
      setPickTimer(PICK_SECONDS);

      let left = PICK_SECONDS;

      if (pickInterval) window.clearInterval(pickInterval);

      pickInterval = window.setInterval(() => {
        left -= 1;
        setPickTimer(left);

        if (left > 0) {
          setStatus(`Pick a weapon from your lane table · ${left}s`);
        } else {
          if (pickInterval) window.clearInterval(pickInterval);
          pickInterval = null;
          startShootPhase();
        }
      }, 1000);

      lanesRef.current
        .filter((lane) => lane?.controller === 'AI')
        .forEach((lane, idx) => {
          window.setTimeout(
            () => {
              if (disposed || phaseRef.current !== 'pick') return;
              const aiPick = pickAiWeaponIndex(
                idx,
                tableWeaponIndicesForLane(lane.laneIndex)
              );
              setHeldWeapon(lane.laneIndex, aiPick, true);
            },
            850 + idx * 650
          );
        });
    }

    function startShootPhase() {
      setPhaseSafe('shoot');
      setViewMode('range');
      setStatus('Shoot phase started');

      const shots = Array.from({ length: LANE_COUNT }, (_, laneIndex) =>
        lanesRef.current[laneIndex] ? SHOTS_PER_PLAYER : 0
      );
      shotsLeftRef.current = shots;
      setShotsLeft([...shots]);

      const scores = [0, 0, 0, 0];
      laneScoresRef.current = scores;
      setLaneScores([...scores]);
      winnerLaneRef.current = null;
      setWinnerText('');
      setLastHitText('');

      paperTargetsRef.current.forEach((target) => {
        target.score = 0;
        target.hits = 0;
        target.holes.forEach((h) => {
          target.paper.remove(h.mesh);
          h.mesh.geometry.dispose();
          (h.mesh.material as THREE.Material).dispose();
        });
        target.holes = [];
        updateLabelSprite(
          target.labelSprite,
          `Lane ${target.laneIndex + 1} · 0`
        );
        (target.winnerRing.material as THREE.MeshBasicMaterial).opacity = 0;
      });

      lanesRef.current.forEach((lane, laneIndex) => {
        if (lane?.controller === 'AI') {
          lane.aiNextShotAt = performance.now() + 900 + laneIndex * 420;
        }
      });
    }

    function finishRound() {
      setPhaseSafe('results');
      setViewMode('results');

      const scores = laneScoresRef.current;
      const activeLaneIndexes = lanesRef.current
        .map((lane, index) => (lane ? index : -1))
        .filter((index) => index >= 0);
      const best = Math.max(...activeLaneIndexes.map((index) => scores[index]));
      const winnerLane =
        activeLaneIndexes.find((index) => scores[index] === best) ??
        userLaneRef.current;
      const winnerLaneRuntime = lanesRef.current[winnerLane];
      const winnerName =
        winnerLane === userLaneRef.current
          ? 'YOU'
          : `AI ${winnerLaneRuntime?.playerId ?? winnerLane}`;
      winnerLaneRef.current = winnerLane;

      setWinnerText(
        `Winner: ${winnerName} · Lane ${winnerLane + 1} · ${best} pts`
      );
      setStatus(`${winnerName} wins! Winner target reveal + TPC coin burst.`);

      tpcCoins.forEach((coin) => {
        coin.mesh.visible = true;
        coin.mesh.position.set(
          THREE.MathUtils.randFloatSpread(0.9),
          1.85 + THREE.MathUtils.randFloatSpread(0.42),
          -3.72 + THREE.MathUtils.randFloatSpread(0.35)
        );
        coin.mesh.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );
        coin.velocity.set(
          THREE.MathUtils.randFloatSpread(2.3),
          THREE.MathUtils.randFloat(1.65, 3.45),
          THREE.MathUtils.randFloat(-0.7, 1.45)
        );
        coin.life = 3.2 + Math.random() * 1.4;
      });

      paperTargetsRef.current.forEach((target, i) => {
        (target.winnerRing.material as THREE.MeshBasicMaterial).opacity =
          i === winnerLane ? 1 : 0;
        updateLabelSprite(
          target.labelSprite,
          `Lane ${i + 1} · ${target.score}`
        );
      });
    }

    function addLaneScore(laneIndex: number, points: number) {
      const next = [...laneScoresRef.current];
      next[laneIndex] += points;
      laneScoresRef.current = next;
      setLaneScores(next);

      const target = paperTargetsRef.current[laneIndex];
      if (target) {
        target.score = next[laneIndex];
        updateLabelSprite(
          target.labelSprite,
          `Lane ${laneIndex + 1} · ${target.score}`
        );
      }
    }

    function setShotCount(laneIndex: number, value: number) {
      const next = [...shotsLeftRef.current];
      next[laneIndex] = value;
      shotsLeftRef.current = next;
      setShotsLeft(next);
    }

    function scoreHit(local: THREE.Vector3) {
      const headDistance = Math.hypot(local.x, local.y - 0.46);
      if (headDistance < 0.14) return { points: 95, label: 'Head shot' };

      const heartDistance = Math.hypot(local.x, local.y - 0.08);
      if (heartDistance < 0.075) return { points: 100, label: 'Heart shot' };
      if (heartDistance < 0.13) return { points: 88, label: 'Center chest' };
      if (heartDistance < 0.2) return { points: 70, label: 'Inner ring' };
      if (heartDistance < 0.3) return { points: 48, label: 'Outer ring' };
      if (Math.abs(local.x) < 0.43 && local.y > -0.64 && local.y < 0.48)
        return { points: 20, label: 'Body hit' };
      return { points: 5, label: 'Paper edge' };
    }

    function addBulletHole(
      target: PaperTargetRuntime,
      localPoint: THREE.Vector3,
      points: number,
      label: string
    ) {
      const hole = createBulletHole(localPoint, points);
      target.paper.add(hole);
      target.holes.push({ mesh: hole, points, label });
      target.hits += 1;
      if (target.holes.length > 36) {
        const old = target.holes.shift();
        if (old) {
          target.paper.remove(old.mesh);
          old.mesh.geometry.dispose();
          (old.mesh.material as THREE.Material).dispose();
        }
      }
    }

    function resolveUserShotFromCrosshair(laneIndex: number) {
      const target = paperTargetsRef.current[laneIndex];
      target.paper.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);

      const planePoint = target.paper.getWorldPosition(new THREE.Vector3());
      const planeNormal = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(
          target.paper.getWorldQuaternion(new THREE.Quaternion())
        )
        .normalize();
      const targetPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        planeNormal,
        planePoint
      );
      shotRaycaster.setFromCamera(crosshairNdc, camera);

      const point = new THREE.Vector3();
      const intersects = shotRaycaster.ray.intersectPlane(targetPlane, point);
      if (!intersects) {
        return { point: planePoint, local: null, target };
      }

      const local = target.paper.worldToLocal(point.clone());
      local.z = 0;
      const onPaper =
        Math.abs(local.x) <= TARGET_HALF_WIDTH &&
        Math.abs(local.y) <= TARGET_HALF_HEIGHT;

      return { point, local: onPaper ? local : null, target };
    }

    function resolveShotForLane(
      laneIndex: number,
      spread: number,
      aiAim?: THREE.Vector2
    ) {
      const target = paperTargetsRef.current[laneIndex];
      const baseAim = aiAim ?? aimRef.current;
      const local = new THREE.Vector3(
        THREE.MathUtils.clamp(
          baseAim.x + THREE.MathUtils.randFloatSpread(spread),
          -1,
          1
        ) * TARGET_HALF_WIDTH,
        THREE.MathUtils.clamp(
          baseAim.y + THREE.MathUtils.randFloatSpread(spread),
          -1,
          1
        ) * TARGET_HALF_HEIGHT,
        0
      );
      const point = target.paper.localToWorld(local.clone());
      return { point, local, target };
    }

    function executeShot(laneIndex: number, isAI: boolean) {
      if (phaseRef.current !== 'shoot') return;
      if (shotsLeftRef.current[laneIndex] <= 0) return;

      const lane = lanesRef.current[laneIndex];
      if (!lane?.muzzle || !lane.shellPort) return;

      const weapon = WEAPONS[lane.activeWeaponIndex];
      const stats = statsFor(weapon);
      const now = performance.now();

      if (!isAI && now < fireLockRef.current) return;
      if (!isAI) fireLockRef.current = now + stats.fireDelay;

      if (!isAI && ammoRef.current <= 0) {
        setStatus('Reload first');
        return;
      }

      if (!isAI) {
        ammoRef.current -= 1;
        setAmmo(ammoRef.current);
      }

      setShotCount(laneIndex, shotsLeftRef.current[laneIndex] - 1);

      if (!isAI) {
        recoilRef.current = stats.recoil;
        followUntilRef.current =
          performance.now() +
          (isNineMmWeapon(weapon)
            ? 9000
            : usesRifleCinematic(weapon)
              ? 7000
              : 500);
      }

      playShot(Math.max(0.6, stats.recoil), weapon);
      lane.pickupLift = 0.35;

      const muzzlePos = new THREE.Vector3();
      lane.muzzle.getWorldPosition(muzzlePos);

      const shellPos = new THREE.Vector3();
      lane.shellPort.getWorldPosition(shellPos);
      const weaponQuat = lane.muzzle.getWorldQuaternion(new THREE.Quaternion());
      const muzzleDir = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(weaponQuat)
        .normalize();
      const weaponRight = new THREE.Vector3(1, 0, 0)
        .applyQuaternion(weaponQuat)
        .normalize();
      const weaponUp = new THREE.Vector3(0, 1, 0)
        .applyQuaternion(weaponQuat)
        .normalize();
      spawnMuzzleEffects(
        scene,
        muzzlePos,
        muzzleDir,
        shotEffectsRef.current,
        Math.max(0.8, stats.recoil)
      );
      const ammoTemplates =
        ammoTemplatesRef.current ?? createFallbackAmmoTemplates();
      const shotCinematic =
        !isAI && (isNineMmWeapon(weapon) || usesRifleCinematic(weapon));
      shellsRef.current.push(
        createShell(
          scene,
          shellPos,
          stats.shellPower,
          weapon,
          ammoTemplates,
          muzzleDir,
          weaponRight,
          weaponUp,
          shotCinematic
        )
      );
      while (shellsRef.current.length > 72) {
        const oldShell = shellsRef.current.shift();
        if (oldShell) {
          scene.remove(oldShell.root);
          disposeObject(oldShell.root);
        }
      }

      let bestPoints = 0;
      let bestLabel = 'Miss';
      const pelletCount = stats.fairPellets;

      for (let i = 0; i < pelletCount; i += 1) {
        const result = isAI
          ? resolveShotForLane(laneIndex, stats.spread * 1.08, lane.aiAim)
          : resolveUserShotFromCrosshair(laneIndex);
        const cinematic = shotCinematic && i === 0;
        bulletsRef.current.push(
          createBullet(
            scene,
            muzzlePos.clone(),
            result.point.clone(),
            cinematic,
            stats.bulletSpeed,
            weapon,
            ammoTemplates
          )
        );

        if (result.local) {
          const score = scoreHit(result.local);
          addBulletHole(result.target, result.local, score.points, score.label);
          if (score.points > bestPoints) {
            bestPoints = score.points;
            bestLabel = score.label;
          }
        } else if (!isAI) {
          bestLabel = 'Missed paper';
        }
      }

      addLaneScore(laneIndex, bestPoints);
      const shooterName =
        laneIndex === userLaneRef.current ? 'YOU' : `AI ${lane.playerId}`;
      setLastHitText(`${shooterName}: ${bestLabel} · +${bestPoints}`);
      setStatus(
        `${shooterName} fired ${weapon.shortName}: ${bestLabel} +${bestPoints}`
      );

      const allDone = shotsLeftRef.current.every((s) => s <= 0);
      if (allDone) {
        window.setTimeout(() => {
          if (!disposed) finishRound();
        }, 850);
      }
    }

    function fireUser() {
      if (phaseRef.current !== 'shoot') return;
      executeShot(userLaneRef.current, false);
    }

    function reloadUser() {
      if (phaseRef.current !== 'shoot' || reloadRef.current) return;
      const weapon = WEAPONS[selectedWeaponRef.current];
      const stats = statsFor(weapon);
      reloadRef.current = true;
      setStatus('Reloading...');
      window.setTimeout(() => {
        if (disposed) return;
        ammoRef.current = stats.mag;
        setAmmo(stats.mag);
        reloadRef.current = false;
        setStatus('Ready');
      }, stats.reloadMs);
    }

    function tableWeaponIndicesForLane(laneIndex: number) {
      const indices = tableWeaponsRef.current
        .slice()
        .filter((tw) => tw.laneIndex === laneIndex)
        .sort((a, b) =>
          a.root.position.z === b.root.position.z
            ? a.root.position.x - b.root.position.x
            : a.root.position.z - b.root.position.z
        )
        .map((tw) => tw.weaponIndex);
      return indices;
    }

    function tableWeaponIndicesForUser() {
      const laneWeapons = tableWeaponIndicesForLane(userLaneRef.current);
      return laneWeapons.length
        ? laneWeapons
        : WEAPONS.map((_, index) => index);
    }

    function canSwitchWeapons() {
      return phaseRef.current === 'pick' || phaseRef.current === 'shoot';
    }

    function switchToWeapon(weaponIndex: number, verb = 'Switched to') {
      if (!tableWeaponIndicesForUser().includes(weaponIndex)) {
        setStatus('That weapon is assigned to another lane');
        return;
      }
      selectedWeaponRef.current = weaponIndex;
      setSelectedWeapon(weaponIndex);
      setHeldWeapon(userLaneRef.current, weaponIndex, true);
      highlightTableSelection();
      setStatus(`${verb} ${WEAPONS[weaponIndex].shortName}`);
    }

    function nextWeapon() {
      if (!canSwitchWeapons()) return;
      const visibleOnTable = tableWeaponIndicesForUser();
      const currentSlot = visibleOnTable.indexOf(selectedWeaponRef.current);
      const next =
        visibleOnTable[
          (currentSlot + 1 + visibleOnTable.length) % visibleOnTable.length
        ];
      switchToWeapon(next);
    }

    function prevWeapon() {
      if (!canSwitchWeapons()) return;
      const visibleOnTable = tableWeaponIndicesForUser();
      const currentSlot = visibleOnTable.indexOf(selectedWeaponRef.current);
      const next =
        visibleOnTable[
          (currentSlot - 1 + visibleOnTable.length) % visibleOnTable.length
        ];
      switchToWeapon(next);
    }

    function pickWeapon(index: number) {
      if (phaseRef.current !== 'pick') return;
      if (!tableWeaponIndicesForUser().includes(index)) {
        setStatus('Pick only weapons from your lane table');
        return;
      }
      switchToWeapon(index, 'Picked');
    }

    function updateAI(now: number) {
      if (phaseRef.current !== 'shoot') return;
      lanesRef.current.forEach((lane) => {
        if (!lane || lane.controller !== 'AI') return;
        if (shotsLeftRef.current[lane.laneIndex] <= 0) return;
        if (now < lane.aiNextShotAt) return;

        const skill =
          lane.playerId === 1 ? 0.13 : lane.playerId === 2 ? 0.18 : 0.23;
        const targetPreference =
          Math.random() < 0.72
            ? new THREE.Vector2(0, 0.08 / TARGET_HALF_HEIGHT)
            : new THREE.Vector2(0, 0.46 / TARGET_HALF_HEIGHT);
        lane.aiAim.lerp(targetPreference, 0.68);
        lane.aiAim.x += THREE.MathUtils.randFloatSpread(skill);
        lane.aiAim.y += THREE.MathUtils.randFloatSpread(skill * 0.82);
        lane.aiAim.x = THREE.MathUtils.clamp(lane.aiAim.x, -0.82, 0.82);
        lane.aiAim.y = THREE.MathUtils.clamp(lane.aiAim.y, -0.7, 0.72);

        executeShot(lane.laneIndex, true);
        lane.aiNextShotAt = now + 850 + Math.random() * 800;
      });
    }

    void loadWeaponsAndTables();

    const activePointers = new Set<number>();
    const lastPointerById = new Map<number, THREE.Vector2>();

    function updateAim(event: PointerEvent, absolute = false) {
      const rect = renderer.domElement.getBoundingClientRect();
      const normalizedX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const normalizedY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      if (absolute) {
        aimRef.current.set(
          THREE.MathUtils.clamp(normalizedX * 0.72, -0.95, 0.95),
          THREE.MathUtils.clamp(normalizedY * 0.58, -0.7, 0.7)
        );
        return;
      }

      const previous = lastPointerById.get(event.pointerId);
      const dx = previous ? event.clientX - previous.x : event.movementX || 0;
      const dy = previous ? event.clientY - previous.y : event.movementY || 0;
      lastPointerById.set(
        event.pointerId,
        new THREE.Vector2(event.clientX, event.clientY)
      );

      const fineScale = event.shiftKey ? 0.00085 : 0.00185;
      aimRef.current.set(
        THREE.MathUtils.clamp(aimRef.current.x + dx * fineScale, -0.95, 0.95),
        THREE.MathUtils.clamp(aimRef.current.y - dy * fineScale, -0.7, 0.7)
      );
    }

    function tryPick(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickTargetsRef.current, true)[0];
      if (!hit) return false;

      let cur: THREE.Object3D | null = hit.object;
      while (cur) {
        if (typeof cur.userData.pickWeaponIndex === 'number') {
          pickWeapon(cur.userData.pickWeaponIndex);
          return true;
        }
        cur = cur.parent;
      }
      return false;
    }

    function onPointerDown(event: PointerEvent) {
      activePointers.add(event.pointerId);
      renderer.domElement.setPointerCapture?.(event.pointerId);
      lastPointerById.set(
        event.pointerId,
        new THREE.Vector2(event.clientX, event.clientY)
      );

      if (phaseRef.current === 'pick' && viewModeRef.current === 'tables') {
        tryPick(event);
      } else if (viewModeRef.current !== 'range') {
        updateAim(event, true);
      }
    }

    function onPointerMove(event: PointerEvent) {
      if (!activePointers.has(event.pointerId)) return;
      if (viewModeRef.current === 'range') updateAim(event);
    }

    function onPointerUp(event: PointerEvent) {
      activePointers.delete(event.pointerId);
      lastPointerById.delete(event.pointerId);
      renderer.domElement.releasePointerCapture?.(event.pointerId);
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);

    function updateBullets(dt: number) {
      for (let i = bulletsRef.current.length - 1; i >= 0; i -= 1) {
        const bullet = bulletsRef.current[i];
        bullet.age += dt;

        if (bullet.cinematic && bullet.prelaunch > 0 && !bullet.launched) {
          const p = THREE.MathUtils.smoothstep(
            Math.min(1, bullet.age / bullet.prelaunch),
            0,
            1
          );
          bullet.pos.copy(bullet.inside).lerp(bullet.muzzle, p);
          if (bullet.age >= bullet.prelaunch) {
            bullet.launched = true;
            bullet.pos.copy(bullet.muzzle);
            bullet.t = 0;
          }
        } else if (!bullet.impacted) {
          bullet.t += dt * bullet.speed;
          const p = THREE.MathUtils.smoothstep(Math.min(1, bullet.t), 0, 1);
          bullet.pos.lerpVectors(bullet.muzzle, bullet.end, p);
          if (bullet.t >= 1) {
            bullet.impacted = true;
            bullet.impactAge = 0;
            bullet.pos.copy(bullet.end);
            bullet.t = 1;
          }
        } else {
          bullet.impactAge += dt;
          bullet.pos.copy(bullet.end);
        }

        bullet.root.position.copy(bullet.pos);
        bullet.root.quaternion.copy(bullet.flightQuat);
        bullet.spin += BULLET_SPIN * dt;
        bullet.spinGroup.rotation.set(0, 0, bullet.spin);

        bullet.trail.position.copy(bullet.pos).lerp(bullet.muzzle, 0.15);
        bullet.trail.lookAt(bullet.end);
        bullet.trail.visible = bullet.launched;

        if (bullet.wake) {
          bullet.wake.visible = bullet.launched;
          bullet.wake.position.copy(bullet.pos);
          bullet.wake.quaternion.copy(bullet.flightQuat);
        }

        if (
          (bullet.impacted && bullet.impactAge > 0.45) ||
          bullet.age >= bullet.life
        ) {
          scene.remove(bullet.root, bullet.trail);
          if (bullet.wake) scene.remove(bullet.wake);
          disposeObject(bullet.root);
          disposeObject(bullet.trail);
          if (bullet.wake) disposeObject(bullet.wake);
          bulletsRef.current.splice(i, 1);
        }
      }
    }

    function updateShells(dt: number) {
      for (let i = shellsRef.current.length - 1; i >= 0; i -= 1) {
        const shell = shellsRef.current[i];
        shell.age += dt;
        shell.life -= dt;

        if (!shell.launched) {
          shell.pos
            .copy(shell.start)
            .lerp(
              shell.end,
              THREE.MathUtils.smoothstep(
                Math.min(1, shell.age / shell.pre),
                0,
                1
              )
            );
          if (shell.age >= shell.pre) shell.launched = true;
        } else if (!shell.grounded) {
          shell.vel.y -= dt * 2.8;
          shell.pos.addScaledVector(shell.vel, dt);
          if (shell.pos.y < 0.08) {
            shell.pos.y = 0.08;
            shell.vel.y *= -0.18;
            shell.vel.x *= 0.82;
            shell.vel.z *= 0.82;
            if (!shell.hitPlayed) {
              shell.hitPlayed = true;
              playShellImpact(
                Math.min(1.35, Math.max(0.35, shell.spin.length() / 12))
              );
            }
            if (Math.abs(shell.vel.y) < 0.08) shell.grounded = true;
          }
        } else {
          shell.vel.multiplyScalar(Math.exp(-1.2 * dt));
        }

        shell.root.position.copy(shell.pos);
        shell.root.rotation.x += shell.spin.x * dt;
        shell.root.rotation.y += shell.spin.y * dt;
        shell.root.rotation.z += shell.spin.z * dt;

        if (shell.life <= 0 && !shell.grounded) {
          scene.remove(shell.root);
          disposeObject(shell.root);
          shellsRef.current.splice(i, 1);
        }
      }
    }

    function updateShotEffects(dt: number) {
      for (let i = shotEffectsRef.current.length - 1; i >= 0; i -= 1) {
        const effect = shotEffectsRef.current[i];
        effect.age += dt;
        if (effect.velocity) {
          effect.root.position.addScaledVector(effect.velocity, dt);
          effect.root.scale.setScalar(1 + effect.age * 3);
        } else {
          effect.root.scale.setScalar(1 + (effect.age / effect.life) * 1.8);
        }
        effect.root.traverse((child) => {
          const mesh = child as THREE.Mesh;
          const material = mesh.material as THREE.Material | undefined;
          if (!material || !('opacity' in material)) return;
          material.transparent = true;
          material.opacity =
            Math.max(0, 1 - effect.age / effect.life) *
            (effect.velocity ? 0.28 : 1);
        });
        if (effect.age > effect.life) {
          scene.remove(effect.root);
          disposeObject(effect.root);
          shotEffectsRef.current.splice(i, 1);
        }
      }
    }

    function updateCharacters(dt: number) {
      lanesRef.current.forEach((lane) => {
        lane.mixer?.update(dt);
        lane.pickupLift = Math.max(0, lane.pickupLift - dt * 2.3);

        const isUser = lane.controller === 'USER';
        const aim = isUser ? aimRef.current : lane.aiAim;
        const recoil = isUser ? recoilRef.current : 0;
        const weapon = WEAPONS[lane.activeWeaponIndex];
        const nineMm = isNineMmWeapon(weapon);
        const kick =
          Math.sin(Math.max(0, Math.min(1, recoil)) * Math.PI) *
          (nineMm ? 0.09 : recoil);
        const baseMount = nineMm
          ? SERVICE_PISTOL_AIM.mount
          : new THREE.Vector3(0.34, 1.27, -0.12);

        lane.weaponMount.position.x = THREE.MathUtils.lerp(
          lane.weaponMount.position.x,
          baseMount.x + aim.x * (nineMm ? 0.04 : 0.1),
          nineMm ? 0.22 : 0.16
        );
        lane.weaponMount.position.y = THREE.MathUtils.lerp(
          lane.weaponMount.position.y,
          baseMount.y +
            lane.pickupLift * 0.18 +
            aim.y * (nineMm ? 0.03 : 0.06) -
            kick * (nineMm ? 0.09 : 0.05),
          nineMm ? 0.22 : 0.16
        );
        lane.weaponMount.position.z = THREE.MathUtils.lerp(
          lane.weaponMount.position.z,
          baseMount.z + kick * (nineMm ? 0.045 : 0.18),
          nineMm ? 0.22 : 0.16
        );

        lane.weaponMount.rotation.x = THREE.MathUtils.lerp(
          lane.weaponMount.rotation.x,
          (nineMm ? -0.02 : 0.02) - kick * (nineMm ? 0.44 : 0.2) + aim.y * 0.05,
          nineMm ? 0.22 : 0.16
        );
        lane.weaponMount.rotation.y = THREE.MathUtils.lerp(
          lane.weaponMount.rotation.y,
          (nineMm ? 0.01 : -0.03) - aim.x * 0.08 + kick * (nineMm ? 0.08 : 0),
          nineMm ? 0.22 : 0.16
        );
        lane.weaponMount.rotation.z = THREE.MathUtils.lerp(
          lane.weaponMount.rotation.z,
          (nineMm ? 0.005 : 0.1) + aim.x * 0.05 + kick * (nineMm ? 0.12 : 0),
          nineMm ? 0.22 : 0.16
        );
      });

      recoilRef.current = Math.max(0, recoilRef.current - dt * 6.4);
    }

    function updateTargets() {
      if (phaseRef.current === 'shoot') {
        const time = performance.now() * 0.001;
        paperTargetsRef.current.forEach((target) => {
          if (!target.movementAmplitude) return;
          const offset =
            Math.sin(time * target.movementSpeed + target.movementPhase) *
            target.movementAmplitude;
          const bob =
            Math.sin(time * target.movementSpeed * 1.7 + target.movementPhase) *
            0.08;
          target.root.position.x = target.startX + offset;
          target.root.position.y = target.startY + bob;
          target.root.rotation.y =
            Math.sin(time * target.movementSpeed + target.movementPhase) * 0.08;
        });
      }

      if (phaseRef.current === 'results') {
        const best = Math.max(...laneScoresRef.current);
        const winnerLane =
          winnerLaneRef.current ??
          laneScoresRef.current.findIndex((score) => score === best);

        paperTargetsRef.current.forEach((target, i) => {
          const wantedZ = i === winnerLane ? -4.1 : -7.2;
          const wantedX = i === winnerLane ? 0 : LANE_X[i] * 0.75;
          target.root.position.z = THREE.MathUtils.lerp(
            target.root.position.z,
            wantedZ,
            0.05
          );
          target.root.position.x = THREE.MathUtils.lerp(
            target.root.position.x,
            wantedX,
            0.05
          );
          target.root.position.y = THREE.MathUtils.lerp(
            target.root.position.y,
            i === winnerLane ? 0.92 : 0.76,
            0.05
          );
          target.root.rotation.y = THREE.MathUtils.lerp(
            target.root.rotation.y,
            0,
            0.08
          );
        });

        lanesRef.current.forEach((lane) => {
          if (!lane) return;
          const winningLane = lane.laneIndex === winnerLane;
          const targetX = winningLane ? -1.18 : LANE_X[lane.laneIndex];
          const targetZ = winningLane ? -3.95 : 3.05;
          lane.root.position.x = THREE.MathUtils.lerp(
            lane.root.position.x,
            targetX,
            0.045
          );
          lane.root.position.z = THREE.MathUtils.lerp(
            lane.root.position.z,
            targetZ,
            0.045
          );
          lane.root.rotation.y = THREE.MathUtils.lerp(
            lane.root.rotation.y,
            winningLane ? 0.18 : 0,
            0.05
          );
        });
      }
    }

    function updateWinnerCoins(dt: number) {
      tpcCoins.forEach((coin) => {
        if (!coin.mesh.visible) return;
        coin.life -= dt;
        coin.velocity.y -= 2.6 * dt;
        coin.mesh.position.addScaledVector(coin.velocity, dt);
        coin.mesh.rotation.x += 8.5 * dt;
        coin.mesh.rotation.y += 5.8 * dt;
        if (coin.life <= 0 || coin.mesh.position.y < 0.32)
          coin.mesh.visible = false;
      });
    }

    const tempPos = new THREE.Vector3();
    const tempLook = new THREE.Vector3();

    function updateCamera() {
      if (viewModeRef.current === 'tables') {
        tempPos.set(0, 5.75, 8.85);
        tempLook.set(0, 1.0, 1.72);
        camera.position.lerp(tempPos, 0.08);
        camera.lookAt(tempLook);
        return;
      }

      if (viewModeRef.current === 'results') {
        const activeLaneIndexes = lanesRef.current
          .map((lane, index) => (lane ? index : -1))
          .filter((index) => index >= 0);
        const best = Math.max(
          ...activeLaneIndexes.map((index) => laneScoresRef.current[index])
        );
        const winnerLane =
          activeLaneIndexes.find(
            (index) => laneScoresRef.current[index] === best
          ) ?? userLaneRef.current;
        const target = paperTargetsRef.current[winnerLane];
        if (target) {
          tempPos.set(0, 2.5, 4.45);
          tempLook.copy(target.root.position).add(new THREE.Vector3(0, 1.0, 0));
          camera.position.lerp(tempPos, 0.07);
          camera.lookAt(tempLook);
        }
        return;
      }

      const cinematicBullet = bulletsRef.current.find(
        (b) =>
          b.cinematic &&
          (!b.impacted ||
            b.impactAge < 0.45 ||
            performance.now() < followUntilRef.current)
      );
      if (cinematicBullet) {
        const dir = cinematicBullet.end
          .clone()
          .sub(cinematicBullet.start)
          .normalize();
        if (!cinematicBullet.launched && cinematicBullet.prelaunch > 0) {
          tempPos
            .copy(cinematicBullet.muzzle)
            .addScaledVector(dir, -1.3)
            .addScaledVector(cinematicBullet.right, 0.52)
            .add(new THREE.Vector3(0, 0.52, 0));
          tempLook
            .copy(cinematicBullet.muzzle)
            .addScaledVector(dir, 0.46)
            .addScaledVector(cinematicBullet.right, 0.15);
        } else {
          const followPoint = cinematicBullet.impacted
            ? cinematicBullet.end
            : cinematicBullet.root.position;
          tempPos
            .copy(followPoint)
            .addScaledVector(dir, -0.92)
            .add(new THREE.Vector3(0.2, 0.16, 0.3));
          tempLook
            .copy(followPoint)
            .addScaledVector(dir, cinematicBullet.impacted ? 0.18 : 0.9);
        }
        camera.position.lerp(tempPos, cinematicBullet.launched ? 0.115 : 0.075);
        camera.lookAt(tempLook);
        return;
      }

      tempPos.set(
        LANE_X[userLaneRef.current] +
          OVER_SHOULDER_OFFSET.x +
          aimRef.current.x * 0.24,
        OVER_SHOULDER_OFFSET.y +
          aimRef.current.y * 0.12 +
          recoilRef.current * 0.04,
        OVER_SHOULDER_OFFSET.z
      );
      tempLook.set(
        LANE_X[userLaneRef.current] +
          OVER_SHOULDER_LOOK.x +
          aimRef.current.x * 1.35,
        OVER_SHOULDER_LOOK.y + aimRef.current.y * 0.95,
        OVER_SHOULDER_LOOK.z
      );

      camera.position.lerp(tempPos, 0.09);
      camera.lookAt(tempLook);
    }

    const clock = new THREE.Clock();

    function resize() {
      if (!mount) return;
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    function animate() {
      if (disposed) return;
      raf = requestAnimationFrame(animate);

      const dt = Math.min(clock.getDelta(), 0.05);

      updateAI(performance.now());
      updateBullets(dt);
      updateShells(dt);
      updateShotEffects(dt);
      updateCharacters(dt);
      updateTargets();
      updateWinnerCoins(dt);
      updateCamera();

      renderer.render(scene, camera);
    }

    actionsRef.current.fire = () => {
      if (phaseRef.current === 'results') {
        window.location.reload();
        return;
      }
      fireUser();
    };
    actionsRef.current.reload = () => reloadUser();
    actionsRef.current.next = () => nextWeapon();
    actionsRef.current.prev = () => prevWeapon();
    actionsRef.current.tables = () => {
      if (phaseRef.current === 'pick') setViewMode('tables');
    };
    actionsRef.current.range = () => {
      if (phaseRef.current === 'pick') setViewMode('range');
    };
    actionsRef.current.restart = () => window.location.reload();
    actionsRef.current.select = (index: number) => {
      if (phaseRef.current === 'pick') {
        pickWeapon(index);
      } else if (phaseRef.current === 'shoot') {
        switchToWeapon(index);
      }
    };

    resize();
    animate();

    window.addEventListener('resize', resize);

    return () => {
      disposed = true;
      if (pickInterval) window.clearInterval(pickInterval);

      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);

      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);

      disposeObject(scene);
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  const panelStyle: React.CSSProperties = {
    background: 'rgba(8,14,24,.74)',
    border: '1px solid rgba(255,255,255,.12)',
    borderRadius: 16,
    padding: '10px 12px',
    color: 'white',
    boxShadow: '0 12px 30px rgba(0,0,0,.24)',
    backdropFilter: 'blur(10px)'
  };

  const buttonStyle: React.CSSProperties = {
    border: '1px solid rgba(255,255,255,.16)',
    borderRadius: 14,
    padding: '10px 12px',
    background: 'rgba(255,255,255,.08)',
    color: 'white',
    fontSize: 12,
    fontWeight: 800,
    boxShadow: '0 10px 22px rgba(0,0,0,.18)',
    cursor: 'pointer'
  };

  const fireStyle: React.CSSProperties = {
    height: 90,
    borderRadius: 999,
    border: '1px solid rgba(255,230,230,.25)',
    background:
      phase === 'results' ? 'rgba(34,197,94,.92)' : 'rgba(220,38,38,.92)',
    color: 'white',
    fontWeight: 900,
    fontSize: 18,
    boxShadow: '0 18px 40px rgba(0,0,0,.28)',
    cursor: 'pointer'
  };

  const visibleWeaponIndices = tableWeaponsRef.current.length
    ? tableWeaponsRef.current
        .filter((tw) => tw.laneIndex === userLane)
        .sort((a, b) =>
          a.root.position.z === b.root.position.z
            ? a.root.position.x - b.root.position.x
            : a.root.position.z - b.root.position.z
        )
        .map((tw) => tw.weaponIndex)
    : WEAPONS.map((_, index) => index);

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#0a0d13',
        fontFamily: 'system-ui, sans-serif',
        userSelect: 'none',
        touchAction: 'none'
      }}
    >
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          display: 'grid',
          gap: 10,
          zIndex: 10
        }}
      >
        <div style={panelStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              alignItems: 'start'
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fde68a' }}>
                {queryConfig.mode === 'online'
                  ? 'Online Shooting Range'
                  : `${queryConfig.playerName}${queryConfig.playerFlag ? ` ${queryConfig.playerFlag}` : ''} vs AI`}
              </div>
              <div style={{ marginTop: 3, fontSize: 11, opacity: 0.88 }}>
                {phase === 'pick'
                  ? `Pick a weapon from your Lane ${userLane + 1} table · ${pickTimer}s`
                  : phase === 'shoot'
                    ? `Lane ${userLane + 1} is yours · ${queryConfig.playerCount} players · ${RANGE_DISTANCE_CONFIG[queryConfig.distance].label} distance · red dot precision`
                    : phase === 'results'
                      ? winnerText
                      : 'Loading range...'}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 900 }}>
              <div>{phase.toUpperCase()}</div>
              <div>{viewMode.toUpperCase()}</div>
            </div>
          </div>

          <div
            style={{
              marginTop: 8,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              opacity: 0.96
            }}
          >
            {laneScores.map((s, i) =>
              !lanesRef.current[i] ? null : (
                <div
                  key={i}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 12,
                    background:
                      i === userLane
                        ? 'rgba(250,204,21,.16)'
                        : 'rgba(255,255,255,.05)',
                    color: i === userLane ? '#fde68a' : '#d1d5db'
                  }}
                >
                  <div>
                    {i === userLane
                      ? 'YOU'
                      : `AI ${lanesRef.current[i]?.playerId ?? i}`}
                  </div>
                  <div>Score: {s}</div>
                  <div>Shots: {shotsLeft[i]}</div>
                </div>
              )
            )}
          </div>

          <div
            style={{
              marginTop: 6,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              fontSize: 11,
              fontWeight: 700,
              opacity: 0.9,
              flexWrap: 'wrap'
            }}
          >
            <span>Weapon: {selectedEntry.shortName}</span>
            <span>Type: {selectedEntry.weaponClass.toUpperCase()}</span>
            <span>
              Distance: {RANGE_DISTANCE_CONFIG[queryConfig.distance].label}
            </span>
            <span>
              Ammo: {ammo}/{selectedStats.mag}
            </span>
            <span>
              {queryConfig.mode === 'online'
                ? 'Online stake match'
                : 'Free vs AI'}
            </span>
            <span>{status}</span>
            {lastHitText && (
              <span style={{ color: '#86efac' }}>{lastHitText}</span>
            )}
          </div>
        </div>
      </div>

      {viewMode === 'range' && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 40,
            height: 40,
            transform: 'translate(-50%,-50%)',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,.8)',
            boxShadow: '0 0 22px rgba(255,255,255,.16)',
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: -12,
              width: 1,
              height: 12,
              background: 'rgba(255,255,255,.8)',
              transform: 'translateX(-50%)'
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              bottom: -12,
              width: 1,
              height: 12,
              background: 'rgba(255,255,255,.8)',
              transform: 'translateX(-50%)'
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: -12,
              width: 12,
              height: 1,
              background: 'rgba(255,255,255,.8)',
              transform: 'translateY(-50%)'
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: -12,
              width: 12,
              height: 1,
              background: 'rgba(255,255,255,.8)',
              transform: 'translateY(-50%)'
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 6,
              height: 6,
              borderRadius: 999,
              background: '#f87171',
              transform: 'translate(-50%,-50%)'
            }}
          />
        </div>
      )}

      {(phase === 'pick' || phase === 'shoot') && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 92,
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            padding: '6px 2px',
            zIndex: 10,
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {visibleWeaponIndices.map((index) => {
            const weapon = WEAPONS[index];
            const active = index === selectedWeapon;
            return (
              <button
                key={weapon.id}
                type="button"
                onClick={() => actionsRef.current.select(index)}
                style={{
                  minWidth: 64,
                  borderRadius: 14,
                  border: active
                    ? '1px solid rgba(250,204,21,.95)'
                    : '1px solid rgba(255,255,255,.18)',
                  background: active
                    ? 'rgba(250,204,21,.18)'
                    : 'rgba(15,23,42,.72)',
                  color: active ? '#fde68a' : '#e5e7eb',
                  padding: '4px 5px',
                  fontSize: 9,
                  fontWeight: 900,
                  cursor: 'pointer'
                }}
              >
                {weaponIconUris[index] && (
                  <img
                    src={weaponIconUris[index]}
                    alt=""
                    style={{ width: 50, height: 25, objectFit: 'contain' }}
                  />
                )}
                <div>{weapon.shortName}</div>
              </button>
            );
          })}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 10,
          alignItems: 'center',
          zIndex: 10
        }}
      >
        <button
          onClick={() => actionsRef.current.next()}
          style={buttonStyle}
          disabled={phase !== 'pick' && phase !== 'shoot'}
        >
          Switch
        </button>
        <button
          onClick={() => actionsRef.current.reload()}
          style={{
            ...buttonStyle,
            background: 'rgba(234,179,8,.92)',
            color: '#111827'
          }}
          disabled={phase !== 'shoot'}
        >
          Reload
        </button>
        <button
          onClick={() => actionsRef.current.fire()}
          style={{ ...fireStyle, height: 64 }}
        >
          {phase === 'results' ? 'RESTART' : 'SHOOT'}
        </button>
      </div>
    </div>
  );
}
