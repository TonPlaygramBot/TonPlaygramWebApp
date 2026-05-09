import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';
import { CAPTURE_ANIMATION_OPTIONS } from './ludoBattleOptions.js';
import { MURLAN_TABLE_FINISHES } from './murlanTableFinishes.js';
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_STORE_ITEMS
} from './poolRoyaleInventoryConfig.js';
import { swatchThumbnail } from './storeThumbnails.js';

const DEFAULT_HDRI_ID = POOL_ROYALE_DEFAULT_HDRI_ID || POOL_ROYALE_HDRI_VARIANTS[0]?.id;

const CHESS_HUMAN_CHARACTER_SOURCE = Object.freeze({
  source: 'open-source',
  license: 'CC0',
  author: 'Mixamo / Adobe (sample avatars)'
});

const DEFAULT_SEATED_HUMAN_ADAPTER = Object.freeze({
  seatedScaleMultiplier: 1,
  seatedYawOffset: 0,
  seatedYOffset: 0,
  seatedZOffset: 0
});

export const CHESS_HUMAN_CHARACTER_OPTIONS = Object.freeze([
  {
    id: 'rpm-current',
    label: 'Current Avatar',
    modelUrls: ['https://threejs.org/examples/models/gltf/readyplayer.me.glb'],
    thumbnail: swatchThumbnail(['#2f6f8a', '#1e293b', '#b48d6b']),
    seatedAdapter: DEFAULT_SEATED_HUMAN_ADAPTER,
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-aj',
    label: 'AJ',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Aj.glb'],
    thumbnail: swatchThumbnail(['#2a4365', '#1f2937', '#d4a373']),
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-jane',
    label: 'Jane',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Jane.glb'],
    thumbnail: swatchThumbnail(['#6b21a8', '#1f2937', '#f5c2a0']),
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-eva',
    label: 'Eva',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Eva.glb'],
    thumbnail: swatchThumbnail(['#0f766e', '#164e63', '#f2c89b']),
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-joe',
    label: 'Joe',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Joe.glb'],
    thumbnail: swatchThumbnail(['#6b7280', '#1f2937', '#c58f63']),
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-kaya',
    label: 'Kaya',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Kaya.glb'],
    thumbnail: swatchThumbnail(['#1d4ed8', '#111827', '#d8b08c']),
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-ybot',
    label: 'Y-Bot',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/YBot.glb'],
    thumbnail: swatchThumbnail(['#1f2937', '#0f172a', '#9ca3af']),
    seatedAdapter: {
      seatedScaleMultiplier: 0.95,
      seatedYawOffset: Math.PI
    },
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-xbot',
    label: 'X-Bot',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Xbot.glb'],
    thumbnail: swatchThumbnail(['#334155', '#0f172a', '#94a3b8']),
    seatedAdapter: {
      seatedScaleMultiplier: 0.95,
      seatedYawOffset: Math.PI
    },
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-soldier',
    label: 'Soldier',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb'],
    thumbnail: swatchThumbnail(['#3f6212', '#1f2937', '#b8a083']),
    seatedAdapter: {
      seatedScaleMultiplier: 0.89,
      seatedYawOffset: Math.PI,
      seatedYOffset: -0.01
    },
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-remy',
    label: 'Remy',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Remy.glb'],
    thumbnail: swatchThumbnail(['#7c2d12', '#111827', '#d6a77b']),
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-priya',
    label: 'Priya',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Priya.glb'],
    thumbnail: swatchThumbnail(['#c026d3', '#312e81', '#e6b58f']),
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-noah',
    label: 'Noah',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Noah.glb'],
    thumbnail: swatchThumbnail(['#0891b2', '#0f172a', '#c79b76']),
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-martha',
    label: 'Martha',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Martha.glb'],
    thumbnail: swatchThumbnail(['#7e22ce', '#1f2937', '#f0c4a3']),
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-lewis',
    label: 'Lewis',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Lewis.glb'],
    thumbnail: swatchThumbnail(['#0f766e', '#064e3b', '#cb9d75']),
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-kiara',
    label: 'Kiara',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Kiara.glb'],
    thumbnail: swatchThumbnail(['#be123c', '#1f2937', '#e7be98']),
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'mixamo-josh',
    label: 'Josh',
    modelUrls: ['https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Josh.glb'],
    thumbnail: swatchThumbnail(['#1d4ed8', '#1f2937', '#c49368']),
    ...CHESS_HUMAN_CHARACTER_SOURCE
  },
  {
    id: 'webgl-vietnam-human',
    label: 'Vietnam Human',
    modelUrls: ['https://raw.githubusercontent.com/hmthanh/3d-human-model/main/TranThiNgocTham.glb'],
    thumbnail: swatchThumbnail(['#3b82f6', '#1e293b', '#d6b08a']),
    source: 'hmthanh/3d-human-model GitHub',
    license: 'Check repository license',
    author: 'hmthanh'
  },
  {
    id: 'webgl-human-body-a',
    label: 'Human Body A',
    modelUrls: ['https://raw.githubusercontent.com/msorkhpar/3d-human-model-vite/main/body.glb'],
    thumbnail: swatchThumbnail(['#22c55e', '#111827', '#c99b73']),
    source: 'msorkhpar/3d-human-model-vite GitHub',
    license: 'Check repository license',
    author: 'msorkhpar'
  },
  {
    id: 'webgl-human-body-b',
    label: 'Human Body B',
    modelUrls: ['https://raw.githubusercontent.com/bddicken/humanbody/main/body.glb'],
    thumbnail: swatchThumbnail(['#f59e0b', '#1f2937', '#c5936d']),
    source: 'bddicken/humanbody GitHub',
    license: 'Check repository license',
    author: 'bddicken'
  },
  {
    id: 'webgl-ai-teacher',
    label: 'AI Teacher',
    modelUrls: ['https://raw.githubusercontent.com/Surbh77/AI-teacher/main/avatar.glb'],
    thumbnail: swatchThumbnail(['#ec4899', '#1e1b4b', '#d7ae89']),
    source: 'Surbh77/AI-teacher GitHub',
    license: 'Check repository license',
    author: 'Surbh77'
  },
  {
    id: 'webgl-ai-teacher-1',
    label: 'AI Teacher 1',
    modelUrls: ['https://raw.githubusercontent.com/Surbh77/AI-teacher/main/avatar1.glb'],
    thumbnail: swatchThumbnail(['#06b6d4', '#0f172a', '#d4a882']),
    source: 'Surbh77/AI-teacher GitHub',
    license: 'Check repository license',
    author: 'Surbh77'
  }
]);

const CHESS_STORE_HUMAN_CHARACTER_IDS = Object.freeze([
  'webgl-vietnam-human',
  'webgl-human-body-a',
  'webgl-human-body-b',
  'webgl-ai-teacher',
  'webgl-ai-teacher-1'
]);

const BASE_CHAIR_OPTIONS = [
  {
    id: 'crimsonVelvet',
    label: 'Crimson Velvet',
    primary: '#8b1538',
    accent: '#5c0f26',
    highlight: '#d35a7a',
    legColor: '#1f1f1f',
    thumbnail: swatchThumbnail(['#8b1538', '#5c0f26', '#d35a7a'])
  },
  {
    id: 'midnightNavy',
    label: 'Midnight Blue',
    primary: '#153a8b',
    accent: '#0c214f',
    highlight: '#4d74d8',
    legColor: '#10131c',
    thumbnail: swatchThumbnail(['#153a8b', '#0c214f', '#4d74d8'])
  },
  {
    id: 'emeraldWave',
    label: 'Emerald Wave',
    primary: '#0f6a2f',
    accent: '#063d1b',
    highlight: '#48b26a',
    legColor: '#142318',
    thumbnail: swatchThumbnail(['#0f6a2f', '#063d1b', '#48b26a'])
  },
  {
    id: 'onyxShadow',
    label: 'Onyx Shadow',
    primary: '#202020',
    accent: '#101010',
    highlight: '#6f6f6f',
    legColor: '#080808',
    thumbnail: swatchThumbnail(['#202020', '#101010', '#6f6f6f'])
  },
  {
    id: 'royalPlum',
    label: 'Royal Chestnut',
    primary: '#3f1f5b',
    accent: '#2c1340',
    highlight: '#7c4ae0',
    legColor: '#140a24',
    thumbnail: swatchThumbnail(['#3f1f5b', '#2c1340', '#7c4ae0'])
  }
];

const mapStoolThemeToChair = (theme) => ({
  ...theme,
  primary: theme.seatColor || theme.primary || '#7c3aed',
  accent: theme.accent || theme.highlight || theme.seatColor,
  legColor: theme.legColor || theme.baseColor || '#111827',
  preserveMaterials: theme.preserveMaterials ?? theme.source === 'polyhaven'
});

export const CHESS_CHAIR_OPTIONS = Object.freeze([
  ...MURLAN_STOOL_THEMES.map(mapStoolThemeToChair),
  ...BASE_CHAIR_OPTIONS
]);

const PROCEDURAL_TABLE_OPTIONS = [
  {
    id: 'murlan-default',
    label: 'Octagon Table',
    source: 'procedural',
    proceduralShapeId: 'classicOctagon',
    price: 0,
    description: 'Default octagon battle table with shared royale proportions.',
    thumbnail: swatchThumbnail(['#0f172a', '#1f2937', '#38bdf8'])
  },
  {
    id: 'hexagonTable',
    label: 'Hexagon Table',
    source: 'procedural',
    proceduralShapeId: 'hexagonTable',
    price: 980,
    description: 'Six-sided battle table tuned for Chess Battle Royal.',
    thumbnail: swatchThumbnail(['#0f172a', '#111827', '#22d3ee'])
  },
  {
    id: 'grandOval',
    label: 'Oval Table',
    source: 'procedural',
    proceduralShapeId: 'grandOval',
    price: 1020,
    description: 'Oval battle table variant for a softer arena silhouette.',
    thumbnail: swatchThumbnail(['#0b1220', '#111827', '#f97316'])
  },
  {
    id: 'diamondEdge',
    label: 'Diamond Edge Table',
    source: 'procedural',
    proceduralShapeId: 'diamondEdge',
    price: 1060,
    description: 'Diamond-edge table shape with crisp rounded corners.',
    thumbnail: swatchThumbnail(['#1f2937', '#0f172a', '#a855f7'])
  }
];

export const CHESS_TABLE_OPTIONS = Object.freeze([
  ...PROCEDURAL_TABLE_OPTIONS,
  ...MURLAN_TABLE_THEMES.filter((theme) => theme.id !== 'murlan-default')
]);

const CHESS_BATTLE_REMOVED_TABLE_IDS = new Set(['diamondEdge']);
const CHESS_BATTLE_DEFAULT_TABLE_ID = 'murlan-default';

export const CHESS_BATTLE_TABLE_OPTIONS = Object.freeze(
  CHESS_TABLE_OPTIONS
    .filter((option) => !CHESS_BATTLE_REMOVED_TABLE_IDS.has(option.id))
    .sort((a, b) => {
      if (a.id === CHESS_BATTLE_DEFAULT_TABLE_ID) return -1;
      if (b.id === CHESS_BATTLE_DEFAULT_TABLE_ID) return 1;
      return 0;
    })
);

const POOL_ROYALE_LT_TABLE_FINISH_IDS = new Set([
  'carbonFiberChalk',
  'carbonFiberChalkGrey',
  'carbonFiberChalkBeige',
  'carbonFiberChalkDarkBlue',
  'carbonFiberChalkWhite',
  'carbonFiberChalkDarkGreen',
  'carbonFiberChalkDarkYellow',
  'carbonFiberChalkDarkBrown',
  'carbonFiberChalkDarkRed',
  'carbonFiberSnakeChalk',
  'carbonFiberSnakeChalkGrey',
  'carbonFiberSnakeChalkBeige',
  'carbonFiberSnakeChalkDarkBlue',
  'carbonFiberSnakeChalkWhite',
  'carbonFiberSnakeChalkDarkGreen',
  'carbonFiberAlligatorOlive',
  'carbonFiberAlligatorSwamp',
  'carbonFiberAlligatorClay',
  'carbonFiberAlligatorSand',
  'carbonFiberAlligatorMoss',
  'carbonFiberAlligatorNight'
]);

const CHESS_LT_TABLE_FINISHES = Object.freeze(
  POOL_ROYALE_STORE_ITEMS.filter(
    (item) => item.type === 'tableFinish' && POOL_ROYALE_LT_TABLE_FINISH_IDS.has(item.optionId)
  ).map((item) => ({
    id: item.optionId,
    label: item.name.replace(/\s*Finish$/i, ''),
    description: item.description,
    price: item.price,
    swatches: item.swatches,
    thumbnail: item.thumbnail,
    woodOption: Object.freeze({
      id: item.optionId,
      label: item.name.replace(/\s*Finish$/i, ''),
      presetId: 'smokedOak',
      grainId: 'dark_wood'
    })
  }))
);

export const CHESS_TABLE_FINISH_OPTIONS = Object.freeze([
  ...MURLAN_TABLE_FINISHES,
  ...CHESS_LT_TABLE_FINISHES
]);

export const CHESS_BATTLE_DEFAULT_UNLOCKS = Object.freeze({
  chairColor: [CHESS_CHAIR_OPTIONS[0]?.id],
  tables: [CHESS_TABLE_OPTIONS[0]?.id],
  tableFinish: [CHESS_TABLE_FINISH_OPTIONS[0]?.id],
  sideColor: ['amberGlow', 'mintVale'],
  boardTheme: ['classic'],
  headStyle: ['current'],
  humanCharacter: [CHESS_HUMAN_CHARACTER_OPTIONS[0]?.id],
  environmentHdri: [DEFAULT_HDRI_ID],
  captureAnimation: [CAPTURE_ANIMATION_OPTIONS[0]?.id]
});

export const CHESS_BATTLE_OPTION_LABELS = Object.freeze({
  chairColor: Object.freeze(
    CHESS_CHAIR_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  tables: Object.freeze(
    CHESS_TABLE_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  tableFinish: Object.freeze(
    CHESS_TABLE_FINISH_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  sideColor: Object.freeze({
    marble: 'Marble',
    darkForest: 'Dark Forest',
    amberGlow: 'Amber Glow',
    mintVale: 'Mint Vale',
    royalWave: 'Royal Wave',
    roseMist: 'Rose Mist',
    amethyst: 'Amethyst',
    cinderBlaze: 'Cinder Blaze',
    arcticDrift: 'Arctic Drift',
    obsidianGold: 'Obsidian Gold',
    coralBloom: 'Coral Bloom',
    neonPulse: 'Neon Pulse'
  }),
  boardTheme: Object.freeze({
    classic: 'Classic',
    ivorySlate: 'Ivory/Slate',
    forest: 'Forest',
    sand: 'Sand/Brown',
    ocean: 'Ocean',
    violet: 'Violet',
    chrome: 'Chrome',
    nebulaGlass: 'Nebula Glass'
  }),
  headStyle: Object.freeze({
    current: 'Current',
    headRuby: 'Ruby',
    headSapphire: 'Sapphire',
    headChrome: 'Chrome',
    headGold: 'Gold'
  }),
  humanCharacter: Object.freeze(
    CHESS_HUMAN_CHARACTER_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  ),
  environmentHdri: Object.freeze(
    POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
      acc[variant.id] = `${variant.name} HDRI`;
      return acc;
    }, {})
  ),
  captureAnimation: Object.freeze(
    CAPTURE_ANIMATION_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  )
});

export const CHESS_BATTLE_OPTION_THUMBNAILS = Object.freeze({
  sideColor: Object.freeze({
    marble: '/assets/game-art/chess-battle-royal/pieces/marble.svg',
    darkForest: '/assets/game-art/chess-battle-royal/pieces/darkForest.svg',
    amberGlow: '/assets/game-art/chess-battle-royal/pieces/amberGlow.svg',
    mintVale: '/assets/game-art/chess-battle-royal/pieces/mintVale.svg',
    royalWave: '/assets/game-art/chess-battle-royal/pieces/royalWave.svg',
    roseMist: '/assets/game-art/chess-battle-royal/pieces/roseMist.svg',
    amethyst: '/assets/game-art/chess-battle-royal/pieces/amethyst.svg',
    cinderBlaze: '/assets/game-art/chess-battle-royal/pieces/cinderBlaze.svg',
    arcticDrift: '/assets/game-art/chess-battle-royal/pieces/arcticDrift.svg',
    obsidianGold: '/assets/game-art/chess-battle-royal/pieces/obsidianGold.svg',
    coralBloom: '/assets/game-art/chess-battle-royal/pieces/coralBloom.svg',
    neonPulse: '/assets/game-art/chess-battle-royal/pieces/neonPulse.svg'
  }),
  boardTheme: Object.freeze({
    classic: '/assets/game-art/chess-battle-royal/boards/classic.svg',
    ivorySlate: '/assets/game-art/chess-battle-royal/boards/ivorySlate.svg',
    forest: '/assets/game-art/chess-battle-royal/boards/forest.svg',
    sand: '/assets/game-art/chess-battle-royal/boards/sand.svg',
    ocean: '/assets/game-art/chess-battle-royal/boards/ocean.svg',
    violet: '/assets/game-art/chess-battle-royal/boards/violet.svg',
    chrome: '/assets/game-art/chess-battle-royal/boards/chrome.svg',
    nebulaGlass: '/assets/game-art/chess-battle-royal/boards/nebulaGlass.svg'
  }),
  headStyle: Object.freeze({
    current: '/assets/game-art/chess-battle-royal/heads/current.svg',
    headRuby: '/assets/game-art/chess-battle-royal/heads/headRuby.svg',
    headSapphire: '/assets/game-art/chess-battle-royal/heads/headSapphire.svg',
    headChrome: '/assets/game-art/chess-battle-royal/heads/headChrome.svg',
    headGold: '/assets/game-art/chess-battle-royal/heads/headGold.svg'
  }),
  humanCharacter: Object.freeze(
    CHESS_HUMAN_CHARACTER_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.thumbnail;
      return acc;
    }, {})
  ),
  captureAnimation: Object.freeze(
    CAPTURE_ANIMATION_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.thumbnail;
      return acc;
    }, {})
  )
});

export const CHESS_BATTLE_STORE_ITEMS = [
  ...CHESS_TABLE_FINISH_OPTIONS.map((finish, idx) => ({
    id: `chess-table-finish-${finish.id}`,
    type: 'tableFinish',
    optionId: finish.id,
    name: finish.label,
    price: finish.price ?? 980 + idx * 40,
    description: finish.description,
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'table'
  })),
  ...CHESS_TABLE_OPTIONS.map((theme, idx) => ({
    id: `chess-table-${theme.id}`,
    type: 'tables',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 980 + idx * 40,
    description: theme.description || `${theme.label} table with preserved Poly Haven materials.`,
    thumbnail: theme.thumbnail,
    previewShape: 'table'
  })),
  ...CHESS_CHAIR_OPTIONS.slice(1).map((option, idx) => ({
    id: `chess-chair-${option.id}`,
    type: 'chairColor',
    optionId: option.id,
    name: option.label,
    price: option.price ?? 320 + idx * 20,
    description:
      option.description ||
      `${option.label} seating tuned for Chess Battle Royal.`,
    thumbnail: option.thumbnail,
    previewShape: 'chair'
  })),
  {
    id: 'chess-side-marble',
    type: 'sideColor',
    optionId: 'marble',
    name: 'Marble Pieces',
    price: 1400,
    description: 'Premium marble-inspired pieces for either side.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.marble
  },
  {
    id: 'chess-side-forest',
    type: 'sideColor',
    optionId: 'darkForest',
    name: 'Dark Forest Pieces',
    price: 1300,
    description: 'Deep forest hue pieces with luxe accents.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.darkForest
  },
  {
    id: 'chess-side-royal',
    type: 'sideColor',
    optionId: 'royalWave',
    name: 'Royal Wave Pieces',
    price: 420,
    description: 'Royal blue quick-select palette.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.royalWave
  },
  {
    id: 'chess-side-rose',
    type: 'sideColor',
    optionId: 'roseMist',
    name: 'Rose Mist Pieces',
    price: 420,
    description: 'Rosy quick-select palette with soft glow.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.roseMist
  },
  {
    id: 'chess-side-amethyst',
    type: 'sideColor',
    optionId: 'amethyst',
    name: 'Amethyst Pieces',
    price: 460,
    description: 'Amethyst quick-select palette with sheen.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.amethyst
  },
  {
    id: 'chess-side-cinder',
    type: 'sideColor',
    optionId: 'cinderBlaze',
    name: 'Cinder Blaze Pieces',
    price: 480,
    description: 'Molten orange-on-charcoal palette for fiery showdowns.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.cinderBlaze
  },
  {
    id: 'chess-side-arctic',
    type: 'sideColor',
    optionId: 'arcticDrift',
    name: 'Arctic Drift Pieces',
    price: 520,
    description: 'Icy stone palette with frosted metallic hints.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.arcticDrift
  },
  {
    id: 'chess-side-obsidian-gold',
    type: 'sideColor',
    optionId: 'obsidianGold',
    name: 'Obsidian Gold Pieces',
    price: 560,
    description: 'Midnight obsidian body with luxe gold accents.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.obsidianGold
  },
  {
    id: 'chess-side-coral-bloom',
    type: 'sideColor',
    optionId: 'coralBloom',
    name: 'Coral Bloom Pieces',
    price: 540,
    description: 'Coral and aqua contrast for vibrant checkers sets.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.coralBloom
  },
  {
    id: 'chess-side-neon-pulse',
    type: 'sideColor',
    optionId: 'neonPulse',
    name: 'Neon Pulse Pieces',
    price: 600,
    description: 'Neon lime and ultraviolet combo for night arena vibes.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor.neonPulse
  },
  {
    id: 'chess-board-ivorySlate',
    type: 'boardTheme',
    optionId: 'ivorySlate',
    name: 'Ivory/Slate Board',
    price: 380,
    description: 'Alternate board palette for fast swaps.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.ivorySlate
  },
  {
    id: 'chess-board-forest',
    type: 'boardTheme',
    optionId: 'forest',
    name: 'Forest Board',
    price: 410,
    description: 'Alternate board palette for fast swaps.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.forest
  },
  {
    id: 'chess-board-sand',
    type: 'boardTheme',
    optionId: 'sand',
    name: 'Sand/Brown Board',
    price: 440,
    description: 'Alternate board palette for fast swaps.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.sand
  },
  {
    id: 'chess-board-ocean',
    type: 'boardTheme',
    optionId: 'ocean',
    name: 'Ocean Board',
    price: 470,
    description: 'Alternate board palette for fast swaps.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.ocean
  },
  {
    id: 'chess-board-violet',
    type: 'boardTheme',
    optionId: 'violet',
    name: 'Violet Board',
    price: 500,
    description: 'Alternate board palette for fast swaps.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.violet
  },
  {
    id: 'chess-board-chrome',
    type: 'boardTheme',
    optionId: 'chrome',
    name: 'Chrome Board',
    price: 540,
    description: 'Alternate board palette for fast swaps.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.chrome
  },
  {
    id: 'chess-board-nebula',
    type: 'boardTheme',
    optionId: 'nebulaGlass',
    name: 'Nebula Glass Board',
    price: 580,
    description: 'Cosmic glass palette with deep-space contrasts.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.boardTheme.nebulaGlass
  },
  {
    id: 'chess-head-ruby',
    type: 'headStyle',
    optionId: 'headRuby',
    name: 'Ruby Pawn Heads',
    price: 310,
    description: 'Unlocks an additional pawn head glass preset.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.headStyle.headRuby
  },
  {
    id: 'chess-head-sapphire',
    type: 'headStyle',
    optionId: 'headSapphire',
    name: 'Sapphire Pawn Heads',
    price: 335,
    description: 'Unlocks an additional pawn head glass preset.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.headStyle.headSapphire
  },
  {
    id: 'chess-head-chrome',
    type: 'headStyle',
    optionId: 'headChrome',
    name: 'Chrome Pawn Heads',
    price: 360,
    description: 'Unlocks an additional pawn head glass preset.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.headStyle.headChrome
  },
  {
    id: 'chess-head-gold',
    type: 'headStyle',
    optionId: 'headGold',
    name: 'Gold Pawn Heads',
    price: 385,
    description: 'Unlocks an additional pawn head glass preset.',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.headStyle.headGold
  },
  ...CAPTURE_ANIMATION_OPTIONS.map((option, idx) => ({
    id: `chess-capture-animation-${option.id}`,
    type: 'captureAnimation',
    optionId: option.id,
    name: option.label,
    price: 900 + idx * 110,
    description: option.description || 'Ludo Battle Royal weapon animation pack adapted for Chess Battle Royal.',
    thumbnail: option.thumbnail
  })),
  ...CHESS_HUMAN_CHARACTER_OPTIONS.filter((option) =>
    CHESS_STORE_HUMAN_CHARACTER_IDS.includes(option.id)
  ).map((option, idx) => ({
    id: `chess-human-${option.id}`,
    type: 'humanCharacter',
    optionId: option.id,
    name: option.label,
    price: 620 + idx * 30,
    description: 'Open-source GLB human character for the seated chess arena.',
    thumbnail: option.thumbnail
  })),
  ...POOL_ROYALE_HDRI_VARIANTS.map((variant, idx) => ({
    id: `chess-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price ?? 1400 + idx * 30,
    description: 'Pool Royale HDRI environment, tuned for chess table promos.',
    thumbnail: variant.thumbnail
  }))
];

export const CHESS_BATTLE_DEFAULT_LOADOUT = [
  {
    type: 'tables',
    optionId: CHESS_TABLE_OPTIONS[0]?.id,
    label: CHESS_TABLE_OPTIONS[0]?.label
  },
  { type: 'chairColor', optionId: CHESS_CHAIR_OPTIONS[0]?.id, label: CHESS_CHAIR_OPTIONS[0]?.label },
  {
    type: 'tableFinish',
    optionId: CHESS_TABLE_FINISH_OPTIONS[0]?.id,
    label: CHESS_TABLE_FINISH_OPTIONS[0]?.label
  },
  { type: 'sideColor', optionId: 'amberGlow', label: 'Amber Glow Pieces' },
  { type: 'sideColor', optionId: 'mintVale', label: 'Mint Vale Pieces' },
  { type: 'boardTheme', optionId: 'classic', label: 'Classic Board' },
  { type: 'headStyle', optionId: 'current', label: 'Current Pawn Heads' },
  {
    type: 'humanCharacter',
    optionId: CHESS_HUMAN_CHARACTER_OPTIONS[0]?.id,
    label: CHESS_HUMAN_CHARACTER_OPTIONS[0]?.label || 'Current Avatar'
  },
  {
    type: 'environmentHdri',
    optionId: DEFAULT_HDRI_ID,
    label: CHESS_BATTLE_OPTION_LABELS.environmentHdri[DEFAULT_HDRI_ID] || 'HDR Environment'
  },
  {
    type: 'captureAnimation',
    optionId: CAPTURE_ANIMATION_OPTIONS[0]?.id,
    label: CAPTURE_ANIMATION_OPTIONS[0]?.label
  }
];

export const CHESS_BATTLE_ROYAL_OPTION_LABELS = Object.freeze({
  ...CHESS_BATTLE_OPTION_LABELS,
  tables: Object.freeze(
    CHESS_BATTLE_TABLE_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  )
});

export const CHESS_BATTLE_ROYAL_DEFAULT_UNLOCKS = Object.freeze({
  ...CHESS_BATTLE_DEFAULT_UNLOCKS,
  tables: [CHESS_BATTLE_TABLE_OPTIONS[0]?.id]
});

export const CHESS_BATTLE_ROYAL_DEFAULT_LOADOUT = Object.freeze(
  CHESS_BATTLE_DEFAULT_LOADOUT.map((item) => {
    if (item.type !== 'tables') return item;
    return {
      ...item,
      optionId: CHESS_BATTLE_TABLE_OPTIONS[0]?.id,
      label: CHESS_BATTLE_TABLE_OPTIONS[0]?.label
    };
  })
);

export const CHESS_BATTLE_ROYAL_STORE_ITEMS = Object.freeze(
  CHESS_BATTLE_STORE_ITEMS.filter(
    (item) => item.type !== 'tables' || !CHESS_BATTLE_REMOVED_TABLE_IDS.has(item.optionId)
  )
);
