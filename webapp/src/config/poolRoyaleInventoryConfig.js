export const POOL_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableFinish: ['charredTimber'],
  chromeColor: ['gold'],
  railMarkerColor: ['gold'],
  clothColor: ['freshGreen'],
  cueStyle: ['birch-frost'],
  pocketLiner: ['blackPocket']
});

export const POOL_ROYALE_OPTION_LABELS = Object.freeze({
  tableFinish: Object.freeze({
    rusticSplit: 'Pearl Cream',
    charredTimber: 'Charred Timber',
    plankStudio: 'Plank Studio',
    weatheredGrey: 'Weathered Grey',
    jetBlackCarbon: 'Jet Black Carbon',
    frostedAsh: 'Frosted Ash',
    amberWharf: 'Amber Wharf',
    obsidianMist: 'Obsidian Mist'
  }),
  chromeColor: Object.freeze({
    chrome: 'Chrome',
    gold: 'Gold'
  }),
  railMarkerColor: Object.freeze({
    chrome: 'Chrome',
    pearl: 'Pearl',
    gold: 'Gold'
  }),
  clothColor: Object.freeze({
    freshGreen: 'Tour Green',
    graphite: 'Arcadia Graphite',
    arcticBlue: 'Arctic Blue',
    emeraldPulse: 'Emerald Pulse',
    ivyDrift: 'Ivy Drift',
    mintRadiance: 'Mint Radiance',
    cobaltFrost: 'Cobalt Frost',
    midnightWave: 'Midnight Wave',
    neonAzure: 'Neon Azure',
    crimsonFlash: 'Crimson Flash',
    rubyInferno: 'Ruby Inferno',
    garnetVelvet: 'Garnet Velvet',
    forestPrime: 'Forest Prime',
    evergreenLuxe: 'Evergreen Luxe',
    jadeCurrent: 'Jade Current',
    denim_fabric_03: 'Denim Fabric 03',
    hessian_230: 'Hessian Weave 230',
    polar_fleece: 'Polar Fleece',
    cotton_jersey: 'Cotton Jersey',
    faux_fur_geometric: 'Faux Fur Geometric',
    jogging_melange: 'Jogging Mélange',
    knitted_fleece: 'Knitted Fleece',
    caban: 'Caban Wool',
    curly_teddy_natural: 'Curly Teddy Natural',
    curly_teddy_checkered: 'Curly Teddy Checkered',
    denim_fabric_04: 'Denim Fabric 04',
    denim_fabric_05: 'Denim Fabric 05',
    scuba_suede: 'Scuba Suede'
  }),
  cueStyle: Object.freeze({
    'redwood-ember': 'Redwood Ember',
    'birch-frost': 'Birch Frost',
    'wenge-nightfall': 'Wenge Nightfall',
    'mahogany-heritage': 'Mahogany Heritage',
    'walnut-satin': 'Walnut Satin',
    'carbon-matrix': 'Carbon Matrix',
    'maple-horizon': 'Maple Horizon',
    'graphite-aurora': 'Graphite Aurora'
  }),
  pocketLiner: Object.freeze({
    blackPocket: 'Black Pocket Jaws',
    graphitePocket: 'Graphite Pocket Jaws',
    titaniumPocket: 'Titanium Pocket Jaws',
    copperPocket: 'Copper Pocket Jaws',
    emeraldPocket: 'Emerald Pocket Jaws',
    rubyPocket: 'Ruby Pocket Jaws',
    pearlPocket: 'Pearl Pocket Jaws'
  })
});

export const POOL_ROYALE_STORE_ITEMS = [
  {
    id: 'finish-rusticSplit',
    type: 'tableFinish',
    optionId: 'rusticSplit',
    name: 'Pearl Cream Finish',
    price: 820,
    description: 'Warm cream split rails with matching legs and trim.'
  },
  {
    id: 'finish-plankStudio',
    type: 'tableFinish',
    optionId: 'plankStudio',
    name: 'Plank Studio Finish',
    price: 910,
    description: 'Crisp plank-style oak studio rails with satin sheen.'
  },
  {
    id: 'finish-weatheredGrey',
    type: 'tableFinish',
    optionId: 'weatheredGrey',
    name: 'Weathered Grey Finish',
    price: 940,
    description: 'Driftwood grey rails with soft grain and cooled trim.'
  },
  {
    id: 'finish-jetBlack',
    type: 'tableFinish',
    optionId: 'jetBlackCarbon',
    name: 'Jet Black Carbon Finish',
    price: 1020,
    description: 'Carbon-inspired black rails with smoked metallic trim.'
  },
  {
    id: 'finish-frostedAsh',
    type: 'tableFinish',
    optionId: 'frostedAsh',
    name: 'Frosted Ash Finish',
    price: 980,
    description: 'Cool ash rails with satin silver trim and pale skirt.'
  },
  {
    id: 'finish-amberWharf',
    type: 'tableFinish',
    optionId: 'amberWharf',
    name: 'Amber Wharf Finish',
    price: 990,
    description: 'Warm amber planks with bronzed trim and deep grain.'
  },
  {
    id: 'finish-obsidianMist',
    type: 'tableFinish',
    optionId: 'obsidianMist',
    name: 'Obsidian Mist Finish',
    price: 1050,
    description: 'Smoked obsidian rails with misted graphite accents.'
  },
  {
    id: 'chrome-chrome',
    type: 'chromeColor',
    optionId: 'chrome',
    name: 'Mirror Chrome Fascias',
    price: 360,
    description: 'Polished chrome plates to swap in for the fascia set.'
  },
  {
    id: 'railMarkers-pearl',
    type: 'railMarkerColor',
    optionId: 'pearl',
    name: 'Pearl Diamonds',
    price: 280,
    description: 'Pearlescent diamond markers with soft sheen.'
  },
  {
    id: 'railMarkers-chrome',
    type: 'railMarkerColor',
    optionId: 'chrome',
    name: 'Chrome Diamonds',
    price: 240,
    description: 'Chrome-lined diamond markers that match fascia shine.'
  },
  {
    id: 'cloth-graphite',
    type: 'clothColor',
    optionId: 'graphite',
    name: 'Arcadia Graphite Cloth',
    price: 520,
    description: 'Tournament graphite cloth for a darker arena feel.'
  },
  {
    id: 'cloth-arcticBlue',
    type: 'clothColor',
    optionId: 'arcticBlue',
    name: 'Arctic Blue Cloth',
    price: 560,
    description: 'Cool arctic blue tournament cloth with crisp sheen.'
  },
  {
    id: 'cloth-emeraldPulse',
    type: 'clothColor',
    optionId: 'emeraldPulse',
    name: 'Emerald Pulse Cloth',
    price: 590,
    description: 'Glowing emerald cloth with a pulsing luxe nap.'
  },
  {
    id: 'cloth-ivyDrift',
    type: 'clothColor',
    optionId: 'ivyDrift',
    name: 'Ivy Drift Cloth',
    price: 610,
    description: 'Deep ivy cloth with shaded railside gradients.'
  },
  {
    id: 'cloth-mintRadiance',
    type: 'clothColor',
    optionId: 'mintRadiance',
    name: 'Mint Radiance Cloth',
    price: 620,
    description: 'Bright mint cloth that lifts ambient highlights.'
  },
  {
    id: 'cloth-cobaltFrost',
    type: 'clothColor',
    optionId: 'cobaltFrost',
    name: 'Cobalt Frost Cloth',
    price: 630,
    description: 'Frosted cobalt cloth with crisp cool reflections.'
  },
  {
    id: 'cloth-midnightWave',
    type: 'clothColor',
    optionId: 'midnightWave',
    name: 'Midnight Wave Cloth',
    price: 640,
    description: 'Midnight navy cloth with wavey sapphire sheen.'
  },
  {
    id: 'cloth-neonAzure',
    type: 'clothColor',
    optionId: 'neonAzure',
    name: 'Neon Azure Cloth',
    price: 660,
    description: 'Electric azure cloth with high-contrast glow.'
  },
  {
    id: 'cloth-crimsonFlash',
    type: 'clothColor',
    optionId: 'crimsonFlash',
    name: 'Crimson Flash Cloth',
    price: 670,
    description: 'Deep crimson cloth with bright ruby sheen for bold arenas.'
  },
  {
    id: 'cloth-rubyInferno',
    type: 'clothColor',
    optionId: 'rubyInferno',
    name: 'Ruby Inferno Cloth',
    price: 680,
    description: 'Hot ruby felt with fiery highlights tuned for neon rigs.'
  },
  {
    id: 'cloth-garnetVelvet',
    type: 'clothColor',
    optionId: 'garnetVelvet',
    name: 'Garnet Velvet Cloth',
    price: 690,
    description: 'Velvet garnet nap with dark wine undertones.'
  },
  {
    id: 'cloth-forestPrime',
    type: 'clothColor',
    optionId: 'forestPrime',
    name: 'Forest Prime Cloth',
    price: 620,
    description: 'Deep forest tournament cloth with neutral grain.'
  },
  {
    id: 'cloth-evergreenLuxe',
    type: 'clothColor',
    optionId: 'evergreenLuxe',
    name: 'Evergreen Luxe Cloth',
    price: 640,
    description: 'Luxe evergreen felt with polished highlights.'
  },
  {
    id: 'cloth-jadeCurrent',
    type: 'clothColor',
    optionId: 'jadeCurrent',
    name: 'Jade Current Cloth',
    price: 650,
    description: 'Jade-tinted cloth with cool current-like sheen.'
  },
  {
    id: 'cloth-denimFabric03',
    type: 'clothColor',
    optionId: 'denim_fabric_03',
    name: 'Denim Fabric 03 Cloth',
    price: 690,
    description: 'Poly Haven denim weave with deep indigo threads and soft sheen.'
  },
  {
    id: 'cloth-hessian230',
    type: 'clothColor',
    optionId: 'hessian_230',
    name: 'Hessian 230 Cloth',
    price: 710,
    description: 'Rustic hessian burlap texture with warm tan fibers.'
  },
  {
    id: 'cloth-polarFleece',
    type: 'clothColor',
    optionId: 'polar_fleece',
    name: 'Polar Fleece Cloth',
    price: 720,
    description: 'Soft polar fleece nap with cozy neutral highlights.'
  },
  {
    id: 'cloth-cottonJersey',
    type: 'clothColor',
    optionId: 'cotton_jersey',
    name: 'Cotton Jersey Cloth',
    price: 715,
    description: 'Smooth cotton jersey knit with balanced cream tone.'
  },
  {
    id: 'cloth-fauxFurGeo',
    type: 'clothColor',
    optionId: 'faux_fur_geometric',
    name: 'Faux Fur Geometric Cloth',
    price: 740,
    description: 'Patterned faux fur with geometric strands for luxe depth.'
  },
  {
    id: 'cloth-joggingMelange',
    type: 'clothColor',
    optionId: 'jogging_melange',
    name: 'Jogging Mélange Cloth',
    price: 720,
    description: 'Heathered jogging mélange with balanced grey flecks.'
  },
  {
    id: 'cloth-knittedFleece',
    type: 'clothColor',
    optionId: 'knitted_fleece',
    name: 'Knitted Fleece Cloth',
    price: 725,
    description: 'Knitted fleece texture with warm brown yarn detail.'
  },
  {
    id: 'cloth-caban',
    type: 'clothColor',
    optionId: 'caban',
    name: 'Caban Wool Cloth',
    price: 730,
    description: 'Rich caban wool weave with amber undertones.'
  },
  {
    id: 'cloth-curlyTeddyNatural',
    type: 'clothColor',
    optionId: 'curly_teddy_natural',
    name: 'Curly Teddy Natural Cloth',
    price: 750,
    description: 'Natural curly teddy pile with plush neutral fibers.'
  },
  {
    id: 'cloth-curlyTeddyCheckered',
    type: 'clothColor',
    optionId: 'curly_teddy_checkered',
    name: 'Curly Teddy Checkered Cloth',
    price: 750,
    description: 'Checkered teddy fleece with deep teal highlights.'
  },
  {
    id: 'cloth-denimFabric04',
    type: 'clothColor',
    optionId: 'denim_fabric_04',
    name: 'Denim Fabric 04 Cloth',
    price: 705,
    description: 'Poly Haven denim 04 with balanced blue grain and sheen.'
  },
  {
    id: 'cloth-denimFabric05',
    type: 'clothColor',
    optionId: 'denim_fabric_05',
    name: 'Denim Fabric 05 Cloth',
    price: 705,
    description: 'Dark denim 05 texture with charcoal warp threads.'
  },
  {
    id: 'cloth-scubaSuede',
    type: 'clothColor',
    optionId: 'scuba_suede',
    name: 'Scuba Suede Cloth',
    price: 740,
    description: 'Soft scuba suede surface with teal tint and subtle nap.'
  },
  {
    id: 'pocket-graphite',
    type: 'pocketLiner',
    optionId: 'graphitePocket',
    name: 'Graphite Pocket Jaws',
    price: 520,
    description: 'Matte graphite jaws that mirror the fascia chrome glow.'
  },
  {
    id: 'pocket-titanium',
    type: 'pocketLiner',
    optionId: 'titaniumPocket',
    name: 'Titanium Pocket Jaws',
    price: 540,
    description: 'Cool titanium pocket liners with sharp metallic edges.'
  },
  {
    id: 'pocket-copper',
    type: 'pocketLiner',
    optionId: 'copperPocket',
    name: 'Copper Pocket Jaws',
    price: 560,
    description: 'Burnished copper jaws for a warm contrast to the cloth.'
  },
  {
    id: 'pocket-emerald',
    type: 'pocketLiner',
    optionId: 'emeraldPocket',
    name: 'Emerald Pocket Jaws',
    price: 580,
    description: 'Emerald-infused liners that blend with rich green felts.'
  },
  {
    id: 'pocket-ruby',
    type: 'pocketLiner',
    optionId: 'rubyPocket',
    name: 'Ruby Pocket Jaws',
    price: 590,
    description: 'Ruby-toned jaws with a subtle gloss for red cloth pairings.'
  },
  {
    id: 'pocket-pearl',
    type: 'pocketLiner',
    optionId: 'pearlPocket',
    name: 'Pearl Pocket Jaws',
    price: 600,
    description: 'Pearlescent pocket liners with soft highlights.'
  },
  {
    id: 'cue-redwood',
    type: 'cueStyle',
    optionId: 'redwood-ember',
    name: 'Redwood Ember Cue',
    price: 310,
    description: 'Rich redwood cue butt with ember accents.'
  },
  {
    id: 'cue-wenge',
    type: 'cueStyle',
    optionId: 'wenge-nightfall',
    name: 'Wenge Nightfall Cue',
    price: 340,
    description: 'Deep wenge finish with high-contrast stripes.'
  },
  {
    id: 'cue-mahogany',
    type: 'cueStyle',
    optionId: 'mahogany-heritage',
    name: 'Mahogany Heritage Cue',
    price: 325,
    description: 'Classic mahogany cue with heritage grain highlights.'
  },
  {
    id: 'cue-walnut',
    type: 'cueStyle',
    optionId: 'walnut-satin',
    name: 'Walnut Satin Cue',
    price: 295,
    description: 'Satin walnut cue butt with balanced contrast.'
  },
  {
    id: 'cue-carbon',
    type: 'cueStyle',
    optionId: 'carbon-matrix',
    name: 'Carbon Matrix Cue',
    price: 380,
    description: 'Carbon fiber cue with metallic weave highlights.'
  },
  {
    id: 'cue-maple',
    type: 'cueStyle',
    optionId: 'maple-horizon',
    name: 'Maple Horizon Cue',
    price: 300,
    description: 'Bright maple cue with horizon banding.'
  },
  {
    id: 'cue-graphite',
    type: 'cueStyle',
    optionId: 'graphite-aurora',
    name: 'Graphite Aurora Cue',
    price: 360,
    description: 'Graphite weave cue with aurora-inspired tint.'
  }
];

export const POOL_ROYALE_DEFAULT_LOADOUT = [
  { type: 'tableFinish', optionId: 'charredTimber', label: 'Charred Timber Finish' },
  { type: 'chromeColor', optionId: 'gold', label: 'Gold Chrome Plates' },
  { type: 'railMarkerColor', optionId: 'gold', label: 'Gold Diamond Markers' },
  { type: 'clothColor', optionId: 'freshGreen', label: 'Tour Green Cloth' },
  { type: 'cueStyle', optionId: 'birch-frost', label: 'Birch Frost Cue' },
  { type: 'pocketLiner', optionId: 'blackPocket', label: 'Black Pocket Jaws' }
];
