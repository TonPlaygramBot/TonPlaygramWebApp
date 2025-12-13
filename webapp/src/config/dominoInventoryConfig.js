export const DOMINO_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: ['oakEstate'],
  tableCloth: ['crimson'],
  tableBase: ['obsidian'],
  dominoStyle: ['imperialIvory'],
  highlightStyle: ['marksmanAmber'],
  chairTheme: ['crimsonVelvet']
});

export const DOMINO_OPTION_LABELS = Object.freeze({
  tableWood: Object.freeze({
    oakEstate: 'Lis Estate',
    teakStudio: 'Tik Studio'
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
  dominoStyle: Object.freeze({
    imperialIvory: 'Imperial Ivory',
    obsidianPlatinum: 'Obsidian Platinum',
    midnightRose: 'Midnight Rose',
    auroraJade: 'Aurora Jade',
    carbonVolt: 'Carbon Volt',
    sandstoneAurora: 'Sandstone Aurora'
  }),
  highlightStyle: Object.freeze({
    marksmanAmber: 'Marksman Amber',
    iceTracer: 'Ice Tracer',
    violetPulse: 'Violet Pulse'
  }),
  chairTheme: Object.freeze({
    crimsonVelvet: 'Crimson Velvet',
    midnightNavy: 'Midnight Blue',
    emeraldWave: 'Emerald Wave',
    onyxShadow: 'Onyx Shadow',
    royalPlum: 'Royal Chestnut'
  })
});

export const DOMINO_STORE_ITEMS = [
  {
    id: 'wood-teakStudio',
    type: 'tableWood',
    optionId: 'teakStudio',
    name: 'Tik Studio Wood',
    price: 720,
    description: 'Studio teak grain rails with warm highlights.'
  },
  {
    id: 'cloth-emerald',
    type: 'tableCloth',
    optionId: 'emerald',
    name: 'Emerald Cloth',
    price: 340,
    description: 'Deep emerald felt with balanced shading.'
  },
  {
    id: 'cloth-arctic',
    type: 'tableCloth',
    optionId: 'arctic',
    name: 'Arctic Cloth',
    price: 360,
    description: 'Cool arctic blue felt with crisp border glow.'
  },
  {
    id: 'cloth-sunset',
    type: 'tableCloth',
    optionId: 'sunset',
    name: 'Sunset Cloth',
    price: 360,
    description: 'Sunset orange felt with warm ember trim.'
  },
  {
    id: 'cloth-violet',
    type: 'tableCloth',
    optionId: 'violet',
    name: 'Violet Cloth',
    price: 370,
    description: 'Vibrant violet felt with royal edging.'
  },
  {
    id: 'cloth-amber',
    type: 'tableCloth',
    optionId: 'amber',
    name: 'Amber Cloth',
    price: 370,
    description: 'Amber tournament felt with subtle glow.'
  },
  {
    id: 'base-forestBronze',
    type: 'tableBase',
    optionId: 'forestBronze',
    name: 'Forest Base',
    price: 420,
    description: 'Forest-toned base with bronze trim.'
  },
  {
    id: 'base-midnightChrome',
    type: 'tableBase',
    optionId: 'midnightChrome',
    name: 'Midnight Base',
    price: 440,
    description: 'Midnight chrome base with cool highlights.'
  },
  {
    id: 'base-emberCopper',
    type: 'tableBase',
    optionId: 'emberCopper',
    name: 'Copper Base',
    price: 440,
    description: 'Copper accented base with ember undertone.'
  },
  {
    id: 'base-violetShadow',
    type: 'tableBase',
    optionId: 'violetShadow',
    name: 'Violet Shadow Base',
    price: 450,
    description: 'Shadowed violet base with luxe trim.'
  },
  {
    id: 'base-desertGold',
    type: 'tableBase',
    optionId: 'desertGold',
    name: 'Desert Base',
    price: 460,
    description: 'Desert-inspired base with gold accenting.'
  },
  {
    id: 'domino-obsidianPlatinum',
    type: 'dominoStyle',
    optionId: 'obsidianPlatinum',
    name: 'Obsidian Platinum Dominos',
    price: 510,
    description: 'Obsidian tiles with platinum inlays.'
  },
  {
    id: 'domino-midnightRose',
    type: 'dominoStyle',
    optionId: 'midnightRose',
    name: 'Midnight Rose Dominos',
    price: 520,
    description: 'Midnight blue bodies with rose accents.'
  },
  {
    id: 'domino-auroraJade',
    type: 'dominoStyle',
    optionId: 'auroraJade',
    name: 'Aurora Jade Dominos',
    price: 520,
    description: 'Jade porcelain tiles with champagne trim.'
  },
  {
    id: 'domino-carbonVolt',
    type: 'dominoStyle',
    optionId: 'carbonVolt',
    name: 'Carbon Volt Dominos',
    price: 530,
    description: 'Carbon fiber finish with electric cyan pips.'
  },
  {
    id: 'domino-sandstoneAurora',
    type: 'dominoStyle',
    optionId: 'sandstoneAurora',
    name: 'Sandstone Aurora Dominos',
    price: 530,
    description: 'Sandstone body with aurora orange accents.'
  },
  {
    id: 'highlight-iceTracer',
    type: 'highlightStyle',
    optionId: 'iceTracer',
    name: 'Ice Tracer Highlights',
    price: 280,
    description: 'Frosted tracer arcs and cool emissive glow.'
  },
  {
    id: 'highlight-violetPulse',
    type: 'highlightStyle',
    optionId: 'violetPulse',
    name: 'Violet Pulse Highlights',
    price: 280,
    description: 'Violet pulse tracers with rich emissive flare.'
  },
  {
    id: 'chair-midnightNavy',
    type: 'chairTheme',
    optionId: 'midnightNavy',
    name: 'Midnight Blue Chairs',
    price: 240,
    description: 'Midnight navy seating with satin finish.'
  },
  {
    id: 'chair-emeraldWave',
    type: 'chairTheme',
    optionId: 'emeraldWave',
    name: 'Emerald Wave Chairs',
    price: 240,
    description: 'Emerald seat cushions with dark frames.'
  },
  {
    id: 'chair-onyxShadow',
    type: 'chairTheme',
    optionId: 'onyxShadow',
    name: 'Onyx Shadow Chairs',
    price: 250,
    description: 'Onyx seating set with monochrome highlights.'
  },
  {
    id: 'chair-royalPlum',
    type: 'chairTheme',
    optionId: 'royalPlum',
    name: 'Royal Chestnut Chairs',
    price: 250,
    description: 'Royal chestnut cushions with plum highlight.'
  }
];

export const DOMINO_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: 'oakEstate', label: 'Lis Estate Wood' },
  { type: 'tableCloth', optionId: 'crimson', label: 'Crimson Cloth' },
  { type: 'tableBase', optionId: 'obsidian', label: 'Obsidian Base' },
  { type: 'dominoStyle', optionId: 'imperialIvory', label: 'Imperial Ivory Dominos' },
  { type: 'highlightStyle', optionId: 'marksmanAmber', label: 'Marksman Amber Highlights' },
  { type: 'chairTheme', optionId: 'crimsonVelvet', label: 'Crimson Velvet Chairs' }
];
