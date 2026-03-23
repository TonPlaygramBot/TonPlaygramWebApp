import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  createMurlanStyleTable,
  applyTableMaterials
} from '../../utils/murlanTable.js';
import { MURLAN_TABLE_FINISHES } from '../../config/murlanTableFinishes.js';
import {
  getTelegramFirstName,
  getTelegramPhotoUrl
} from '../../utils/telegram.js';
import {
  applyRendererSRGB,
  applySRGBColorSpace
} from '../../utils/colorSpace.js';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import AvatarTimer from '../../components/AvatarTimer.jsx';
import { getGameVolume, isGameMuted } from '../../utils/sound.js';
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import {
  TAVULL_BATTLE_BOARD_FINISH_OPTIONS,
  TAVULL_BATTLE_CHAIR_OPTIONS,
  TAVULL_BATTLE_FRAME_FINISH_OPTIONS,
  TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS
} from '../../config/tavullBattleInventoryConfig.js';
import {
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_HDRI_VARIANT_MAP
} from '../../config/poolRoyaleInventoryConfig.js';
import {
  getTavullBattleInventory,
  isTavullOptionUnlocked,
  tavullBattleAccountId
} from '../../utils/tavullBattleInventory.js';
import {
  BLACK,
  WHITE,
  applyMove,
  collectTurnSequences,
  initialBoard,
  pickAiSequence
} from '../../utils/tavullEngine.js';

const TABLE_RADIUS = 2.55;
const TABLE_HEIGHT = 1.16;
const CHAIR_DISTANCE = TABLE_RADIUS + 0.82;
const BOARD_Y = TABLE_HEIGHT + 0.08;
const BOARD_HALF_X = 1.28;
const BOARD_HALF_Z = 0.98;
const BOARD_EDGE_MARGIN_X = 0.092;
const BOARD_EDGE_MARGIN_Z = 0.118;
const CENTER_BAR_WIDTH = 0.118;
const POINT_COLUMNS = 6;
const POINT_WIDTH =
  (BOARD_HALF_X * 2 - CENTER_BAR_WIDTH - BOARD_EDGE_MARGIN_X * 2) /
  (POINT_COLUMNS * 2);
const BOARD_BASE_THICKNESS = 0.16;
const FRAME_THICKNESS = 0.112;
const LANE_THICKNESS = 0.04;
const CENTER_BAR_THICKNESS = 0.062;
const POINT_INSET_X = POINT_WIDTH * 0.12;
const POINT_INSET_Z = POINT_WIDTH * 0.16;

const TRIANGLE_BASE_Y_OFFSET = 0.127;
const TRIANGLE_HEIGHT = 0.014;
const TRIANGLE_HALF_BASE = POINT_WIDTH * 0.43;
const TRIANGLE_APEX_LENGTH = BOARD_HALF_Z * 0.73;
const CHIP_RADIUS = POINT_WIDTH * 0.36;
const CHIP_HEIGHT = 0.02;
const CHIP_ROW_SPACING = CHIP_RADIUS * 1.88;
const CHIP_COLUMN_SPACING = POINT_WIDTH * 0.34;
const CHIP_POINT_INSET = POINT_WIDTH * 0.18;
const CHIP_BASE_Y_OFFSET =
  TRIANGLE_BASE_Y_OFFSET + TRIANGLE_HEIGHT + CHIP_HEIGHT * 0.53;
const CHIP_MAX_PER_COLUMN = 5;
const CAPTURE_STRIP_OFFSET_ROWS = 1.15;
const CAPTURE_STRIP_PIECE_GAP = 0.82;

const MODEL_SCALE = 0.75;
const STOOL_SCALE = 1.5 * 1.3;
const SEAT_WIDTH = 0.9 * MODEL_SCALE * STOOL_SCALE;
const SEAT_DEPTH = 0.95 * MODEL_SCALE * STOOL_SCALE;
const SEAT_THICKNESS_SCALED = 0.09 * MODEL_SCALE * STOOL_SCALE;
const BACK_HEIGHT = 0.68 * MODEL_SCALE * STOOL_SCALE;
const BACK_THICKNESS = 0.08 * MODEL_SCALE * STOOL_SCALE;
const ARM_THICKNESS = 0.125 * MODEL_SCALE * STOOL_SCALE;
const ARM_HEIGHT = 0.3 * MODEL_SCALE * STOOL_SCALE;
const ARM_DEPTH = SEAT_DEPTH * 0.75;
const BASE_COLUMN_HEIGHT = 0.5 * MODEL_SCALE * STOOL_SCALE;
const CHAIR_BASE_HEIGHT = TABLE_HEIGHT - SEAT_THICKNESS_SCALED * 0.85;
const CAMERA_2D_POSITION = new THREE.Vector3(0, 8.4, 0.01);
const CAMERA_3D_POSITION = new THREE.Vector3(0, 4.9, 5.6);
const CAMERA_TARGET = new THREE.Vector3(0, TABLE_HEIGHT, 0);
const DRACO_DECODER_PATH =
  'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const BASIS_TRANSCODER_PATH =
  'https://cdn.jsdelivr.net/npm/three@0.164.0/examples/jsm/libs/basis/';
const DEFAULT_HDRI_ASSET =
  POOL_ROYALE_HDRI_VARIANTS[0] ||
  POOL_ROYALE_HDRI_VARIANT_MAP[POOL_ROYALE_HDRI_VARIANTS[0]?.id] ||
  null;
let sharedKtx2Loader = null;
let hasDetectedKtx2Support = false;
const CHAIR_MODEL_URLS = Object.freeze([
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/SheenChair/glTF-Binary/SheenChair.glb',
  '/assets/models/chair/chair.glb',
  '/assets/models/chair/chair.gltf'
]);
const CHAIR_THEMES = Object.freeze([...TAVULL_BATTLE_CHAIR_OPTIONS]);
const QUALITY_OPTIONS = Object.freeze([
  { id: 'performance', label: 'Performance', pixelRatio: 1, shadows: false },
  { id: 'balanced', label: 'Balanced', pixelRatio: 1.5, shadows: true },
  { id: 'ultra', label: 'Ultra', pixelRatio: 2, shadows: true }
]);
const MOVE_SOUND_URL = '/assets/sounds/domino-pieces-1-32112 (mp3cut.net).mp3';
const WIN_SOUND_URL =
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/sound/standard/End.mp3';
const DICE_ROLL_SOUND_URL = '/assets/sounds/u_qpfzpydtro-dice-142528.mp3';
const FALLBACK_SEAT_POSITIONS = [
  { left: '50%', top: '73%' },
  { left: '50%', top: '18%' }
];
const BOARD_FRAME_TEXTURE_SIZE = 2048;
const BOARD_FRAME_TEXTURE_REPEAT = [2.2, 2.2];
const BACKGAMMON_DIE_SIZE = 0.116;
const BACKGAMMON_DIE_CORNER_RADIUS = BACKGAMMON_DIE_SIZE * 0.18;
const BACKGAMMON_DIE_PIP_RADIUS = BACKGAMMON_DIE_SIZE * 0.093;
const BACKGAMMON_DIE_PIP_DEPTH = BACKGAMMON_DIE_SIZE * 0.018;
const BACKGAMMON_DIE_PIP_RIM_INNER = BACKGAMMON_DIE_PIP_RADIUS * 0.78;
const BACKGAMMON_DIE_PIP_RIM_OUTER = BACKGAMMON_DIE_PIP_RADIUS * 1.08;
const BACKGAMMON_DIE_PIP_RIM_OFFSET = BACKGAMMON_DIE_SIZE * 0.0048;
const BACKGAMMON_DIE_PIP_SPREAD = BACKGAMMON_DIE_SIZE * 0.3;
const BACKGAMMON_DIE_FACE_INSET = BACKGAMMON_DIE_SIZE * 0.064;

const CHECKERS_CHIP_HEAD_PRESET = Object.freeze({
  roughness: 0.18,
  metalness: 0.35,
  transmission: 0.18,
  ior: 1.6,
  thickness: 0.44
});
const CHECKERS_CHIP_COLORS = Object.freeze({
  [WHITE]: '#ef4444',
  [BLACK]: '#06b6d4'
});

function createCheckerMaterial(sideColor, headPreset) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(sideColor),
    roughness: headPreset?.roughness ?? 0.08,
    metalness: headPreset?.metalness ?? 0,
    transmission: headPreset?.transmission ?? 0.95,
    ior: headPreset?.ior ?? 1.5,
    thickness: headPreset?.thickness ?? 0.5,
    clearcoat: 0.22,
    clearcoatRoughness: 0.08,
    specularIntensity: 0.9
  });
}

function getDieOrientationQuaternion(val) {
  const orientations = {
    1: new THREE.Euler(0, 0, 0),
    2: new THREE.Euler(-Math.PI / 2, 0, 0),
    3: new THREE.Euler(0, 0, Math.PI / 2),
    4: new THREE.Euler(0, 0, -Math.PI / 2),
    5: new THREE.Euler(Math.PI / 2, 0, 0),
    6: new THREE.Euler(Math.PI, 0, 0)
  };
  return new THREE.Quaternion().setFromEuler(
    orientations[val] || orientations[1]
  );
}

function makeRoyalDie() {
  const die = new THREE.Group();
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    metalness: 0.25,
    roughness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    reflectivity: 0.75,
    envMapIntensity: 1.4
  });
  const pipMaterial = new THREE.MeshPhysicalMaterial({
    color: '#0a0a0a',
    roughness: 0.05,
    metalness: 0.6,
    clearcoat: 0.9,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.1,
    emissive: '#0f172a',
    emissiveIntensity: 0.35
  });
  const rimMaterial = new THREE.MeshPhysicalMaterial({
    color: '#ffd700',
    emissive: '#3a2a00',
    emissiveIntensity: 0.55,
    metalness: 1,
    roughness: 0.18,
    reflectivity: 1,
    envMapIntensity: 1.35,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(
      BACKGAMMON_DIE_SIZE,
      BACKGAMMON_DIE_SIZE,
      BACKGAMMON_DIE_SIZE,
      6,
      BACKGAMMON_DIE_CORNER_RADIUS
    ),
    bodyMaterial
  );
  body.castShadow = true;
  body.receiveShadow = true;
  die.add(body);

  const pipGeo = new THREE.SphereGeometry(
    BACKGAMMON_DIE_PIP_RADIUS,
    36,
    24,
    0,
    Math.PI * 2,
    0,
    Math.PI
  );
  pipGeo.rotateX(Math.PI);
  pipGeo.computeVertexNormals();
  const pipRimGeo = new THREE.RingGeometry(
    BACKGAMMON_DIE_PIP_RIM_INNER,
    BACKGAMMON_DIE_PIP_RIM_OUTER,
    64
  );
  const faceDepth = BACKGAMMON_DIE_SIZE / 2 - BACKGAMMON_DIE_FACE_INSET * 0.6;
  const spread = BACKGAMMON_DIE_PIP_SPREAD;
  const faces = [
    { normal: new THREE.Vector3(0, 1, 0), points: [[0, 0]] },
    {
      normal: new THREE.Vector3(0, 0, 1),
      points: [
        [-spread, -spread],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(1, 0, 0),
      points: [
        [-spread, -spread],
        [0, 0],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(-1, 0, 0),
      points: [
        [-spread, -spread],
        [-spread, spread],
        [spread, -spread],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(0, 0, -1),
      points: [
        [-spread, -spread],
        [-spread, spread],
        [0, 0],
        [spread, -spread],
        [spread, spread]
      ]
    },
    {
      normal: new THREE.Vector3(0, -1, 0),
      points: [
        [-spread, -spread],
        [-spread, 0],
        [-spread, spread],
        [spread, -spread],
        [spread, 0],
        [spread, spread]
      ]
    }
  ];

  faces.forEach(({ normal, points }) => {
    const n = normal.clone().normalize();
    const helper =
      Math.abs(n.y) > 0.9
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3().crossVectors(helper, n).normalize();
    const yAxis = new THREE.Vector3().crossVectors(n, xAxis).normalize();
    points.forEach(([gx, gy]) => {
      const base = new THREE.Vector3()
        .addScaledVector(xAxis, gx)
        .addScaledVector(yAxis, gy)
        .addScaledVector(n, faceDepth - BACKGAMMON_DIE_PIP_DEPTH * 0.5);

      const pip = new THREE.Mesh(pipGeo, pipMaterial);
      pip.castShadow = true;
      pip.receiveShadow = true;
      pip.position.copy(base).addScaledVector(n, BACKGAMMON_DIE_PIP_DEPTH);
      pip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      die.add(pip);

      const rim = new THREE.Mesh(pipRimGeo, rimMaterial);
      rim.receiveShadow = true;
      rim.renderOrder = 6;
      rim.position.copy(base).addScaledVector(n, BACKGAMMON_DIE_PIP_RIM_OFFSET);
      rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      die.add(rim);
    });
  });

  die.visible = false;
  die.userData.setValue = (value) => {
    die.userData.currentValue = value;
    die.quaternion.copy(getDieOrientationQuaternion(value));
  };
  die.userData.setValue(1);
  return die;
}

function ensureKtx2SupportDetection(renderer = null) {
  if (!sharedKtx2Loader || hasDetectedKtx2Support || !renderer) return;
  try {
    sharedKtx2Loader.detectSupport(renderer);
    hasDetectedKtx2Support = true;
  } catch (error) {
    console.warn('Failed to detect KTX2 support for Tavull loader', error);
  }
}

function createConfiguredGLTFLoader(renderer = null) {
  const loader = new GLTFLoader();
  loader.setCrossOrigin?.('anonymous');
  const draco = new DRACOLoader();
  draco.setDecoderPath(DRACO_DECODER_PATH);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder?.(MeshoptDecoder);

  if (!sharedKtx2Loader) {
    sharedKtx2Loader = new KTX2Loader();
    sharedKtx2Loader.setTranscoderPath(BASIS_TRANSCODER_PATH);
  }
  ensureKtx2SupportDetection(renderer);
  loader.setKTX2Loader(sharedKtx2Loader);
  return loader;
}

function prepareLoadedModel(model) {
  model?.traverse?.((obj) => {
    if (!obj?.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    if (obj.geometry?.attributes?.uv && !obj.geometry.attributes.uv2) {
      obj.geometry.setAttribute('uv2', obj.geometry.attributes.uv);
    }
    const materials = Array.isArray(obj.material)
      ? obj.material
      : [obj.material];
    materials.forEach((material) => {
      if (!material) return;
      const colorMaps = [material.map, material.emissiveMap];
      const linearMaps = [
        material.normalMap,
        material.roughnessMap,
        material.metalnessMap,
        material.aoMap,
        material.displacementMap,
        material.alphaMap,
        material.bumpMap
      ];

      colorMaps.filter(Boolean).forEach((texture) => {
        applySRGBColorSpace(texture);
        texture.flipY = false;
        texture.needsUpdate = true;
      });
      linearMaps.filter(Boolean).forEach((texture) => {
        if ('colorSpace' in texture) texture.colorSpace = THREE.NoColorSpace;
        texture.flipY = false;
        texture.needsUpdate = true;
      });
    });
  });
}

function resolveHdriUrlsByVariantIndex(preferredIndex = 0) {
  const variant =
    POOL_ROYALE_HDRI_VARIANTS[preferredIndex] || DEFAULT_HDRI_ASSET;
  if (!variant?.assetId) {
    return [
      'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/colorful_studio_2k.hdr'
    ];
  }
  const resolutions =
    Array.isArray(variant.preferredResolutions) &&
    variant.preferredResolutions.length
      ? variant.preferredResolutions
      : ['2k'];
  const ordered = [
    ...resolutions,
    variant.fallbackResolution,
    '2k',
    '1k'
  ].filter(Boolean);
  const unique = [...new Set(ordered)];
  return unique.map(
    (resolution) =>
      `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${resolution}/${variant.assetId}_${resolution}.hdr`
  );
}

function loadHdriEnvironment(scene, preferredIndex = 0) {
  const rgbe = new RGBELoader();
  const ordered = resolveHdriUrlsByVariantIndex(preferredIndex);
  const tryNext = (index = 0) => {
    if (index >= ordered.length) return;
    rgbe.load(
      ordered[index],
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
      },
      undefined,
      () => tryNext(index + 1)
    );
  };
  tryNext(0);
}

function createArenaChairFallback(
  chairColor = '#8b1d2c',
  legColor = '#111827'
) {
  const seatMaterial = new THREE.MeshStandardMaterial({
    color: chairColor,
    roughness: 0.42,
    metalness: 0.18
  });
  const legMaterial = new THREE.MeshStandardMaterial({
    color: legColor,
    roughness: 0.55,
    metalness: 0.38
  });
  const chair = new THREE.Group();
  const seatMesh = new THREE.Mesh(
    new THREE.BoxGeometry(SEAT_WIDTH, SEAT_THICKNESS_SCALED, SEAT_DEPTH),
    seatMaterial
  );
  seatMesh.position.y = SEAT_THICKNESS_SCALED / 2;
  const backMesh = new THREE.Mesh(
    new THREE.BoxGeometry(SEAT_WIDTH * 0.96, BACK_HEIGHT, BACK_THICKNESS),
    seatMaterial
  );
  backMesh.position.set(
    0,
    SEAT_THICKNESS_SCALED / 2 + BACK_HEIGHT / 2,
    -SEAT_DEPTH / 2 + BACK_THICKNESS / 2
  );
  const armGeometry = new THREE.BoxGeometry(
    ARM_THICKNESS,
    ARM_HEIGHT,
    ARM_DEPTH
  );
  const armOffsetX = SEAT_WIDTH / 2 - ARM_THICKNESS / 2;
  const armOffsetY = SEAT_THICKNESS_SCALED / 2 + ARM_HEIGHT / 2;
  const armOffsetZ = -ARM_DEPTH / 2 + ARM_THICKNESS * 0.2;
  const leftArm = new THREE.Mesh(armGeometry, seatMaterial);
  leftArm.position.set(-armOffsetX, armOffsetY, armOffsetZ);
  const rightArm = new THREE.Mesh(armGeometry, seatMaterial);
  rightArm.position.set(armOffsetX, armOffsetY, armOffsetZ);
  const legMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.16 * MODEL_SCALE * STOOL_SCALE,
      0.2 * MODEL_SCALE * STOOL_SCALE,
      BASE_COLUMN_HEIGHT,
      18
    ),
    legMaterial
  );
  legMesh.position.y = -SEAT_THICKNESS_SCALED / 2 - BASE_COLUMN_HEIGHT / 2;
  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.32 * MODEL_SCALE * STOOL_SCALE,
      0.32 * MODEL_SCALE * STOOL_SCALE,
      0.08 * MODEL_SCALE,
      24
    ),
    legMaterial
  );
  foot.position.y =
    legMesh.position.y - BASE_COLUMN_HEIGHT / 2 - 0.04 * MODEL_SCALE;
  [seatMesh, backMesh, leftArm, rightArm, legMesh, foot].forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    chair.add(mesh);
  });
  return chair;
}

async function loadMappedChair(renderer, theme) {
  const loader = createConfiguredGLTFLoader(renderer);
  let loaded = null;
  for (const url of CHAIR_MODEL_URLS) {
    try {
      const gltf = await loader.loadAsync(url);
      loaded = gltf?.scene || gltf?.scenes?.[0];
      if (loaded) break;
    } catch (error) {
      console.warn('Failed to load Backgammon chair model', url, error);
    }
  }
  if (!loaded) return createArenaChairFallback(theme.primary, theme.leg);

  const model = loaded.clone(true);
  prepareLoadedModel(model);
  const tint = new THREE.Color(theme.primary);
  const legTint = new THREE.Color(theme.leg);
  model.traverse((node) => {
    if (!node?.isMesh) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach((mat) => {
      if (!mat) return;
      const label = `${mat.name || ''} ${node.name || ''}`.toLowerCase();
      const hasMappedTexture = Boolean(mat.map);
      if (!hasMappedTexture) {
        if (/leg|base|metal|foot/.test(label)) mat.color?.lerp(legTint, 0.7);
        else mat.color?.lerp(tint, 0.55);
      }
      if (mat.map) {
        applySRGBColorSpace(mat.map);
        mat.map.flipY = false;
      }
      if (mat.emissiveMap) {
        applySRGBColorSpace(mat.emissiveMap);
        mat.emissiveMap.flipY = false;
      }
      [
        mat.normalMap,
        mat.roughnessMap,
        mat.metalnessMap,
        mat.aoMap,
        mat.displacementMap,
        mat.alphaMap,
        mat.bumpMap
      ]
        .filter(Boolean)
        .forEach((texture) => {
          if ('colorSpace' in texture) texture.colorSpace = THREE.NoColorSpace;
          texture.flipY = false;
        });
      mat.needsUpdate = true;
    });
  });
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const currentMax = Math.max(size.x, size.y, size.z);
  const targetMax = Math.max(SEAT_WIDTH, BACK_HEIGHT * 1.2, SEAT_DEPTH);
  if (currentMax > 0) model.scale.multiplyScalar(targetMax / currentMax);
  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -scaledBox.min.y, -center.z);
  return model;
}

const pointColumnFromEdge = (x) => {
  const laneInnerEdge = BOARD_HALF_X - BOARD_EDGE_MARGIN_X;
  const distanceFromEdge = laneInnerEdge - Math.abs(x);
  return Math.max(
    0,
    Math.min(POINT_COLUMNS - 1, Math.round(distanceFromEdge / POINT_WIDTH))
  );
};

const pointBasePosition = (index) => {
  const rightLaneOuterX =
    BOARD_HALF_X - BOARD_EDGE_MARGIN_X - POINT_WIDTH * 0.5 - POINT_INSET_X;
  const rightLaneInnerX =
    CENTER_BAR_WIDTH * 0.5 + POINT_WIDTH * 0.5 + POINT_INSET_X;
  const leftLaneInnerX = -rightLaneInnerX;
  const leftLaneOuterX = -rightLaneOuterX;

  const laneStep =
    (rightLaneOuterX - rightLaneInnerX) / Math.max(1, POINT_COLUMNS - 1);
  const bottomLane = [
    ...Array.from(
      { length: POINT_COLUMNS },
      (_, col) => rightLaneOuterX - col * laneStep
    ),
    ...Array.from(
      { length: POINT_COLUMNS },
      (_, col) => leftLaneInnerX - col * laneStep
    )
  ];

  if (index <= 11) {
    return {
      x: bottomLane[index],
      z: BOARD_HALF_Z - BOARD_EDGE_MARGIN_Z - POINT_INSET_Z,
      top: false
    };
  }
  const i = 23 - index;
  return {
    x: bottomLane[i],
    z: -BOARD_HALF_Z + BOARD_EDGE_MARGIN_Z + POINT_INSET_Z,
    top: true
  };
};

export default function TavullBattleRoyal() {
  useTelegramBackButton();
  const canvasHostRef = useRef(null);
  const sceneBundleRef = useRef(null);
  const isMountedRef = useRef(true);
  const pendingTimeoutsRef = useRef([]);

  const [game, setGame] = useState({
    points: initialBoard(),
    bar: { white: 0, black: 0 },
    off: { white: 0, black: 0 }
  });
  const [forcedWinner, setForcedWinner] = useState(null);
  const [dice, setDice] = useState([]);
  const [available, setAvailable] = useState([]);
  const [message, setMessage] = useState('Roll to start. You are White.');
  const [aiThinking, setAiThinking] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [viewMode, setViewMode] = useState('3d');
  const [isRollingDice, setIsRollingDice] = useState(false);
  const [tableFinishIdx, setTableFinishIdx] = useState(0);
  const [chairThemeIdx, setChairThemeIdx] = useState(0);
  const [hdriIdx, setHdriIdx] = useState(0);
  const [boardFinishIdx, setBoardFinishIdx] = useState(0);
  const [frameFinishIdx, setFrameFinishIdx] = useState(0);
  const [triangleColorIdx, setTriangleColorIdx] = useState(0);
  const [qualityIdx, setQualityIdx] = useState(1);
  const [activeCustomizationKey, setActiveCustomizationKey] = useState(
    'tableFinish'
  );
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [inventoryVersion, setInventoryVersion] = useState(0);
  const [activeMoveHighlight, setActiveMoveHighlight] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const accountId = tavullBattleAccountId(
    typeof window !== 'undefined' ? window.localStorage?.getItem('accountId') : ''
  );
  const tavullInventory = useMemo(
    () => getTavullBattleInventory(accountId),
    [accountId, inventoryVersion]
  );
  const playerName = getTelegramFirstName() || 'Player';
  const playerAvatar = getTelegramPhotoUrl();

  const winner =
    forcedWinner ||
    (game.off.white >= 15 ? WHITE : game.off.black >= 15 ? BLACK : null);

  const players = [
    {
      index: 0,
      id: 'self-player',
      name: playerName,
      photoUrl: playerAvatar || '/assets/icons/profile.svg',
      color: 'white',
      isTurn: !aiThinking && !winner
    },
    {
      index: 1,
      id: 'ai-royal',
      name: 'AI Royal',
      photoUrl: '/assets/icons/profile.svg',
      color: 'black',
      isTurn: aiThinking
    }
  ];

  const ownedChairOptions = useMemo(
    () =>
      CHAIR_THEMES.filter((option) =>
        isTavullOptionUnlocked('chairColor', option.id, tavullInventory)
      ),
    [tavullInventory]
  );
  const ownedHdriOptions = useMemo(
    () =>
      POOL_ROYALE_HDRI_VARIANTS.filter((option) =>
        isTavullOptionUnlocked('environmentHdri', option.id, tavullInventory)
      ),
    [tavullInventory]
  );
  const ownedFinishOptions = useMemo(
    () =>
      MURLAN_TABLE_FINISHES.filter((option) =>
        isTavullOptionUnlocked('tableFinish', option.id, tavullInventory)
      ),
    [tavullInventory]
  );
  const ownedBoardFinishOptions = useMemo(
    () =>
      TAVULL_BATTLE_BOARD_FINISH_OPTIONS.filter((option) =>
        isTavullOptionUnlocked('boardFinish', option.id, tavullInventory)
      ),
    [tavullInventory]
  );
  const ownedFrameFinishOptions = useMemo(
    () =>
      TAVULL_BATTLE_FRAME_FINISH_OPTIONS.filter((option) =>
        isTavullOptionUnlocked('frameFinish', option.id, tavullInventory)
      ),
    [tavullInventory]
  );
  const ownedTriangleColorOptions = useMemo(
    () =>
      TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS.filter((option) =>
        isTavullOptionUnlocked('triangleColor', option.id, tavullInventory)
      ),
    [tavullInventory]
  );

  const customizationSections = useMemo(
    () => [
      {
        key: 'tableFinish',
        label: 'Table Finish',
        options: ownedFinishOptions,
        selectedIdx: tableFinishIdx,
        setSelectedIdx: setTableFinishIdx
      },
      {
        key: 'chairColor',
        label: 'Chairs',
        options: ownedChairOptions,
        selectedIdx: chairThemeIdx,
        setSelectedIdx: setChairThemeIdx
      },
      {
        key: 'boardFinish',
        label: 'Board Finish',
        options: ownedBoardFinishOptions,
        selectedIdx: boardFinishIdx,
        setSelectedIdx: setBoardFinishIdx
      },
      {
        key: 'frameFinish',
        label: 'Frame Finish',
        options: ownedFrameFinishOptions,
        selectedIdx: frameFinishIdx,
        setSelectedIdx: setFrameFinishIdx
      },
      {
        key: 'triangleColor',
        label: 'Triangles',
        options: ownedTriangleColorOptions,
        selectedIdx: triangleColorIdx,
        setSelectedIdx: setTriangleColorIdx
      },
      {
        key: 'environmentHdri',
        label: 'HDR Environment',
        options: ownedHdriOptions,
        selectedIdx: hdriIdx,
        setSelectedIdx: setHdriIdx
      }
    ],
    [
      ownedFinishOptions,
      tableFinishIdx,
      ownedChairOptions,
      chairThemeIdx,
      ownedBoardFinishOptions,
      boardFinishIdx,
      ownedFrameFinishOptions,
      frameFinishIdx,
      ownedTriangleColorOptions,
      triangleColorIdx,
      ownedHdriOptions,
      hdriIdx
    ]
  );
  const activeCustomizationSection = useMemo(
    () =>
      customizationSections.find(({ key }) => key === activeCustomizationKey) ||
      customizationSections[0] ||
      null,
    [activeCustomizationKey, customizationSections]
  );

  const renderCustomizationPreview = useCallback((option) => {
    if (!option) return null;
    if (option.thumbnail) {
      return (
        <span className="relative flex h-16 w-full items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-black/20">
          <img
            src={option.thumbnail}
            alt={option.label || option.name || 'Option thumbnail'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </span>
      );
    }
    const swatches = Array.isArray(option.swatches) && option.swatches.length >= 2
      ? option.swatches
      : [option.dark || option.primary || '#7c5e45', option.light || option.accent || '#3f2e23'];
    return (
      <span
        className="h-16 w-full rounded-xl border border-white/20"
        style={{
          background: `linear-gradient(135deg, ${swatches[0]}, ${swatches[1]})`
        }}
      />
    );
  }, []);

  useEffect(() => {
    const onInventoryUpdate = () => setInventoryVersion((v) => v + 1);
    window.addEventListener('tavullBattleInventoryUpdate', onInventoryUpdate);
    return () =>
      window.removeEventListener(
        'tavullBattleInventoryUpdate',
        onInventoryUpdate
      );
  }, []);

  useEffect(() => {
    if (!ownedFinishOptions.length) return;
    if (!ownedFinishOptions[tableFinishIdx]) setTableFinishIdx(0);
  }, [ownedFinishOptions, tableFinishIdx]);

  useEffect(() => {
    if (!ownedChairOptions.length) return;
    if (!ownedChairOptions[chairThemeIdx]) setChairThemeIdx(0);
  }, [ownedChairOptions, chairThemeIdx]);

  useEffect(() => {
    if (!ownedHdriOptions.length) return;
    if (!ownedHdriOptions[hdriIdx]) setHdriIdx(0);
  }, [ownedHdriOptions, hdriIdx]);
  useEffect(() => {
    if (!ownedBoardFinishOptions.length) return;
    if (!ownedBoardFinishOptions[boardFinishIdx]) setBoardFinishIdx(0);
  }, [ownedBoardFinishOptions, boardFinishIdx]);
  useEffect(() => {
    if (!ownedFrameFinishOptions.length) return;
    if (!ownedFrameFinishOptions[frameFinishIdx]) setFrameFinishIdx(0);
  }, [ownedFrameFinishOptions, frameFinishIdx]);
  useEffect(() => {
    if (!ownedTriangleColorOptions.length) return;
    if (!ownedTriangleColorOptions[triangleColorIdx]) setTriangleColorIdx(0);
  }, [ownedTriangleColorOptions, triangleColorIdx]);

  const playSfx = (url, volumeScale = 1) => {
    if (isGameMuted() || !soundEnabled) return;
    try {
      const audio = new Audio(url);
      audio.volume = Math.min(1, getGameVolume() * volumeScale);
      void audio.play().catch(() => {});
    } catch {}
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (!canvasHostRef.current) return undefined;

    const host = canvasHostRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090f1f');

    const camera = new THREE.PerspectiveCamera(
      42,
      host.clientWidth / host.clientHeight,
      0.1,
      120
    );
    camera.position.copy(CAMERA_3D_POSITION);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    applyRendererSRGB(renderer);
    const initialQuality = QUALITY_OPTIONS[qualityIdx] || QUALITY_OPTIONS[1];
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, initialQuality.pixelRatio)
    );
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = Boolean(initialQuality.shadows);
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 4.4;
    controls.maxDistance = 8.6;
    controls.target.copy(CAMERA_TARGET);

    const applyViewMode = (mode) => {
      if (mode === '2d') {
        camera.position.copy(CAMERA_2D_POSITION);
        camera.lookAt(CAMERA_TARGET);
        controls.minPolarAngle = 0.02;
        controls.maxPolarAngle = Math.PI * 0.08;
        controls.enableRotate = false;
        controls.minDistance = 5.8;
        controls.maxDistance = 11.5;
      } else {
        camera.position.copy(CAMERA_3D_POSITION);
        camera.lookAt(CAMERA_TARGET);
        controls.minPolarAngle = 0.4;
        controls.maxPolarAngle = Math.PI * 0.48;
        controls.enableRotate = true;
        controls.minDistance = 4.4;
        controls.maxDistance = 8.6;
      }
      controls.target.copy(CAMERA_TARGET);
      controls.update();
    };
    applyViewMode(viewMode);

    scene.add(new THREE.AmbientLight('#ffffff', 0.5));
    const key = new THREE.DirectionalLight('#ffffff', 1.15);
    key.position.set(5, 8, 3);
    key.castShadow = true;
    scene.add(key);

    const fill = new THREE.PointLight('#6ec4ff', 0.7, 30);
    fill.position.set(-4, 4.5, -3);
    scene.add(fill);

    const initialHdri = ownedHdriOptions[hdriIdx] || ownedHdriOptions[0];
    const initialHdriIdx = POOL_ROYALE_HDRI_VARIANTS.findIndex(
      (option) => option.id === initialHdri?.id
    );
    loadHdriEnvironment(scene, initialHdriIdx >= 0 ? initialHdriIdx : 0);

    const initialFinish =
      ownedFinishOptions[tableFinishIdx] || ownedFinishOptions[0];
    const initialFinishIdx = MURLAN_TABLE_FINISHES.findIndex(
      (option) => option.id === initialFinish?.id
    );
    const table = createMurlanStyleTable({
      arena: scene,
      renderer,
      tableRadius: TABLE_RADIUS,
      tableHeight: TABLE_HEIGHT
    });
    applyTableMaterials(
      table.parts,
      MURLAN_TABLE_FINISHES[initialFinishIdx >= 0 ? initialFinishIdx : 0]
    );

    const chairRootA = new THREE.Group();
    chairRootA.position.set(0, CHAIR_BASE_HEIGHT, CHAIR_DISTANCE);
    chairRootA.rotation.y = Math.PI;
    scene.add(chairRootA);
    const chairRootB = new THREE.Group();
    chairRootB.position.set(0, CHAIR_BASE_HEIGHT, -CHAIR_DISTANCE);
    scene.add(chairRootB);
    const setChairs = async (themeIndex) => {
      const theme = CHAIR_THEMES[themeIndex] || CHAIR_THEMES[0];
      const a = await loadMappedChair(renderer, theme);
      const b = a.clone(true);
      chairRootA.clear();
      chairRootB.clear();
      chairRootA.add(a);
      chairRootB.add(b);
    };
    void setChairs(chairThemeIdx);

    const boardRoot = new THREE.Group();
    scene.add(boardRoot);

    const createCanvasTexture = (drawFn, repeat = [1, 1]) => {
      const canvas = document.createElement('canvas');
      canvas.width = BOARD_FRAME_TEXTURE_SIZE;
      canvas.height = BOARD_FRAME_TEXTURE_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      drawFn(ctx, canvas.width, canvas.height);
      const texture = new THREE.CanvasTexture(canvas);
      applySRGBColorSpace(texture);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeat[0], repeat[1]);
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 1;
      texture.needsUpdate = true;
      return texture;
    };
    const boardLaneTexture = createCanvasTexture((ctx, width, height) => {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#f8ebd2');
      grad.addColorStop(0.5, '#e2cfa8');
      grad.addColorStop(1, '#d6ba8d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(103,61,31,0.22)';
      ctx.lineWidth = 2;
      for (let y = 0; y <= height; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }, BOARD_FRAME_TEXTURE_REPEAT);
    const frameTexture = createCanvasTexture((ctx, width, height) => {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#6e3a22');
      grad.addColorStop(0.45, '#5c2e1a');
      grad.addColorStop(1, '#472211');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.6;
      for (let x = 8; x < width; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 36, height);
        ctx.stroke();
      }
    }, BOARD_FRAME_TEXTURE_REPEAT);
    const triangleTexture = createCanvasTexture((ctx, width, height) => {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#c7d2fe');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(15,23,42,0.26)';
      ctx.lineWidth = 2;
      for (let x = 0; x <= width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 16, height);
        ctx.stroke();
      }
    }, [1.2, 3.2]);

    const woodMaterial = new THREE.MeshStandardMaterial({
      color: '#7b4127',
      map: frameTexture || null,
      roughness: 0.52,
      metalness: 0.14
    });
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: '#5d2e1b',
      map: frameTexture || null,
      roughness: 0.48,
      metalness: 0.22
    });
    const boardSurfaceMaterial = new THREE.MeshStandardMaterial({
      color: '#f0dfbf',
      map: boardLaneTexture || null,
      roughness: 0.74,
      metalness: 0.02
    });
    const pointDarkMaterial = new THREE.MeshStandardMaterial({
      color: '#08080b',
      map: triangleTexture || null,
      roughness: 0.66,
      metalness: 0.08
    });
    const pointLightMaterial = new THREE.MeshStandardMaterial({
      color: '#f4f1e8',
      map: triangleTexture || null,
      roughness: 0.7,
      metalness: 0.04
    });
    const applyFinishToMaterial = (material, finish, fallback = '#7b4127') => {
      const [primary] = finish?.swatches || [];
      material.color.set(primary || fallback);
      if (material.map) material.map.needsUpdate = true;
      material.needsUpdate = true;
    };
    const applyTrianglePalette = (palette) => {
      pointDarkMaterial.color.set(palette?.dark || '#f59e0b');
      pointLightMaterial.color.set(palette?.light || '#fef3c7');
      pointDarkMaterial.needsUpdate = true;
      pointLightMaterial.needsUpdate = true;
    };

    const boardBase = new THREE.Mesh(
      new THREE.BoxGeometry(
        BOARD_HALF_X * 2,
        BOARD_BASE_THICKNESS,
        BOARD_HALF_Z * 2
      ),
      woodMaterial
    );
    boardBase.position.y = BOARD_Y;
    boardRoot.add(boardBase);

    const frameOuter = new THREE.Mesh(
      new THREE.BoxGeometry(
        BOARD_HALF_X * 1.98,
        FRAME_THICKNESS,
        BOARD_HALF_Z * 1.98
      ),
      frameMaterial
    );
    frameOuter.position.y = BOARD_Y + BOARD_BASE_THICKNESS * 0.52;
    boardRoot.add(frameOuter);

    const laneWidth =
      BOARD_HALF_X - CENTER_BAR_WIDTH * 0.5 - BOARD_EDGE_MARGIN_X;
    const laneDepth = BOARD_HALF_Z * 2 - BOARD_EDGE_MARGIN_Z * 2;
    const laneOffset = CENTER_BAR_WIDTH * 0.5 + laneWidth * 0.5;
    [-1, 1].forEach((side) => {
      const lane = new THREE.Mesh(
        new THREE.BoxGeometry(laneWidth, LANE_THICKNESS, laneDepth),
        boardSurfaceMaterial
      );
      lane.position.set(
        side * laneOffset,
        BOARD_Y + BOARD_BASE_THICKNESS * 0.62,
        0
      );
      boardRoot.add(lane);
    });

    const centerBar = new THREE.Mesh(
      new THREE.BoxGeometry(
        CENTER_BAR_WIDTH,
        CENTER_BAR_THICKNESS,
        BOARD_HALF_Z * 2 - BOARD_EDGE_MARGIN_Z * 2
      ),
      boardSurfaceMaterial
    );
    centerBar.position.y = BOARD_Y + BOARD_BASE_THICKNESS * 0.64;
    boardRoot.add(centerBar);

    const hinge = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.09, BOARD_HALF_Z * 0.25),
      new THREE.MeshStandardMaterial({
        color: '#a9b0ba',
        roughness: 0.3,
        metalness: 0.92
      })
    );
    hinge.position.set(0, BOARD_Y + 0.165, 0);
    boardRoot.add(hinge);

    const makeTriangle = (x, top, dark) => {
      const baseZ = top
        ? -BOARD_HALF_Z + BOARD_EDGE_MARGIN_Z
        : BOARD_HALF_Z - BOARD_EDGE_MARGIN_Z;
      const apexZ = top
        ? baseZ + TRIANGLE_APEX_LENGTH
        : baseZ - TRIANGLE_APEX_LENGTH;
      const shape = new THREE.Shape();
      shape.moveTo(-TRIANGLE_HALF_BASE, baseZ);
      shape.lineTo(TRIANGLE_HALF_BASE, baseZ);
      shape.lineTo(0, apexZ);
      shape.closePath();
      const geom = new THREE.ExtrudeGeometry(shape, {
        depth: TRIANGLE_HEIGHT,
        bevelEnabled: false
      });
      geom.rotateX(-Math.PI / 2);
      const tri = new THREE.Mesh(
        geom,
        dark ? pointDarkMaterial : pointLightMaterial
      );
      tri.position.set(x, BOARD_Y + TRIANGLE_BASE_Y_OFFSET, 0);
      boardRoot.add(tri);
    };

    for (let i = 0; i < 24; i += 1) {
      const p = pointBasePosition(i);
      makeTriangle(p.x, p.top, pointColumnFromEdge(p.x) % 2 === 0);
    }
    applyFinishToMaterial(
      boardSurfaceMaterial,
      ownedBoardFinishOptions[boardFinishIdx] || ownedBoardFinishOptions[0],
      '#f0dfbf'
    );
    applyFinishToMaterial(
      frameMaterial,
      ownedFrameFinishOptions[frameFinishIdx] || ownedFrameFinishOptions[0],
      '#5d2e1b'
    );
    applyTrianglePalette(
      ownedTriangleColorOptions[triangleColorIdx] ||
        ownedTriangleColorOptions[0]
    );

    const chipGroup = new THREE.Group();
    scene.add(chipGroup);
    const diceGroup = new THREE.Group();
    scene.add(diceGroup);
    const diceAnimationState = { entries: [] };
    const maxDice = 2;

    const diceMeshes = Array.from({ length: maxDice }, () => {
      const mesh = makeRoyalDie();
      diceGroup.add(mesh);
      return mesh;
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const boardPlane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -(BOARD_Y + 0.16)
    );
    const hitPoint = new THREE.Vector3();
    const resolveNearestPoint = (x, z) => {
      let nearest = null;
      let minDist = Infinity;
      for (let i = 0; i < 24; i += 1) {
        const base = pointBasePosition(i);
        const dx = x - base.x;
        const dz = z - base.z;
        const dist = Math.hypot(dx, dz);
        if (dist < minDist) {
          minDist = dist;
          nearest = i;
        }
      }
      if (minDist > POINT_WIDTH * 0.72) return null;
      return nearest;
    };
    const onBoardTap = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(boardPlane, hitPoint)) return;
      const nearest = resolveNearestPoint(hitPoint.x, hitPoint.z);
      if (nearest == null) return;
      window.dispatchEvent(
        new CustomEvent('tavullPointTap', { detail: { point: nearest } })
      );
    };
    renderer.domElement.addEventListener('pointerdown', onBoardTap);

    const resize = () => {
      if (!host) return;
      const width = host.clientWidth;
      const height = host.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', resize);

    let raf = 0;
    const tick = () => {
      const now = performance.now();
      diceAnimationState.entries = diceAnimationState.entries.filter(
        (entry) => {
          if (now < entry.start) return true;
          const elapsed = now - entry.start;
          const t = Math.min(1, elapsed / entry.duration);
          const eased = 1 - (1 - t) ** 3;
          const arc = Math.sin(Math.PI * t) * 0.18;
          entry.mesh.position.lerpVectors(entry.startPos, entry.endPos, eased);
          entry.mesh.position.y += arc;
          entry.mesh.rotation.x += 0.42;
          entry.mesh.rotation.y += 0.37;
          entry.mesh.rotation.z += 0.25;
          if (t >= 1) {
            if (entry.targetQuaternion) {
              entry.mesh.setRotationFromQuaternion(entry.targetQuaternion);
            }
            return false;
          }
          return true;
        }
      );
      controls.update();
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(tick);
    };
    tick();

    sceneBundleRef.current = {
      scene,
      camera,
      renderer,
      controls,
      chipGroup,
      animateDiceThrow: (values = [], seat = 0) => {
        const diceValues = (
          Array.isArray(values) && values.length ? values : [1, 1]
        ).slice(0, maxDice);
        const startZ = seat === 0 ? BOARD_HALF_Z - 0.05 : -BOARD_HALF_Z + 0.05;
        const endZ = 0;
        const centerXPositions = [-0.34, 0.34];
        diceMeshes.forEach((mesh, index) => {
          if (index >= diceValues.length) {
            mesh.visible = false;
            return;
          }
          mesh.visible = true;
          const dieValue = Number(diceValues[index]) || 1;
          mesh.userData.setValue?.(dieValue);
          diceAnimationState.entries = diceAnimationState.entries.filter(
            (entry) => entry.mesh !== mesh
          );
          const x = centerXPositions[index] ?? 0;
          const startPos = new THREE.Vector3(x, BOARD_Y + 0.24, startZ);
          const endPos = new THREE.Vector3(x, BOARD_Y + 0.17, endZ);
          mesh.position.copy(startPos);
          diceAnimationState.entries.push({
            mesh,
            start: performance.now() + index * 60,
            duration: 980,
            startPos,
            endPos,
            targetQuaternion: getDieOrientationQuaternion(dieValue)
          });
        });
      },
      applyViewMode,
      applyTableFinish: (idx) =>
        applyTableMaterials(
          table.parts,
          MURLAN_TABLE_FINISHES[idx] || MURLAN_TABLE_FINISHES[0]
        ),
      applyHdri: (idx) => loadHdriEnvironment(scene, idx),
      applyBoardFinish: (idx) =>
        applyFinishToMaterial(
          boardSurfaceMaterial,
          TAVULL_BATTLE_BOARD_FINISH_OPTIONS[idx] ||
            TAVULL_BATTLE_BOARD_FINISH_OPTIONS[0],
          '#f0dfbf'
        ),
      applyFrameFinish: (idx) =>
        applyFinishToMaterial(
          frameMaterial,
          TAVULL_BATTLE_FRAME_FINISH_OPTIONS[idx] ||
            TAVULL_BATTLE_FRAME_FINISH_OPTIONS[0],
          '#5d2e1b'
        ),
      applyTriangleColor: (idx) =>
        applyTrianglePalette(
          TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS[idx] ||
            TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS[0]
        ),
      applyQuality: (idx) => {
        const quality = QUALITY_OPTIONS[idx] || QUALITY_OPTIONS[1];
        renderer.setPixelRatio(
          Math.min(window.devicePixelRatio || 1, quality.pixelRatio)
        );
        renderer.shadowMap.enabled = Boolean(quality.shadows);
        renderer.shadowMap.needsUpdate = true;
      },
      applyChairs: setChairs
    };

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.removeEventListener('pointerdown', onBoardTap);
      if (host.contains(renderer.domElement))
        host.removeChild(renderer.domElement);
      sceneBundleRef.current = null;
      isMountedRef.current = false;
    };
  }, []);

  useEffect(
    () => () => {
      pendingTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      pendingTimeoutsRef.current = [];
      isMountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyViewMode) return;
    bundle.applyViewMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyTableFinish) return;
    const selected =
      ownedFinishOptions[tableFinishIdx] || ownedFinishOptions[0];
    const globalIdx = MURLAN_TABLE_FINISHES.findIndex(
      (option) => option.id === selected?.id
    );
    bundle.applyTableFinish(globalIdx >= 0 ? globalIdx : 0);
  }, [tableFinishIdx, ownedFinishOptions]);

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyHdri) return;
    const selected = ownedHdriOptions[hdriIdx] || ownedHdriOptions[0];
    const globalIdx = POOL_ROYALE_HDRI_VARIANTS.findIndex(
      (option) => option.id === selected?.id
    );
    bundle.applyHdri(globalIdx >= 0 ? globalIdx : 0);
  }, [hdriIdx, ownedHdriOptions]);
  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyBoardFinish) return;
    const selected =
      ownedBoardFinishOptions[boardFinishIdx] || ownedBoardFinishOptions[0];
    const globalIdx = TAVULL_BATTLE_BOARD_FINISH_OPTIONS.findIndex(
      (option) => option.id === selected?.id
    );
    bundle.applyBoardFinish(globalIdx >= 0 ? globalIdx : 0);
  }, [boardFinishIdx, ownedBoardFinishOptions]);
  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyFrameFinish) return;
    const selected =
      ownedFrameFinishOptions[frameFinishIdx] || ownedFrameFinishOptions[0];
    const globalIdx = TAVULL_BATTLE_FRAME_FINISH_OPTIONS.findIndex(
      (option) => option.id === selected?.id
    );
    bundle.applyFrameFinish(globalIdx >= 0 ? globalIdx : 0);
  }, [frameFinishIdx, ownedFrameFinishOptions]);
  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyTriangleColor) return;
    const selected =
      ownedTriangleColorOptions[triangleColorIdx] ||
      ownedTriangleColorOptions[0];
    const globalIdx = TAVULL_BATTLE_TRIANGLE_COLOR_OPTIONS.findIndex(
      (option) => option.id === selected?.id
    );
    bundle.applyTriangleColor(globalIdx >= 0 ? globalIdx : 0);
  }, [triangleColorIdx, ownedTriangleColorOptions]);

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyQuality) return;
    bundle.applyQuality(qualityIdx);
  }, [qualityIdx]);

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle?.applyChairs) return;
    const selected = ownedChairOptions[chairThemeIdx] || ownedChairOptions[0];
    const globalIdx = CHAIR_THEMES.findIndex(
      (option) => option.id === selected?.id
    );
    void bundle.applyChairs(globalIdx >= 0 ? globalIdx : 0);
  }, [chairThemeIdx, ownedChairOptions]);

  useEffect(() => {
    if (!winner) return;
    playSfx(WIN_SOUND_URL, 0.9);
  }, [winner]);

  useEffect(() => {
    const bundle = sceneBundleRef.current;
    if (!bundle) return;
    const { chipGroup } = bundle;
    chipGroup.clear();

    const createChip = (color) => {
      const pieceGroup = new THREE.Group();
      const sideColor =
        CHECKERS_CHIP_COLORS[color] || CHECKERS_CHIP_COLORS[WHITE];
      const baseMaterial = createCheckerMaterial(
        sideColor,
        CHECKERS_CHIP_HEAD_PRESET
      );

      const chip = new THREE.Mesh(
        new THREE.CylinderGeometry(
          CHIP_RADIUS,
          CHIP_RADIUS * 0.94,
          CHIP_HEIGHT,
          56,
          1,
          false
        ),
        baseMaterial
      );
      chip.castShadow = true;
      chip.receiveShadow = true;
      pieceGroup.add(chip);

      const topCap = new THREE.Mesh(
        new THREE.CylinderGeometry(
          CHIP_RADIUS * 0.74,
          CHIP_RADIUS * 0.81,
          CHIP_HEIGHT * 0.42,
          48
        ),
        baseMaterial.clone()
      );
      topCap.position.y = CHIP_HEIGHT * 0.56;
      topCap.castShadow = true;
      topCap.receiveShadow = true;
      pieceGroup.add(topCap);

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(CHIP_RADIUS * 0.7, CHIP_RADIUS * 0.064, 16, 64),
        new THREE.MeshStandardMaterial({
          color: '#f8fafc',
          metalness: 0.88,
          roughness: 0.25,
          transparent: true,
          opacity: 0.85
        })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = CHIP_HEIGHT * 0.64;
      pieceGroup.add(rim);

      return pieceGroup;
    };

    const sourceTargets = new Set();
    const destinationTargets = new Set();
    available.forEach((sequence) => {
      sequence?.line?.forEach((move) => {
        if (typeof move?.from !== 'number' || typeof move?.to !== 'number')
          return;
        if (selectedPoint == null) {
          sourceTargets.add(move.from);
          return;
        }
        if (move.from === selectedPoint) {
          sourceTargets.add(move.from);
          destinationTargets.add(move.to);
        }
      });
    });

    if (activeMoveHighlight) {
      if (typeof activeMoveHighlight.from === 'number')
        sourceTargets.add(activeMoveHighlight.from);
      if (typeof activeMoveHighlight.to === 'number')
        destinationTargets.add(activeMoveHighlight.to);
    }

    const createPrecisionMarker = (isSource, emphasized = false) =>
      new THREE.Mesh(
        new THREE.TorusGeometry(
          CHIP_RADIUS * (isSource ? 1.08 : 0.92),
          CHIP_RADIUS * 0.09,
          16,
          48
        ),
        new THREE.MeshStandardMaterial({
          color: emphasized ? '#f59e0b' : isSource ? '#22d3ee' : '#60a5fa',
          emissive: emphasized ? '#7c2d12' : isSource ? '#164e63' : '#1e3a8a',
          emissiveIntensity: emphasized ? 1.35 : isSource ? 1 : 1.1,
          roughness: 0.28,
          metalness: 0.24,
          transparent: true,
          opacity: emphasized ? 0.98 : isSource ? 0.92 : 0.95
        })
      );

    const pointMarkerPosition = (pointIndex, forSource) => {
      const base = pointBasePosition(pointIndex);
      const point = game.points[pointIndex];
      const towardCenterSign = base.top ? 1 : -1;
      const count = point?.count || 0;
      const slot = forSource ? Math.max(0, count - 1) : count;
      const row = Math.min(slot % CHIP_MAX_PER_COLUMN, CHIP_MAX_PER_COLUMN - 1);
      return new THREE.Vector3(
        base.x,
        BOARD_Y + CHIP_BASE_Y_OFFSET + CHIP_HEIGHT * 0.12,
        base.z + towardCenterSign * (CHIP_POINT_INSET + row * CHIP_ROW_SPACING)
      );
    };

    for (let i = 0; i < 24; i += 1) {
      const point = game.points[i];
      if (!point.color || point.count <= 0) continue;
      const base = pointBasePosition(i);
      const totalColumns = Math.ceil(point.count / CHIP_MAX_PER_COLUMN);
      const columnCenterOffset = (totalColumns - 1) * 0.5;
      const towardCenterSign = base.top ? 1 : -1;
      for (let s = 0; s < point.count; s += 1) {
        const chip = createChip(point.color);
        const column = Math.floor(s / CHIP_MAX_PER_COLUMN);
        const row = s % CHIP_MAX_PER_COLUMN;
        chip.position.set(
          base.x + (column - columnCenterOffset) * CHIP_COLUMN_SPACING,
          BOARD_Y + CHIP_BASE_Y_OFFSET,
          base.z +
            towardCenterSign * (CHIP_POINT_INSET + row * CHIP_ROW_SPACING)
        );
        chipGroup.add(chip);
      }
    }

    sourceTargets.forEach((pointIndex) => {
      if (pointIndex < 0 || pointIndex >= 24) return;
      const marker = createPrecisionMarker(
        true,
        typeof selectedPoint === 'number' && pointIndex === selectedPoint
      );
      marker.rotation.x = Math.PI / 2;
      marker.position.copy(pointMarkerPosition(pointIndex, true));
      chipGroup.add(marker);
    });

    destinationTargets.forEach((pointIndex) => {
      if (pointIndex < 0 || pointIndex >= 24) return;
      const marker = createPrecisionMarker(
        false,
        activeMoveHighlight?.to === pointIndex || selectedPoint != null
      );
      if (selectedPoint != null) marker.scale.setScalar(1.12);
      marker.rotation.x = Math.PI / 2;
      marker.position.copy(pointMarkerPosition(pointIndex, false));
      chipGroup.add(marker);
    });

    const makeCapturedSideChips = (count, color, edge) => {
      if (!count) return;
      const maxPerRow = 12;
      for (let s = 0; s < count; s += 1) {
        const chip = createChip(color);
        const row = Math.floor(s / maxPerRow);
        const col = s % maxPerRow;
        const rowCount = Math.min(count - row * maxPerRow, maxPerRow);
        const centered = col - (rowCount - 1) / 2;
        chip.position.set(
          centered * CHIP_COLUMN_SPACING * CAPTURE_STRIP_PIECE_GAP,
          BOARD_Y + CHIP_BASE_Y_OFFSET,
          edge *
            (BOARD_HALF_Z +
              CHIP_POINT_INSET * (CAPTURE_STRIP_OFFSET_ROWS + row * 0.74))
        );
        chipGroup.add(chip);
      }
    };

    makeCapturedSideChips(game.bar.white, WHITE, 1);
    makeCapturedSideChips(game.bar.black, BLACK, -1);
  }, [game, available, activeMoveHighlight, selectedPoint]);

  const animateSequence = (state, color, sequence, onDone) => {
    const line = sequence?.line || [];
    if (!line.length) {
      onDone?.(state);
      return;
    }
    let idx = 0;
    let currentState = state;
    const runStep = () => {
      if (!isMountedRef.current) return;
      const move = line[idx];
      setActiveMoveHighlight({ from: move.from, to: move.to, color });
      const opponent = color === WHITE ? BLACK : WHITE;
      const previousOpponentBar = currentState.bar[opponent];
      currentState = applyMove(currentState, color, move);
      setGame(currentState);
      const wasCapture = currentState.bar[opponent] > previousOpponentBar;
      playSfx(MOVE_SOUND_URL, wasCapture ? 0.76 : 0.7);
      idx += 1;
      if (idx < line.length) {
        const timeoutId = window.setTimeout(runStep, 460);
        pendingTimeoutsRef.current.push(timeoutId);
      } else {
        const timeoutId = window.setTimeout(() => {
          setActiveMoveHighlight(null);
          onDone?.(currentState);
        }, 320);
        pendingTimeoutsRef.current.push(timeoutId);
      }
    };
    runStep();
  };

  const playAi = (stateAfterPlayer) => {
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const visibleAiDice = [d1, d2];
    const aiDice = d1 === d2 ? [d1, d1, d1, d1] : visibleAiDice;
    setMessage(`AI rolled ${d1} and ${d2}.`);
    setIsRollingDice(true);
    setAiThinking(true);
    setSelectedPoint(null);
    sceneBundleRef.current?.animateDiceThrow?.(visibleAiDice, 1);
    playSfx(DICE_ROLL_SOUND_URL, 1);

    const timeoutId = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      setIsRollingDice(false);
      let choice = null;
      try {
        choice = pickAiSequence(stateAfterPlayer, aiDice);
      } catch (error) {
        console.error(
          'Backgammon AI turn crashed, skipping turn safely.',
          error
        );
      }
      if (!choice || !choice.line.length) {
        setMessage(`AI rolled ${d1}/${d2} but had no legal move. Your turn.`);
        setAiThinking(false);
        setDice([]);
        setAvailable([]);
        return;
      }
      animateSequence(stateAfterPlayer, BLACK, choice, () => {
        setMessage(`AI played ${choice.line.length} move(s). Your turn.`);
        setAiThinking(false);
        setDice([]);
        setAvailable([]);
      });
    }, 850);
    pendingTimeoutsRef.current.push(timeoutId);
  };

  const roll = () => {
    if (aiThinking || winner || available.length > 0) return;
    setIsRollingDice(true);
    setSelectedPoint(null);
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    const visibleDice = [d1, d2];
    const useDice = d1 === d2 ? [d1, d1, d1, d1] : visibleDice;
    sceneBundleRef.current?.animateDiceThrow?.(visibleDice, 0);
    playSfx(DICE_ROLL_SOUND_URL, 1);
    const timeoutId = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      setIsRollingDice(false);
      playSfx(MOVE_SOUND_URL, 0.45);
      let seq = [];
      try {
        seq = collectTurnSequences(game, WHITE, useDice);
      } catch (error) {
        console.error('Backgammon player turn evaluation crashed.', error);
      }
      setDice(useDice);
      setAvailable(seq);
      if (!seq.length || !seq.some((s) => s.line.length)) {
        setMessage(`You rolled ${d1}/${d2} but no legal move. AI turn.`);
        playAi(game);
        return;
      }
      setMessage(
        'Tap a checker or triangle to select from-point, then tap destination triangle.'
      );
    }, 820);
    pendingTimeoutsRef.current.push(timeoutId);
  };

  const handleSequence = (sequence) => {
    if (!available.length || aiThinking || winner) return;
    if (!sequence?.line?.length) return;
    setAvailable([]);
    setDice([]);
    setMessage('Moving checkers…');
    animateSequence(game, WHITE, sequence, (stateAfterPlayer) => {
      setSelectedPoint(null);
      setMessage('You played. AI is thinking…');
      playAi(stateAfterPlayer);
    });
  };

  useEffect(() => {
    if (!available.length) {
      setSelectedPoint(null);
      return;
    }
    const onPointTap = (event) => {
      const point = event?.detail?.point;
      if (typeof point !== 'number' || aiThinking || winner) return;

      if (selectedPoint == null) {
        const startsFromPoint = available.filter(
          (seq) => seq?.line?.[0]?.from === point
        );
        if (!startsFromPoint.length) return;
        setSelectedPoint(point);
        const moveCount = new Set(
          startsFromPoint
            .map((seq) => seq?.line?.[0]?.to)
            .filter((toPoint) => typeof toPoint === 'number')
        ).size;
        setMessage(
          moveCount > 0
            ? `Piece selected. ${moveCount} legal destination${moveCount > 1 ? 's' : ''} highlighted.`
            : 'Piece selected. Tap destination triangle.'
        );
        return;
      }

      const narrowed = available.filter(
        (seq) =>
          seq?.line?.[0]?.from === selectedPoint && seq?.line?.[0]?.to === point
      );

      if (narrowed.length >= 1) {
        handleSequence(narrowed[0]);
        return;
      }

      const restartFromPoint = available.filter(
        (seq) => seq?.line?.[0]?.from === point
      );
      if (restartFromPoint.length) {
        setSelectedPoint(point);
        const moveCount = new Set(
          restartFromPoint
            .map((seq) => seq?.line?.[0]?.to)
            .filter((toPoint) => typeof toPoint === 'number')
        ).size;
        setMessage(
          moveCount > 0
            ? `Piece changed. ${moveCount} legal destination${moveCount > 1 ? 's' : ''} highlighted.`
            : 'From point changed. Tap destination triangle.'
        );
      }
    };

    window.addEventListener('tavullPointTap', onPointTap);
    return () => window.removeEventListener('tavullPointTap', onPointTap);
  }, [available, aiThinking, winner, selectedPoint]);

  return (
    <div className="fixed inset-0 bg-[#060b16] px-3 py-3 text-white touch-none select-none">
      {message ? (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 px-4">
          <div className="max-w-[80vw] rounded-full border border-white/15 bg-black/55 px-4 py-2 text-center text-xs font-semibold text-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur">
            {message}
          </div>
        </div>
      ) : null}

      <div className="absolute top-20 left-4 z-20 flex flex-col items-start gap-3 pointer-events-none">
        <button
          type="button"
          onClick={() => setConfigOpen((open) => !open)}
          aria-expanded={configOpen}
          aria-label={configOpen ? 'Close game menu' : 'Open game menu'}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-gray-100 shadow-[0_6px_18px_rgba(2,6,23,0.45)] transition hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <span className="text-base leading-none" aria-hidden="true">
            ☰
          </span>
          <span className="leading-none">Menu</span>
        </button>
      </div>

      <div className="absolute top-20 right-4 z-20 flex flex-col items-end gap-3 pointer-events-none">
        <div className="pointer-events-auto flex flex-col items-end gap-3">
          <button
            type="button"
            onClick={() => setViewMode((mode) => (mode === '3d' ? '2d' : '3d'))}
            className="icon-only-button flex h-10 w-10 items-center justify-center text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
          >
            {viewMode === '3d' ? '2D' : '3D'}
          </button>
          <BottomLeftIcons
            showInfo={false}
            showChat={false}
            showGift={false}
            className="flex flex-col"
            buttonClassName="icon-only-button pointer-events-auto flex h-10 w-10 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
            iconClassName="text-[1.5rem] leading-none"
            labelClassName="sr-only"
            muteIconOn="🔇"
            muteIconOff="🔊"
            order={['mute']}
          />
        </div>
      </div>

      {configOpen && (
        <div className="absolute top-20 right-4 z-30 pointer-events-auto mt-2 w-72 max-w-[80vw] rounded-2xl border border-white/15 bg-black/80 p-4 text-xs text-white shadow-2xl backdrop-blur max-h-[80vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-sky-200/80">
                Backgammon Settings
              </p>
              <p className="mt-1 text-[0.7rem] text-white/70">
                Personalize board finish, frame, triangle colors, chairs, and
                table finish.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfigOpen(false)}
              className="rounded-full p-1 text-white/70 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              aria-label="Close settings"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m6 6 12 12M18 6 6 18"
                />
              </svg>
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between text-[0.7rem] text-gray-200">
              <span>Sound effects</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border border-emerald-400/40 bg-transparent text-emerald-400 focus:ring-emerald-500"
                checked={soundEnabled}
                onChange={(event) => setSoundEnabled(event.target.checked)}
              />
            </label>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.35em] text-white/70">
                    Personalize Arena
                  </p>
                  <p className="mt-1 text-[0.7rem] text-white/60">
                    Table cloth, chairs, and table details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTableFinishIdx(0);
                    setChairThemeIdx(0);
                    setHdriIdx(0);
                    setBoardFinishIdx(0);
                    setFrameFinishIdx(0);
                    setTriangleColorIdx(0);
                    setQualityIdx(1);
                  }}
                  className="rounded-lg border border-white/15 px-2 py-1 text-[0.65rem] font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
                >
                  Reset
                </button>
              </div>
              <div className="mt-3 max-h-72 space-y-3">
                <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 px-1">
                  {customizationSections.map(({ key, label }) => {
                    const selectedSection = key === activeCustomizationKey;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveCustomizationKey(key)}
                        className={`whitespace-nowrap rounded-full border px-3 py-2 text-[0.7rem] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                          selectedSection
                            ? 'border-sky-400/70 bg-sky-500/10 text-white shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                            : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {activeCustomizationSection && (
                  <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                      {activeCustomizationSection.label}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {activeCustomizationSection.options.map((option, idx) => {
                        const selected = activeCustomizationSection.selectedIdx === idx;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => activeCustomizationSection.setSelectedIdx(idx)}
                            aria-pressed={selected}
                            className={`flex flex-col items-center rounded-2xl border p-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                              selected
                                ? 'border-sky-400/80 bg-sky-400/10 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                                : 'border-white/10 bg-white/5 hover:border-white/20'
                            }`}
                          >
                            {renderCustomizationPreview(option)}
                            <span className="mt-1 text-center text-[0.6rem] font-semibold text-gray-100">
                              {option.label || option.name || 'Option'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className="w-full rounded-lg border border-white/20 px-3 py-2 text-left"
                  onClick={() =>
                    setQualityIdx((v) => (v + 1) % QUALITY_OPTIONS.length)
                  }
                >
                  Graphics: {QUALITY_OPTIONS[qualityIdx]?.label || 'Balanced'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        <div ref={canvasHostRef} className="h-full w-full" />
      </div>

      <div className="absolute left-1/2 top-[81%] z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
        <button
          type="button"
          onClick={roll}
          disabled={
            aiThinking || winner || available.length > 0 || isRollingDice
          }
          className="rounded-xl border border-white/30 bg-transparent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Roll Dice
        </button>
      </div>

      <div className="pointer-events-auto">
        <BottomLeftIcons
          onGift={() => setShowGift(true)}
          showInfo={false}
          showChat={false}
          showMute={false}
          className="fixed right-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-50 flex flex-col gap-4"
          buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
          iconClassName="text-[1.65rem] leading-none"
          labelClassName="sr-only"
          giftIcon="🎁"
          order={['gift']}
        />
        <BottomLeftIcons
          onChat={() => setShowChat(true)}
          showInfo={false}
          showGift={false}
          showMute={false}
          className="fixed left-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-50 flex flex-col"
          buttonClassName="icon-only-button pointer-events-auto flex h-11 w-11 items-center justify-center text-white/90 transition-opacity duration-200 hover:text-white focus:outline-none"
          iconClassName="text-[1.65rem] leading-none"
          labelClassName="sr-only"
          chatIcon="💬"
          order={['chat']}
        />
      </div>

      {chatBubbles.map((bubble) => (
        <div key={bubble.id} className="chat-bubble chess-battle-chat-bubble">
          <span>{bubble.text}</span>
          <img
            src={bubble.photoUrl}
            alt="avatar"
            className="w-5 h-5 rounded-full"
          />
        </div>
      ))}

      <QuickMessagePopup
        open={showChat}
        onClose={() => setShowChat(false)}
        title="Quick Chat"
        onSend={(text) => {
          const id = Date.now();
          setChatBubbles((bubbles) => [
            ...bubbles,
            { id, text, photoUrl: playerAvatar || '/assets/icons/profile.svg' }
          ]);
          setTimeout(
            () =>
              setChatBubbles((bubbles) =>
                bubbles.filter((bubble) => bubble.id !== id)
              ),
            3000
          );
        }}
      />

      <GiftPopup
        open={showGift}
        onClose={() => setShowGift(false)}
        players={players}
        senderIndex={0}
      />

      <div className="absolute inset-0 z-10 pointer-events-none">
        {players.map((player) => {
          const fallback =
            FALLBACK_SEAT_POSITIONS[player.index] || FALLBACK_SEAT_POSITIONS[0];
          const positionStyle = {
            position: 'absolute',
            left: fallback.left,
            top: fallback.top,
            transform: 'translate(-50%, -50%)'
          };
          return (
            <div
              key={`backgammon-seat-${player.index}`}
              className="absolute pointer-events-auto flex flex-col items-center"
              style={positionStyle}
            >
              <AvatarTimer
                index={player.index}
                photoUrl={player.photoUrl}
                active={player.isTurn}
                isTurn={player.isTurn}
                timerPct={1}
                name={player.name}
                color={player.color}
                size={1}
              />
              <span className="mt-1 text-[0.65rem] font-semibold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
                {player.name}
              </span>
              {player.index === 1 && winner && (
                <span
                  className="mt-0.5 max-w-[120px] text-center text-[0.52rem] font-semibold leading-[1.2] text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {winner === WHITE ? 'You win!' : 'AI wins!'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
