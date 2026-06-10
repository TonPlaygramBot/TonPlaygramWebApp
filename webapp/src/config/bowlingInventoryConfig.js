import {
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_STORE_ITEMS,
} from './poolRoyaleInventoryConfig.js';
import { swatchThumbnail } from './storeThumbnails.js';

const DEFAULT_BOWLING_CHARACTER_SOURCE = Object.freeze({
  source: 'Domino Royal human character set',
  license: 'original game avatar catalog'
});

export const BOWLING_DOMINO_CLOTH_MATERIALS = Object.freeze({
  denim: {
    source: 'Poly Haven denim_fabric 1k glTF CC0',
    color: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/denim_fabric/denim_fabric_diff_1k.jpg',
    normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/denim_fabric/denim_fabric_nor_gl_1k.jpg',
    roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/denim_fabric/denim_fabric_rough_1k.jpg',
    tint: 0x314d86
  },
  check: {
    source: 'Poly Haven gingham_check 1k glTF CC0',
    color: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/gingham_check/gingham_check_diff_1k.jpg',
    normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/gingham_check/gingham_check_nor_gl_1k.jpg',
    roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/gingham_check/gingham_check_rough_1k.jpg',
    tint: 0x9f3651
  },
  hessian: {
    source: 'Poly Haven hessian_230 1k glTF CC0',
    color: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/hessian_230/hessian_230_diff_1k.jpg',
    normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/hessian_230/hessian_230_nor_gl_1k.jpg',
    roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/hessian_230/hessian_230_rough_1k.jpg',
    tint: 0xa27445
  },
  floral: {
    source: 'Poly Haven floral_jacquard 1k glTF CC0',
    color: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floral_jacquard/floral_jacquard_diff_1k.jpg',
    normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floral_jacquard/floral_jacquard_nor_gl_1k.jpg',
    roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/floral_jacquard/floral_jacquard_rough_1k.jpg',
    tint: 0x6d3f7f
  },
  fleece: {
    source: 'Poly Haven knitted_fleece 1k glTF CC0',
    color: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/knitted_fleece/knitted_fleece_diff_1k.jpg',
    normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/knitted_fleece/knitted_fleece_nor_gl_1k.jpg',
    roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/knitted_fleece/knitted_fleece_rough_1k.jpg',
    tint: 0x4b5563
  },
  picnic: {
    source: 'Poly Haven fabric_pattern_07 1k glTF CC0',
    color: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_pattern_07/fabric_pattern_07_col_1_1k.jpg',
    normal: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_pattern_07/fabric_pattern_07_nor_gl_1k.jpg',
    roughness: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_pattern_07/fabric_pattern_07_rough_1k.jpg',
    tint: 0xc44f42
  }
});

export const BOWLING_DOMINO_CHARACTER_TEXTURES = Object.freeze({
  royalDenim: {
    upper: { material: 'denim', tint: 0x2f5f9f, repeat: 4.2 },
    lower: { material: 'hessian', tint: 0x9b6b3f, repeat: 3.4 },
    accent: { material: 'fleece', tint: 0xd8dee9, repeat: 5.0 },
    hairColor: 0x24150f,
    eyeColor: 0x2f5d7c,
    skinTone: 0xd9a27d
  },
  casinoCheck: {
    upper: { material: 'check', tint: 0xb7375d, repeat: 3.8 },
    lower: { material: 'denim', tint: 0x243e70, repeat: 4.4 },
    accent: { material: 'hessian', tint: 0xf4d7a1, repeat: 3.2 },
    hairColor: 0x14100c,
    eyeColor: 0x5a3d2b,
    skinTone: 0xc78f68
  },
  linenStreet: {
    upper: { material: 'hessian', tint: 0xb68452, repeat: 3.6 },
    lower: { material: 'fleece', tint: 0x374151, repeat: 5.2 },
    accent: { material: 'denim', tint: 0x4a6fa4, repeat: 4.0 },
    hairColor: 0x2c1b12,
    eyeColor: 0x406a45,
    skinTone: 0xe0b18d
  },
  jacquardNight: {
    upper: { material: 'floral', tint: 0x7c3f88, repeat: 3.2 },
    lower: { material: 'denim', tint: 0x1f335f, repeat: 4.5 },
    accent: { material: 'check', tint: 0xe3c16f, repeat: 4.0 },
    hairColor: 0x3a2418,
    eyeColor: 0x364f7d,
    skinTone: 0xb87957
  },
  softFleece: {
    upper: { material: 'fleece', tint: 0x556070, repeat: 5.3 },
    lower: { material: 'hessian', tint: 0x8b633f, repeat: 3.7 },
    accent: { material: 'floral', tint: 0xb88ab8, repeat: 3.0 },
    hairColor: 0x120d0a,
    eyeColor: 0x33271e,
    skinTone: 0xd39a72
  },
  patternedRed: {
    upper: { material: 'picnic', tint: 0xc44f42, repeat: 3.4 },
    lower: { material: 'denim', tint: 0x263f73, repeat: 4.7 },
    accent: { material: 'fleece', tint: 0xf1f5f9, repeat: 5.0 },
    hairColor: 0x231915,
    eyeColor: 0x3d5f73,
    skinTone: 0xc88b64
  },
  mixedDenim: {
    upper: { material: 'denim', tint: 0x3b6ea8, repeat: 4.0 },
    lower: { material: 'check', tint: 0x4f6f93, repeat: 4.2 },
    accent: { material: 'hessian', tint: 0xd6a35f, repeat: 3.2 },
    hairColor: 0x0f0b08,
    eyeColor: 0x4c3425,
    skinTone: 0xe3b08b
  }
});

export const BOWLING_HUMAN_CHARACTER_OPTIONS = Object.freeze([
  {
    id: 'rpm-current-domino',
    label: 'Current Avatar',
    modelUrls: ['https://threejs.org/examples/models/gltf/readyplayer.me.glb'],
    thumbnail: swatchThumbnail(['#2f6f8a', '#1e293b', '#b48d6b']),
    accent: '#ff7a2f',
    clothCombo: 'royalDenim',
    ...DEFAULT_BOWLING_CHARACTER_SOURCE
  },
  {
    id: 'rpm-67d411-domino',
    label: 'Casino Rival',
    modelUrls: [
      'https://models.readyplayer.me/67d411b30787acbf58ce58ac.glb',
      'https://api.readyplayer.me/v1/avatars/67d411b30787acbf58ce58ac.glb',
      'https://avatars.readyplayer.me/67d411b30787acbf58ce58ac.glb'
    ],
    thumbnail: swatchThumbnail(['#b7375d', '#243e70', '#f4d7a1']),
    accent: '#b7375d',
    clothCombo: 'casinoCheck',
    ...DEFAULT_BOWLING_CHARACTER_SOURCE
  },
  {
    id: 'rpm-67f433-domino',
    label: 'Linen Pro',
    modelUrls: [
      'https://models.readyplayer.me/67f433b69dc08cf26d2cf585.glb',
      'https://api.readyplayer.me/v1/avatars/67f433b69dc08cf26d2cf585.glb',
      'https://avatars.readyplayer.me/67f433b69dc08cf26d2cf585.glb'
    ],
    thumbnail: swatchThumbnail(['#b68452', '#374151', '#4a6fa4']),
    accent: '#b68452',
    clothCombo: 'linenStreet',
    ...DEFAULT_BOWLING_CHARACTER_SOURCE
  },
  {
    id: 'rpm-67e1b5-domino',
    label: 'Jacquard Ace',
    modelUrls: [
      'https://models.readyplayer.me/67e1b51ae11c93725e4395c9.glb',
      'https://api.readyplayer.me/v1/avatars/67e1b51ae11c93725e4395c9.glb',
      'https://avatars.readyplayer.me/67e1b51ae11c93725e4395c9.glb'
    ],
    thumbnail: swatchThumbnail(['#7c3f88', '#1f335f', '#e3c16f']),
    accent: '#7c3f88',
    clothCombo: 'jacquardNight',
    ...DEFAULT_BOWLING_CHARACTER_SOURCE
  },
  {
    id: 'webgl-vietnam-human-domino',
    label: 'Street Champ',
    modelUrls: ['https://raw.githubusercontent.com/hmthanh/3d-human-model/main/TranThiNgocTham.glb'],
    thumbnail: swatchThumbnail(['#556070', '#8b633f', '#b88ab8']),
    accent: '#556070',
    clothCombo: 'softFleece',
    ...DEFAULT_BOWLING_CHARACTER_SOURCE
  },
  {
    id: 'webgl-ai-teacher-domino',
    label: 'Pattern Coach',
    modelUrls: ['https://raw.githubusercontent.com/Surbh77/AI-teacher/main/avatar.glb'],
    thumbnail: swatchThumbnail(['#c44f42', '#263f73', '#f1f5f9']),
    accent: '#c44f42',
    clothCombo: 'patternedRed',
    ...DEFAULT_BOWLING_CHARACTER_SOURCE
  },
  {
    id: 'webgl-ai-teacher-1-domino',
    label: 'Denim Striker',
    modelUrls: ['https://raw.githubusercontent.com/Surbh77/AI-teacher/main/avatar1.glb'],
    thumbnail: swatchThumbnail(['#3b6ea8', '#4f6f93', '#d6a35f']),
    accent: '#3b6ea8',
    clothCombo: 'mixedDenim',
    ...DEFAULT_BOWLING_CHARACTER_SOURCE
  }
]);

const reduceLabels = (options) =>
  options.reduce((acc, option) => {
    acc[option.id] = option.label;
    return acc;
  }, {});

export const BOWLING_HDRI_VARIANTS = Object.freeze(
  POOL_ROYALE_HDRI_VARIANTS.map((variant, index) => ({
    ...variant,
    id: variant.id,
    name: variant.name,
    description: variant.description || 'Shared Pool Royale HDRI for bowling.',
    sourceUrl: variant.sourceUrl,
    hdriUrl: variant.hdriUrl,
    thumbnailUrl: variant.thumbnailUrl || variant.thumbnail,
    priceCoins: index === 0 ? 0 : variant.priceCoins ?? variant.price ?? 450,
    rarity: index === 0 ? 'common' : 'rare',
  }))
);

export const BOWLING_OPTION_LABELS = Object.freeze({
  environmentHdri: Object.freeze(reduceLabels(BOWLING_HDRI_VARIANTS.map((variant) => ({ id: variant.id, label: `${variant.name} HDRI` })))),
  tableFinish: 'Bowling Table Finish',
  chromeColor: 'Bowling Chrome Plates',
  humanCharacter: Object.freeze(reduceLabels(BOWLING_HUMAN_CHARACTER_OPTIONS)),
});

export const BOWLING_DEFAULT_LOADOUT = Object.freeze({
  environmentHdri: BOWLING_HDRI_VARIANTS[0]?.id,
  humanCharacter: BOWLING_HUMAN_CHARACTER_OPTIONS[0]?.id,
});

const poolVisualStoreItems = POOL_ROYALE_STORE_ITEMS.filter((item) =>
  ['environmentHdri', 'tableFinish', 'chromeColor'].includes(item.type)
);

export const BOWLING_STORE_ITEMS = Object.freeze([
  ...poolVisualStoreItems.map((item) => ({
    ...item,
    id: `bowling-${item.id}`,
    game: 'bowling',
    featured: item.type === 'environmentHdri' ? item.optionId === BOWLING_DEFAULT_LOADOUT.environmentHdri : !!item.featured,
  })),
  ...BOWLING_HUMAN_CHARACTER_OPTIONS.slice(1).map((option, index) => ({
    id: `bowling-human-character-${option.id}`,
    type: 'humanCharacter',
    optionId: option.id,
    game: 'bowling',
    name: option.label,
    price: 1200 + index * 90,
    description: 'Domino Royal human avatar adapted for Real Bowling player and AI bowlers.',
    thumbnail: option.thumbnail,
    featured: index < 2,
  }))
]);
