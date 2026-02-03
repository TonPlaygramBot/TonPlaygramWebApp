import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';
import { POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';
import { polyHavenThumb, remoteThumb, swatchThumbnail } from './storeThumbnails.js';

export const DOMINO_ROYAL_OPTION_SETS = Object.freeze({
  tableWood: [
    { id: 'oakEstate', label: 'Lis Estate' },
    { id: 'teakStudio', label: 'Tik Studio' }
  ],
  tableCloth: [
    { id: 'crimson', label: 'Crimson Cloth' },
    { id: 'emerald', label: 'Emerald Cloth' },
    { id: 'arctic', label: 'Arctic Cloth' },
    { id: 'sunset', label: 'Sunset Cloth' },
    { id: 'violet', label: 'Violet Cloth' },
    { id: 'amber', label: 'Amber Cloth' }
  ],
  tableBase: [
    { id: 'obsidian', label: 'Obsidian Base' },
    { id: 'forestBronze', label: 'Forest Base' },
    { id: 'midnightChrome', label: 'Midnight Base' },
    { id: 'emberCopper', label: 'Copper Base' },
    { id: 'violetShadow', label: 'Violet Shadow Base' },
    { id: 'desertGold', label: 'Desert Base' }
  ],
  tableTheme: MURLAN_TABLE_THEMES.map(({ id, label, price = 0, description }) => ({
    id,
    label,
    price,
    description: description || `${label} table from Murlan Royale`
  })),
  environmentHdri: POOL_ROYALE_HDRI_VARIANTS.map(({ id, name }) => ({ id, label: `${name} HDRI` })),
  dominoStyle: [
    { id: 'imperialIvory', label: 'Imperial Ivory' },
    { id: 'obsidianPlatinum', label: 'Obsidian Platinum' },
    { id: 'midnightRose', label: 'Midnight Rose' },
    { id: 'auroraJade', label: 'Aurora Jade' },
    { id: 'frostedOpal', label: 'Frosted Opal' },
    { id: 'carbonVolt', label: 'Carbon Volt' },
    { id: 'sandstoneAurora', label: 'Sandstone Aurora' }
  ],
  highlightStyle: [
    { id: 'marksmanAmber', label: 'Marksman Amber' },
    { id: 'iceTracer', label: 'Ice Tracer' },
    { id: 'violetPulse', label: 'Violet Pulse' }
  ],
  chairTheme: MURLAN_STOOL_THEMES.map(({ id, label, price = 0, description }) => ({
    id,
    label,
    price,
    description: description || `${label} seating set from Murlan Royale`
  }))
});

const DOMINO_TABLE_WOOD_THUMBNAILS = Object.freeze({
  oakEstate: polyHavenThumb('oak_veneer_01'),
  teakStudio: polyHavenThumb('kitchen_wood')
});

const DOMINO_TABLE_CLOTH_THUMBNAILS = Object.freeze({
  crimson: swatchThumbnail(['#960019', '#4a0012', '#fecaca']),
  emerald: swatchThumbnail(['#0f6a2f', '#054d24', '#bbf7d0']),
  arctic: swatchThumbnail(['#2563eb', '#1d4ed8', '#bfdbfe']),
  sunset: swatchThumbnail(['#ea580c', '#c2410c', '#fed7aa']),
  violet: swatchThumbnail(['#7c3aed', '#5b21b6', '#ddd6fe']),
  amber: swatchThumbnail(['#b7791f', '#92571a', '#fde68a'])
});

const DOMINO_TABLE_BASE_THUMBNAILS = Object.freeze({
  obsidian: swatchThumbnail(['#141414', '#1f232a', '#94a3b8']),
  forestBronze: swatchThumbnail(['#101714', '#1f2d24', '#4ade80']),
  midnightChrome: swatchThumbnail(['#0f172a', '#1e2f4a', '#93c5fd']),
  emberCopper: swatchThumbnail(['#231312', '#5c2d1b', '#fdba74']),
  violetShadow: swatchThumbnail(['#1f1130', '#3f1b5b', '#c4b5fd']),
  desertGold: swatchThumbnail(['#1c1a12', '#5a4524', '#fcd34d'])
});

const DOMINO_STYLE_THUMBNAILS = Object.freeze({
  imperialIvory: swatchThumbnail(['#f8fafc', '#cbd5f5', '#e2e8f0']),
  obsidianPlatinum: swatchThumbnail(['#1f2937', '#6b7280', '#e5e7eb']),
  midnightRose: swatchThumbnail(['#881337', '#1f2937', '#fecdd3']),
  auroraJade: swatchThumbnail(['#047857', '#0f172a', '#86efac']),
  frostedOpal: swatchThumbnail(['#f8fafc', '#c7d2fe', '#e2e8f0']),
  carbonVolt: swatchThumbnail(['#0f172a', '#111827', '#fde047']),
  sandstoneAurora: swatchThumbnail(['#d6c7a1', '#7c2d12', '#fcd34d'])
});

const DOMINO_STYLE_THUMB_BASE = import.meta.env.VITE_DOMINO_STYLE_THUMBNAIL_BASE || '';

const resolveDominoStyleThumbnail = (id) =>
  remoteThumb(DOMINO_STYLE_THUMB_BASE, `domino-style-${id}.png`) || DOMINO_STYLE_THUMBNAILS[id];

const DOMINO_HIGHLIGHT_THUMBNAILS = Object.freeze({
  marksmanAmber: swatchThumbnail(['#f59e0b', '#92400e', '#fde68a']),
  iceTracer: swatchThumbnail(['#e0f2fe', '#0ea5e9', '#bae6fd']),
  violetPulse: swatchThumbnail(['#7c3aed', '#5b21b6', '#ddd6fe'])
});

export const DOMINO_ROYAL_DEFAULT_UNLOCKS = Object.freeze(
  Object.entries(DOMINO_ROYAL_OPTION_SETS).reduce((acc, [type, options]) => {
    acc[type] = options.length ? [options[0].id] : [];
    return acc;
  }, {})
);

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
  ...DOMINO_ROYAL_OPTION_SETS.tableWood.slice(1).map((option) => ({
    id: `domino-wood-${option.id}`,
    type: 'tableWood',
    optionId: option.id,
    name: option.label,
    price: 780,
    description: 'Alternate premium wood finish for your Domino Royal arena.',
    thumbnail: DOMINO_TABLE_WOOD_THUMBNAILS[option.id]
  })),
  ...DOMINO_ROYAL_OPTION_SETS.tableCloth.slice(1).map((option, idx) => ({
    id: `domino-cloth-${option.id}`,
    type: 'tableCloth',
    optionId: option.id,
    name: option.label,
    price: 340 + idx * 30,
    description: 'Unlock a new felt tone for the Domino Royal table surface.',
    thumbnail: DOMINO_TABLE_CLOTH_THUMBNAILS[option.id]
  })),
  ...DOMINO_ROYAL_OPTION_SETS.tableBase.slice(1).map((option, idx) => ({
    id: `domino-base-${option.id}`,
    type: 'tableBase',
    optionId: option.id,
    name: option.label,
    price: 520 + idx * 40,
    description: 'Swap in a different pedestal finish beneath the table.',
    thumbnail: DOMINO_TABLE_BASE_THUMBNAILS[option.id]
  })),
  ...DOMINO_ROYAL_OPTION_SETS.tableTheme.slice(1).map((option, idx) => ({
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
    price: POOL_ROYALE_HDRI_VARIANTS[idx + 1]?.price || 1200 + idx * 80,
    description: 'HDRI environment from the Pool/Murlan Royale library.',
    thumbnail: POOL_ROYALE_HDRI_VARIANTS.find((variant) => variant.id === option.id)?.thumbnail
  })),
  ...DOMINO_ROYAL_OPTION_SETS.dominoStyle.slice(1).map((option, idx) => ({
    id: `domino-style-${option.id}`,
    type: 'dominoStyle',
    optionId: option.id,
    name: option.label,
    price: 820 + idx * 40,
    description: 'Premium domino material set for tiles and pips.',
    thumbnail: resolveDominoStyleThumbnail(option.id)
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
  ...DOMINO_ROYAL_OPTION_SETS.chairTheme.slice(1).map((option, idx) => ({
    id: `domino-chair-${option.id}`,
    type: 'chairTheme',
    optionId: option.id,
    name: option.label,
    price: option.price || 300 + idx * 25,
    description: option.description || 'Murlan Royale seating set for Domino Royal.',
    thumbnail: MURLAN_STOOL_THEMES.find((theme) => theme.id === option.id)?.thumbnail
  }))
];

export const DOMINO_ROYAL_DEFAULT_LOADOUT = Object.entries(DOMINO_ROYAL_OPTION_SETS).map(
  ([type, options]) => ({
    type,
    optionId: options[0]?.id,
    label: options[0]?.label
  })
);
