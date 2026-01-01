import { POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';
import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';

const baseDominoOptions = {
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
  ]
};

const dominoChairThemes = [
  { id: 'crimsonVelvet', label: 'Crimson Velvet Chairs' },
  { id: 'midnightNavy', label: 'Midnight Blue Chairs' },
  { id: 'emeraldWave', label: 'Emerald Wave Chairs' },
  { id: 'onyxShadow', label: 'Onyx Shadow Chairs' },
  { id: 'royalPlum', label: 'Royal Chestnut Chairs' },
  ...MURLAN_STOOL_THEMES.map((theme) => ({
    id: theme.id,
    label: theme.label,
    seatColor: theme.seatColor ?? '#d9d9d9',
    legColor: theme.legColor ?? '#111827',
    highlight: theme.accentColor ?? theme.seatColor ?? '#e2e8f0'
  }))
];

const dominoTableThemes = MURLAN_TABLE_THEMES.map((theme, idx) => ({
  id: theme.id,
  label: theme.label,
  thumbnail: theme.thumbnail,
  description: theme.description,
  woodIndex: idx % baseDominoOptions.tableWood.length,
  clothIndex: (idx + 1) % baseDominoOptions.tableCloth.length,
  baseIndex: (idx + 2) % baseDominoOptions.tableBase.length
}));

const dominoHdriOptions = POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
  id: variant.id,
  label: `${variant.name} HDRI`,
  swatches: variant.swatches,
  description: variant.description
}));

export const DOMINO_ROYAL_OPTION_SETS = Object.freeze({
  ...baseDominoOptions,
  chairTheme: dominoChairThemes,
  tableTheme: dominoTableThemes,
  environmentHdri: dominoHdriOptions
});

const buildDominoDefaults = () => {
  const base = Object.entries(DOMINO_ROYAL_OPTION_SETS).reduce((acc, [type, options]) => {
    acc[type] = options.length ? [options[0].id] : [];
    return acc;
  }, {});
  const defaultHdri = DOMINO_ROYAL_OPTION_SETS.environmentHdri.find(
    (option) => option.id === POOL_ROYALE_DEFAULT_HDRI_ID
  );
  const allHdriIds = DOMINO_ROYAL_OPTION_SETS.environmentHdri.map((option) => option.id);
  if (allHdriIds.length) {
    const preferredId = defaultHdri?.id ?? allHdriIds[0];
    base.environmentHdri = Array.from(new Set([preferredId, ...allHdriIds]));
  }
  return base;
};

export const DOMINO_ROYAL_DEFAULT_UNLOCKS = Object.freeze(buildDominoDefaults());

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
  })),
  ...DOMINO_ROYAL_OPTION_SETS.tableTheme.slice(1).map((option, idx) => ({
    id: `domino-table-${option.id}`,
    type: 'tableTheme',
    optionId: option.id,
    name: option.label,
    price: 980 + idx * 40,
    description: option.description || 'Murlan Royale table variant brought to Domino.'
  })),
  ...DOMINO_ROYAL_OPTION_SETS.environmentHdri.map((option, idx) => ({
    id: `domino-hdri-${option.id}`,
    type: 'environmentHdri',
    optionId: option.id,
    name: option.label,
    price: 1400 + idx * 25,
    description: option.description || 'HDRI carried over from Murlan Royale.',
    swatches: option.swatches,
    previewShape: 'table'
  }))
];

export const DOMINO_ROYAL_DEFAULT_LOADOUT = Object.entries(DOMINO_ROYAL_OPTION_SETS).map(([type, options]) => {
  const preferredId = DOMINO_ROYAL_DEFAULT_UNLOCKS[type]?.[0];
  const preferredOption = options.find((opt) => opt.id === preferredId) || options[0];
  return {
    type,
    optionId: preferredOption?.id,
    label: preferredOption?.label
  };
});
