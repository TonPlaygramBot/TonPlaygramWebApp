import {
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_STORE_ITEMS,
} from './poolRoyaleInventoryConfig.js';
import { swatchThumbnail } from './storeThumbnails.js';

const DEFAULT_BOWLING_CHARACTER_SOURCE = Object.freeze({
  source: 'Domino Royal human character set',
  license: 'original game avatar catalog'
});

export const BOWLING_HUMAN_CHARACTER_OPTIONS = Object.freeze([
  {
    id: 'rpm-current-domino',
    label: 'Current Avatar',
    modelUrls: ['https://threejs.org/examples/models/gltf/readyplayer.me.glb'],
    thumbnail: swatchThumbnail(['#2f6f8a', '#1e293b', '#b48d6b']),
    accent: '#ff7a2f',
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
    ...DEFAULT_BOWLING_CHARACTER_SOURCE
  },
  {
    id: 'webgl-vietnam-human-domino',
    label: 'Street Champ',
    modelUrls: ['https://raw.githubusercontent.com/hmthanh/3d-human-model/main/TranThiNgocTham.glb'],
    thumbnail: swatchThumbnail(['#556070', '#8b633f', '#b88ab8']),
    accent: '#556070',
    ...DEFAULT_BOWLING_CHARACTER_SOURCE
  },
  {
    id: 'webgl-ai-teacher-domino',
    label: 'Pattern Coach',
    modelUrls: ['https://raw.githubusercontent.com/Surbh77/AI-teacher/main/avatar.glb'],
    thumbnail: swatchThumbnail(['#c44f42', '#263f73', '#f1f5f9']),
    accent: '#c44f42',
    ...DEFAULT_BOWLING_CHARACTER_SOURCE
  },
  {
    id: 'webgl-ai-teacher-1-domino',
    label: 'Denim Striker',
    modelUrls: ['https://raw.githubusercontent.com/Surbh77/AI-teacher/main/avatar1.glb'],
    thumbnail: swatchThumbnail(['#3b6ea8', '#4f6f93', '#d6a35f']),
    accent: '#3b6ea8',
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
