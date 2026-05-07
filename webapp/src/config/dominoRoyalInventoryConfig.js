import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';
import { POOL_ROYALE_DEFAULT_HDRI_ID } from './poolRoyaleInventoryConfig.js';
import { swatchThumbnail } from './storeThumbnails.js';
import {
  BATTLE_ROYALE_SHARED_CHAIR_THEME_OPTIONS,
  BATTLE_ROYALE_SHARED_HDRI_VARIANTS,
  BATTLE_ROYALE_SHARED_TABLE_CLOTH_OPTIONS,
  BATTLE_ROYALE_SHARED_TABLE_FINISH_OPTIONS,
  BATTLE_ROYALE_SHARED_TABLE_THEME_OPTIONS
} from './battleRoyaleSharedInventory.js';

export const DOMINO_ROYAL_OPTION_SETS = Object.freeze({
  tableWood: BATTLE_ROYALE_SHARED_TABLE_FINISH_OPTIONS.map(({ id, label, price = 0, description, thumbnail, woodOption }) => ({
    id,
    label,
    price,
    description,
    thumbnail,
    woodOption
  })),
  tableCloth: BATTLE_ROYALE_SHARED_TABLE_CLOTH_OPTIONS.map(({ id, label, price = 0, description, thumbnail, feltTop, feltBottom, emissive }) => ({
    id,
    label,
    price,
    description,
    swatches: [feltTop, feltBottom, emissive].filter(Boolean),
    thumbnail
  })),
  tableTheme: BATTLE_ROYALE_SHARED_TABLE_THEME_OPTIONS.map(({ id, label, price = 0, description, source, assetId, preserveMaterials }) => ({
    id,
    label,
    price,
    source,
    assetId,
    preserveMaterials,
    description: description || `${label} table from Murlan Royale`
  })),
  environmentHdri: BATTLE_ROYALE_SHARED_HDRI_VARIANTS.map(({ id, name }) => ({ id, label: `${name} HDRI` })),
  dominoStyle: [
    { id: 'imperialIvory', label: 'Imperial Ivory' },
    { id: 'royalCrimson', label: 'Royal Crimson' },
    { id: 'azureRegal', label: 'Azure Regal' },
    { id: 'emeraldCrown', label: 'Emerald Crown' },
    { id: 'violetEmpire', label: 'Violet Empire' },
    { id: 'obsidianNight', label: 'Obsidian Night' },
    { id: 'sunsetAmber', label: 'Sunset Amber' }
  ],
  dominoDotStyle: [
    { id: 'headRuby', label: 'Ruby' },
    { id: 'headPearl', label: 'Pearl' },
    { id: 'headSapphire', label: 'Sapphire' },
    { id: 'headEmerald', label: 'Emerald' },
    { id: 'headDiamond', label: 'Diamond' },
    { id: 'headChrome', label: 'Chrome' },
    { id: 'headGold', label: 'Gold' }
  ],
  dominoFrameStyle: [
    { id: 'goldImperial', label: 'Gold Imperial' },
    { id: 'chromeEdge', label: 'Chrome Edge' },
    { id: 'aluminumMatte', label: 'Aluminium Matte' },
    { id: 'bronzeForge', label: 'Bronze Forge' },
    { id: 'obsidianTrim', label: 'Obsidian Trim' },
    { id: 'roseCopper', label: 'Rose Copper' }
  ],
  highlightStyle: [
    { id: 'marksmanAmber', label: 'Marksman Amber' },
    { id: 'iceTracer', label: 'Ice Tracer' },
    { id: 'violetPulse', label: 'Violet Pulse' }
  ],
  chairTheme: BATTLE_ROYALE_SHARED_CHAIR_THEME_OPTIONS.map(({ id, label, price = 0, description }) => ({
    id,
    label,
    price,
    description: description || `${label} seating set from Murlan Royale`
  }))
});


const DOMINO_TABLE_CLOTH_THUMBNAILS = Object.freeze({
  crimson: swatchThumbnail(['#960019', '#4a0012', '#fecaca']),
  emerald: swatchThumbnail(['#0f6a2f', '#054d24', '#bbf7d0']),
  arctic: swatchThumbnail(['#2563eb', '#1d4ed8', '#bfdbfe']),
  sunset: swatchThumbnail(['#ea580c', '#c2410c', '#fed7aa']),
  violet: swatchThumbnail(['#7c3aed', '#5b21b6', '#ddd6fe']),
  amber: swatchThumbnail(['#b7791f', '#92571a', '#fde68a'])
});

const DOMINO_STYLE_THUMBNAILS = Object.freeze({
  imperialIvory: swatchThumbnail(['#f8fafc', '#cbd5f5', '#e2e8f0']),
  royalCrimson: swatchThumbnail(['#991b1b', '#7f1d1d', '#fecaca']),
  azureRegal: swatchThumbnail(['#1d4ed8', '#1e3a8a', '#bfdbfe']),
  emeraldCrown: swatchThumbnail(['#047857', '#065f46', '#a7f3d0']),
  violetEmpire: swatchThumbnail(['#6d28d9', '#581c87', '#ddd6fe']),
  obsidianNight: swatchThumbnail(['#111827', '#0f172a', '#9ca3af']),
  sunsetAmber: swatchThumbnail(['#b45309', '#78350f', '#fde68a'])
});


const DOMINO_DOT_STYLE_THUMBNAILS = Object.freeze({
  headRuby: '/assets/game-art/chess-battle-royal/heads/headRuby.svg',
  headPearl: '/assets/game-art/chess-battle-royal/heads/current.svg',
  headSapphire: '/assets/game-art/chess-battle-royal/heads/headSapphire.svg',
  headEmerald: swatchThumbnail(['#065f46', '#10b981', '#d1fae5']),
  headDiamond: swatchThumbnail(['#f8fafc', '#dbeafe', '#bfdbfe']),
  headChrome: '/assets/game-art/chess-battle-royal/heads/headChrome.svg',
  headGold: '/assets/game-art/chess-battle-royal/heads/headGold.svg'
});

const DOMINO_FRAME_STYLE_THUMBNAILS = Object.freeze({
  goldImperial: swatchThumbnail(['#f59e0b', '#fbbf24', '#78350f']),
  chromeEdge: swatchThumbnail(['#f5f5f5', '#a1a1aa', '#1f2937']),
  aluminumMatte: swatchThumbnail(['#d1d5db', '#9ca3af', '#334155']),
  bronzeForge: swatchThumbnail(['#b45309', '#92400e', '#451a03']),
  obsidianTrim: swatchThumbnail(['#111827', '#374151', '#9ca3af']),
  roseCopper: swatchThumbnail(['#b45309', '#f59e0b', '#fbcfe8'])
});

const DOMINO_HIGHLIGHT_THUMBNAILS = Object.freeze({
  marksmanAmber: swatchThumbnail(['#f59e0b', '#92400e', '#fde68a']),
  iceTracer: swatchThumbnail(['#e0f2fe', '#0ea5e9', '#bae6fd']),
  violetPulse: swatchThumbnail(['#7c3aed', '#5b21b6', '#ddd6fe'])
});

const DOMINO_DEFAULT_IDS = Object.freeze({
  tableTheme: 'murlan-default',
  tableWood: 'peelingPaintWeathered',
  tableCloth: 'emerald',
  chairTheme: 'dining_chair_02'
});

const getDefaultOptionId = (options) => options?.[0]?.id;
const getDominoDefaultOptionId = (type) => {
  const options = DOMINO_ROYAL_OPTION_SETS[type] || [];
  if (!options.length) return undefined;
  const preferredId = DOMINO_DEFAULT_IDS[type];
  if (preferredId && options.some((option) => option.id === preferredId)) {
    return preferredId;
  }
  return getDefaultOptionId(options);
};

export const DOMINO_ROYAL_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: [getDominoDefaultOptionId('tableWood')].filter(Boolean),
  tableCloth: [getDominoDefaultOptionId('tableCloth')].filter(Boolean),
  tableTheme: DOMINO_ROYAL_OPTION_SETS.tableTheme.map((option) => option.id),
  environmentHdri: BATTLE_ROYALE_SHARED_HDRI_VARIANTS.map((variant) => variant.id),
  dominoStyle: [getDominoDefaultOptionId('dominoStyle')].filter(Boolean),
  dominoDotStyle: [getDominoDefaultOptionId('dominoDotStyle')].filter(Boolean),
  dominoFrameStyle: [getDominoDefaultOptionId('dominoFrameStyle')].filter(Boolean),
  highlightStyle: [getDominoDefaultOptionId('highlightStyle')].filter(Boolean),
  chairTheme: DOMINO_ROYAL_OPTION_SETS.chairTheme.map((option) => option.id)
});

export const DOMINO_ROYAL_OPTION_LABELS = Object.freeze(
  Object.entries(DOMINO_ROYAL_OPTION_SETS).reduce((acc, [type, options]) => {
    acc[type] = Object.freeze(
      options.reduce((map, option) => {
        map[option.id] = option.label;
        return map;
      }, {})
    );
    return acc;
  }, {})
);

export const DOMINO_ROYAL_STORE_ITEMS = [
  ...DOMINO_ROYAL_OPTION_SETS.tableWood.slice(1).map((option, idx) => ({
    id: `domino-wood-${option.id}`,
    type: 'tableWood',
    optionId: option.id,
    name: option.label,
    price: option.price || 980 + idx * 40,
    description: option.description || 'Table finish from the Ludo/Murlan Royale collection.',
    thumbnail: option.thumbnail
  })),
  ...DOMINO_ROYAL_OPTION_SETS.tableCloth.slice(1).map((option, idx) => ({
    id: `domino-cloth-${option.id}`,
    type: 'tableCloth',
    optionId: option.id,
    name: option.label,
    price: option.price || 340 + idx * 30,
    description: option.description || 'Unlock a new felt tone for the Domino Royal table surface.',
    thumbnail: option.swatches?.length ? swatchThumbnail(option.swatches) : DOMINO_TABLE_CLOTH_THUMBNAILS[option.id]
  })),
  ...DOMINO_ROYAL_OPTION_SETS.tableTheme.map((option, idx) => ({
    id: `domino-table-theme-${option.id}`,
    type: 'tableTheme',
    optionId: option.id,
    name: option.label,
    price: option.price || 900 + idx * 45,
    description: option.description || 'Apply the Murlan Royale table collection to Domino.',
    thumbnail: MURLAN_TABLE_THEMES.find((theme) => theme.id === option.id)?.thumbnail
  })),
  ...DOMINO_ROYAL_OPTION_SETS.environmentHdri.slice(1).map((option, idx) => ({
    id: `domino-hdri-${option.id}`,
    type: 'environmentHdri',
    optionId: option.id,
    name: option.label,
    price: BATTLE_ROYALE_SHARED_HDRI_VARIANTS[idx + 1]?.price || 1200 + idx * 80,
    description: 'HDRI environment from the Pool/Murlan Royale library.',
    thumbnail: BATTLE_ROYALE_SHARED_HDRI_VARIANTS.find((variant) => variant.id === option.id)?.thumbnail
  })),
  ...DOMINO_ROYAL_OPTION_SETS.dominoStyle.slice(1).map((option, idx) => ({
    id: `domino-style-${option.id}`,
    type: 'dominoStyle',
    optionId: option.id,
    name: option.label,
    price: 820 + idx * 40,
    description: 'Premium domino material set for tiles and pips.',
    thumbnail: DOMINO_STYLE_THUMBNAILS[option.id]
  })),

  ...DOMINO_ROYAL_OPTION_SETS.dominoDotStyle.slice(1).map((option, idx) => ({
    id: `domino-dot-style-${option.id}`,
    type: 'dominoDotStyle',
    optionId: option.id,
    name: option.label,
    price: 640 + idx * 35,
    description: 'Chess Battle Royal head-material inspired dot set for domino pips (no glass option).',
    thumbnail: DOMINO_DOT_STYLE_THUMBNAILS[option.id]
  })),
  ...DOMINO_ROYAL_OPTION_SETS.dominoFrameStyle.slice(1).map((option, idx) => ({
    id: `domino-frame-style-${option.id}`,
    type: 'dominoFrameStyle',
    optionId: option.id,
    name: option.label,
    price: 700 + idx * 40,
    description: 'Domino frame finish pack inspired by luxury metallic trims.',
    thumbnail: DOMINO_FRAME_STYLE_THUMBNAILS[option.id]
  })),
  ...DOMINO_ROYAL_OPTION_SETS.highlightStyle.slice(1).map((option, idx) => ({
    id: `domino-highlight-${option.id}`,
    type: 'highlightStyle',
    optionId: option.id,
    name: option.label,
    price: 260 + idx * 40,
    description: 'Unlocks a new tracer highlight for the table setup.',
    thumbnail: DOMINO_HIGHLIGHT_THUMBNAILS[option.id]
  })),
  ...DOMINO_ROYAL_OPTION_SETS.chairTheme.map((option, idx) => ({
    id: `domino-chair-${option.id}`,
    type: 'chairTheme',
    optionId: option.id,
    name: option.label,
    price: option.price || 300 + idx * 25,
    description: option.description || 'Murlan Royale seating set for Domino Royal.',
    thumbnail: MURLAN_STOOL_THEMES.find((theme) => theme.id === option.id)?.thumbnail
  }))
];

const getLabelForOption = (type, optionId) =>
  DOMINO_ROYAL_OPTION_LABELS[type]?.[optionId] ||
  DOMINO_ROYAL_OPTION_SETS[type]?.find((option) => option.id === optionId)?.label ||
  optionId;

export const DOMINO_ROYAL_DEFAULT_LOADOUT = [
  {
    type: 'tableWood',
    optionId: getDominoDefaultOptionId('tableWood'),
    label: getLabelForOption('tableWood', getDominoDefaultOptionId('tableWood'))
  },
  {
    type: 'tableCloth',
    optionId: getDominoDefaultOptionId('tableCloth'),
    label: getLabelForOption('tableCloth', getDominoDefaultOptionId('tableCloth'))
  },
  {
    type: 'tableTheme',
    optionId: getDominoDefaultOptionId('tableTheme'),
    label: getLabelForOption('tableTheme', getDominoDefaultOptionId('tableTheme'))
  },
  {
    type: 'environmentHdri',
    optionId: POOL_ROYALE_DEFAULT_HDRI_ID,
    label: getLabelForOption('environmentHdri', POOL_ROYALE_DEFAULT_HDRI_ID)
  },
  {
    type: 'dominoStyle',
    optionId: getDominoDefaultOptionId('dominoStyle'),
    label: getLabelForOption('dominoStyle', getDominoDefaultOptionId('dominoStyle'))
  },
  {
    type: 'dominoDotStyle',
    optionId: getDominoDefaultOptionId('dominoDotStyle'),
    label: getLabelForOption('dominoDotStyle', getDominoDefaultOptionId('dominoDotStyle'))
  },
  {
    type: 'dominoFrameStyle',
    optionId: getDominoDefaultOptionId('dominoFrameStyle'),
    label: getLabelForOption('dominoFrameStyle', getDominoDefaultOptionId('dominoFrameStyle'))
  },
  {
    type: 'highlightStyle',
    optionId: getDominoDefaultOptionId('highlightStyle'),
    label: getLabelForOption('highlightStyle', getDominoDefaultOptionId('highlightStyle'))
  },
  {
    type: 'chairTheme',
    optionId: getDominoDefaultOptionId('chairTheme'),
    label: getLabelForOption('chairTheme', getDominoDefaultOptionId('chairTheme'))
  }
];
