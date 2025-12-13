export const DOMINO_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: ['oakEstate'],
  tableCloth: ['crimson'],
  tableBase: ['obsidian'],
  dominoStyle: ['imperialIvory'],
  highlightStyle: ['marksmanAmber'],
  chairTheme: ['crimsonVelvet']
});

export const DOMINO_ROYALE_OPTION_LABELS = Object.freeze({
  tableWood: Object.freeze({
    oakEstate: 'Lis Estate Wood',
    teakStudio: 'Tik Studio Wood'
  }),
  tableCloth: Object.freeze({
    crimson: 'Crimson Cloth',
    emerald: 'Emerald Cloth',
    arctic: 'Arctic Cloth',
    sunset: 'Sunset Cloth',
    violet: 'Violet Cloth',
    amber: 'Amber Cloth'
  }),
  tableBase: Object.freeze({
    obsidian: 'Obsidian Base',
    forestBronze: 'Forest Bronze Base',
    midnightChrome: 'Midnight Chrome Base',
    emberCopper: 'Ember Copper Base',
    violetShadow: 'Violet Shadow Base',
    desertGold: 'Desert Gold Base'
  }),
  dominoStyle: Object.freeze({
    imperialIvory: 'Imperial Ivory Dominoes',
    obsidianPlatinum: 'Obsidian Platinum Dominoes',
    midnightRose: 'Midnight Rose Dominoes',
    auroraJade: 'Aurora Jade Dominoes',
    sandstoneAurora: 'Sandstone Aurora Dominoes'
  }),
  highlightStyle: Object.freeze({
    marksmanAmber: 'Marksman Amber Highlights',
    iceTracer: 'Ice Tracer Highlights',
    violetPulse: 'Violet Pulse Highlights'
  }),
  chairTheme: Object.freeze({
    crimsonVelvet: 'Crimson Velvet Chairs',
    midnightNavy: 'Midnight Blue Chairs',
    emeraldWave: 'Emerald Wave Chairs',
    onyxShadow: 'Onyx Shadow Chairs',
    royalPlum: 'Royal Chestnut Chairs'
  })
});

export const DOMINO_ROYALE_STORE_ITEMS = [
  {
    id: 'wood-teakStudio',
    type: 'tableWood',
    optionId: 'teakStudio',
    name: 'Tik Studio Wood',
    price: 780,
    description: 'Teak studio grain with bright estate banding.'
  },
  {
    id: 'cloth-emerald',
    type: 'tableCloth',
    optionId: 'emerald',
    name: 'Emerald Cloth',
    price: 260,
    description: 'Deep emerald felt with balanced sheen.'
  },
  {
    id: 'cloth-arctic',
    type: 'tableCloth',
    optionId: 'arctic',
    name: 'Arctic Cloth',
    price: 280,
    description: 'Cool arctic blue felt for crisp contrast.'
  },
  {
    id: 'cloth-sunset',
    type: 'tableCloth',
    optionId: 'sunset',
    name: 'Sunset Cloth',
    price: 300,
    description: 'Warm sunset gradient cloth with copper notes.'
  },
  {
    id: 'cloth-violet',
    type: 'tableCloth',
    optionId: 'violet',
    name: 'Violet Cloth',
    price: 300,
    description: 'Violet felt with deep royal shading.'
  },
  {
    id: 'cloth-amber',
    type: 'tableCloth',
    optionId: 'amber',
    name: 'Amber Cloth',
    price: 320,
    description: 'Amber-toned cloth to warm the arena lighting.'
  },
  {
    id: 'base-forestBronze',
    type: 'tableBase',
    optionId: 'forestBronze',
    name: 'Forest Bronze Base',
    price: 520,
    description: 'Forest bronze legs with bronze-trimmed columns.'
  },
  {
    id: 'base-midnightChrome',
    type: 'tableBase',
    optionId: 'midnightChrome',
    name: 'Midnight Chrome Base',
    price: 560,
    description: 'Chrome-detailed midnight column set.'
  },
  {
    id: 'base-emberCopper',
    type: 'tableBase',
    optionId: 'emberCopper',
    name: 'Ember Copper Base',
    price: 540,
    description: 'Copper-infused base with ember accents.'
  },
  {
    id: 'base-violetShadow',
    type: 'tableBase',
    optionId: 'violetShadow',
    name: 'Violet Shadow Base',
    price: 560,
    description: 'Violet shadow legs with twilight trims.'
  },
  {
    id: 'base-desertGold',
    type: 'tableBase',
    optionId: 'desertGold',
    name: 'Desert Gold Base',
    price: 600,
    description: 'Desert gold metallic base for luxe seating.'
  },
  {
    id: 'domino-obsidian',
    type: 'dominoStyle',
    optionId: 'obsidianPlatinum',
    name: 'Obsidian Platinum Dominoes',
    price: 880,
    description: 'Obsidian tiles with platinum insets.'
  },
  {
    id: 'domino-midnight',
    type: 'dominoStyle',
    optionId: 'midnightRose',
    name: 'Midnight Rose Dominoes',
    price: 900,
    description: 'Midnight blue porcelain with rose copper accents.'
  },
  {
    id: 'domino-aurora',
    type: 'dominoStyle',
    optionId: 'auroraJade',
    name: 'Aurora Jade Dominoes',
    price: 940,
    description: 'Jade emerald tones with bronze rims.'
  },
  {
    id: 'domino-sandstone',
    type: 'dominoStyle',
    optionId: 'sandstoneAurora',
    name: 'Sandstone Aurora Dominoes',
    price: 960,
    description: 'Sandstone porcelain with amber glow rings.'
  },
  {
    id: 'highlight-iceTracer',
    type: 'highlightStyle',
    optionId: 'iceTracer',
    name: 'Ice Tracer Highlights',
    price: 210,
    description: 'Glacial tracer arcs for targeting highlights.'
  },
  {
    id: 'highlight-violetPulse',
    type: 'highlightStyle',
    optionId: 'violetPulse',
    name: 'Violet Pulse Highlights',
    price: 230,
    description: 'Violet pulse rings with energetic glow.'
  },
  {
    id: 'chair-midnight',
    type: 'chairTheme',
    optionId: 'midnightNavy',
    name: 'Midnight Blue Chairs',
    price: 260,
    description: 'Velvet navy seating with chrome studs.'
  },
  {
    id: 'chair-emerald',
    type: 'chairTheme',
    optionId: 'emeraldWave',
    name: 'Emerald Wave Chairs',
    price: 260,
    description: 'Emerald seating with deep forest legs.'
  },
  {
    id: 'chair-onyx',
    type: 'chairTheme',
    optionId: 'onyxShadow',
    name: 'Onyx Shadow Chairs',
    price: 280,
    description: 'Matte onyx chairs with gunmetal studs.'
  },
  {
    id: 'chair-royal',
    type: 'chairTheme',
    optionId: 'royalPlum',
    name: 'Royal Chestnut Chairs',
    price: 280,
    description: 'Royal plum seating with chestnut trim.'
  }
];

export const DOMINO_ROYALE_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: 'oakEstate', label: 'Lis Estate Wood' },
  { type: 'tableCloth', optionId: 'crimson', label: 'Crimson Cloth' },
  { type: 'tableBase', optionId: 'obsidian', label: 'Obsidian Base' },
  { type: 'dominoStyle', optionId: 'imperialIvory', label: 'Imperial Ivory Dominoes' },
  { type: 'highlightStyle', optionId: 'marksmanAmber', label: 'Marksman Amber Highlights' },
  { type: 'chairTheme', optionId: 'crimsonVelvet', label: 'Crimson Velvet Chairs' }
];

export const DOMINO_ROYALE_TYPE_LABELS = Object.freeze({
  tableWood: 'Table Wood',
  tableCloth: 'Table Cloth',
  tableBase: 'Table Base',
  dominoStyle: 'Domino Style',
  highlightStyle: 'Highlights',
  chairTheme: 'Chairs'
});
