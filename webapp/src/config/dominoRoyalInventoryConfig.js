import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS
} from './poolRoyaleInventoryConfig.js';
import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';

const DEFAULT_TABLE_MODEL = Object.freeze({
  id: 'domino-default',
  label: 'Domino Default Table',
  source: 'procedural'
});

const DEFAULT_CHAIR_MODEL = Object.freeze({
  id: 'domino-default',
  label: 'Domino Classic Chair',
  source: 'procedural'
});

export const DOMINO_ROYAL_OPTION_SETS = Object.freeze({
  environmentHdri: POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
    id: variant.id,
    label: `${variant.name} HDRI`
  })),
  tableModel: [DEFAULT_TABLE_MODEL, ...MURLAN_TABLE_THEMES.map(({ id, label }) => ({ id, label }))],
  chairModel: [DEFAULT_CHAIR_MODEL, ...MURLAN_STOOL_THEMES.map(({ id, label }) => ({ id, label }))],
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
  chairTheme: [
    { id: 'crimsonVelvet', label: 'Crimson Velvet Chairs' },
    { id: 'midnightNavy', label: 'Midnight Blue Chairs' },
    { id: 'emeraldWave', label: 'Emerald Wave Chairs' },
    { id: 'onyxShadow', label: 'Onyx Shadow Chairs' },
    { id: 'royalPlum', label: 'Royal Chestnut Chairs' }
  ]
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
  ...POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
    id: `domino-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price ?? 1400,
    description: variant.description ?? 'Premium HDR environment for Domino Royal.'
  })).slice(1),
  ...MURLAN_TABLE_THEMES.filter((theme) => theme.id !== DEFAULT_TABLE_MODEL.id).map((theme, idx) => ({
    id: `domino-table-${theme.id}`,
    type: 'tableModel',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 900 + idx * 35,
    description: theme.description ?? 'Alternate table model with preserved materials.'
  })),
  ...MURLAN_STOOL_THEMES.filter((theme) => theme.id !== DEFAULT_CHAIR_MODEL.id).map((theme, idx) => ({
    id: `domino-chair-model-${theme.id}`,
    type: 'chairModel',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 480 + idx * 20,
    description: theme.description ?? 'Alternate chair model with preserved materials.'
  })),
  ...DOMINO_ROYAL_OPTION_SETS.tableWood.slice(1).map((option) => ({
    id: `domino-wood-${option.id}`,
    type: 'tableWood',
    optionId: option.id,
    name: option.label,
    price: 780,
    description: 'Alternate premium wood finish for your Domino Royal arena.'
  })),
  ...DOMINO_ROYAL_OPTION_SETS.tableCloth.slice(1).map((option, idx) => ({
    id: `domino-cloth-${option.id}`,
    type: 'tableCloth',
    optionId: option.id,
    name: option.label,
    price: 340 + idx * 30,
    description: 'Unlock a new felt tone for the Domino Royal table surface.'
  })),
  ...DOMINO_ROYAL_OPTION_SETS.tableBase.slice(1).map((option, idx) => ({
    id: `domino-base-${option.id}`,
    type: 'tableBase',
    optionId: option.id,
    name: option.label,
    price: 520 + idx * 40,
    description: 'Swap in a different pedestal finish beneath the table.'
  })),
  ...DOMINO_ROYAL_OPTION_SETS.dominoStyle.slice(1).map((option, idx) => ({
    id: `domino-style-${option.id}`,
    type: 'dominoStyle',
    optionId: option.id,
    name: option.label,
    price: 820 + idx * 40,
    description: 'Premium domino material set for tiles and pips.'
  })),
  ...DOMINO_ROYAL_OPTION_SETS.highlightStyle.slice(1).map((option, idx) => ({
    id: `domino-highlight-${option.id}`,
    type: 'highlightStyle',
    optionId: option.id,
    name: option.label,
    price: 260 + idx * 40,
    description: 'Unlocks a new tracer highlight for the table setup.'
  })),
  ...DOMINO_ROYAL_OPTION_SETS.chairTheme.slice(1).map((option, idx) => ({
    id: `domino-chair-${option.id}`,
    type: 'chairTheme',
    optionId: option.id,
    name: option.label,
    price: 300 + idx * 20,
    description: 'Alternate spectator chair upholstery for the arena.'
  }))
];

export const DOMINO_ROYAL_DEFAULT_LOADOUT = Object.entries(DOMINO_ROYAL_OPTION_SETS).map(
  ([type, options]) => ({
    type,
    optionId:
      type === 'environmentHdri'
        ? POOL_ROYALE_DEFAULT_HDRI_ID
        : options[0]?.id,
    label:
      type === 'environmentHdri'
        ? DOMINO_ROYAL_OPTION_SETS.environmentHdri.find((option) => option.id === POOL_ROYALE_DEFAULT_HDRI_ID)?.label
        : options[0]?.label
  })
);
