import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as THREE from 'three';
import { loadExactUkrainianDroneModel } from '../utils/ukrainianDroneModel.js';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  POOL_ROYALE_DEFAULT_LOADOUT,
  POOL_ROYALE_OPTION_LABELS,
  POOL_ROYALE_STORE_ITEMS,
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_BASE_VARIANTS
} from '../config/poolRoyaleInventoryConfig.js';
import { POOL_ROYALE_CLOTH_VARIANTS } from '../config/poolRoyaleClothPresets.js';
import {
  SNOOKER_ROYALE_DEFAULT_LOADOUT,
  SNOOKER_ROYALE_OPTION_LABELS,
  SNOOKER_ROYALE_STORE_ITEMS,
  SNOOKER_ROYALE_HDRI_VARIANTS,
  SNOOKER_ROYALE_BASE_VARIANTS
} from '../config/snookerRoyalInventoryConfig.js';
import { SNOOKER_ROYALE_CLOTH_VARIANTS } from '../config/snookerRoyalClothPresets.js';
import {
  AIR_HOCKEY_DEFAULT_LOADOUT,
  AIR_HOCKEY_OPTION_LABELS,
  AIR_HOCKEY_STORE_ITEMS
} from '../config/airHockeyInventoryConfig.js';
import {
  GOAL_RUSH_DEFAULT_LOADOUT,
  GOAL_RUSH_OPTION_LABELS,
  GOAL_RUSH_STORE_ITEMS
} from '../config/goalRushInventoryConfig.js';
import {
  addPoolRoyalUnlock,
  getCachedPoolRoyalInventory,
  getPoolRoyalInventory,
  isPoolOptionUnlocked,
  listOwnedPoolRoyalOptions,
  poolRoyalAccountId
} from '../utils/poolRoyalInventory.js';
import {
  addSnookerRoyalUnlock,
  getCachedSnookerRoyalInventory,
  getSnookerRoyalInventory,
  isSnookerOptionUnlocked,
  listOwnedSnookerRoyalOptions,
  snookerRoyalAccountId
} from '../utils/snookerRoyalInventory.js';
import {
  addAirHockeyUnlock,
  airHockeyAccountId,
  getAirHockeyInventory,
  isAirHockeyOptionUnlocked,
  listOwnedAirHockeyOptions
} from '../utils/airHockeyInventory.js';
import {
  addGoalRushUnlock,
  goalRushAccountId,
  getGoalRushInventory,
  isGoalRushOptionUnlocked,
  listOwnedGoalRushOptions
} from '../utils/goalRushInventory.js';
import {
  CHESS_BATTLE_DEFAULT_LOADOUT,
  CHESS_BATTLE_OPTION_LABELS,
  CHESS_BATTLE_ROYAL_DEFAULT_LOADOUT,
  CHESS_BATTLE_ROYAL_OPTION_LABELS,
  CHESS_BATTLE_ROYAL_STORE_ITEMS,
  CHESS_BATTLE_STORE_ITEMS
} from '../config/chessBattleInventoryConfig.js';
import {
  FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT,
  FOUR_IN_ROW_BATTLE_OPTION_LABELS,
  FOUR_IN_ROW_BATTLE_STORE_ITEMS
} from '../config/fourInRowInventoryConfig.js';
import {
  addChessBattleUnlock,
  getChessBattleInventory,
  isChessOptionUnlocked,
  chessBattleAccountId,
  listOwnedChessOptions
} from '../utils/chessBattleInventory.js';
import {
  addFourInRowUnlock,
  getFourInRowInventory,
  isFourInRowOptionUnlocked,
  listOwnedFourInRowOptions,
  fourInRowAccountId
} from '../utils/fourInRowInventory.js';
import {
  LUDO_BATTLE_DEFAULT_LOADOUT,
  LUDO_BATTLE_OPTION_LABELS,
  LUDO_BATTLE_STORE_ITEMS
} from '../config/ludoBattleInventoryConfig.js';
import {
  TAVULL_BATTLE_DEFAULT_LOADOUT,
  TAVULL_BATTLE_OPTION_LABELS,
  TAVULL_BATTLE_STORE_ITEMS
} from '../config/tavullBattleInventoryConfig.js';
import {
  addLudoBattleUnlock,
  getLudoBattleInventory,
  isLudoOptionUnlocked,
  listOwnedLudoOptions,
  ludoBattleAccountId
} from '../utils/ludoBattleInventory.js';
import {
  addTavullBattleUnlock,
  getTavullBattleInventory,
  isTavullOptionUnlocked,
  listOwnedTavullOptions,
  tavullBattleAccountId
} from '../utils/tavullBattleInventory.js';
import {
  MURLAN_ROYALE_DEFAULT_LOADOUT,
  MURLAN_ROYALE_OPTION_LABELS,
  MURLAN_ROYALE_STORE_ITEMS
} from '../config/murlanInventoryConfig.js';
import {
  addMurlanUnlock,
  getMurlanInventory,
  isMurlanOptionUnlocked,
  listOwnedMurlanOptions,
  murlanAccountId
} from '../utils/murlanInventory.js';
import {
  DOMINO_ROYAL_DEFAULT_LOADOUT,
  DOMINO_ROYAL_OPTION_LABELS,
  DOMINO_ROYAL_STORE_ITEMS
} from '../config/dominoRoyalInventoryConfig.js';
import {
  TEXAS_HOLDEM_DEFAULT_LOADOUT,
  TEXAS_HOLDEM_OPTION_LABELS,
  TEXAS_HOLDEM_STORE_ITEMS
} from '../config/texasHoldemInventoryConfig.js';
import { BOWLING_DEFAULT_LOADOUT, BOWLING_OPTION_LABELS, BOWLING_STORE_ITEMS } from '../config/bowlingInventoryConfig.js';
import { TABLE_CLOTH_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { TABLE_SHAPE_OPTIONS } from '../utils/murlanTable.js';
import {
  SNAKE_DEFAULT_LOADOUT,
  SNAKE_OPTION_LABELS,
  SNAKE_STORE_ITEMS
} from '../config/snakeInventoryConfig.js';
import {
  addDominoRoyalUnlock,
  dominoRoyalAccountId,
  getDominoRoyalInventory,
  isDominoOptionUnlocked,
  listOwnedDominoOptions
} from '../utils/dominoRoyalInventory.js';
import {
  addSnakeUnlock,
  getSnakeInventory,
  isSnakeOptionUnlocked,
  listOwnedSnakeOptions,
  snakeAccountId
} from '../utils/snakeInventory.js';
import {
  addTexasHoldemUnlock,
  getTexasHoldemInventory,
  isTexasOptionUnlocked,
  listOwnedTexasOptions,
  texasHoldemAccountId
} from '../utils/texasHoldemInventory.js';
import { buyBundle, getAccountBalance } from '../utils/api.js';
import { addTrainingAttempts } from '../utils/poolRoyaleTrainingProgress.js';
import {
  getLastStorePurchaseSnapshot,
  recordStorePurchase
} from '../utils/storeTransactions.js';
import { DEV_INFO } from '../utils/constants.js';
import { swatchThumbnail } from '../config/storeThumbnails.js';
import { getCustomHdriCatalog, saveCustomHdriEntry } from '../utils/customHdriCatalog.js';

const UKRAINIAN_DRONE_PREVIEW_STATUS = Object.freeze({
  loading: 'LOADING',
  ready: 'READY',
  fallback: 'FALLBACK'
});

function fitUkrainianDronePreviewObject(model, targetLength = 4.2) {
  model.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxLength = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxLength) || maxLength <= 0) return;
  model.scale.setScalar(targetLength / maxLength);
  model.updateMatrixWorld?.(true);
  const fittedBox = new THREE.Box3().setFromObject(model);
  const center = fittedBox.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y += -fittedBox.min.y + 1.4;
  model.updateMatrixWorld?.(true);
}

function createUkrainianDronePreviewFallback() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#7b8792', roughness: 0.65, metalness: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#374151', roughness: 0.7, metalness: 0.12 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.4, 24), bodyMat);
  body.rotation.z = Math.PI / 2;
  body.position.y = 1.8;
  group.add(body);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 3.0), bodyMat);
  wing.position.set(-0.1, 1.76, 0);
  group.add(wing);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 24), bodyMat);
  nose.rotation.z = -Math.PI / 2;
  nose.position.set(1.45, 1.8, 0);
  group.add(nose);

  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 0.08), darkMat);
  prop.name = 'propeller';
  prop.position.set(-1.45, 1.8, 0);
  group.add(prop);

  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  return group;
}

function disposeUkrainianDronePreviewObject(object) {
  object?.traverse?.((child) => {
    if (!child?.isMesh && !child?.isSkinnedMesh) return;
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    materials.forEach((material) => {
      ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap'].forEach((key) => material?.[key]?.dispose?.());
      material?.dispose?.();
    });
  });
}

function UkrainianDroneExactPreview({ showCaption = true, size = 'sm', containerClassName = '' }) {
  const mountRef = useRef(null);
  const runtimeRef = useRef(null);
  const [status, setStatus] = useState(UKRAINIAN_DRONE_PREVIEW_STATUS.loading);
  const sizeClasses = {
    sm: 'h-16 w-24',
    md: 'h-24 w-40',
    lg: 'h-32 w-full'
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let frame = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#020617');
    scene.fog = new THREE.Fog('#020617', 18, 48);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
    camera.position.set(5.2, 4.2, 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 2.1));

    const key = new THREE.DirectionalLight(0xffffff, 4.4);
    key.position.set(5, 7, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    scene.add(key);

    const fill = new THREE.PointLight(0x9cc8ff, 11, 28, 1.4);
    fill.position.set(-3, 3.8, 5.5);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 72),
      new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.88, metalness: 0.12 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const resize = () => {
      const width = mount.clientWidth || 160;
      const height = mount.clientHeight || 100;
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const start = async () => {
      try {
        setStatus(UKRAINIAN_DRONE_PREVIEW_STATUS.loading);
        const drone = await loadExactUkrainianDroneModel(renderer);
        if (disposed) {
          disposeUkrainianDronePreviewObject(drone);
          return;
        }
        fitUkrainianDronePreviewObject(drone, 4.2);
        drone.rotation.y = 0.45;
        scene.add(drone);
        runtimeRef.current = { root: drone, baseY: drone.position.y };
        setStatus(UKRAINIAN_DRONE_PREVIEW_STATUS.ready);
      } catch (error) {
        console.warn('Store Ukrainian drone exact preview failed, using fallback drone', error);
        if (disposed) return;
        const fallback = createUkrainianDronePreviewFallback();
        scene.add(fallback);
        runtimeRef.current = { root: fallback, baseY: fallback.position.y };
        setStatus(UKRAINIAN_DRONE_PREVIEW_STATUS.fallback);
      }
    };

    resize();
    void start();
    const clock = new THREE.Clock();
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const time = clock.elapsedTime;
      const runtime = runtimeRef.current;
      if (runtime?.root) {
        runtime.root.position.y = runtime.baseY + Math.sin(time * 1.5) * 0.08;
        runtime.root.rotation.y += 0.004;
        runtime.root.traverse((obj) => {
          if (obj.name?.toLowerCase?.().includes('propeller') || obj.name?.toLowerCase?.().includes('rotor')) {
            obj.rotation.x = time * 24;
          }
        });
      }
      renderer.render(scene, camera);
    };
    animate();

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    window.addEventListener('resize', resize);

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
      if (runtimeRef.current?.root) disposeUkrainianDronePreviewObject(runtimeRef.current.root);
      floor.geometry.dispose();
      floor.material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      runtimeRef.current = null;
    };
  }, []);

  return (
    <div className={`flex items-center gap-3 ${containerClassName}`}>
      <div className={`relative overflow-hidden rounded-xl border border-white/10 bg-[#020617] shadow-[0_18px_45px_-26px_rgba(0,0,0,0.9)] ${sizeClasses[size] || sizeClasses.sm}`}>
        <div ref={mountRef} className="absolute inset-0" />
        <div className="pointer-events-none absolute left-1 top-1 rounded-full border border-white/10 bg-slate-950/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-white/80">
          {status}
        </div>
      </div>
      {showCaption ? (
        <div className="grid gap-0.5 text-xs text-white/70">
          <span className="font-semibold text-white">Exact GLB Drone</span>
          <span className="text-white/60">Original textures + fallbacks</span>
        </div>
      ) : null}
    </div>
  );
}

const TYPE_LABELS = {
  tableFinish: 'Table Finishes',
  chromeColor: 'Chrome Fascias',
  railMarkerColor: 'Rail Markers',
  tableBase: 'Table Bases',
  clothColor: 'Cloth Colors',
  cueStyle: 'Cue Styles',
  pocketLiner: 'Pocket Jaws',
  environmentHdri: 'HDR Environments',
  poolTrainingAttempt: 'Training Attempts'
};

const AIR_HOCKEY_TYPE_LABELS = {
  field: 'Rink Surface',
  cushionCloth: 'Cushion Cloth',
  table: 'Table Finish',
  tableBase: 'Table Bases',
  environmentHdri: 'HDR Environments',
  puck: 'Puck Finish',
  mallet: 'Mallets',
  rails: 'Rails',
  goals: 'Goals'
};

const GOAL_RUSH_TYPE_LABELS = {
  field: 'Pitch Surface',
  cushionCloth: 'Cushion Cloth',
  table: 'Table Finish',
  tableBase: 'Table Bases',
  environmentHdri: 'HDR Environments',
  puck: 'WebGL Balls',
  mallet: 'Strikers',
  rails: 'Rails',
  goals: 'Goal Nets'
};

const CHESS_TYPE_LABELS = {
  tables: 'Table Models',
  tableFinish: 'Table Finish',
  tableCloth: 'Table Cloth',
  chairColor: 'Chairs',
  humanCharacter: 'Human Characters',
  sideColor: 'Piece Colors',
  boardTheme: 'Board Themes',
  headStyle: 'Pawn Heads',
  environmentHdri: 'HDR Environments'
};
const CHECKERS_BATTLE_TYPE_LABELS = {
  ...CHESS_TYPE_LABELS,
  tableCloth: 'Table Cloth'
};

const CHECKERS_PROCEDURAL_TABLES = [
  {
    id: 'murlan-default',
    label: 'Octagon Table',
    thumbnail:
      TABLE_SHAPE_OPTIONS.find((option) => option.id === 'classicOctagon')
        ?.thumbnail
  },
  {
    id: 'ovalTable',
    label: 'Oval Table',
    thumbnail:
      TABLE_SHAPE_OPTIONS.find((option) => option.id === 'grandOval')?.thumbnail
  },
  {
    id: 'diamondEdge',
    label: 'Diamond Edge Table',
    thumbnail:
      TABLE_SHAPE_OPTIONS.find((option) => option.id === 'diamondEdge')
        ?.thumbnail
  },
  {
    id: 'hexagonTable',
    label: 'Hexagon Table',
    thumbnail:
      TABLE_SHAPE_OPTIONS.find((option) => option.id === 'hexagonTable')
        ?.thumbnail
  }
];

const CHECKERS_BATTLE_STORE_ITEMS = [
  ...CHESS_BATTLE_STORE_ITEMS,
  ...CHECKERS_PROCEDURAL_TABLES.filter((table) => table.id !== 'murlan-default')
    .map((table, idx) => ({
      id: `checkers-table-${table.id}`,
      type: 'tables',
      optionId: table.id,
      name: table.label,
      price: 980 + idx * 45,
      description: `${table.label} layout for Checkers Battle Royal.`,
      thumbnail: table.thumbnail,
      previewShape: 'table'
    })),
  ...TABLE_CLOTH_OPTIONS.slice(1).map((option, idx) => ({
    id: `checkers-cloth-${option.id}`,
    type: 'tableCloth',
    optionId: option.id,
    name: option.label,
    price: 360 + idx * 35,
    description: 'Premium table cloth option for procedural checkers tables.',
    thumbnail: option.thumbnail,
    previewShape: 'table'
  }))
];
const TAVULL_TYPE_LABELS = {
  tableFinish: 'Table Finish',
  chairColor: 'Chairs',
  boardFinish: 'Board Finish',
  frameFinish: 'Board Frame',
  triangleColor: 'Triangle Colors',
  environmentHdri: 'HDR Environments'
};

const FOUR_IN_ROW_TYPE_LABELS = {
  tables: 'Table Models',
  tableFinish: 'Table Finish',
  chairColor: 'Chairs',
  boardTheme: 'Board Skins',
  boardLayout: 'Board Sizes',
  stoneStyle: 'Stone Sets',
  environmentHdri: 'HDR Environments'
};

const BLACKJACK_TYPE_LABELS = {
  tableWood: 'Table Wood',
  tableCloth: 'Table Cloth',
  chairColor: 'Chairs',
  tableShape: 'Table Shape',
  cards: 'Cards'
};

const LUDO_TYPE_LABELS = {
  tables: 'Table Models',
  tableFinish: 'Table Finish',
  stools: 'Stools & Chairs',
  environmentHdri: 'HDR Environments',
  tokenPalette: 'Token Palette',
  tokenStyle: 'Token Style',
  tokenPiece: 'Token Piece',
  sideColor: 'Piece Colors',
  headStyle: 'Pawn Heads'
};

const MURLAN_TYPE_LABELS = {
  outfit: 'Outfits',
  cards: 'Card Themes',
  stools: 'Stools & Chairs',
  characters: '3D Characters',
  tables: 'Table Models',
  tableCloth: 'Table Cloth',
  tableFinish: 'Table Finish',
  environmentHdri: 'HDR Environments'
};

const DOMINO_TYPE_LABELS = {
  tableWood: 'Table Wood',
  tableCloth: 'Table Cloth',
  tableBase: 'Table Base',
  tableTheme: 'Table Models',
  environmentHdri: 'HDR Environments',
  dominoStyle: 'Domino Colors',
  dominoDotStyle: 'Domino Dots',
  dominoFrameStyle: 'Domino Frames',
  highlightStyle: 'Highlights',
  chairTheme: 'Chairs'
};

const SNAKE_TYPE_LABELS = {
  arenaTheme: 'Arena Atmosphere',
  boardPalette: 'Board Palette',
  snakeSkin: 'Snake Skins',
  diceTheme: 'Dice Finish',
  railTheme: 'Rails & Nets',
  tokenFinish: 'Token Finish',
  tokenColor: 'Token Colors',
  headStyle: 'Pawn Heads',
  tokenShape: 'Token Shape',
  tableFinish: 'Table Finish',
  tables: 'Table Models',
  stools: 'Chairs',
  environmentHdri: 'HDR Environments'
};

const TEXAS_TYPE_LABELS = {
  tableFinish: 'Table Finish',
  tableWood: 'Table Wood',
  tableCloth: 'Table Cloth',
  tableBase: 'Table Base',
  chairTheme: 'Chairs',
  tableTheme: 'Table Models',
  tableShape: 'Table Shape',
  cards: 'Cards',
  environmentHdri: 'HDR Environments'
};

const TON_ICON = '/assets/icons/ezgif-54c96d8a9b9236.webp';
const TON_PRICE_MIN = 100;
const TON_PRICE_MAX = 5000;
const THUMBNAIL_SIZE = 256;
const ZOOM_PREVIEW_SIZE = 1024;
const POLYHAVEN_THUMBNAIL_BASE = 'https://cdn.polyhaven.com/asset_img/thumbs/';
const POOL_STORE_ACCOUNT_ID =
  import.meta.env.VITE_POOL_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;
const SNOOKER_STORE_ACCOUNT_ID =
  import.meta.env.VITE_SNOOKER_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;
const AIR_HOCKEY_STORE_ACCOUNT_ID =
  import.meta.env.VITE_AIR_HOCKEY_STORE_ACCOUNT_ID || DEV_INFO.account;
const GOAL_RUSH_STORE_ACCOUNT_ID =
  import.meta.env.VITE_GOAL_RUSH_STORE_ACCOUNT_ID || DEV_INFO.account;
const CHESS_STORE_ACCOUNT_ID =
  import.meta.env.VITE_CHESS_BATTLE_STORE_ACCOUNT_ID || DEV_INFO.account;
const TAVULL_STORE_ACCOUNT_ID =
  import.meta.env.VITE_TAVULL_BATTLE_STORE_ACCOUNT_ID || DEV_INFO.account;
const BLACKJACK_STORE_ACCOUNT_ID =
  import.meta.env.VITE_BLACKJACK_STORE_ACCOUNT_ID || DEV_INFO.account;
const LUDO_STORE_ACCOUNT_ID =
  import.meta.env.VITE_LUDO_BATTLE_STORE_ACCOUNT_ID || DEV_INFO.account;
const MURLAN_STORE_ACCOUNT_ID =
  import.meta.env.VITE_MURLAN_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;
const DOMINO_STORE_ACCOUNT_ID =
  import.meta.env.VITE_DOMINO_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;
const SNAKE_STORE_ACCOUNT_ID =
  import.meta.env.VITE_SNAKE_STORE_ACCOUNT_ID || DEV_INFO.account;
const TEXAS_STORE_ACCOUNT_ID =
  import.meta.env.VITE_TEXAS_HOLDEM_STORE_ACCOUNT_ID || DEV_INFO.account;
const FACE_SCAN_BUILD_TARIFF_TPC = 3200;
const FACE_SCAN_DETAIL_TARIFF_PER_POSE_TPC = 450;
const FACE_SCAN_CREATOR_STEPS = [
  {
    id: 'camera',
    title: '1) Scan with phone camera',
    description: 'Capture front, left, right, and raised chin angles in portrait.'
  },
  {
    id: 'mesh',
    title: '2) Build 3D face mesh',
    description: 'Use side details to generate a full 3D head scan preview.'
  },
  {
    id: 'body',
    title: '3) Pick human body',
    description: 'Attach the scanned head to one of the human character bodies in store.'
  },
  {
    id: 'create',
    title: '4) Create character',
    description: 'Save your custom human character with the scanned face attached.'
  }
];
const FACE_SCAN_POSES = Object.freeze([
  { id: 'front', label: 'Front', hint: 'Look straight at the screen' },
  { id: 'left', label: 'Left side', hint: 'Turn face visually left' },
  { id: 'right', label: 'Right side', hint: 'Turn face visually right' },
  { id: 'chin', label: 'Chin up', hint: 'Lift chin higher' }
]);
const FACE_SCAN_DETAIL_PRESETS = [
  { label: 'Natural hero', detail: 'Balanced', lighting: 'Soft studio', expression: 'Neutral' },
  { label: 'Arcade avatar', detail: 'Stylized', lighting: 'Neon rim', expression: 'Confident' },
  { label: 'Real scan', detail: 'High detail', lighting: 'Even daylight', expression: 'Relaxed' }
];
const FACE_SCAN_BODY_OPTIONS = Object.freeze([
  { id: 'human-warrior', label: 'Royal Warrior', tone: '#38bdf8', outfit: '#1e3a8a' },
  { id: 'human-striker', label: 'Arena Striker', tone: '#f97316', outfit: '#7c2d12' },
  { id: 'human-casual', label: 'Casual Player', tone: '#22c55e', outfit: '#14532d' },
  { id: 'human-champion', label: 'Gold Champion', tone: '#facc15', outfit: '#713f12' }
]);

const createItemKey = (type, optionId) => `${type}:${optionId}`;
const selectionKey = (item) => `${item.slug}:${item.id}`;
const formatTpcAmount = (value) => Number(value || 0).toLocaleString();
const normalizeAccount = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const resolveSwatches = (type, optionId, fallbackSwatches = []) => {
  if (OPTION_SWATCH_OVERRIDES[optionId])
    return OPTION_SWATCH_OVERRIDES[optionId];
  if (TYPE_SWATCHES[type]) return TYPE_SWATCHES[type];
  if (fallbackSwatches.length) return fallbackSwatches;
  return TYPE_SWATCHES.default;
};

const resolvePreviewShape = (slug, type, preferredShape) => {
  if (preferredShape) return preferredShape;
  if (PREVIEW_BY_TYPE[type]) return PREVIEW_BY_TYPE[type];
  if (PREVIEW_BY_SLUG[slug]) return PREVIEW_BY_SLUG[slug];
  return 'default';
};

const previewLabel = (shape) => PREVIEW_LABELS[shape] || PREVIEW_LABELS.default;

const GAME_HDRI_SELECTION_STORAGE_KEYS = Object.freeze({
  poolroyale: 'poolHdriEnvironment',
  bilardoshqip: 'bilardoShqipHdriEnvironment',
  snookerroyale: 'snookerHdriEnvironment'
});

function FaceScanCharacterPreview({ scanEntries = [], bodyOption, title }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let disposed = false;
    let frame = 0;
    const width = Math.max(1, mount.clientWidth || 360);
    const height = Math.max(1, mount.clientHeight || 320);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 1.7, 6.2);
    camera.lookAt(0, 1.55, 0);

    scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x111827, 2.7));
    const key = new THREE.DirectionalLight(0xffffff, 4.8);
    key.position.set(3.8, 5.2, 5.5);
    scene.add(key);
    const rim = new THREE.PointLight(0x67e8f9, 12, 16, 1.4);
    rim.position.set(-3, 2.6, 3.8);
    scene.add(rim);

    const bodyColor = new THREE.Color(bodyOption?.outfit || '#1e3a8a');
    const accentColor = new THREE.Color(bodyOption?.tone || '#38bdf8');
    const skinMat = new THREE.MeshStandardMaterial({ color: '#f0b887', roughness: 0.58, metalness: 0.02 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.48, metalness: 0.08 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.35, metalness: 0.18, emissive: accentColor, emissiveIntensity: 0.08 });
    const darkMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.75, metalness: 0.04 });
    const lineMat = new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.65 });

    const group = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 1.12, 8, 24), bodyMat);
    torso.position.y = 0.95;
    group.add(torso);

    const chest = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.025, 8, 64), accentMat);
    chest.position.set(0, 1.25, 0.32);
    chest.rotation.x = Math.PI / 2;
    group.add(chest);

    [-0.62, 0.62].forEach((x) => {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.92, 8, 16), bodyMat);
      arm.position.set(x, 0.95, 0);
      arm.rotation.z = x > 0 ? -0.2 : 0.2;
      group.add(arm);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 1.0, 8, 16), darkMat);
      leg.position.set(x * 0.35, 0.02, 0);
      group.add(leg);
    });

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.26, 24), skinMat);
    neck.position.y = 1.72;
    group.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.43, 48, 32), skinMat);
    head.scale.set(0.82, 1.08, 0.72);
    head.position.y = 2.16;
    group.add(head);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 16), skinMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 2.17, 0.33);
    group.add(nose);

    [-0.14, 0.14].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), darkMat);
      eye.position.set(x, 2.23, 0.32);
      eye.scale.set(1, 0.7, 0.45);
      group.add(eye);
    });

    const scanRing = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.012, 8, 96), accentMat);
    scanRing.position.y = 2.16;
    scanRing.rotation.x = Math.PI / 2;
    group.add(scanRing);

    const points = [];
    const poseCount = Math.max(1, scanEntries.length);
    for (let i = 0; i < poseCount; i += 1) {
      const angle = (i / poseCount) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * 0.58, 2.16 + Math.sin(i * 1.7) * 0.12, Math.sin(angle) * 0.58));
    }
    if (points.length > 1) {
      points.push(points[0].clone());
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMat));
    }

    group.position.y = -0.28;
    scene.add(group);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.75, 72),
      new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9, metalness: 0.05, transparent: true, opacity: 0.82 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.86;
    scene.add(floor);

    const onResize = () => {
      if (disposed) return;
      const nextWidth = Math.max(1, mount.clientWidth || 360);
      const nextHeight = Math.max(1, mount.clientHeight || 320);
      renderer.setSize(nextWidth, nextHeight, false);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    };

    mount.innerHTML = '';
    mount.appendChild(renderer.domElement);
    window.addEventListener('resize', onResize);

    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const t = performance.now() * 0.001;
      group.rotation.y = Math.sin(t * 0.7) * 0.28;
      scanRing.rotation.z = t * 1.4;
      scanRing.scale.setScalar(1 + Math.sin(t * 2.4) * 0.035);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      scene.traverse((child) => {
        if (!child.isMesh && !child.isLine) return;
        child.geometry?.dispose?.();
        const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
        materials.forEach((material) => material.dispose?.());
      });
      renderer.dispose?.();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [bodyOption, scanEntries.length]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-200/35 bg-slate-950/70">
      <div ref={mountRef} className="h-72 w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 py-2 text-[11px] text-cyan-50/90">
        3D face scan preview · head attached to {bodyOption?.label || 'human body'} · {title}
      </div>
    </div>
  );
}

const normalizePolyHavenImage = (url, size) => {
  if (typeof url !== 'string' || !url.startsWith(POLYHAVEN_THUMBNAIL_BASE))
    return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('width', size);
    parsed.searchParams.set('height', size);
    return parsed.toString();
  } catch (error) {
    return url;
  }
};

const DEFAULT_LIST_FORM = {
  itemId: '',
  price: ''
};

const TYPE_SWATCHES = {
  tableFinish: ['#3b2f2f', '#8b5a2b'],
  chromeColor: ['#f5f5f5', '#d4d4d8'],
  railMarkerColor: ['#9ca3af', '#fef3c7'],
  tableBase: ['#0f172a', '#1f2937'],
  clothColor: ['#0f766e', '#22c55e'],
  cueStyle: ['#0f172a', '#1e293b'],
  environmentHdri: ['#0ea5e9', '#312e81'],
  field: ['#22d3ee', '#0ea5e9'],
  table: ['#4b5563', '#94a3b8'],
  puck: ['#111827', '#4b5563'],
  mallet: ['#111827', '#f59e0b'],
  rails: ['#1e293b', '#334155'],
  goals: ['#f97316', '#fb923c'],
  tableWood: ['#4b3621', '#9a7b4f'],
  tableCloth: ['#0f172a', '#34d399'],
  tableTheme: ['#0f172a', '#e5e7eb'],
  tables: ['#0f172a', '#94a3b8'],
  stools: ['#111827', '#eab308'],
  chairTheme: ['#0f172a', '#f59e0b'],
  chairColor: ['#111827', '#f59e0b'],
  humanCharacter: ['#334155', '#fca5a5'],
  tableShape: ['#334155', '#64748b'],
  sideColor: ['#f8fafc', '#1f2937'],
  boardTheme: ['#f59e0b', '#14b8a6'],
  headStyle: ['#0f172a', '#facc15'],
  cards: ['#f8fafc', '#e5e7eb'],
  dominoStyle: ['#f8fafc', '#d1d5db'],
  dominoDotStyle: ['#111827', '#eab308'],
  dominoFrameStyle: ['#f59e0b', '#a1a1aa'],
  highlightStyle: ['#22d3ee', '#818cf8'],
  tokenPalette: ['#ef4444', '#22c55e', '#3b82f6'],
  tokenStyle: ['#eab308', '#6366f1'],
  tokenPiece: ['#0f172a', '#e11d48'],
  arenaTheme: ['#0ea5e9', '#a855f7'],
  boardPalette: ['#38bdf8', '#10b981'],
  snakeSkin: ['#16a34a', '#65a30d'],
  diceTheme: ['#f8fafc', '#e11d48'],
  railTheme: ['#1e293b', '#64748b'],
  tokenFinish: ['#facc15', '#fb7185'],
  tokenColor: ['#f59e0b', '#10b981'],
  default: ['#22c55e', '#0ea5e9']
};

const POOL_CLOTH_SWATCHES = POOL_ROYALE_CLOTH_VARIANTS.reduce((acc, cloth) => {
  if (cloth?.swatches?.length) {
    acc[cloth.id] = cloth.swatches;
  }
  return acc;
}, {});

const SNOOKER_CLOTH_SWATCHES = SNOOKER_ROYALE_CLOTH_VARIANTS.reduce(
  (acc, cloth) => {
    if (cloth?.swatches?.length) {
      acc[cloth.id] = cloth.swatches;
    }
    return acc;
  },
  {}
);

const OPTION_SWATCH_OVERRIDES = {
  ...POOL_CLOTH_SWATCHES,
  ...SNOOKER_CLOTH_SWATCHES,
  peelingPaintWeathered: ['#a89f95', '#b8b3aa'],
  oakVeneer01: ['#b9854e', '#c89a64'],
  woodTable001: ['#8f6243', '#a4724f'],
  darkWood: ['#2f241f', '#3d2f2a'],
  rosewoodVeneer01: ['#5b2f26', '#6f3a2f'],
  gold: ['#f59e0b', '#fbbf24'],
  chrome: ['#e5e7eb', '#a1a1aa'],
  pearl: ['#f5f3ff', '#e2e8f0'],
  'redwood-ember': ['#7f1d1d', '#b45309'],
  'birch-frost': ['#f8fafc', '#cbd5e1'],
  'wenge-nightfall': ['#111827', '#312e81'],
  'mahogany-heritage': ['#4c1d95', '#7e22ce'],
  'walnut-satin': ['#4a3728', '#b68973'],
  'carbon-matrix': ['#0f172a', '#94a3b8'],
  'maple-horizon': ['#fef3c7', '#fbbf24'],
  'graphite-aurora': ['#111827', '#22d3ee'],
  amberGlow: ['#f59e0b', '#fbbf24'],
  mintVale: ['#10b981', '#34d399'],
  royalWave: ['#3b82f6', '#60a5fa'],
  roseMist: ['#ef4444', '#f87171'],
  amethyst: ['#8b5cf6', '#c4b5fd'],
  marble: ['#f8fafc', '#e2e8f0'],
  darkForest: ['#14532d', '#22c55e'],
  arcticRidge: ['#bae6fd', '#38bdf8'],
  basaltStone: ['#1f2937', '#0f172a'],
  emeraldSide: ['#22c55e', '#16a34a'],
  royalIvory: ['#f8fafc', '#e2e8f0'],
  neonRush: ['#f472b6', '#22d3ee'],
  duskMallet: ['#0f172a', '#1e3a8a'],
  cinderBlaze: ['#ff6b35', '#2b1a12'],
  arcticDrift: ['#bcd7ff', '#1f2f52'],
  nebulaGlass: ['#e0f2fe', '#0b1024'],
  ...POOL_ROYALE_BASE_VARIANTS.reduce((acc, variant) => {
    if (Array.isArray(variant.swatches) && variant.swatches.length) {
      acc[variant.id] = variant.swatches;
    }
    return acc;
  }, {}),
  ...SNOOKER_ROYALE_BASE_VARIANTS.reduce((acc, variant) => {
    if (Array.isArray(variant.swatches) && variant.swatches.length) {
      acc[variant.id] = variant.swatches;
    }
    return acc;
  }, {}),
  ...POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
    if (Array.isArray(variant.swatches) && variant.swatches.length) {
      acc[variant.id] = variant.swatches;
    }
    return acc;
  }, {}),
  ...SNOOKER_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
    if (Array.isArray(variant.swatches) && variant.swatches.length) {
      acc[variant.id] = variant.swatches;
    }
    return acc;
  }, {})
};

const PREVIEW_BY_TYPE = {
  cueStyle: 'cue',
  chairColor: 'chair',
  humanCharacter: 'chair',
  stools: 'chair',
  boardTheme: 'chess-royals',
  sideColor: 'chess-royals',
  headStyle: 'pawn-head',
  chromeColor: 'chrome',
  environmentHdri: 'table',
  cards: 'cards',
  dominoStyle: 'domino',
  dominoDotStyle: 'pawn-head',
  dominoFrameStyle: 'domino',
  tokenPalette: 'token-stack',
  tokenStyle: 'token-stack',
  tokenPiece: 'token-stack',
  tokenFinish: 'token-stack',
  diceTheme: 'dice',
  mallet: 'puck',
  puck: 'puck',
  rails: 'table',
  table: 'table',
  tableFinish: 'table',
  tableBase: 'table',
  tableWood: 'table',
  tableCloth: 'table',
  tableTheme: 'table',
  chairTheme: 'chair',
  tables: 'table'
};

const PREVIEW_BY_SLUG = {
  chessbattleroyal: 'chess-royals',
  checkersbattleroyal: 'chess-royals',
  fourinrowroyale: 'chess-royals',
  tavullbattleroyal: 'chess-royals',
  'domino-royal': 'domino'
};

const PREVIEW_LABELS = {
  cue: 'Cue render',
  chair: 'Lounge chair',
  'chess-royals': 'King & Queen',
  'pawn-head': 'Pawn heads',
  chrome: 'Chrome fascia',
  domino: 'Domino tile',
  cards: 'Card stack',
  dice: 'Dice pair',
  table: 'Table surface',
  puck: 'Rink gear',
  'token-stack': 'Token stack',
  default: '3D sample'
};

const USAGE_BY_TYPE = {
  tableFinish: {
    title: 'Table finish',
    description:
      'Updates the main table finish visible in every match, replay, and lobby preview.'
  },
  tableBase: {
    title: 'Table base',
    description:
      'Swaps the base build under the table for all match cameras and result screens.'
  },
  tableWood: {
    title: 'Table wood',
    description:
      'Replaces the wooden trim around the table for all match broadcasts.'
  },
  tableCloth: {
    title: 'Table cloth',
    description:
      'Changes the cloth color and texture players see during every rally.'
  },
  clothColor: {
    title: 'Cloth color',
    description:
      'Applies a new cloth palette to the table surface in matches and training rooms.'
  },
  cueStyle: {
    title: 'Cue style',
    description:
      'Replaces the cue model shown in aim view, replays, and win screens.'
  },
  pocketLiner: {
    title: 'Pocket jaws',
    description:
      'Updates the pocket liners that are visible in close-up shots and replays.'
  },
  chromeColor: {
    title: 'Chrome fascia',
    description:
      'Re-tints the table hardware for every broadcast camera and showroom view.'
  },
  railMarkerColor: {
    title: 'Rail markers',
    description: 'Changes the rail marker accents used in guides and live play.'
  },
  environmentHdri: {
    title: 'HDR environment',
    description:
      'Replaces the HDR lighting setup used for showroom previews and match lighting.'
  },
  table: {
    title: 'Table finish',
    description:
      'Swaps the main table surface used in matches and lobby previews.'
  },
  field: {
    title: 'Rink surface',
    description:
      'Changes the rink surface and markings used in Air Hockey matches.'
  },
  cushionCloth: {
    title: 'Cushion cloth',
    description:
      'Refreshes the padded rail cloth used in gameplay and highlight reels.'
  },
  puck: {
    title: 'Puck finish',
    description:
      'Applies a new puck material in every serve, replay, and highlight view.'
  },
  mallet: {
    title: 'Mallet style',
    description:
      'Updates the striker model used by players throughout each match.'
  },
  rails: {
    title: 'Rails',
    description:
      'Replaces the rink rails shown in match play and top-down camera shots.'
  },
  goals: {
    title: 'Goals',
    description:
      'Updates the goal framing and net details visible in match shots.'
  },
  tables: {
    title: 'Table model',
    description:
      'Swaps the full table model used in Chess, Ludo, and Snake arenas.'
  },
  chairColor: {
    title: 'Chair finish',
    description:
      'Changes the seating upholstery shown in lobby previews and matches.'
  },
  stools: {
    title: 'Stools & chairs',
    description:
      'Updates the chair styling around the arena table and podium views.'
  },
  sideColor: {
    title: 'Piece colors',
    description:
      'Applies a new palette to player pieces in live matches and replays.'
  },
  boardTheme: {
    title: 'Board theme',
    description:
      'Replaces the board texture and accents used in board-based matches.'
  },
  boardFinish: {
    title: 'Board finish',
    description:
      'Applies octagon-table finish textures to the 4 in a Row board faces.'
  },
  boardFrameFinish: {
    title: 'Board frame',
    description:
      'Updates the 4 in a Row board frame and stand with octagon-table textures.'
  },
  ringFinish: {
    title: 'Ring finish',
    description:
      'Changes the slot ring material (chrome, gold, aluminium, or plastic variants).'
  },
  headStyle: {
    title: 'Pawn heads',
    description: 'Swaps pawn head shapes visible during zoomed match play.'
  },
  tokenPalette: {
    title: 'Token palette',
    description:
      'Changes the palette for your Ludo tokens across matches and highlights.'
  },
  tokenStyle: {
    title: 'Token style',
    description: 'Updates the body shape for your tokens in every match camera.'
  },
  tokenPiece: {
    title: 'Token piece',
    description:
      'Replaces the token model shown on the board and victory screens.'
  },
  outfit: {
    title: 'Outfit',
    description:
      'Applies a new outfit skin to your Murlan avatar across match scenes.'
  },
  cards: {
    title: 'Card theme',
    description:
      'Updates the card backs and suits shown during every deal and replay.'
  },
  tableTheme: {
    title: 'Table model',
    description:
      'Swaps the full table model used in Domino or Texas Hold’em arenas.'
  },
  dominoStyle: {
    title: 'Domino colors',
    description:
      'Applies one of six store colors while Imperial Ivory remains the default.'
  },
  dominoDotStyle: {
    title: 'Domino dots',
    description:
      'Swaps domino pips with Chess Battle Royal pawn-head inspired dot sets.'
  },
  dominoFrameStyle: {
    title: 'Domino frames',
    description:
      'Changes the domino frame trim to metallic finishes like gold, chrome, aluminium, and bronze.'
  },
  highlightStyle: {
    title: 'Highlights',
    description: 'Changes highlight glow effects in gameplay and UI moments.'
  },
  chairTheme: {
    title: 'Chair theme',
    description: 'Replaces the chair set shown around the table in every scene.'
  },
  arenaTheme: {
    title: 'Arena atmosphere',
    description: 'Changes the arena backdrop and lighting ambiance.'
  },
  boardPalette: {
    title: 'Board palette',
    description:
      'Updates the Snake board palette used in match and lobby views.'
  },
  snakeSkin: {
    title: 'Snake skin',
    description: 'Applies a new snake skin material visible during all rounds.'
  },
  diceTheme: {
    title: 'Dice finish',
    description: 'Updates dice materials shown in each roll and replay.'
  },
  railTheme: {
    title: 'Rails & nets',
    description: 'Changes the board rails and nets for Snake arenas.'
  },
  tokenFinish: {
    title: 'Token finish',
    description: 'Updates token materials for Snake & Ladder gameplay.'
  },
  tokenColor: {
    title: 'Token colors',
    description: 'Applies color palettes to player tokens during every match.'
  },
  tokenShape: {
    title: 'Token shape',
    description: 'Changes the 3D token shape shown in matches and previews.'
  },
  floorFinish: {
    title: 'Floor finish',
    description: 'Changes lane and approach floor textures.'
  }
};

const TENNIS_HDRI_OPTION_IDS = Object.freeze(['suburbanGarden','countryTrackMidday','autumnPark','rooitouPark','rotesRathaus','veniceDawn2','piazzaSanMarco']);

const hashString = (value) => {
  let hash = 0;
  if (!value) return hash;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 1000000;
  }
  return hash;
};

const formatShortDate = (date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);

const storeMeta = {
  tennis: {
    name: 'Tennis',
    items: [
      ...POOL_ROYALE_STORE_ITEMS.filter((item) => item.type === 'environmentHdri' && TENNIS_HDRI_OPTION_IDS.includes(item.optionId)),
      ...LUDO_BATTLE_STORE_ITEMS.filter((item) => item.type === 'humanCharacter')
    ],
    defaults: [...POOL_ROYALE_DEFAULT_LOADOUT, ...LUDO_BATTLE_DEFAULT_LOADOUT.filter((entry) => entry.type === 'humanCharacter')],
    labels: { ...POOL_ROYALE_OPTION_LABELS, humanCharacter: LUDO_BATTLE_OPTION_LABELS.humanCharacter },
    typeLabels: TYPE_LABELS,
    accountId: POOL_STORE_ACCOUNT_ID
  },
  poolroyale: {
    name: 'Pool Royale',
    items: POOL_ROYALE_STORE_ITEMS,
    defaults: POOL_ROYALE_DEFAULT_LOADOUT,
    labels: POOL_ROYALE_OPTION_LABELS,
    typeLabels: TYPE_LABELS,
    accountId: POOL_STORE_ACCOUNT_ID
  },
  bilardoshqip: {
    name: 'Bilardo Shqip',
    items: POOL_ROYALE_STORE_ITEMS,
    defaults: POOL_ROYALE_DEFAULT_LOADOUT,
    labels: POOL_ROYALE_OPTION_LABELS,
    typeLabels: TYPE_LABELS,
    accountId: POOL_STORE_ACCOUNT_ID
  },
  snookerroyale: {
    name: 'Snooker Royal',
    items: SNOOKER_ROYALE_STORE_ITEMS,
    defaults: SNOOKER_ROYALE_DEFAULT_LOADOUT,
    labels: SNOOKER_ROYALE_OPTION_LABELS,
    typeLabels: TYPE_LABELS,
    accountId: SNOOKER_STORE_ACCOUNT_ID
  },
  airhockey: {
    name: 'Air Hockey',
    items: AIR_HOCKEY_STORE_ITEMS,
    defaults: AIR_HOCKEY_DEFAULT_LOADOUT,
    labels: AIR_HOCKEY_OPTION_LABELS,
    typeLabels: AIR_HOCKEY_TYPE_LABELS,
    accountId: AIR_HOCKEY_STORE_ACCOUNT_ID
  },
  goalrush: {
    name: 'Goal Rush',
    items: GOAL_RUSH_STORE_ITEMS,
    defaults: GOAL_RUSH_DEFAULT_LOADOUT,
    labels: GOAL_RUSH_OPTION_LABELS,
    typeLabels: GOAL_RUSH_TYPE_LABELS,
    accountId: GOAL_RUSH_STORE_ACCOUNT_ID
  },
  chessbattleroyal: {
    name: 'Chess Battle Royal',
    items: CHESS_BATTLE_ROYAL_STORE_ITEMS,
    defaults: CHESS_BATTLE_ROYAL_DEFAULT_LOADOUT,
    labels: CHESS_BATTLE_ROYAL_OPTION_LABELS,
    typeLabels: CHESS_TYPE_LABELS,
    accountId: CHESS_STORE_ACCOUNT_ID
  },
  checkersbattleroyal: {
    name: 'Checkers Battle Royal',
    items: CHESS_BATTLE_STORE_ITEMS,
    defaults: CHESS_BATTLE_DEFAULT_LOADOUT,
    labels: CHESS_BATTLE_OPTION_LABELS,
    typeLabels: CHESS_TYPE_LABELS,
    accountId: CHESS_STORE_ACCOUNT_ID
  },
  fourinrowroyale: {
    name: '4 in a Row',
    items: FOUR_IN_ROW_BATTLE_STORE_ITEMS,
    defaults: FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT,
    labels: FOUR_IN_ROW_BATTLE_OPTION_LABELS,
    typeLabels: FOUR_IN_ROW_TYPE_LABELS,
    accountId: CHESS_STORE_ACCOUNT_ID
  },
  tavullbattleroyal: {
    name: 'Backgammon Royal',
    items: TAVULL_BATTLE_STORE_ITEMS,
    defaults: TAVULL_BATTLE_DEFAULT_LOADOUT,
    labels: TAVULL_BATTLE_OPTION_LABELS,
    typeLabels: TAVULL_TYPE_LABELS,
    accountId: TAVULL_STORE_ACCOUNT_ID
  },
  ludobattleroyal: {
    name: 'Ludo Battle Royal',
    items: LUDO_BATTLE_STORE_ITEMS,
    defaults: LUDO_BATTLE_DEFAULT_LOADOUT,
    labels: LUDO_BATTLE_OPTION_LABELS,
    typeLabels: LUDO_TYPE_LABELS,
    accountId: LUDO_STORE_ACCOUNT_ID
  },
  murlanroyale: {
    name: 'Murlan Royale',
    items: MURLAN_ROYALE_STORE_ITEMS,
    defaults: MURLAN_ROYALE_DEFAULT_LOADOUT,
    labels: MURLAN_ROYALE_OPTION_LABELS,
    typeLabels: MURLAN_TYPE_LABELS,
    accountId: MURLAN_STORE_ACCOUNT_ID
  },
  weaponkart: {
    name: 'Weapon Kart',
    items: MURLAN_ROYALE_STORE_ITEMS.filter((item) => item.type === 'characters').map((item) => ({
      ...item,
      type: 'humanCharacter'
    })),
    defaults: MURLAN_ROYALE_DEFAULT_LOADOUT.filter((entry) => entry.type === 'characters').map((entry) => ({
      ...entry,
      type: 'humanCharacter'
    })),
    labels: { humanCharacter: MURLAN_ROYALE_OPTION_LABELS.characters },
    typeLabels: { humanCharacter: 'Seated Characters' },
    accountId: MURLAN_STORE_ACCOUNT_ID
  },
  'domino-royal': {
    name: 'Domino Royal',
    items: DOMINO_ROYAL_STORE_ITEMS,
    defaults: DOMINO_ROYAL_DEFAULT_LOADOUT,
    labels: DOMINO_ROYAL_OPTION_LABELS,
    typeLabels: DOMINO_TYPE_LABELS,
    accountId: DOMINO_STORE_ACCOUNT_ID
  },
  snake: {
    name: 'Snake & Ladder',
    items: SNAKE_STORE_ITEMS,
    defaults: SNAKE_DEFAULT_LOADOUT,
    labels: SNAKE_OPTION_LABELS,
    typeLabels: SNAKE_TYPE_LABELS,
    accountId: SNAKE_STORE_ACCOUNT_ID
  },
  bowling: {
    name: 'Real Bowling',
    items: BOWLING_STORE_ITEMS,
    defaults: BOWLING_DEFAULT_LOADOUT,
    labels: BOWLING_OPTION_LABELS,
    typeLabels: TYPE_LABELS,
    accountId: POOL_STORE_ACCOUNT_ID
  },
  texasholdem: {
    name: "Texas Hold'em",
    items: TEXAS_HOLDEM_STORE_ITEMS,
    defaults: TEXAS_HOLDEM_DEFAULT_LOADOUT,
    labels: TEXAS_HOLDEM_OPTION_LABELS,
    typeLabels: TEXAS_TYPE_LABELS,
    accountId: TEXAS_STORE_ACCOUNT_ID
  }
};

export default function Store() {
  useTelegramBackButton();
  const navigate = useNavigate();
  const { gameSlug } = useParams();
  const [accountId, setAccountId] = useState(() => poolRoyalAccountId());
  const [poolOwned, setPoolOwned] = useState(() =>
    getCachedPoolRoyalInventory(accountId)
  );
  const [snookerOwned, setSnookerOwned] = useState(() =>
    getCachedSnookerRoyalInventory(accountId)
  );
  const [airOwned, setAirOwned] = useState(() =>
    getAirHockeyInventory(airHockeyAccountId(accountId))
  );
  const [goalRushOwned, setGoalRushOwned] = useState(() =>
    getGoalRushInventory(goalRushAccountId(accountId))
  );
  const [chessOwned, setChessOwned] = useState(() =>
    getChessBattleInventory(chessBattleAccountId(accountId))
  );
  const [fourInRowOwned, setFourInRowOwned] = useState(() =>
    getFourInRowInventory(fourInRowAccountId(accountId))
  );
  const [ludoOwned, setLudoOwned] = useState(() =>
    getLudoBattleInventory(ludoBattleAccountId(accountId))
  );
  const [tavullOwned, setTavullOwned] = useState(() =>
    getTavullBattleInventory(tavullBattleAccountId(accountId))
  );
  const [murlanOwned, setMurlanOwned] = useState(() =>
    getMurlanInventory(murlanAccountId(accountId))
  );
  const [dominoOwned, setDominoOwned] = useState(() =>
    getDominoRoyalInventory(dominoRoyalAccountId(accountId))
  );
  const [snakeOwned, setSnakeOwned] = useState(() =>
    getSnakeInventory(snakeAccountId(accountId))
  );
  const [texasOwned, setTexasOwned] = useState(() =>
    getTexasHoldemInventory(texasHoldemAccountId(accountId))
  );
  const [accountBalance, setAccountBalance] = useState(null);
  const [processing, setProcessing] = useState('');
  const [info, setInfo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('featured');
  const [activeGame, setActiveGame] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [confirmItem, setConfirmItem] = useState(null);
  const [purchaseStatus, setPurchaseStatus] = useState('');
  const [showPurchaseToast, setShowPurchaseToast] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState('');
  const [transactionState, setTransactionState] = useState('idle');
  const [showTransactionToast, setShowTransactionToast] = useState(false);
  const [userListings, setUserListings] = useState(() => getCustomHdriCatalog());
  const [showListModal, setShowListModal] = useState(false);
  const [listForm, setListForm] = useState(() => ({ ...DEFAULT_LIST_FORM }));
  const [showMyListings, setShowMyListings] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [zoomPreview, setZoomPreview] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [confirmItems, setConfirmItems] = useState([]);
  const [isPaying, setIsPaying] = useState(false);
  const [faceScanStep, setFaceScanStep] = useState(0);
  const [faceScanDraft, setFaceScanDraft] = useState({
    name: '',
    bodyId: FACE_SCAN_BODY_OPTIONS[0]?.id || '',
    detail: 'Balanced',
    lighting: 'Soft studio',
    expression: 'Neutral',
    scanQuality: 72,
    privacy: 'private'
  });
  const [faceScanUploads, setFaceScanUploads] = useState([]);
  const [faceScanPreviewReady, setFaceScanPreviewReady] = useState(false);
  const [faceScanCreated, setFaceScanCreated] = useState(false);
  const [faceScanSaving, setFaceScanSaving] = useState(false);

  const resolvedGameSlug = useMemo(() => {
    if (!gameSlug) return 'all';
    if (gameSlug === 'all') return 'all';
    return storeMeta[gameSlug] ? gameSlug : 'all';
  }, [gameSlug]);

  useEffect(() => {
    if (activeGame !== resolvedGameSlug) {
      setActiveGame(resolvedGameSlug);
    }
  }, [activeGame, resolvedGameSlug]);

  useEffect(() => {
    if (!detailItem) {
      setZoomPreview(null);
    }
  }, [detailItem]);

  useEffect(() => {
    setUserListings(getCustomHdriCatalog(accountId || 'guest'));
    const handleCatalogUpdate = () => {
      setUserListings(getCustomHdriCatalog(accountId || 'guest'));
    };
    window.addEventListener('customHdriCatalogUpdate', handleCatalogUpdate);
    return () => {
      window.removeEventListener('customHdriCatalogUpdate', handleCatalogUpdate);
    };
  }, [accountId]);

  useEffect(() => {
    if (!purchaseStatus) {
      setShowPurchaseToast(false);
      return;
    }
    setShowPurchaseToast(true);
    const timeout = window.setTimeout(() => setShowPurchaseToast(false), 9000);
    return () => window.clearTimeout(timeout);
  }, [purchaseStatus]);

  useEffect(() => {
    if (!transactionStatus) {
      setShowTransactionToast(false);
      return;
    }
    setShowTransactionToast(true);
    if (transactionState === 'processing') return undefined;
    const timeout = window.setTimeout(
      () => setShowTransactionToast(false),
      7000
    );
    return () => window.clearTimeout(timeout);
  }, [transactionState, transactionStatus]);

  useEffect(() => {
    setAccountId(poolRoyalAccountId());
  }, []);

  useEffect(() => {
    if (accountId && accountId !== 'guest') return;
    const snapshot = getLastStorePurchaseSnapshot();
    if (!snapshot?.accountId) return;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('accountId', snapshot.accountId);
    }
    setAccountId(snapshot.accountId);
    const restoredDate = new Date(
      snapshot.transaction?.date || Date.now()
    ).toLocaleString();
    setInfo(
      `Store restored to your last purchase profile from ${restoredDate}.`
    );
  }, [accountId]);

  useEffect(() => {
    setPoolOwned(getCachedPoolRoyalInventory(accountId));
    setSnookerOwned(getCachedSnookerRoyalInventory(accountId));
    setAirOwned(getAirHockeyInventory(airHockeyAccountId(accountId)));
    setGoalRushOwned(getGoalRushInventory(goalRushAccountId(accountId)));
    setChessOwned(getChessBattleInventory(chessBattleAccountId(accountId)));
    setFourInRowOwned(getFourInRowInventory(fourInRowAccountId(accountId)));
    setLudoOwned(getLudoBattleInventory(ludoBattleAccountId(accountId)));
    setTavullOwned(getTavullBattleInventory(tavullBattleAccountId(accountId)));
    setMurlanOwned(getMurlanInventory(murlanAccountId(accountId)));
    setDominoOwned(getDominoRoyalInventory(dominoRoyalAccountId(accountId)));
    setSnakeOwned(getSnakeInventory(snakeAccountId(accountId)));
    setTexasOwned(getTexasHoldemInventory(texasHoldemAccountId(accountId)));
    let cancelled = false;
    getPoolRoyalInventory(accountId)
      .then((inventory) => {
        if (!cancelled && inventory) setPoolOwned(inventory);
      })
      .catch((err) =>
        console.warn('Failed to sync Pool Royale inventory', err)
      );
    getSnookerRoyalInventory(accountId)
      .then((inventory) => {
        if (!cancelled && inventory) setSnookerOwned(inventory);
      })
      .catch((err) =>
        console.warn('Failed to sync Snooker Royal inventory', err)
      );
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  useEffect(() => {
    const handlePoolInventoryUpdate = (event) => {
      if (event?.detail?.accountId && event.detail.accountId !== accountId)
        return;
      if (event?.detail?.inventory) {
        setPoolOwned(event.detail.inventory);
      } else {
        setPoolOwned(getCachedPoolRoyalInventory(accountId));
        getPoolRoyalInventory(accountId)
          .then((inventory) => setPoolOwned(inventory))
          .catch((err) =>
            console.warn('Failed to reload Pool Royale inventory', err)
          );
      }
    };
    const handleSnookerInventoryUpdate = (event) => {
      if (event?.detail?.accountId && event.detail.accountId !== accountId)
        return;
      if (event?.detail?.inventory) {
        setSnookerOwned(event.detail.inventory);
      } else {
        setSnookerOwned(getCachedSnookerRoyalInventory(accountId));
        getSnookerRoyalInventory(accountId)
          .then((inventory) => setSnookerOwned(inventory))
          .catch((err) =>
            console.warn('Failed to reload Snooker Royal inventory', err)
          );
      }
    };
    window.addEventListener(
      'poolRoyalInventoryUpdate',
      handlePoolInventoryUpdate
    );
    window.addEventListener(
      'snookerRoyalInventoryUpdate',
      handleSnookerInventoryUpdate
    );
    return () => {
      window.removeEventListener(
        'poolRoyalInventoryUpdate',
        handlePoolInventoryUpdate
      );
      window.removeEventListener(
        'snookerRoyalInventoryUpdate',
        handleSnookerInventoryUpdate
      );
    };
  }, [accountId]);

  const loadAccountBalance = useCallback(async () => {
    const resolvedAccountId = poolRoyalAccountId(
      accountId === 'guest' ? '' : accountId
    );
    if (!resolvedAccountId || resolvedAccountId === 'guest') {
      setAccountBalance(null);
      return;
    }
    try {
      const res = await getAccountBalance(resolvedAccountId);
      if (typeof res?.balance === 'number') {
        setAccountBalance(res.balance);
      }
    } catch (err) {
      console.error('Failed to load TPC balance', err);
    }
  }, [accountId]);

  useEffect(() => {
    loadAccountBalance();
  }, [loadAccountBalance]);

  const faceScanStepProgress = useMemo(
    () =>
      Math.max(
        1,
        Math.min(FACE_SCAN_CREATOR_STEPS.length, faceScanStep + 1)
      ),
    [faceScanStep]
  );
  const selectedFaceScanBody = useMemo(
    () =>
      FACE_SCAN_BODY_OPTIONS.find(
        (option) => option.id === faceScanDraft.bodyId
      ) || FACE_SCAN_BODY_OPTIONS[0] || null,
    [faceScanDraft.bodyId]
  );
  const capturedPoseCount = faceScanUploads.length;
  const faceScanBuildTotalTariff =
    FACE_SCAN_BUILD_TARIFF_TPC + capturedPoseCount * FACE_SCAN_DETAIL_TARIFF_PER_POSE_TPC;
  const faceScanBuildShortfall =
    typeof accountBalance === 'number'
      ? Math.max(0, faceScanBuildTotalTariff - accountBalance)
      : null;
  const canCreateFaceScan =
    faceScanDraft.name.trim().length >= 3 &&
    capturedPoseCount >= FACE_SCAN_POSES.length &&
    Boolean(faceScanDraft.bodyId) &&
    faceScanPreviewReady &&
    !faceScanCreated;


  useEffect(
    () => () => {
      faceScanUploads.forEach((entry) => {
        if (entry?.previewUrl?.startsWith?.('blob:')) {
          URL.revokeObjectURL(entry.previewUrl);
        }
      });
    },
    [faceScanUploads]
  );

  const handleFaceScanDraftChange = useCallback((field, value) => {
    setFaceScanDraft((prev) => ({ ...prev, [field]: value }));
    if (field !== 'name') {
      setFaceScanPreviewReady(false);
      setFaceScanCreated(false);
    }
  }, []);

  const fileToDataUrl = useCallback(
    (file) =>
      new Promise((resolve, reject) => {
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsDataURL(file);
      }),
    []
  );

  const prepareFaceScanImage = useCallback(
    (file) =>
      new Promise(async (resolve) => {
        try {
          const rawDataUrl = await fileToDataUrl(file);
          resolve({ previewUrl: rawDataUrl, meshDataUrl: rawDataUrl });
        } catch (error) {
          console.warn('Failed to prepare face scan image', error);
          resolve({ previewUrl: '', meshDataUrl: '' });
        }
      }),
    [fileToDataUrl]
  );

  const handleFaceScanUploads = useCallback(
    async (event) => {
      const files = Array.from(event.target.files || []).slice(0, FACE_SCAN_POSES.length);
      const preparedFiles = await Promise.all(
        files.map(async (file, index) => {
          const prepared = await prepareFaceScanImage(file);
          const pose = FACE_SCAN_POSES[index] || FACE_SCAN_POSES[0];
          return {
            id: `${pose.id}-${file.name}-${file.size}-${index}`,
            poseId: pose.id,
            poseLabel: pose.label,
            poseHint: pose.hint,
            file,
            previewUrl: prepared.previewUrl,
            meshDataUrl: prepared.meshDataUrl
          };
        })
      );
      const validFiles = preparedFiles.filter((entry) => entry.previewUrl);
      setFaceScanUploads((prev) => {
        prev.forEach((entry) => {
          if (entry?.previewUrl?.startsWith?.('blob:')) URL.revokeObjectURL(entry.previewUrl);
        });
        return validFiles;
      });
      if (validFiles.length === 0) {
        setTransactionState('error');
        setTransactionStatus('Could not read those face scan photos. Please upload JPG/PNG/WebP from the phone camera.');
        setFaceScanPreviewReady(false);
        setFaceScanCreated(false);
        return;
      }
      setFaceScanPreviewReady(false);
      setFaceScanCreated(false);
      setFaceScanStep(validFiles.length >= FACE_SCAN_POSES.length ? 1 : 0);
    },
    [prepareFaceScanImage]
  );

  const applyFaceScanPreset = useCallback((preset) => {
    setFaceScanDraft((prev) => ({
      ...prev,
      detail: preset.detail,
      lighting: preset.lighting,
      expression: preset.expression
    }));
    setFaceScanPreviewReady(false);
    setFaceScanCreated(false);
    setFaceScanStep(1);
  }, []);

  const handleFaceScanPreview = useCallback(() => {
    if (faceScanDraft.name.trim().length < 3) {
      setTransactionState('error');
      setTransactionStatus('Name your custom character (min 3 chars) before building preview.');
      return;
    }
    if (capturedPoseCount < FACE_SCAN_POSES.length) {
      setTransactionState('error');
      setTransactionStatus(`Add ${FACE_SCAN_POSES.length - capturedPoseCount} more face angle photo(s) for a full 3D scan.`);
      return;
    }
    setFaceScanPreviewReady(true);
    setFaceScanCreated(false);
    setFaceScanStep(2);
    setTransactionState('success');
    setTransactionStatus(`3D face preview ready: "${faceScanDraft.name.trim()}" is attached to ${selectedFaceScanBody?.label || 'the selected body'}.`);
  }, [capturedPoseCount, faceScanDraft.name, selectedFaceScanBody?.label]);

  const handleFaceScanCreate = useCallback(async () => {
    if (!canCreateFaceScan || faceScanSaving) return;
    if (typeof accountBalance === 'number' && accountBalance < faceScanBuildTotalTariff) {
      setTransactionState('error');
      setTransactionStatus(`Not enough TPC. Add ${formatTpcAmount(faceScanBuildTotalTariff - accountBalance)} more to create this character.`);
      return;
    }
    try {
      setFaceScanSaving(true);
      setTransactionState('processing');
      setTransactionStatus('Creating your human character with the scanned 3D head attached…');
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      const createdAt = Date.now();
      const savedCharacter = {
        id: `face-scan-character-${createdAt}`,
        name: faceScanDraft.name.trim(),
        bodyId: faceScanDraft.bodyId,
        bodyLabel: selectedFaceScanBody?.label || 'Human body',
        poseCount: capturedPoseCount,
        detail: faceScanDraft.detail,
        lighting: faceScanDraft.lighting,
        expression: faceScanDraft.expression,
        privacy: faceScanDraft.privacy,
        thumbnailUrl: faceScanUploads[0]?.previewUrl || '',
        createdAt
      };
      if (typeof window !== 'undefined') {
        const storageKey = `tonplaygram:faceScanCharacters:${normalizeAccount(accountId || 'guest') || 'guest'}`;
        const current = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
        window.localStorage.setItem(storageKey, JSON.stringify([savedCharacter, ...current].slice(0, 12)));
      }
      setFaceScanCreated(true);
      setFaceScanStep(3);
      setTransactionState('success');
      setTransactionStatus(`${savedCharacter.name} is ready: scanned head attached to ${savedCharacter.bodyLabel}.`);
      if (typeof accountBalance === 'number') {
        setAccountBalance((prev) => Math.max(0, (prev || 0) - faceScanBuildTotalTariff));
      }
    } catch (error) {
      console.warn('Face scan character creation failed', error);
      setTransactionState('error');
      setTransactionStatus('Could not create the face scan character right now. Please try again.');
    } finally {
      setFaceScanSaving(false);
    }
  }, [
    accountBalance,
    accountId,
    canCreateFaceScan,
    capturedPoseCount,
    faceScanBuildTotalTariff,
    faceScanDraft,
    faceScanSaving,
    faceScanUploads,
    selectedFaceScanBody
  ]);


  const storeItemsBySlug = useMemo(
    () => ({
      poolroyale: POOL_ROYALE_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'poolroyale'
      })),
      bilardoshqip: POOL_ROYALE_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'bilardoshqip'
      })),
      snookerroyale: SNOOKER_ROYALE_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'snookerroyale'
      })),
      airhockey: AIR_HOCKEY_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'airhockey'
      })),
      goalrush: GOAL_RUSH_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'goalrush'
      })),
      chessbattleroyal: CHESS_BATTLE_ROYAL_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'chessbattleroyal'
      })),
      checkersbattleroyal: CHECKERS_BATTLE_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'checkersbattleroyal'
      })),
      fourinrowroyale: FOUR_IN_ROW_BATTLE_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'fourinrowroyale'
      })),
      tavullbattleroyal: TAVULL_BATTLE_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'tavullbattleroyal'
      })),
      ludobattleroyal: LUDO_BATTLE_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'ludobattleroyal'
      })),
      murlanroyale: MURLAN_ROYALE_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'murlanroyale'
      })),
      weaponkart: MURLAN_ROYALE_STORE_ITEMS.filter((item) => item.type === 'characters').map((item) => ({
        ...item,
        type: 'humanCharacter',
        key: createItemKey('humanCharacter', item.optionId),
        slug: 'weaponkart'
      })),
      'domino-royal': DOMINO_ROYAL_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'domino-royal'
      })),
      snake: SNAKE_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'snake'
      })),
      bowling: BOWLING_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'bowling'
      })),
      texasholdem: TEXAS_HOLDEM_STORE_ITEMS.map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'texasholdem'
      })),
      tennis: POOL_ROYALE_STORE_ITEMS.filter((item) => item.type === 'environmentHdri' && TENNIS_HDRI_OPTION_IDS.includes(item.optionId)).map((item) => ({
        ...item,
        key: createItemKey(item.type, item.optionId),
        slug: 'tennis'
      })),
    }),
    []
  );

  const ownedCheckers = useMemo(
    () => ({
      poolroyale: (type, optionId) =>
        isPoolOptionUnlocked(type, optionId, poolOwned),
      bilardoshqip: (type, optionId) =>
        isPoolOptionUnlocked(type, optionId, poolOwned),
      snookerroyale: (type, optionId) =>
        isSnookerOptionUnlocked(type, optionId, snookerOwned),
      airhockey: (type, optionId) =>
        isAirHockeyOptionUnlocked(type, optionId, airOwned),
      goalrush: (type, optionId) =>
        isGoalRushOptionUnlocked(type, optionId, goalRushOwned),
      chessbattleroyal: (type, optionId) =>
        isChessOptionUnlocked(type, optionId, chessOwned),
      checkersbattleroyal: (type, optionId) =>
        isChessOptionUnlocked(type, optionId, chessOwned),
      fourinrowroyale: (type, optionId) =>
        isFourInRowOptionUnlocked(type, optionId, fourInRowOwned),
      tavullbattleroyal: (type, optionId) =>
        isTavullOptionUnlocked(type, optionId, tavullOwned),
      ludobattleroyal: (type, optionId) =>
        isLudoOptionUnlocked(type, optionId, ludoOwned),
      murlanroyale: (type, optionId) =>
        isMurlanOptionUnlocked(type, optionId, murlanOwned),
      weaponkart: (type, optionId) =>
        isMurlanOptionUnlocked(type === 'humanCharacter' ? 'characters' : type, optionId, murlanOwned),
      'domino-royal': (type, optionId) =>
        isDominoOptionUnlocked(type, optionId, dominoOwned),
      snake: (type, optionId) =>
        isSnakeOptionUnlocked(type, optionId, snakeOwned),
      tennis: (type, optionId) =>
        isPoolOptionUnlocked(type, optionId, poolOwned),
      bowling: (type, optionId) =>
        optionId === BOWLING_DEFAULT_LOADOUT[type] || isPoolOptionUnlocked(type, optionId, poolOwned),
      texasholdem: (type, optionId) =>
        isTexasOptionUnlocked(type, optionId, texasOwned),
    }),
    [
      airOwned,
      goalRushOwned,
      poolOwned,
      snookerOwned,
      chessOwned,
      fourInRowOwned,
      ludoOwned,
      tavullOwned,
      murlanOwned,
      dominoOwned,
      snakeOwned,
      texasOwned,
    ]
  );

  const labelResolvers = useMemo(
    () => ({
      poolroyale: (item) =>
        POOL_ROYALE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      bilardoshqip: (item) =>
        POOL_ROYALE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      snookerroyale: (item) =>
        SNOOKER_ROYALE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      airhockey: (item) =>
        AIR_HOCKEY_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      goalrush: (item) =>
        GOAL_RUSH_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      chessbattleroyal: (item) =>
        CHESS_BATTLE_ROYAL_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      checkersbattleroyal: (item) =>
        CHESS_BATTLE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      fourinrowroyale: (item) =>
        FOUR_IN_ROW_BATTLE_OPTION_LABELS[item.type]?.[item.optionId] ||
        item.name,
      tavullbattleroyal: (item) =>
        TAVULL_BATTLE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      ludobattleroyal: (item) =>
        LUDO_BATTLE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      murlanroyale: (item) =>
        MURLAN_ROYALE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      weaponkart: (item) =>
        MURLAN_ROYALE_OPTION_LABELS.characters?.[item.optionId] || item.name,
      'domino-royal': (item) =>
        DOMINO_ROYAL_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      snake: (item) =>
        SNAKE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      texasholdem: (item) =>
        TEXAS_HOLDEM_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      tennis: (item) =>
        POOL_ROYALE_OPTION_LABELS[item.type]?.[item.optionId] || item.name
    }),
    []
  );

  const typeLabelResolver = useMemo(
    () => ({
      poolroyale: TYPE_LABELS,
      bilardoshqip: TYPE_LABELS,
      airhockey: AIR_HOCKEY_TYPE_LABELS,
      goalrush: GOAL_RUSH_TYPE_LABELS,
      chessbattleroyal: CHESS_TYPE_LABELS,
      checkersbattleroyal: CHECKERS_BATTLE_TYPE_LABELS,
      fourinrowroyale: FOUR_IN_ROW_TYPE_LABELS,
      tavullbattleroyal: TAVULL_TYPE_LABELS,
      ludobattleroyal: LUDO_TYPE_LABELS,
      murlanroyale: MURLAN_TYPE_LABELS,
      weaponkart: { humanCharacter: 'Seated Characters' },
      'domino-royal': DOMINO_TYPE_LABELS,
      snake: SNAKE_TYPE_LABELS,
      texasholdem: TEXAS_TYPE_LABELS,
      tennis: TYPE_LABELS
    }),
    []
  );

  const buildNftMetadata = useCallback((item) => {
    const key = `${item.slug}-${item.id}-${item.optionId}`;
    const hash = hashString(key);
    const serialSuffix = String(hash).padStart(6, '0');
    const circulation = 400 + (hash % 1800);
    const burns = hash % 6;
    const mintedDaysAgo = 20 + (hash % 280);
    const lastSaleDaysAgo = Math.max(2, mintedDaysAgo - (hash % 18));
    const mintedDate = new Date(Date.now() - mintedDaysAgo * 86400000);
    const purchaseDate = new Date(mintedDate.getTime() + 6 * 86400000);
    const lastSaleDate = new Date(Date.now() - lastSaleDaysAgo * 86400000);
    const adjustment = (hash % 50) / 100;
    const safePrice = (price) =>
      Math.min(TON_PRICE_MAX, Math.max(TON_PRICE_MIN, Number(price)));
    const history = [
      {
        label: 'Minted',
        date: formatShortDate(mintedDate),
        price: safePrice(item.price)
      },
      {
        label: 'Purchased',
        date: formatShortDate(purchaseDate),
        price: safePrice(item.price + adjustment)
      },
      {
        label: 'Last sold',
        date: formatShortDate(lastSaleDate),
        price: safePrice(item.price + adjustment * 1.6)
      },
      {
        label: 'Burns',
        date: burns ? `${burns} retired` : 'None'
      }
    ];

    return {
      serial: `TPG-${item.slug.slice(0, 4).toUpperCase()}-${serialSuffix}`,
      circulation,
      burns,
      games: [storeMeta[item.slug]?.name || item.slug],
      history
    };
  }, []);

  const resolveUsageDetails = useCallback((item, gameName) => {
    const typeUsage = USAGE_BY_TYPE[item.type] || {};
    const title = typeUsage.title || `${item.typeLabel} usage`;
    const description =
      typeUsage.description ||
      `This cosmetic updates the ${item.typeLabel.toLowerCase()} presentation in ${gameName} matches, lobbies, and replays.`;
    const placements = [
      'Match gameplay',
      'Lobby preview',
      'Replays & highlights'
    ];
    return { title, description, placements };
  }, []);

  const clampTonPrice = useCallback((value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return TON_PRICE_MIN;
    const clamped = Math.min(TON_PRICE_MAX, Math.max(TON_PRICE_MIN, numeric));
    return Number(clamped.toFixed(2));
  }, []);

  const priceRange = useMemo(() => {
    const prices = [];
    Object.values(storeItemsBySlug).forEach((items) => {
      items.forEach((item) => {
        if (Number.isFinite(item.price)) prices.push(item.price);
      });
    });
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : min;
    return { min, max };
  }, [storeItemsBySlug]);

  const normalizeTonPrice = useCallback(
    (rawPrice) => {
      const numeric = Number(rawPrice);
      if (!Number.isFinite(numeric)) return TON_PRICE_MIN;
      if (priceRange.max <= priceRange.min) return TON_PRICE_MAX;
      const ratio =
        (numeric - priceRange.min) / (priceRange.max - priceRange.min);
      const clamped = Math.min(1, Math.max(0, ratio));
      const value = TON_PRICE_MIN + clamped * (TON_PRICE_MAX - TON_PRICE_MIN);
      return Number(value.toFixed(2));
    },
    [priceRange.max, priceRange.min]
  );

  const resolveOriginalImage = useCallback((item) => {
    if (!item) return '';
    const candidates = [
      item.image,
      item.imageUrl,
      item.media?.image,
      item.previewImage,
      item.preview?.image,
      item.nftMeta?.image,
      item.zoomImage
    ];
    return (
      candidates.find(
        (candidate) =>
          typeof candidate === 'string' && candidate.trim().length > 0
      ) || ''
    );
  }, []);

  const resolveItemThumbnail = useCallback(
    (item) => {
      if (!item) return '';
      const thumbnailCandidates = [
        item.thumbnail,
        item.thumbnail?.url,
        item.thumbnail?.src,
        item.nftMeta?.thumbnail,
        item.media?.thumbnail,
        item.preview?.thumbnail
      ];
      const resolvedThumbnail =
        thumbnailCandidates.find(
          (candidate) =>
            typeof candidate === 'string' && candidate.trim().length > 0
        ) || '';
      const originalImage = resolveOriginalImage(item);
      const usesGeneratedSwatch =
        resolvedThumbnail.startsWith('data:image/svg+xml');
      const resolved =
        (resolvedThumbnail && !usesGeneratedSwatch
          ? resolvedThumbnail
          : originalImage) || '';
      if (resolved) return normalizePolyHavenImage(resolved, THUMBNAIL_SIZE);
      if (item.swatches?.length) {
        return swatchThumbnail(item.swatches);
      }
      return '';
    },
    [resolveOriginalImage]
  );

  const resolveItemMedia = useCallback(
    (item) => {
      if (!item) return { thumbnail: '', zoom: '', alt: '' };
      const thumbnail = resolveItemThumbnail(item);
      const originalImage = resolveOriginalImage(item);
      const zoomCandidates = [
        item.zoomImage,
        originalImage,
        item.media?.zoom,
        item.media?.image
      ];
      const zoomFallback = normalizePolyHavenImage(
        thumbnail,
        ZOOM_PREVIEW_SIZE
      );
      const zoom =
        zoomCandidates.find(
          (candidate) =>
            typeof candidate === 'string' && candidate.trim().length > 0
        ) ||
        zoomFallback ||
        thumbnail;
      return {
        thumbnail,
        zoom,
        alt: item.displayLabel || item.name || 'Store item preview'
      };
    },
    [resolveItemThumbnail, resolveOriginalImage]
  );

  const decorateMarketplaceItem = (item, options = {}) => {
    const resolvedPrice = options.scalePrice
      ? normalizeTonPrice(item.price)
      : clampTonPrice(item.price);
    const swatches = resolveSwatches(item.type, item.optionId, item.swatches);
    const previewShape = resolvePreviewShape(
      item.slug,
      item.type,
      item.previewShape
    );
    const nftMeta = buildNftMetadata({
      ...item,
      price: resolvedPrice,
      swatches
    });
    return { ...item, price: resolvedPrice, swatches, previewShape, nftMeta };
  };

  const baseMarketplaceItems = useMemo(() => {
    const entries = [];
    Object.entries(storeItemsBySlug).forEach(([slug, items]) => {
      const ownedChecker = ownedCheckers[slug];
      const labelResolver = labelResolvers[slug];
      const typeLabels = typeLabelResolver[slug] || {};
      items.forEach((item) => {
        const displayLabel = labelResolver ? labelResolver(item) : item.name;
        entries.push(
          decorateMarketplaceItem(
            {
              ...item,
              slug,
              displayLabel,
              typeLabel: typeLabels[item.type] || item.type,
              gameName: storeMeta[slug]?.name || slug,
              owned: ownedChecker
                ? ownedChecker(item.type, item.optionId)
                : false,
              seller: 'Official store'
            },
            { scalePrice: true }
          )
        );
      });
    });
    return entries;
  }, [labelResolvers, ownedCheckers, storeItemsBySlug, typeLabelResolver]);

  const ownedMarketplaceItems = useMemo(
    () => baseMarketplaceItems.filter((item) => item.owned),
    [baseMarketplaceItems]
  );

  useEffect(() => {
    if (showListModal && ownedMarketplaceItems.length) {
      setListForm((prev) => {
        const validSelection = ownedMarketplaceItems.find(
          (item) => item.id === prev.itemId
        );
        const nextItem = validSelection || ownedMarketplaceItems[0];
        const suggestedPrice =
          prev.price || (nextItem.price ? String(nextItem.price) : '');
        if (prev.itemId === nextItem.id && prev.price === suggestedPrice)
          return prev;
        return { ...prev, itemId: nextItem.id, price: suggestedPrice };
      });
    }

    if (!showListModal) {
      setListForm({ ...DEFAULT_LIST_FORM });
    }
  }, [ownedMarketplaceItems, showListModal]);

  const decoratedUserListings = useMemo(
    () =>
      userListings.flatMap((listing) => {
        const games = Array.isArray(listing.supportedGames)
          ? listing.supportedGames.filter((slug) => slug !== 'poolroyale')
          : [];
        const listingOwner = normalizeAccount(listing.createdBy);
        const isListingOwner =
          listingOwner && listingOwner === normalizeAccount(accountId || 'guest');
        return games.map((slug) =>
          {
            const optionId = listing.optionIdByGame?.[slug] || listing.optionId;
            const alreadyOwned = ownedCheckers[slug]
              ? ownedCheckers[slug]('environmentHdri', optionId)
              : false;
            return decorateMarketplaceItem(
              {
                ...listing,
                id: `${listing.id}-${slug}`,
                slug,
                optionId,
                gameName: storeMeta[slug]?.name || 'Player listing',
                typeLabel: 'Custom HDRI',
                displayLabel: listing.name || listing.displayLabel || 'Player NFT',
                thumbnail: listing.thumbnailUrl || listing.environmentUrl || '',
                owned: Boolean(isListingOwner || alreadyOwned),
                seller: isListingOwner ? 'You' : `Creator ${listing.createdBy || 'player'}`,
                isCreatorListingOwner: Boolean(isListingOwner)
              },
              { scalePrice: false }
            );
          }
        );
      }),
    [accountId, ownedCheckers, userListings]
  );
  const myCreatorListings = useMemo(
    () => decoratedUserListings.filter((item) => item.isCreatorListingOwner),
    [decoratedUserListings]
  );

  const allMarketplaceItems = useMemo(
    () => [...baseMarketplaceItems, ...decoratedUserListings],
    [baseMarketplaceItems, decoratedUserListings]
  );

  const applyFilters = useCallback(
    (items) => {
      const term = searchTerm.trim().toLowerCase();
      return items
        .filter((item) => {
          if (activeGame !== 'all' && item.slug !== activeGame) return false;
          if (activeType !== 'all' && item.typeLabel !== activeType)
            return false;
          if (!term) return true;
          return (
            item.displayLabel.toLowerCase().includes(term) ||
            item.description?.toLowerCase().includes(term) ||
            item.typeLabel.toLowerCase().includes(term) ||
            item.gameName.toLowerCase().includes(term)
          );
        })
        .sort((a, b) => {
          if (sortOption === 'price-low') return a.price - b.price;
          if (sortOption === 'price-high') return b.price - a.price;
          if (sortOption === 'alpha')
            return a.displayLabel.localeCompare(b.displayLabel);
          const featuredRank = (item) => {
            const label = item.typeLabel?.toLowerCase() || '';
            const hasThumbnail = Boolean(resolveItemThumbnail(item));
            const isTableOrChair =
              label.includes('table') ||
              label.includes('chair') ||
              label.includes('stool');
            if (hasThumbnail && isTableOrChair) return 0;
            if (hasThumbnail) return 1;
            if (isTableOrChair) return 2;
            return 3;
          };
          const rankDiff = featuredRank(a) - featuredRank(b);
          if (rankDiff !== 0) return rankDiff;
          const nameDiff = a.displayLabel.localeCompare(b.displayLabel);
          if (nameDiff !== 0) return nameDiff;
          return a.slug.localeCompare(b.slug);
        });
    },
    [activeGame, activeType, searchTerm, sortOption]
  );

  const filteredItems = useMemo(
    () => applyFilters(allMarketplaceItems),
    [allMarketplaceItems, applyFilters]
  );
  const filteredUserListings = useMemo(
    () => applyFilters(myCreatorListings),
    [applyFilters, myCreatorListings]
  );
  const visibleItems = showMyListings ? filteredUserListings : filteredItems;

  useEffect(() => {
    const validKeys = new Set(
      allMarketplaceItems.map((item) => selectionKey(item))
    );
    setSelectedKeys((prev) => prev.filter((key) => validKeys.has(key)));
  }, [allMarketplaceItems]);

  const selectedItems = useMemo(() => {
    const keySet = new Set(selectedKeys);
    return allMarketplaceItems.filter((item) => keySet.has(selectionKey(item)));
  }, [allMarketplaceItems, selectedKeys]);

  const selectedPurchasable = useMemo(
    () => selectedItems.filter((item) => !item.owned),
    [selectedItems]
  );
  const selectedTotalPrice = useMemo(
    () => selectedPurchasable.reduce((sum, item) => sum + item.price, 0),
    [selectedPurchasable]
  );
  const selectedOwnedCount = selectedItems.length - selectedPurchasable.length;
  const selectedGameCount = useMemo(
    () => new Set(selectedPurchasable.map((item) => item.slug)).size,
    [selectedPurchasable]
  );
  const hasSelection = selectedKeys.length > 0;
  const hasPurchasableSelection = selectedPurchasable.length > 0;
  const selectedBalanceAfter =
    accountBalance === null ? null : accountBalance - selectedTotalPrice;
  const selectedShortfall =
    selectedBalanceAfter !== null && selectedBalanceAfter < 0
      ? Math.abs(selectedBalanceAfter)
      : 0;

  useEffect(() => {
    if (!selectedPurchasable.length) {
      setConfirmItems([]);
    }
  }, [selectedPurchasable]);

  const toggleSelection = useCallback((item) => {
    if (!item || item.owned) return;
    setSelectedKeys((prev) => {
      const key = selectionKey(item);
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return Array.from(next);
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedKeys([]), []);

  const userListingStats = useMemo(() => {
    const total = myCreatorListings.length;
    const prices = myCreatorListings.map((item) => Number(item.price) || 0);
    const totalValue = prices.reduce((sum, price) => sum + price, 0);
    const avgPrice = total ? Math.round((totalValue / total) * 100) / 100 : 0;
    const floorPrice = total ? Math.min(...prices) : 0;
    return { total, totalValue, avgPrice, floorPrice };
  }, [myCreatorListings]);

  const typeFilters = useMemo(() => {
    const types = new Set();
    const scopedItems = showMyListings
      ? myCreatorListings
      : allMarketplaceItems;
    scopedItems.forEach((item) => {
      if (item.typeLabel) {
        types.add(item.typeLabel);
      }
    });
    return ['all', ...Array.from(types)];
  }, [activeGame, allMarketplaceItems, myCreatorListings, showMyListings]);

  useEffect(() => {
    if (!typeFilters.includes(activeType)) {
      setActiveType('all');
    }
  }, [activeType, typeFilters]);

  const resetStatus = () => {
    setPurchaseStatus('');
    setInfo('');
    setTransactionStatus('');
    setTransactionState('idle');
  };

  const handleGameChange = useCallback(
    (slug) => {
      setActiveGame(slug);
      setActiveType('all');
      if (slug === 'all') {
        navigate('/store/all');
      } else {
        navigate(`/store/${slug}`);
      }
    },
    [navigate]
  );

  const groupedItems = useMemo(() => {
    if (activeGame === 'all') return [];
    const groups = new Map();
    visibleItems.forEach((item) => {
      if (item.slug !== activeGame) return;
      const key = item.typeLabel || 'Accessories';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return Array.from(groups.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
  }, [activeGame, visibleItems]);

  const handleListSubmit = (event) => {
    event?.preventDefault();
    const selectedItem = ownedMarketplaceItems.find(
      (item) => item.id === listForm.itemId
    );

    if (!selectedItem) {
      setInfo('Select an owned NFT to list.');
      return;
    }

    const listingPrice = clampTonPrice(
      listForm.price || selectedItem.price || TON_PRICE_MIN
    );

    const newListing = decorateMarketplaceItem({
      id: `user-${Date.now()}`,
      slug: selectedItem.slug,
      type: selectedItem.type,
      optionId: selectedItem.optionId,
      name: selectedItem.name,
      displayLabel: selectedItem.displayLabel,
      description:
        selectedItem.description ||
        `${selectedItem.gameName} ${selectedItem.typeLabel} listed from your collection.`,
      price: listingPrice,
      typeLabel: selectedItem.typeLabel,
      swatches: selectedItem.swatches,
      previewShape: selectedItem.previewShape,
      owned: true,
      seller: 'You'
    });

    setUserListings((prev) => [...prev, newListing]);
    setShowListModal(false);
    setListForm({ ...DEFAULT_LIST_FORM });
    setInfo('Your NFT listing has been added to the marketplace.');
  };

  const handlePurchase = async (items) => {
    const payload = Array.isArray(items)
      ? items.filter(Boolean)
      : [items].filter(Boolean);
    if (!payload.length) return;
    const fallbackSnapshot = getLastStorePurchaseSnapshot();
    const fallbackAccountId = fallbackSnapshot?.accountId || '';
    const resolvedAccountId = poolRoyalAccountId(
      accountId === 'guest' ? fallbackAccountId : accountId
    );
    const seen = new Set();
    const unique = payload.filter((item) => {
      const key = selectionKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const purchasable = unique.filter((item) => !item.owned);
    if (!purchasable.length) {
      setInfo('No new items selected for purchase.');
      return;
    }
    if (!resolvedAccountId || resolvedAccountId === 'guest') {
      setInfo('Link your TPC account before completing a purchase.');
      return;
    }
    const totalPrice = purchasable.reduce((sum, item) => sum + item.price, 0);
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      setInfo('Unable to compute total TPC payment.');
      return;
    }
    if (accountBalance !== null && totalPrice > accountBalance) {
      setInfo('Insufficient TPC balance to complete this purchase.');
      return;
    }

    const groupedBySlug = purchasable.reduce((acc, item) => {
      acc[item.slug] = acc[item.slug] || {
        items: [],
        gameName: storeMeta[item.slug]?.name || item.slug
      };
      acc[item.slug].items.push(item);
      return acc;
    }, {});

    const groupedEntries = Object.values(groupedBySlug);
    if (!groupedEntries.length) {
      setInfo('Selected items are unavailable for purchase.');
      return;
    }

    const labelResolver = (slug, item) =>
      labelResolvers[slug]
        ? labelResolvers[slug](item)
        : item.name || item.displayLabel;
    setProcessing(purchasable.length > 1 ? 'bulk' : purchasable[0].id);
    resetStatus();
    setTransactionState('processing');
    setTransactionStatus('Purchasing…');

    try {
      const bundle = {
        items: purchasable.map((item) => ({
          slug: item.slug,
          type: item.type,
          optionId: item.optionId,
          price: item.price
        }))
      };
      const purchase = await buyBundle(resolvedAccountId, bundle);
      if (purchase?.error) {
        setInfo(purchase.error || 'Unable to process TPC payment.');
        setTransactionState('error');
        setTransactionStatus(
          purchase.error || 'Payment failed. Please try again.'
        );
        return;
      }
      setTransactionStatus('Payment approved. Unlocking items…');

      const backgroundSyncTasks = [];
      for (const [slug, group] of Object.entries(groupedBySlug)) {
        if (slug === 'poolroyale' || slug === 'bilardoshqip' || slug === 'tennis' || slug === 'bowling') {
          for (const entry of group.items) {
            const syncTask = addPoolRoyalUnlock(
              entry.type,
              entry.optionId,
              resolvedAccountId
            ).then((updated) => {
              setPoolOwned(updated);
              return updated;
            });
            backgroundSyncTasks.push(syncTask);
          }
          setPoolOwned(getCachedPoolRoyalInventory(resolvedAccountId));
          continue;
        }
        if (slug === 'snookerroyale') {
          for (const entry of group.items) {
            const syncTask = addSnookerRoyalUnlock(
              entry.type,
              entry.optionId,
              resolvedAccountId
            ).then((updated) => {
              setSnookerOwned(updated);
              return updated;
            });
            backgroundSyncTasks.push(syncTask);
          }
          setSnookerOwned(getCachedSnookerRoyalInventory(resolvedAccountId));
          continue;
        }

        for (const entry of group.items) {
          if (slug === 'airhockey') {
            setAirOwned(
              addAirHockeyUnlock(entry.type, entry.optionId, resolvedAccountId)
            );
          } else if (
            slug === 'chessbattleroyal' ||
            slug === 'checkersbattleroyal'
          ) {
            setChessOwned(
              addChessBattleUnlock(
                entry.type,
                entry.optionId,
                resolvedAccountId
              )
            );
          } else if (slug === 'tavullbattleroyal') {
            setTavullOwned(
              addTavullBattleUnlock(
                entry.type,
                entry.optionId,
                resolvedAccountId
              )
            );
          } else if (slug === 'fourinrowroyale') {
            setFourInRowOwned(
              addFourInRowUnlock(entry.type, entry.optionId, resolvedAccountId)
            );
          } else if (slug === 'ludobattleroyal') {
            setLudoOwned(
              addLudoBattleUnlock(entry.type, entry.optionId, resolvedAccountId)
            );
          } else if (slug === 'murlanroyale') {
            setMurlanOwned(
              addMurlanUnlock(entry.type, entry.optionId, resolvedAccountId)
            );
          } else if (slug === 'weaponkart') {
            setMurlanOwned(
              addMurlanUnlock(
                entry.type === 'humanCharacter' ? 'characters' : entry.type,
                entry.optionId,
                resolvedAccountId
              )
            );
          } else if (slug === 'domino-royal') {
            setDominoOwned(
              addDominoRoyalUnlock(
                entry.type,
                entry.optionId,
                resolvedAccountId
              )
            );
          } else if (slug === 'snake') {
            setSnakeOwned(
              addSnakeUnlock(entry.type, entry.optionId, resolvedAccountId)
            );
          } else if (slug === 'texasholdem') {
            setTexasOwned(
              addTexasHoldemUnlock(
                entry.type,
                entry.optionId,
                resolvedAccountId
              )
            );
          }
        }
      }
      if (backgroundSyncTasks.length) {
        Promise.allSettled(backgroundSyncTasks).catch(() => {});
      }

      const purchasedCustomHdriListings = purchasable.filter(
        (item) =>
          item?.type === 'environmentHdri' &&
          typeof item?.optionId === 'string' &&
          item.optionId.startsWith('custom-hdri:') &&
          typeof item?.environmentUrl === 'string' &&
          item.environmentUrl
      );
      if (purchasedCustomHdriListings.length) {
        purchasedCustomHdriListings.forEach((item) => {
          const slug = String(item.slug || '').toLowerCase();
          if (!slug) return;
          const optionIdByGame =
            item.optionIdByGame && typeof item.optionIdByGame === 'object'
              ? { ...item.optionIdByGame, [slug]: item.optionId }
              : { [slug]: item.optionId };
          saveCustomHdriEntry({
            id:
              item.id && String(item.id).startsWith('custom-hdri-')
                ? item.id
                : `custom-hdri-${Date.now()}-${slug}`,
            name: item.name || item.displayLabel || 'Custom HDRI',
            description: item.description || '',
            createdAt: Number(item.createdAt || Date.now()),
            createdBy: resolvedAccountId,
            visibility: 'private',
            supportedGames: Array.from(new Set([slug])),
            optionIdByGame,
            environmentUrl: item.environmentUrl,
            thumbnailUrl:
              item.thumbnailUrl || item.thumbnail || item.environmentUrl,
            storePrice: Number(item.price || 0)
          });
        });
        setUserListings(getCustomHdriCatalog(resolvedAccountId));
      }

      const purchasedTrainingAttempts = purchasable.reduce((sum, item) => {
        if (item.slug !== 'poolroyale' || item.type !== 'poolTrainingAttempt')
          return sum;
        const attempts = Number(item.optionId);
        return Number.isFinite(attempts) && attempts > 0
          ? sum + Math.floor(attempts)
          : sum;
      }, 0);
      if (purchasedTrainingAttempts > 0) {
        addTrainingAttempts(purchasedTrainingAttempts);
      }

      setTransactionStatus('Inventory updated. Finalizing receipt…');

      const resolver = (item) => labelResolver(item.slug, item);
      const groupedCount = groupedEntries.length;
      const successLabel =
        purchasable.length === 1
          ? `Payment confirmed — ${resolver(purchasable[0])} delivered instantly in ${storeMeta[purchasable[0].slug]?.name || purchasable[0].slug}.`
          : `Payment confirmed — ${purchasable.length} cosmetics delivered across ${groupedCount} game${groupedCount === 1 ? '' : 's'}.`;
      const detailLabel =
        purchasable.length === 1
          ? `${resolver(purchasable[0])} • ${storeMeta[purchasable[0].slug]?.name || purchasable[0].slug}`
          : `${purchasable.length} store items across ${groupedCount} game${groupedCount === 1 ? '' : 's'}`;
      recordStorePurchase(resolvedAccountId, {
        totalPrice,
        detail: detailLabel,
        items: purchasable.map((item) => ({
          slug: item.slug,
          type: item.type,
          optionId: item.optionId,
          label: resolver(item),
          price: item.price
        }))
      });
      const purchasedKeys = new Set(
        purchasable.map((item) => selectionKey(item))
      );
      setSelectedKeys((prev) => prev.filter((key) => !purchasedKeys.has(key)));
      setPurchaseStatus(successLabel);
      setInfo('');
      setTransactionState('success');
      setTransactionStatus('Purchase confirmed and added to your inventory.');
      await loadAccountBalance();
    } catch (err) {
      console.error('Purchase failed', err);
      setInfo('Failed to process purchase.');
      setTransactionState('error');
      setTransactionStatus('Purchase failed. Please try again.');
    } finally {
      setProcessing('');
      setConfirmItem(null);
      setConfirmItems([]);
    }
  };

  const initiateTpcPurchase = async (items) => {
    const payload = Array.isArray(items)
      ? items.filter(Boolean)
      : [items].filter(Boolean);
    if (!payload.length) return;
    setIsPaying(true);
    resetStatus();
    try {
      await handlePurchase(payload);
    } finally {
      setIsPaying(false);
    }
  };

  const featuredCount = allMarketplaceItems.length;
  const ownedCount = allMarketplaceItems.filter((item) => item.owned).length;
  const walletLabel =
    accountId && accountId !== 'guest' ? 'Account linked' : 'Guest mode';
  const mainPaddingClass = hasSelection
    ? 'pb-[calc(10rem+env(safe-area-inset-bottom))]'
    : 'pb-24';

  const renderListModal = () => {
    if (!showListModal) return null;
    const selectedItem = ownedMarketplaceItems.find(
      (item) => item.id === listForm.itemId
    );
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <div className="flex w-full max-w-xl max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <p className="text-xs text-white/60">List an owned NFT</p>
              <h3 className="text-lg font-semibold text-white">
                Create marketplace listing
              </h3>
              <p className="text-sm text-white/60">
                Pick an unlocked cosmetic, then set the sale price. We keep the
                metadata locked to your NFT.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowListModal(false)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <form
            className="grid flex-1 gap-3 overflow-y-auto p-4"
            onSubmit={handleListSubmit}
          >
            <div className="grid gap-3 md:grid-cols-[7fr_5fr] md:items-start">
              <div className="grid gap-2">
                <div className="flex items-center justify-between text-sm text-white/80">
                  <span>Choose an owned NFT</span>
                  <span className="text-xs text-white/60">
                    {ownedMarketplaceItems.length} available
                  </span>
                </div>
                <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                  {ownedMarketplaceItems.length ? (
                    ownedMarketplaceItems.map((item) => {
                      const active = item.id === listForm.itemId;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() =>
                            setListForm((prev) => ({
                              ...prev,
                              itemId: item.id,
                              price:
                                prev.price ||
                                (item.price ? String(item.price) : '')
                            }))
                          }
                          className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                            active
                              ? 'border-emerald-300/60 bg-emerald-500/10 shadow-[0_10px_30px_-20px_rgba(16,185,129,0.9)]'
                              : 'border-white/10 bg-black/20 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {renderPreview3d(item, false)}
                            <div className="grid gap-0.5 text-sm text-white/80">
                              <div className="font-semibold text-white">
                                {item.displayLabel}
                              </div>
                              <div className="text-xs text-white/60">
                                {item.gameName} • {item.typeLabel}
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-sm text-white/80">
                            <div className="flex items-center justify-end gap-1 font-semibold">
                              <span>{item.price}</span>
                              <img
                                src={TON_ICON}
                                alt="TPC"
                                className="h-4 w-4"
                              />
                            </div>
                            <div className="text-[11px] text-white/50">
                              Base price
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white/70">
                      You have no cosmetics unlocked yet. Buy an item from the
                      store before listing it.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-white/60">
                      Selected NFT
                    </p>
                    <h4 className="text-base font-semibold text-white">
                      {selectedItem
                        ? selectedItem.displayLabel
                        : 'No selection'}
                    </h4>
                    <p className="text-xs text-white/60">
                      {selectedItem
                        ? `${selectedItem.gameName} • ${selectedItem.typeLabel}`
                        : 'Pick an owned cosmetic to list it.'}
                    </p>
                  </div>
                  {selectedItem ? renderPreview3d(selectedItem, false) : null}
                </div>

                <label className="grid gap-1 text-sm text-white/80">
                  <span className="text-xs uppercase tracking-wide text-white/60">
                    Listing price (TPC)
                  </span>
                  <input
                    type="number"
                    min={TON_PRICE_MIN}
                    max={TON_PRICE_MAX}
                    step="0.01"
                    value={listForm.price}
                    onChange={(e) =>
                      setListForm((prev) => ({
                        ...prev,
                        price: e.target.value
                      }))
                    }
                    placeholder={selectedItem?.price || TON_PRICE_MIN}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none"
                    required
                  />
                  <span className="text-xs text-white/50">
                    Metadata stays tied to your NFT. Buyers will only see the
                    price you set here.
                  </span>
                </label>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowListModal(false);
                      setListForm({ ...DEFAULT_LIST_FORM });
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white/90 sm:w-auto"
                    disabled={!selectedItem}
                  >
                    Publish listing
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderConfirmModal = () => {
    if (!confirmItem) return null;
    const gameName = storeMeta[confirmItem.slug]?.name || confirmItem.slug;
    const confirmBalanceAfter =
      accountBalance === null ? null : accountBalance - confirmItem.price;
    const confirmShortfall =
      confirmBalanceAfter !== null && confirmBalanceAfter < 0
        ? Math.abs(confirmBalanceAfter)
        : 0;
    const isInsufficientBalance = confirmShortfall > 0;
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pb-4 pt-8 sm:pt-12">
        <div className="w-full max-w-lg max-h-[calc(100vh-6rem)] overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <p className="text-xs text-white/60">Confirm purchase</p>
              <h3 className="text-lg font-semibold text-white">
                {confirmItem.displayLabel}
              </h3>
              <p className="text-sm text-white/60">
                {gameName} • {confirmItem.typeLabel}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
              {confirmItem.price}
              <img src={TON_ICON} alt="TPC" className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-3 p-4 text-sm text-white/70">
            <p>
              Purchase with your TPC balance. Once approved, we deliver the NFT
              instantly and log it on your statement.
            </p>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              {renderStoreThumbnail(confirmItem, 'compact')}
              <div className="grid gap-1 text-xs">
                <div className="text-sm font-semibold text-white">
                  {confirmItem.displayLabel}
                </div>
                <div className="text-white/60">
                  {gameName} • {confirmItem.typeLabel}
                </div>
              </div>
            </div>
            <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-white/80">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Game</span>
                <span className="font-semibold">{gameName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Type</span>
                <span className="font-semibold">{confirmItem.typeLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Price</span>
                <span className="flex items-center gap-1 font-semibold">
                  {confirmItem.price}
                  <img src={TON_ICON} alt="TPC" className="h-4 w-4" />
                </span>
              </div>
            </div>
            <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-white/60">Payment</span>
                <span className="font-semibold text-white">
                  TPC balance purchase
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-white/60">Delivery</span>
                <span className="font-semibold text-white">
                  NFT sent instantly and logged on your statement
                </span>
              </div>
            </div>
            <div className="grid gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/5 p-3 text-xs text-white/80">
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/60">TPC balance</span>
                <span className="font-semibold text-white">
                  {accountBalance === null
                    ? '—'
                    : formatTpcAmount(accountBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/60">Item total</span>
                <span className="font-semibold text-white">
                  {formatTpcAmount(confirmItem.price)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/60">After purchase</span>
                <span
                  className={`font-semibold ${isInsufficientBalance ? 'text-rose-200' : 'text-emerald-200'}`}
                >
                  {confirmBalanceAfter === null
                    ? '—'
                    : formatTpcAmount(confirmBalanceAfter)}
                </span>
              </div>
              {isInsufficientBalance ? (
                <p className="text-rose-200">
                  Need {formatTpcAmount(confirmShortfall)} more TPC to complete
                  this purchase.
                </p>
              ) : null}
            </div>
            {showTransactionToast ? (
              <div
                className={`rounded-2xl border px-3 py-2 text-xs ${
                  transactionState === 'error'
                    ? 'border-rose-400/50 bg-rose-500/15 text-rose-100'
                    : transactionState === 'success'
                      ? 'border-emerald-300/50 bg-emerald-500/10 text-emerald-100'
                      : 'border-white/20 bg-white/10 text-white/90'
                }`}
              >
                <span className="font-semibold">{transactionStatus}</span>
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmItem(null)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => initiateTpcPurchase(confirmItem)}
                className="w-full rounded-2xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-200 sm:w-auto"
                disabled={
                  Boolean(processing) || isPaying || isInsufficientBalance
                }
              >
                {isInsufficientBalance
                  ? 'Insufficient TPC'
                  : isPaying
                    ? 'Purchasing…'
                    : 'Purchase'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBulkConfirmModal = () => {
    if (!confirmItems.length) return null;
    const totalPrice = confirmItems.reduce((sum, item) => sum + item.price, 0);
    const bulkBalanceAfter =
      accountBalance === null ? null : accountBalance - totalPrice;
    const bulkShortfall =
      bulkBalanceAfter !== null && bulkBalanceAfter < 0
        ? Math.abs(bulkBalanceAfter)
        : 0;
    const hasBulkShortfall = bulkShortfall > 0;
    const grouped = confirmItems.reduce((acc, item) => {
      const gameName = storeMeta[item.slug]?.name || item.slug;
      acc[gameName] = (acc[gameName] || 0) + 1;
      return acc;
    }, {});
    const groupedLabels = Object.entries(grouped)
      .map(([name, count]) => `${count} in ${name}`)
      .join(' • ');

    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 pb-4 pt-8 sm:pt-12">
        <div className="w-full max-w-2xl max-h-[calc(100vh-6rem)] overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <p className="text-xs text-white/60">Confirm bulk purchase</p>
              <h3 className="text-lg font-semibold text-white">
                {confirmItems.length} cosmetics •{' '}
                {groupedLabels || 'Mixed games'}
              </h3>
              <p className="text-sm text-white/60">
                Review your cart and pay once to unlock everything.
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
              {totalPrice.toLocaleString()}
              <img src={TON_ICON} alt="TPC" className="h-4 w-4" />
            </div>
          </div>

          <div className="grid gap-3 p-4 text-sm text-white/80">
            <div className="grid max-h-64 gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">
              {confirmItems.map((item) => (
                <div
                  key={`${item.slug}-${item.id}-confirm`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    {renderStoreThumbnail(item, 'compact')}
                    <div className="grid gap-0.5">
                      <span className="text-white font-semibold">
                        {item.displayLabel}
                      </span>
                      <span className="text-xs text-white/60">
                        {storeMeta[item.slug]?.name || item.slug} •{' '}
                        {item.typeLabel}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    {item.price}
                    <img src={TON_ICON} alt="TPC" className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
              <p className="font-semibold text-white">Checkout summary</p>
              <p className="mt-1">
                Purchase once with your TPC balance, then we deliver instantly
                and record it on your statement.
              </p>
            </div>
            <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-white/60">Payment</span>
                <span className="font-semibold text-white">
                  TPC balance purchase
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-white/60">Delivery</span>
                <span className="font-semibold text-white">
                  NFTs sent instantly and logged on your statement
                </span>
              </div>
            </div>
            <div className="grid gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/5 p-3 text-xs text-white/80">
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/60">TPC balance</span>
                <span className="font-semibold text-white">
                  {accountBalance === null
                    ? '—'
                    : formatTpcAmount(accountBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/60">Bundle total</span>
                <span className="font-semibold text-white">
                  {formatTpcAmount(totalPrice)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/60">After purchase</span>
                <span
                  className={`font-semibold ${hasBulkShortfall ? 'text-rose-200' : 'text-emerald-200'}`}
                >
                  {bulkBalanceAfter === null
                    ? '—'
                    : formatTpcAmount(bulkBalanceAfter)}
                </span>
              </div>
              {hasBulkShortfall ? (
                <p className="text-rose-200">
                  Need {formatTpcAmount(bulkShortfall)} more TPC to checkout
                  this bundle.
                </p>
              ) : null}
            </div>
            {showTransactionToast ? (
              <div
                className={`rounded-2xl border px-3 py-2 text-xs ${
                  transactionState === 'error'
                    ? 'border-rose-400/50 bg-rose-500/15 text-rose-100'
                    : transactionState === 'success'
                      ? 'border-emerald-300/50 bg-emerald-500/10 text-emerald-100'
                      : 'border-white/20 bg-white/10 text-white/90'
                }`}
              >
                <span className="font-semibold">{transactionStatus}</span>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmItems([])}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => initiateTpcPurchase(confirmItems)}
                className="w-full rounded-2xl bg-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-200 sm:w-auto"
                disabled={Boolean(processing) || isPaying || hasBulkShortfall}
              >
                {hasBulkShortfall
                  ? 'Insufficient TPC'
                  : isPaying
                    ? 'Purchasing…'
                    : 'Purchase'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailModal = () => {
    if (!detailItem) return null;
    const gameName = storeMeta[detailItem.slug]?.name || detailItem.slug;
    const usageDetails = resolveUsageDetails(detailItem, gameName);
    const detailMedia = resolveItemMedia(detailItem);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <div className="w-full max-w-4xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-start justify-between border-b border-white/10 p-4">
            <div>
              <p className="text-xs text-white/60">
                {gameName} • {detailItem.typeLabel}
              </p>
              <h3 className="text-lg font-semibold text-white">
                {detailItem.displayLabel}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
                  {detailItem.slug.replace('-', ' ')}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-white/60">
                  {detailItem.typeLabel}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 font-semibold ${
                    detailItem.owned
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                      : 'border-indigo-400/30 bg-indigo-400/10 text-indigo-100'
                  }`}
                >
                  {detailItem.owned ? 'In inventory' : 'Mintable'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
                {detailItem.price}
                <img src={TON_ICON} alt="TPC" className="h-4 w-4" />
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="rounded-full border border-white/10 p-2 text-white/70 hover:bg-white/10"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-4">
            <div className="w-full">
              {detailMedia.zoom ? (
                <button
                  type="button"
                  className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                  onClick={() => setZoomPreview(detailMedia)}
                >
                  <img
                    src={detailMedia.zoom}
                    alt={`${detailMedia.alt} zoom preview`}
                    className="h-56 w-full object-cover transition duration-300 ease-out group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/70" />
                  <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                    High-res lighting match
                  </div>
                </button>
              ) : (
                renderStoreThumbnail(detailItem, 'detail')
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                  <p className="font-semibold text-white">Item overview</p>
                  <p className="mt-1">
                    {detailItem.description ||
                      'Cosmetic details will appear here.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70 space-y-2">
                  <p className="font-semibold text-white">
                    {usageDetails.title}
                  </p>
                  <p className="text-white/70">{usageDetails.description}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-white/60">
                    {usageDetails.placements.map((placement) => (
                      <span
                        key={`${detailItem.id}-${placement}`}
                        className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1"
                      >
                        {placement}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70 space-y-2">
                  <p className="font-semibold text-white">
                    NFT utility & circulation
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Usable in</span>
                    <span className="font-semibold">
                      {detailItem.nftMeta?.games?.join(', ') || gameName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Circulation</span>
                    <span className="font-semibold">
                      {detailItem.nftMeta?.circulation?.toLocaleString() || '—'}{' '}
                      minted
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Burns</span>
                    <span className="font-semibold">
                      {detailItem.nftMeta?.burns ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Serial</span>
                    <span className="font-semibold">
                      {detailItem.nftMeta?.serial || 'TPG-XXXXXX'}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Seller</span>
                    <span className="font-semibold">
                      {detailItem.seller || 'Official store'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Status</span>
                    <span className="font-semibold text-emerald-200">
                      {detailItem.owned ? 'Unlocked' : 'Available'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(detailItem.swatches || [])
                      .slice(0, 6)
                      .map((color, index) => (
                        <span
                          key={`${detailItem.id}-detail-${color}-${index}`}
                          className="h-5 w-5 rounded-full border border-white/20 shadow-sm"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    {(!detailItem.swatches ||
                      detailItem.swatches.length === 0) && (
                      <span className="text-xs text-white/60">
                        Color samples unavailable
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70 space-y-2">
                  <p className="font-semibold text-white">Provenance history</p>
                  <div className="grid gap-2">
                    {(detailItem.nftMeta?.history || []).map((event, index) => (
                      <div
                        key={`${detailItem.id}-history-${index}`}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70"
                      >
                        <div className="font-semibold text-white">
                          {event.label}
                        </div>
                        <div className="flex items-center gap-2">
                          {event.date ? <span>{event.date}</span> : null}
                          {event.price ? (
                            <span className="flex items-center gap-1 font-semibold text-white">
                              {event.price}
                              <img
                                src={TON_ICON}
                                alt="TPC"
                                className="h-3.5 w-3.5"
                              />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setDetailItem(null)}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 sm:w-auto"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmItems([]);
                      setConfirmItem(detailItem);
                      setDetailItem(null);
                    }}
                    className="w-full rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white/90 sm:w-auto"
                    disabled={processing === detailItem.id || detailItem.owned}
                  >
                    {detailItem.owned ? 'Already owned' : 'Buy now'}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  {renderPreview3d(detailItem, { size: 'md' })}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-white">Store thumbnail</p>
                    {detailMedia.zoom ? (
                      <button
                        type="button"
                        onClick={() => setZoomPreview(detailMedia)}
                        className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
                      >
                        Open zoom
                      </button>
                    ) : null}
                  </div>
                  {detailMedia.thumbnail ? (
                    <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
                      <img
                        src={detailMedia.thumbnail}
                        alt={`${detailMedia.alt} store thumbnail`}
                        className="h-40 w-full object-contain p-4"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/70" />
                    </div>
                  ) : (
                    <p className="text-xs text-white/50">
                      Store thumbnails are processing for this item.
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                  <p className="font-semibold text-white">What you get</p>
                  <p className="mt-1">
                    After the TPC payment is confirmed, the NFT unlocks
                    immediately on your linked TPC account.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderZoomModal = () => {
    if (!zoomPreview?.zoom) return null;

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 py-6">
        <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <p className="text-xs text-white/60">High-res zoom preview</p>
              <h3 className="text-sm font-semibold text-white">
                {zoomPreview.alt}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setZoomPreview(null)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 hover:bg-white/10"
            >
              Close
            </button>
          </div>
          <div className="bg-black/50 p-4">
            <img
              src={zoomPreview.zoom}
              alt={`${zoomPreview.alt} zoom preview`}
              className="h-[60vh] w-full rounded-2xl object-contain"
            />
            <p className="mt-3 text-xs text-white/60">
              Captured with the same lighting profile as the store thumbnail for
              consistent finish checks.
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderPreview3d = (item, options = {}) => {
    const resolvedOptions =
      typeof options === 'boolean' ? { showCaption: options } : options;
    const {
      showCaption = true,
      size = 'sm',
      containerClassName = ''
    } = resolvedOptions;
    if (!item) return null;
    const previewShape = item.previewShape || 'default';
    const primary = item.swatches?.[0] || '#0f172a';
    const secondary = item.swatches?.[1] || primary;
    const accent = item.swatches?.[2] || '#f8fafc';
    const safeId = (item.id || item.optionId || 'preview').replace(
      /[^a-zA-Z0-9_-]/g,
      ''
    );
    const gradientId = `${safeId}-grad`;
    const shineId = `${safeId}-shine`;
    const shadowId = `${safeId}-shadow`;
    const sizeClasses = {
      sm: 'h-16 w-24',
      md: 'h-24 w-40',
      lg: 'h-32 w-full'
    };

    if (previewShape === 'ukrainian-drone') {
      return (
        <UkrainianDroneExactPreview
          showCaption={showCaption}
          size={size}
          containerClassName={containerClassName}
        />
      );
    }

    const shapeLayer = (shape) => {
      switch (shape) {
        case 'cue':
          return (
            <g filter={`url(#${shadowId})`}>
              <rect
                x="18"
                y="42"
                width="106"
                height="10"
                rx="5"
                fill={`url(#${gradientId})`}
              />
              <rect
                x="18"
                y="40"
                width="30"
                height="14"
                rx="7"
                fill={accent}
                opacity="0.25"
              />
              <rect x="122" y="44" width="20" height="6" rx="3" fill={accent} />
              <rect
                x="18"
                y="42"
                width="124"
                height="10"
                rx="5"
                stroke={accent}
                strokeWidth="1.2"
                fill="none"
              />
            </g>
          );
        case 'chess-royals':
        case 'chess':
          return (
            <g filter={`url(#${shadowId})`}>
              <path
                d="M54 24c6 4 9 9 9 16 0 5-1 9-4 12h6c3 0 5 2 4 5l-5 17H35l-5-17c-1-3 1-5 4-5h7c-2-3-4-7-4-12 0-7 3-12 9-16Z"
                fill={`url(#${gradientId})`}
                stroke={accent}
                strokeWidth="1.3"
              />
              <path
                d="M102 22h8v8h8v8h-8v6h-8v-6h-8v-8h8z"
                fill={accent}
                opacity="0.75"
                transform="translate(-6 0)"
              />
              <path
                d="M102 20c8 4 12 11 12 20 0 5-1 9-4 12h7c3 0 5 2 4 5l-4 16H82l-4-16c-1-3 1-5 4-5h7c-3-3-4-7-4-12 0-9 4-16 12-20Z"
                fill={`url(#${shineId})`}
                stroke={accent}
                strokeWidth="1.3"
                opacity="0.9"
              />
              <ellipse
                cx="52"
                cy="76"
                rx="20"
                ry="5"
                fill={secondary}
                opacity="0.5"
              />
              <ellipse
                cx="98"
                cy="78"
                rx="24"
                ry="6"
                fill={secondary}
                opacity="0.6"
              />
            </g>
          );
        case 'pawn-head':
          return (
            <g filter={`url(#${shadowId})`}>
              <ellipse
                cx="60"
                cy="36"
                rx="12"
                ry="9"
                fill={accent}
                opacity="0.85"
              />
              <rect
                x="50"
                y="42"
                width="20"
                height="16"
                rx="6"
                fill={`url(#${shineId})`}
              />
              <rect
                x="46"
                y="56"
                width="28"
                height="10"
                rx="4"
                fill={`url(#${gradientId})`}
              />
              <ellipse
                cx="104"
                cy="34"
                rx="10"
                ry="10"
                fill={accent}
                opacity="0.9"
              />
              <rect
                x="94"
                y="44"
                width="20"
                height="14"
                rx="5"
                fill={`url(#${shineId})`}
              />
              <rect
                x="90"
                y="56"
                width="28"
                height="10"
                rx="4"
                fill={`url(#${gradientId})`}
              />
            </g>
          );
        case 'chrome':
          return (
            <g filter={`url(#${shadowId})`}>
              <path
                d="M40 22h86c4 0 6 3 5 6l-10 48c-1 3-4 5-7 5H36c-4 0-6-3-5-7l9-46c1-4 4-6 7-6Z"
                fill={`url(#${gradientId})`}
              />
              <path
                d="M40 28h78l-8 40c-.6 3-3 5-6 5H36Z"
                fill={`url(#${shineId})`}
                opacity="0.9"
              />
              <circle cx="50" cy="34" r="3" fill={accent} opacity="0.7" />
              <circle cx="112" cy="34" r="3" fill={accent} opacity="0.7" />
            </g>
          );
        case 'domino':
          return (
            <g filter={`url(#${shadowId})`}>
              <rect
                x="26"
                y="18"
                width="108"
                height="64"
                rx="10"
                fill={`url(#${gradientId})`}
              />
              <line
                x1="80"
                y1="22"
                x2="80"
                y2="78"
                stroke={accent}
                strokeWidth="2"
                opacity="0.6"
              />
              <circle cx="60" cy="40" r="6" fill={accent} />
              <circle cx="100" cy="60" r="6" fill={accent} />
              <circle cx="100" cy="40" r="4" fill={accent} opacity="0.6" />
            </g>
          );
        case 'cards':
          return (
            <g filter={`url(#${shadowId})`}>
              <rect
                x="32"
                y="18"
                width="78"
                height="58"
                rx="9"
                fill={secondary}
                opacity="0.65"
                transform="rotate(-6 32 18)"
              />
              <rect
                x="56"
                y="26"
                width="78"
                height="58"
                rx="9"
                fill={`url(#${gradientId})`}
                transform="rotate(6 56 26)"
              />
              <rect
                x="52"
                y="22"
                width="78"
                height="58"
                rx="9"
                stroke={accent}
                strokeWidth="1.5"
                fill="none"
                transform="rotate(3 52 22)"
              />
              <text
                x="76"
                y="56"
                fill={accent}
                fontSize="16"
                fontWeight="700"
                opacity="0.9"
              >
                A♠
              </text>
            </g>
          );
        case 'table':
          return (
            <g filter={`url(#${shadowId})`}>
              <rect
                x="22"
                y="26"
                width="116"
                height="48"
                rx="12"
                fill={`url(#${gradientId})`}
              />
              <rect
                x="30"
                y="34"
                width="100"
                height="32"
                rx="10"
                fill={`url(#${shineId})`}
                opacity="0.7"
              />
              <rect
                x="36"
                y="40"
                width="88"
                height="20"
                rx="8"
                fill={accent}
                opacity="0.15"
              />
            </g>
          );
        case 'puck':
          return (
            <g filter={`url(#${shadowId})`}>
              <circle cx="80" cy="50" r="26" fill={`url(#${gradientId})`} />
              <circle
                cx="80"
                cy="50"
                r="18"
                fill={`url(#${shineId})`}
                opacity="0.8"
              />
              <circle cx="80" cy="50" r="10" fill={accent} opacity="0.35" />
            </g>
          );
        case 'token-stack':
          return (
            <g filter={`url(#${shadowId})`}>
              <ellipse
                cx="64"
                cy="42"
                rx="18"
                ry="8"
                fill={`url(#${gradientId})`}
              />
              <rect
                x="46"
                y="42"
                width="36"
                height="12"
                rx="6"
                fill={`url(#${shineId})`}
                opacity="0.8"
              />
              <ellipse
                cx="96"
                cy="54"
                rx="18"
                ry="8"
                fill={`url(#${shineId})`}
                opacity="0.9"
              />
              <rect
                x="78"
                y="54"
                width="36"
                height="12"
                rx="6"
                fill={`url(#${gradientId})`}
              />
              <ellipse
                cx="78"
                cy="66"
                rx="18"
                ry="8"
                fill={accent}
                opacity="0.6"
              />
              <rect
                x="60"
                y="66"
                width="36"
                height="12"
                rx="6"
                fill={`url(#${shineId})`}
                opacity="0.8"
              />
            </g>
          );
        case 'dice':
          return (
            <g filter={`url(#${shadowId})`}>
              <rect
                x="42"
                y="24"
                width="44"
                height="44"
                rx="8"
                fill={`url(#${shineId})`}
              />
              <rect
                x="76"
                y="38"
                width="44"
                height="44"
                rx="8"
                fill={`url(#${gradientId})`}
              />
              <circle cx="54" cy="36" r="3" fill={accent} />
              <circle cx="64" cy="46" r="3" fill={accent} />
              <circle cx="54" cy="56" r="3" fill={accent} />
              <circle cx="88" cy="50" r="3" fill={accent} />
              <circle cx="110" cy="50" r="3" fill={accent} />
              <circle cx="99" cy="61" r="3" fill={accent} />
              <circle cx="88" cy="72" r="3" fill={accent} />
              <circle cx="110" cy="72" r="3" fill={accent} />
            </g>
          );
        case 'chair':
          return (
            <g filter={`url(#${shadowId})`}>
              <rect
                x="54"
                y="26"
                width="52"
                height="36"
                rx="10"
                fill={`url(#${gradientId})`}
              />
              <rect
                x="50"
                y="42"
                width="60"
                height="24"
                rx="8"
                fill={`url(#${shineId})`}
                opacity="0.85"
              />
              <rect
                x="58"
                y="62"
                width="12"
                height="20"
                rx="3"
                fill={accent}
                opacity="0.8"
              />
              <rect
                x="100"
                y="62"
                width="12"
                height="20"
                rx="3"
                fill={accent}
                opacity="0.8"
              />
              <rect
                x="70"
                y="64"
                width="28"
                height="8"
                rx="4"
                fill={secondary}
                opacity="0.7"
              />
            </g>
          );
        default:
          return (
            <g filter={`url(#${shadowId})`}>
              <rect
                x="28"
                y="26"
                width="104"
                height="44"
                rx="10"
                fill={`url(#${gradientId})`}
              />
              <rect
                x="38"
                y="34"
                width="84"
                height="28"
                rx="8"
                fill={`url(#${shineId})`}
                opacity="0.8"
              />
            </g>
          );
      }
    };

    return (
      <div className={`flex items-center gap-3 ${containerClassName}`}>
        <div
          className={`relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-black/40 shadow-[0_18px_45px_-26px_rgba(0,0,0,0.9)] ${sizeClasses[size] || sizeClasses.sm}`}
        >
          <svg viewBox="0 0 160 100" className="h-full w-full">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={primary} />
                <stop offset="100%" stopColor={secondary} />
              </linearGradient>
              <radialGradient id={shineId} cx="50%" cy="40%" r="70%">
                <stop offset="0%" stopColor={accent} stopOpacity="0.9" />
                <stop offset="100%" stopColor={secondary} stopOpacity="0.2" />
              </radialGradient>
              <filter
                id={shadowId}
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >
                <feDropShadow
                  dx="0"
                  dy="10"
                  stdDeviation="8"
                  floodColor="rgba(0,0,0,0.6)"
                />
              </filter>
            </defs>
            {shapeLayer(previewShape)}
            <ellipse cx="80" cy="82" rx="40" ry="8" fill="rgba(0,0,0,0.35)" />
          </svg>
        </div>
        {showCaption ? (
          <div className="grid gap-0.5 text-xs text-white/70">
            <span className="font-semibold text-white">
              {previewLabel(previewShape)}
            </span>
            <span className="text-white/60">High-fidelity 3D sample</span>
          </div>
        ) : null}
      </div>
    );
  };

  const renderStoreThumbnail = (item, variant = 'card') => {
    if (!item) return null;
    const label = (item.displayLabel || item.name || '').slice(0, 18);
    const media = resolveItemMedia(item);
    const resolvedThumbnail = media.thumbnail;
    const isCompact = variant === 'compact';
    const wrapperClass = isCompact
      ? 'relative h-16 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_16px_30px_-24px_rgba(0,0,0,0.9)]'
      : 'relative h-32 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9)]';
    const imageClass = isCompact
      ? 'h-full w-full object-contain p-2'
      : 'h-full w-full object-contain p-3';

    if (resolvedThumbnail) {
      return (
        <div className={wrapperClass}>
          <img
            src={resolvedThumbnail}
            alt={media.alt}
            className={imageClass}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/60" />
          <div
            className={`absolute ${isCompact ? 'bottom-1 left-1' : 'bottom-2 left-2'} rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80`}
          >
            {label}
          </div>
        </div>
      );
    }

    return (
      <div className={wrapperClass}>
        {renderPreview3d(item, {
          showCaption: false,
          size: isCompact ? 'sm' : 'lg',
          containerClassName: 'h-full w-full'
        })}
        <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/60" />
        <div
          className={`absolute ${isCompact ? 'bottom-1 left-1' : 'bottom-2 left-2'} rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/80`}
        >
          {label}
        </div>
      </div>
    );
  };

  const renderStoreCard = (item) => {
    const checked = selectedKeys.includes(selectionKey(item));
    const usageDetails = resolveUsageDetails(item, item.gameName);

    return (
      <div
        key={`${item.slug}-${item.id}`}
        className="group flex h-full flex-col gap-3 rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-black/30 p-4 text-left shadow-sm transition hover:border-white/20 hover:bg-white/10"
      >
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-white/30 bg-black/40 text-emerald-400 focus:ring-emerald-300"
              checked={checked}
              onChange={() => toggleSelection(item)}
              disabled={item.owned}
            />
          </label>
          <button
            type="button"
            onClick={() => setDetailItem(item)}
            className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs font-semibold text-white/70 hover:bg-white/10"
            title="View usage, circulation, and NFT history"
          >
            ℹ️
          </button>
        </div>

        {renderStoreThumbnail(item)}

        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">{item.displayLabel}</div>
            {item.owned && (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                Owned
              </span>
            )}
          </div>
          <div className="text-xs text-white/60">
            {item.gameName} • {item.typeLabel}
          </div>
          <div className="text-[11px] text-white/50">
            Usage: {usageDetails.title}
          </div>
          <div className="text-[11px] text-white/50">
            Serial {item.nftMeta?.serial}
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
            {item.price}
            <img src={TON_ICON} alt="TPC" className="h-4 w-4" />
          </div>
          <button
            type="button"
            onClick={() => setDetailItem(item)}
            className="rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
          >
            View
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmItems([]);
              setConfirmItem(item);
            }}
            className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={item.owned || Boolean(processing)}
          >
            {item.owned ? 'Owned' : 'Buy'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-2xl bg-white/10 shadow-sm">
              <img
                src="/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp"
                alt="TonPlaygram store avatar"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">
                TonPlaygram
              </div>
              <div className="text-xs text-white/60">NFT Storefront</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 md:flex">
              <span className="text-white/60">TPC</span>
              <span className="flex items-center gap-1 font-semibold text-white">
                {accountBalance === null ? '—' : accountBalance}
                <img src={TON_ICON} alt="TPC" className="h-4 w-4" />
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <div
                className={`h-2.5 w-2.5 rounded-full ${accountId && accountId !== 'guest' ? 'bg-emerald-400' : 'bg-white/40'}`}
              />
              <div className="text-xs font-semibold">{walletLabel}</div>
            </div>
          </div>
        </div>
      </header>

      {purchaseStatus && showPurchaseToast ? (
        <div className="fixed inset-x-0 top-16 z-40 flex justify-center px-4">
          <div className="flex w-full max-w-3xl items-start justify-between gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 shadow-[0_18px_40px_rgba(16,185,129,0.25)]">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-base">✅</span>
              <span className="font-semibold">{purchaseStatus}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPurchaseToast(false)}
              className="rounded-full border border-emerald-200/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-50/90 hover:bg-emerald-200/10"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {transactionStatus && showTransactionToast ? (
        <div className="fixed inset-x-0 top-28 z-40 flex justify-center px-4">
          <div
            className={`flex w-full max-w-3xl items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_40px_rgba(15,23,42,0.35)] ${
              transactionState === 'error'
                ? 'border-rose-400/50 bg-rose-500/15 text-rose-100'
                : transactionState === 'success'
                  ? 'border-emerald-300/50 bg-emerald-500/10 text-emerald-100'
                  : 'border-white/20 bg-white/10 text-white/90'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5 text-base">
                {transactionState === 'error'
                  ? '⚠️'
                  : transactionState === 'success'
                    ? '✅'
                    : '⏳'}
              </span>
              <span className="font-semibold">{transactionStatus}</span>
            </div>
            {transactionState !== 'processing' ? (
              <button
                type="button"
                onClick={() => setShowTransactionToast(false)}
                className="rounded-full border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
              >
                Close
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <main
        className={`mx-auto w-full max-w-6xl px-4 pt-4 ${mainPaddingClass}`}
      >
        <section className="mb-4 rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-zinc-950 p-4 shadow-[0_18px_45px_-30px_rgba(34,211,238,0.95)] md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/40 bg-cyan-400/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-100">
                New 3D Face Scan
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white md:text-xl">
                Scan your face and attach it to a store human body
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-cyan-100/80">
                Use the phone camera in portrait, capture every side of your face, choose a human character body, and create a custom character with your scanned 3D head.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-200/40 bg-black/35 px-3 py-2 text-xs text-cyan-100">
              Step {faceScanStepProgress} / {FACE_SCAN_CREATOR_STEPS.length}
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-4">
            {FACE_SCAN_CREATOR_STEPS.map((step, idx) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setFaceScanStep(idx)}
                className={`rounded-2xl border px-3 py-2 text-left transition ${
                  faceScanStep === idx
                    ? 'border-cyan-100/60 bg-cyan-500/20 text-white'
                    : 'border-white/10 bg-black/25 text-white/75 hover:border-cyan-200/30 hover:text-white'
                }`}
              >
                <p className="text-xs font-semibold">{step.title}</p>
                <p className="mt-1 text-[11px] text-white/70">{step.description}</p>
              </button>
            ))}
          </div>

          <div className="mt-3 grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 md:grid-cols-[1fr_1.1fr]">
            <div className="grid gap-2">
              <label className="text-xs text-white/80">
                Character name
                <input
                  value={faceScanDraft.name}
                  onChange={(e) => handleFaceScanDraftChange('name', e.target.value)}
                  placeholder="e.g. My Royal Avatar"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                />
              </label>
              <label className="text-xs text-white/80">
                Capture face angles with phone camera
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  multiple
                  onChange={handleFaceScanUploads}
                  className="mt-1 w-full rounded-xl border border-dashed border-cyan-200/40 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400/25 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-cyan-100"
                />
              </label>
              <p className="text-[11px] text-white/60">
                {capturedPoseCount
                  ? `${capturedPoseCount} / ${FACE_SCAN_POSES.length} scan angle${capturedPoseCount === 1 ? '' : 's'} ready`
                  : 'No face angles captured yet'}
              </p>

              <div className="grid grid-cols-2 gap-2">
                {FACE_SCAN_POSES.map((pose, idx) => {
                  const captured = Boolean(faceScanUploads[idx]);
                  return (
                    <div
                      key={pose.id}
                      className={`rounded-xl border px-3 py-2 text-xs ${
                        captured
                          ? 'border-cyan-200/50 bg-cyan-400/15 text-cyan-50'
                          : 'border-white/10 bg-black/25 text-white/65'
                      }`}
                    >
                      <p className="font-semibold">{pose.label}</p>
                      <p className="mt-1 text-[11px] text-white/60">{pose.hint}</p>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {FACE_SCAN_DETAIL_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyFaceScanPreset(preset)}
                    className="rounded-xl border border-white/10 bg-black/35 px-2 py-2 text-[11px] font-semibold text-white/80 hover:border-cyan-200/30 hover:text-white"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-white/80">
                  Human body
                  <select
                    value={faceScanDraft.bodyId}
                    onChange={(e) => handleFaceScanDraftChange('bodyId', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                  >
                    {FACE_SCAN_BODY_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-white/80">
                  Face detail
                  <select
                    value={faceScanDraft.detail}
                    onChange={(e) => handleFaceScanDraftChange('detail', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                  >
                    <option>Balanced</option>
                    <option>Stylized</option>
                    <option>High detail</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-white/80">
                  Scan lighting
                  <select
                    value={faceScanDraft.lighting}
                    onChange={(e) => handleFaceScanDraftChange('lighting', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                  >
                    <option>Soft studio</option>
                    <option>Even daylight</option>
                    <option>Neon rim</option>
                    <option>Low shadow</option>
                  </select>
                </label>
                <label className="text-xs text-white/80">
                  Expression
                  <select
                    value={faceScanDraft.expression}
                    onChange={(e) => handleFaceScanDraftChange('expression', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                  >
                    <option>Neutral</option>
                    <option>Relaxed</option>
                    <option>Confident</option>
                  </select>
                </label>
              </div>
              <label className="text-xs text-white/80">
                Mesh quality ({faceScanDraft.scanQuality}%)
                <input
                  type="range"
                  min="40"
                  max="100"
                  step="4"
                  value={faceScanDraft.scanQuality}
                  onChange={(e) => handleFaceScanDraftChange('scanQuality', Number(e.target.value))}
                  className="mt-1 w-full accent-cyan-400"
                />
              </label>
              <label className="text-xs text-white/80">
                Privacy
                <select
                  value={faceScanDraft.privacy}
                  onChange={(e) => handleFaceScanDraftChange('privacy', e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/60"
                >
                  <option value="private">Private to my account</option>
                  <option value="public">Public avatar listing</option>
                </select>
              </label>
              <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-white/70">
                The preview shows the scanned head visually higher on the selected body, sized to fit the neck, with the body staying upright for portrait phone screens.
              </div>
            </div>
          </div>

          {faceScanUploads.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {faceScanUploads.map((entry) => (
                <div key={entry.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                  <img src={entry.previewUrl} alt={`${entry.poseLabel} face scan`} className="h-24 w-full object-cover" />
                  <p className="px-2 py-1 text-[11px] font-semibold text-cyan-100">{entry.poseLabel}</p>
                </div>
              ))}
            </div>
          ) : null}

          {faceScanPreviewReady ? (
            <div className="mt-3">
              <FaceScanCharacterPreview
                scanEntries={faceScanUploads}
                bodyOption={selectedFaceScanBody}
                title={faceScanDraft.name.trim() || 'Untitled character'}
              />
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleFaceScanPreview}
              className="rounded-2xl border border-cyan-200/50 bg-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-50 hover:bg-cyan-400/30"
            >
              Build 3D preview
            </button>
            <button
              type="button"
              onClick={handleFaceScanCreate}
              disabled={!canCreateFaceScan || faceScanSaving}
              className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {faceScanSaving
                ? 'Creating character…'
                : `Create character (${formatTpcAmount(faceScanBuildTotalTariff)} TPC)`}
            </button>
            <span className="text-xs text-cyan-100/85">
              {faceScanCreated
                ? `${faceScanDraft.name || 'Custom character'} is ready with your scanned face attached.`
                : faceScanPreviewReady
                  ? 'Preview ready. Create it when the head fit looks correct.'
                  : 'Capture all four face angles before creating the scan.'}
            </span>
          </div>

          <div className="mt-2 text-xs text-white/70">
            {faceScanBuildShortfall
              ? `Balance alert: you need ${formatTpcAmount(faceScanBuildShortfall)} more TPC to create this character.`
              : `Creation tariff: ${formatTpcAmount(FACE_SCAN_BUILD_TARIFF_TPC)} TPC + ${formatTpcAmount(FACE_SCAN_DETAIL_TARIFF_PER_POSE_TPC)} TPC per captured angle.`}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/0 p-5 shadow-sm">
          <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl" />
          <div className="absolute -left-10 -bottom-10 h-44 w-44 rounded-full bg-indigo-400/10 blur-2xl" />

          <div className="relative grid gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Explore NFT cosmetics across every TonPlaygram game
            </div>

            <h1 className="text-balance text-xl font-semibold md:text-2xl">
              Fresh storefront — browse, filter, and grab cosmetics in seconds
            </h1>

            <p className="max-w-2xl text-sm text-white/70">
              Mobile-first design inspired by the mock above. Every card shows
              TPC price, accessory type, and whether you already own it.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white/90">
                Browse everything
              </button>
              <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">
                Search accessories
              </button>
            </div>
          </div>
        </section>

        <div className="mt-4 grid gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/60">
                  Marketplace
                </p>
                <h2 className="text-xl font-semibold leading-tight">
                  Accessories for every TonPlaygram game
                </h2>
                <p className="text-sm text-white/60">
                  Quick filters, transparent listings, and a confirmation modal
                  before checkout.
                </p>
              </div>
              <div className="grid grid-cols-3 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
                <div className="text-left">
                  <p className="text-xs text-white/60">Listings</p>
                  <p className="font-semibold text-white">
                    {featuredCount.toLocaleString()}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-white/60">Owned</p>
                  <p className="font-semibold text-white">{ownedCount}</p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-white/60">TPC</p>
                  <p className="flex items-center gap-1 font-semibold text-white">
                    {accountBalance === null ? '—' : accountBalance}
                    <img src={TON_ICON} alt="TPC" className="h-4 w-4" />
                  </p>
                </div>
              </div>
            </div>

            <div className="sticky top-20 z-20 mt-4 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950/85 p-3 shadow-sm backdrop-blur md:grid-cols-[2fr_1fr_1fr_1fr]">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <span className="text-white/60">🔎</span>
                <input
                  type="search"
                  placeholder="Search by name, game, or accessory type"
                  className="w-full bg-transparent text-sm text-white/90 outline-none placeholder:text-white/40"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none"
                value={activeGame}
                onChange={(e) => handleGameChange(e.target.value)}
              >
                <option value="all">All games</option>
                {Object.entries(storeMeta).map(([slug, meta]) => (
                  <option key={slug} value={slug}>
                    {meta.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none"
                value={activeType}
                onChange={(e) => setActiveType(e.target.value)}
              >
                {typeFilters.map((type) => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All types' : type}
                  </option>
                ))}
              </select>
              <select
                className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="featured">Trending</option>
                <option value="price-low">Price: Low</option>
                <option value="price-high">Price: High</option>
                <option value="alpha">Alphabetical</option>
              </select>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
              <div className="text-xs text-white/60">
                List cosmetics you already own so other players can purchase
                them securely.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMyListings((prev) => !prev)}
                  className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                    showMyListings
                      ? 'border-blue-200/40 bg-blue-400/15 text-blue-50 shadow-[0_10px_30px_-20px_rgba(59,130,246,0.8)]'
                      : 'border-white/10 bg-black/30 text-white/80 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {showMyListings ? 'Show all listings' : 'View my listings'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowListModal(true)}
                  className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/20"
                >
                  List an owned NFT
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-black/15 p-3 text-sm text-white/80">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                    Multi-select checkout
                  </span>
                  <span className="font-semibold text-white">
                    {hasPurchasableSelection
                      ? `${selectedPurchasable.length} item${selectedPurchasable.length === 1 ? '' : 's'} • ${selectedGameCount || 0} game${selectedGameCount === 1 ? '' : 's'}`
                      : hasSelection
                        ? 'Selected items are already owned.'
                        : 'Select items to bundle a purchase'}
                  </span>
                  {selectedOwnedCount > 0 ? (
                    <span className="text-xs text-amber-200">
                      {selectedOwnedCount} owned selection
                      {selectedOwnedCount === 1 ? ' is' : 's are'} skipped
                      automatically.
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedKeys.length}
                  >
                    Clear selection
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmItem(null);
                      setConfirmItems(selectedPurchasable);
                    }}
                    className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!hasPurchasableSelection || Boolean(processing)}
                  >
                    Buy selected ({selectedTotalPrice.toLocaleString()} TPC)
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                <span
                  className={`rounded-full border px-2 py-0.5 ${selectedShortfall ? 'border-rose-300/30 bg-rose-400/10 text-rose-100' : 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100'}`}
                >
                  {selectedBalanceAfter === null
                    ? 'Balance preview unavailable'
                    : selectedShortfall
                      ? `Need +${formatTpcAmount(selectedShortfall)} TPC`
                      : `After checkout: ${formatTpcAmount(selectedBalanceAfter)} TPC`}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  Green + Blue cloth bundles ready for Pool Royale
                </span>
                <span>
                  Pick multiple NFTs, confirm once, and unlock them together.
                </span>
              </div>
            </div>

            <div className="mt-3 grid gap-3 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/80 shadow-sm sm:grid-cols-4">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-white/60">
                  Your listings
                </p>
                <p className="text-2xl font-semibold text-white">
                  {userListingStats.total}
                </p>
                <p className="text-xs text-white/60">
                  Listed items tied to your account
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-white/60">
                  Total value
                </p>
                <p className="flex items-center gap-1 text-2xl font-semibold text-white">
                  {userListingStats.totalValue.toLocaleString()}
                  <img src={TON_ICON} alt="TPC" className="h-4 w-4" />
                </p>
                <p className="text-xs text-white/60">
                  Sum of your active listings
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-white/60">
                  Average price
                </p>
                <p className="flex items-center gap-1 text-2xl font-semibold text-white">
                  {userListingStats.avgPrice.toLocaleString()}
                  <img src={TON_ICON} alt="TPC" className="h-4 w-4" />
                </p>
                <p className="text-xs text-white/60">
                  Per item across your listings
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-white/60">
                  Floor price
                </p>
                <p className="flex items-center gap-1 text-2xl font-semibold text-white">
                  {userListingStats.total
                    ? userListingStats.floorPrice.toLocaleString()
                    : '—'}
                  {userListingStats.total ? (
                    <img src={TON_ICON} alt="TPC" className="h-4 w-4" />
                  ) : null}
                </p>
                <p className="text-xs text-white/60">
                  Lowest priced NFT you listed
                </p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <div className="text-xs font-semibold text-white/70">Games</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                      activeGame === 'all'
                        ? 'border-white/20 bg-white text-zinc-950'
                        : 'border-white/10 bg-black/20 text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                    onClick={() => handleGameChange('all')}
                  >
                    All
                  </button>
                  {Object.entries(storeMeta).map(([slug, meta]) => (
                    <button
                      key={slug}
                      className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                        activeGame === slug
                          ? 'border-white/20 bg-white text-zinc-950'
                          : 'border-white/10 bg-black/20 text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                      onClick={() => handleGameChange(slug)}
                    >
                      {meta.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="text-xs font-semibold text-white/70">
                  Accessory types
                </div>
                <div className="flex flex-wrap gap-2">
                  {typeFilters.map((type) => (
                    <button
                      key={type}
                      className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                        activeType === type
                          ? 'border-white/20 bg-white text-zinc-950'
                          : 'border-white/10 bg-black/20 text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                      onClick={() => setActiveType(type)}
                    >
                      {type === 'all' ? 'All' : type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <div className="text-base font-semibold">
                {showMyListings ? 'Your listings' : 'Marketplace'}
              </div>
              <div className="text-xs text-white/60">
                {visibleItems.length} listings | pay with TPC | accessories for
                every game
              </div>
            </div>
            <button className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 md:inline">
              View analytics
            </button>
          </div>

          <div className="space-y-4">
            {activeGame !== 'all' ? (
              groupedItems.map(([typeLabel, items]) => (
                <section key={typeLabel} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {typeLabel}
                      </div>
                      <div className="text-xs text-white/60">
                        {items.length} items •{' '}
                        {storeMeta[activeGame]?.name || activeGame}
                      </div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/60">
                      Category
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((item) => renderStoreCard(item))}
                  </div>
                </section>
              ))
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleItems.map((item) => renderStoreCard(item))}
              </div>
            )}
          </div>

          {visibleItems.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
              {showMyListings
                ? 'No personal listings are visible with these filters. List an owned NFT or reset the filters to see everything.'
                : 'No items match these filters. Clear the search or pick a different game.'}
            </div>
          )}

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 space-y-2">
            <p className="font-semibold text-white">Quick guidance</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Confirmation modal appears before every purchase so you always
                know the total.
              </li>
              <li>
                The “Owned” badge updates immediately when a purchase succeeds.
              </li>
              <li>
                Mobile-first layout keeps the cards readable on small portrait
                screens.
              </li>
            </ul>
          </div>

          {info ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center text-sm font-semibold text-white/80">
              {info}
            </div>
          ) : null}
          {purchaseStatus ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center text-sm font-semibold text-emerald-300">
              {purchaseStatus}
            </div>
          ) : null}
        </div>
      </main>

      {hasSelection ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span>
                {hasPurchasableSelection
                  ? `${selectedPurchasable.length} item${selectedPurchasable.length === 1 ? '' : 's'} • ${selectedTotalPrice.toLocaleString()} TPC`
                  : 'No purchasable items in your selection.'}
              </span>
              {selectedGameCount && hasPurchasableSelection ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  {selectedGameCount} game{selectedGameCount === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
            {hasPurchasableSelection ? (
              <div
                className={`text-[11px] ${selectedShortfall ? 'text-rose-200' : 'text-emerald-200'}`}
              >
                {selectedBalanceAfter === null
                  ? 'Balance preview unavailable.'
                  : selectedShortfall
                    ? `Need ${formatTpcAmount(selectedShortfall)} more TPC before checkout.`
                    : `After checkout balance: ${formatTpcAmount(selectedBalanceAfter)} TPC.`}
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white/80"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmItem(null);
                  setConfirmItems(selectedPurchasable);
                }}
                className="flex-[2] rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-zinc-950"
                disabled={!hasPurchasableSelection || Boolean(processing)}
              >
                Buy now ({selectedTotalPrice.toLocaleString()} TPC)
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {renderListModal()}
      {renderDetailModal()}
      {renderZoomModal()}
      {renderBulkConfirmModal()}
      {renderConfirmModal()}
    </div>
  );
}
