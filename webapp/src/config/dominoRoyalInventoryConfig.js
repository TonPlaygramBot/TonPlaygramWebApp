import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';
import { POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';

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
  ...DOMINO_ROYAL_OPTION_SETS.tableTheme.slice(1).map((option, idx) => ({
    id: `domino-table-theme-${option.id}`,
    type: 'tableTheme',
    optionId: option.id,
    name: option.label,
    price: option.price || 900 + idx * 45,
    description: option.description || 'Apply the Murlan Royale table collection to Domino.'
  })),
  ...DOMINO_ROYAL_OPTION_SETS.environmentHdri.slice(1).map((option, idx) => ({
    id: `domino-hdri-${option.id}`,
    type: 'environmentHdri',
    optionId: option.id,
    name: option.label,
    price: POOL_ROYALE_HDRI_VARIANTS[idx + 1]?.price || 1200 + idx * 80,
    description: 'HDRI environment from the Pool/Murlan Royale library.'
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
    price: option.price || 300 + idx * 25,
    description: option.description || 'Murlan Royale seating set for Domino Royal.'
  }))
];

export const DOMINO_ROYAL_DEFAULT_LOADOUT = Object.entries(DOMINO_ROYAL_OPTION_SETS).map(
  ([type, options]) => ({
    type,
    optionId: options[0]?.id,
    label: options[0]?.label
  })
);
