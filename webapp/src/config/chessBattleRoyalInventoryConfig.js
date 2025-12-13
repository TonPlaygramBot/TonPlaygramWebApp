export const CHESS_BATTLE_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: ['lightNatural'],
  tableCloth: ['crimson'],
  tableBase: ['obsidian'],
  chairColor: ['crimsonVelvet'],
  tableShape: ['classicOctagon']
});

export const CHESS_BATTLE_ROYALE_OPTION_LABELS = Object.freeze({
  tableWood: Object.freeze({
    lightNatural: 'Light Natural Wood',
    warmBrown: 'Warm Brown Wood',
    cleanStrips: 'Clean Strips Wood',
    oldWoodFloor: 'Old Wood Floor'
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
    forestBronze: 'Forest Base',
    midnightChrome: 'Midnight Base',
    emberCopper: 'Copper Base',
    violetShadow: 'Violet Shadow Base',
    desertGold: 'Desert Base'
  }),
  chairColor: Object.freeze({
    crimsonVelvet: 'Crimson Velvet Chairs',
    midnightNavy: 'Midnight Blue Chairs',
    emeraldWave: 'Emerald Wave Chairs',
    onyxShadow: 'Onyx Shadow Chairs',
    royalPlum: 'Royal Chestnut Chairs'
  }),
  tableShape: Object.freeze({
    classicOctagon: 'Oktagon Klasik',
    grandOval: 'Oval Grand'
  })
});

export const CHESS_BATTLE_ROYALE_STORE_ITEMS = [
  {
    id: 'wood-warmBrown',
    type: 'tableWood',
    optionId: 'warmBrown',
    name: 'Warm Brown Wood',
    price: 520,
    description: 'Walnut-inspired rails with rich brown grain.'
  },
  {
    id: 'wood-cleanStrips',
    type: 'tableWood',
    optionId: 'cleanStrips',
    name: 'Clean Strips Wood',
    price: 560,
    description: 'Striped oak planks with satin finish.'
  },
  {
    id: 'wood-oldWoodFloor',
    type: 'tableWood',
    optionId: 'oldWoodFloor',
    name: 'Old Wood Floor',
    price: 610,
    description: 'Weathered wood floor texture with deep grain.'
  },
  {
    id: 'cloth-emerald',
    type: 'tableCloth',
    optionId: 'emerald',
    name: 'Emerald Cloth',
    price: 310,
    description: 'Saturated emerald felt with dark undertones.'
  },
  {
    id: 'cloth-arctic',
    type: 'tableCloth',
    optionId: 'arctic',
    name: 'Arctic Cloth',
    price: 330,
    description: 'Cool arctic blue felt with clean sheen.'
  },
  {
    id: 'cloth-sunset',
    type: 'tableCloth',
    optionId: 'sunset',
    name: 'Sunset Cloth',
    price: 340,
    description: 'Copper-orange felt for a warmer arena.'
  },
  {
    id: 'cloth-violet',
    type: 'tableCloth',
    optionId: 'violet',
    name: 'Violet Cloth',
    price: 340,
    description: 'Deep violet felt with bright trim.'
  },
  {
    id: 'cloth-amber',
    type: 'tableCloth',
    optionId: 'amber',
    name: 'Amber Cloth',
    price: 350,
    description: 'Amber-toned felt with smoky shadows.'
  },
  {
    id: 'base-forestBronze',
    type: 'tableBase',
    optionId: 'forestBronze',
    name: 'Forest Base',
    price: 450,
    description: 'Deep green base with bronze highlights.'
  },
  {
    id: 'base-midnightChrome',
    type: 'tableBase',
    optionId: 'midnightChrome',
    name: 'Midnight Base',
    price: 470,
    description: 'Midnight chrome base with cool trim.'
  },
  {
    id: 'base-emberCopper',
    type: 'tableBase',
    optionId: 'emberCopper',
    name: 'Copper Base',
    price: 470,
    description: 'Copper-infused base with ember warmth.'
  },
  {
    id: 'base-violetShadow',
    type: 'tableBase',
    optionId: 'violetShadow',
    name: 'Violet Shadow Base',
    price: 480,
    description: 'Violet shadowed base with reflective trim.'
  },
  {
    id: 'base-desertGold',
    type: 'tableBase',
    optionId: 'desertGold',
    name: 'Desert Base',
    price: 480,
    description: 'Desert gold base with muted metallics.'
  },
  {
    id: 'chair-midnightNavy',
    type: 'chairColor',
    optionId: 'midnightNavy',
    name: 'Midnight Blue Chairs',
    price: 260,
    description: 'Navy upholstery with cool highlights.'
  },
  {
    id: 'chair-emeraldWave',
    type: 'chairColor',
    optionId: 'emeraldWave',
    name: 'Emerald Wave Chairs',
    price: 260,
    description: 'Emerald upholstery with deep green accents.'
  },
  {
    id: 'chair-onyxShadow',
    type: 'chairColor',
    optionId: 'onyxShadow',
    name: 'Onyx Shadow Chairs',
    price: 280,
    description: 'Onyx upholstery with soft graphite highlights.'
  },
  {
    id: 'chair-royalPlum',
    type: 'chairColor',
    optionId: 'royalPlum',
    name: 'Royal Chestnut Chairs',
    price: 280,
    description: 'Royal plum upholstery with chestnut accents.'
  },
  {
    id: 'shape-grandOval',
    type: 'tableShape',
    optionId: 'grandOval',
    name: 'Oval Grand Shape',
    price: 520,
    description: 'Rounded oval silhouette with wider seating lanes.'
  }
];

export const CHESS_BATTLE_ROYALE_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: 'lightNatural', label: 'Light Natural Wood' },
  { type: 'tableCloth', optionId: 'crimson', label: 'Crimson Cloth' },
  { type: 'tableBase', optionId: 'obsidian', label: 'Obsidian Base' },
  { type: 'chairColor', optionId: 'crimsonVelvet', label: 'Crimson Velvet Chairs' },
  { type: 'tableShape', optionId: 'classicOctagon', label: 'Oktagon Klasik' }
];
