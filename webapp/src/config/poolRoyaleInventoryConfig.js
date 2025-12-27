export const POOL_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableFinish: ['charredTimber'],
  chromeColor: ['gold'],
  railMarkerColor: ['gold'],
  clothColor: ['denimFabric03Green'],
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
    denimFabric03Green: 'Denim Fabric 03 — Green Tint',
    denimFabric03Blue: 'Denim Fabric 03 — Blue Tint',
    hessian230Green: 'Hessian 230 — Green Tint',
    hessian230Blue: 'Hessian 230 — Blue Tint',
    polarFleeceGreen: 'Polar Fleece — Green Tint',
    polarFleeceBlue: 'Polar Fleece — Blue Tint',
    cottonJerseyGreen: 'Cotton Jersey — Green Tint',
    cottonJerseyBlue: 'Cotton Jersey — Blue Tint',
    fauxFurGeometricGreen: 'Faux Fur Geometric — Green Tint',
    fauxFurGeometricBlue: 'Faux Fur Geometric — Blue Tint',
    joggingMelangeGreen: 'Jogging Mélange — Green Tint',
    joggingMelangeBlue: 'Jogging Mélange — Blue Tint',
    knittedFleeceGreen: 'Knitted Fleece — Green Tint',
    knittedFleeceBlue: 'Knitted Fleece — Blue Tint',
    cabanGreen: 'Caban Wool — Green Tint',
    cabanBlue: 'Caban Wool — Blue Tint',
    curlyTeddyNaturalGreen: 'Curly Teddy Natural — Green Tint',
    curlyTeddyNaturalBlue: 'Curly Teddy Natural — Blue Tint',
    curlyTeddyCheckeredGreen: 'Curly Teddy Checkered — Green Tint',
    curlyTeddyCheckeredBlue: 'Curly Teddy Checkered — Blue Tint',
    denimFabric04Green: 'Denim Fabric 04 — Green Tint',
    denimFabric04Blue: 'Denim Fabric 04 — Blue Tint',
    denimFabric05Green: 'Denim Fabric 05 — Green Tint',
    denimFabric05Blue: 'Denim Fabric 05 — Blue Tint'
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
    id: 'cloth-denimFabric03Green',
    type: 'clothColor',
    optionId: 'denimFabric03Green',
    name: 'Denim Fabric 03 — Green Tint',
    price: 620,
    description: 'Poly Haven denim_fabric_03 cloth tinted green with high-res weave.'
  },
  {
    id: 'cloth-denimFabric03Blue',
    type: 'clothColor',
    optionId: 'denimFabric03Blue',
    name: 'Denim Fabric 03 — Blue Tint',
    price: 640,
    description: 'Poly Haven denim_fabric_03 cloth tinted blue with pronounced threads.'
  },
  {
    id: 'cloth-hessian230Green',
    type: 'clothColor',
    optionId: 'hessian230Green',
    name: 'Hessian 230 — Green Tint',
    price: 630,
    description: 'Hessian_230 texture in a green pass, scaled for larger stitch detail.'
  },
  {
    id: 'cloth-hessian230Blue',
    type: 'clothColor',
    optionId: 'hessian230Blue',
    name: 'Hessian 230 — Blue Tint',
    price: 650,
    description: 'Hessian_230 texture in a blue pass, kept at full-resolution grain.'
  },
  {
    id: 'cloth-polarFleeceGreen',
    type: 'clothColor',
    optionId: 'polarFleeceGreen',
    name: 'Polar Fleece — Green Tint',
    price: 640,
    description: 'Polar_fleece cloth with green tint and boosted nap definition.'
  },
  {
    id: 'cloth-polarFleeceBlue',
    type: 'clothColor',
    optionId: 'polarFleeceBlue',
    name: 'Polar Fleece — Blue Tint',
    price: 660,
    description: 'Polar_fleece cloth with blue tint and amplified fleece depth.'
  },
  {
    id: 'cloth-cottonJerseyGreen',
    type: 'clothColor',
    optionId: 'cottonJerseyGreen',
    name: 'Cotton Jersey — Green Tint',
    price: 650,
    description: 'Cotton_jersey knit with green tint and enlarged stitch pattern.'
  },
  {
    id: 'cloth-cottonJerseyBlue',
    type: 'clothColor',
    optionId: 'cottonJerseyBlue',
    name: 'Cotton Jersey — Blue Tint',
    price: 670,
    description: 'Cotton_jersey knit with blue tint and high-fidelity weave.'
  },
  {
    id: 'cloth-fauxFurGeometricGreen',
    type: 'clothColor',
    optionId: 'fauxFurGeometricGreen',
    name: 'Faux Fur Geometric — Green Tint',
    price: 660,
    description: 'Faux_fur_geometric pass with green tint and crisp pattern scale.'
  },
  {
    id: 'cloth-fauxFurGeometricBlue',
    type: 'clothColor',
    optionId: 'fauxFurGeometricBlue',
    name: 'Faux Fur Geometric — Blue Tint',
    price: 680,
    description: 'Faux_fur_geometric pass with blue tint and sharper fur relief.'
  },
  {
    id: 'cloth-joggingMelangeGreen',
    type: 'clothColor',
    optionId: 'joggingMelangeGreen',
    name: 'Jogging Mélange — Green Tint',
    price: 670,
    description: 'Jogging_melange cloth in green with emphasized melange fibers.'
  },
  {
    id: 'cloth-joggingMelangeBlue',
    type: 'clothColor',
    optionId: 'joggingMelangeBlue',
    name: 'Jogging Mélange — Blue Tint',
    price: 690,
    description: 'Jogging_melange cloth in blue with bold high-res threading.'
  },
  {
    id: 'cloth-knittedFleeceGreen',
    type: 'clothColor',
    optionId: 'knittedFleeceGreen',
    name: 'Knitted Fleece — Green Tint',
    price: 680,
    description: 'Knitted_fleece texture tinted green with enlarged knit pattern.'
  },
  {
    id: 'cloth-knittedFleeceBlue',
    type: 'clothColor',
    optionId: 'knittedFleeceBlue',
    name: 'Knitted Fleece — Blue Tint',
    price: 700,
    description: 'Knitted_fleece texture tinted blue with pronounced fibers.'
  },
  {
    id: 'cloth-cabanGreen',
    type: 'clothColor',
    optionId: 'cabanGreen',
    name: 'Caban Wool — Green Tint',
    price: 690,
    description: 'Caban wool weave in a green tint, using full-size Poly Haven maps.'
  },
  {
    id: 'cloth-cabanBlue',
    type: 'clothColor',
    optionId: 'cabanBlue',
    name: 'Caban Wool — Blue Tint',
    price: 710,
    description: 'Caban wool weave in a blue tint with preserved coarse detail.'
  },
  {
    id: 'cloth-curlyTeddyNaturalGreen',
    type: 'clothColor',
    optionId: 'curlyTeddyNaturalGreen',
    name: 'Curly Teddy Natural — Green Tint',
    price: 700,
    description: 'Curly_teddy_natural nap, green tinted and kept at high resolution.'
  },
  {
    id: 'cloth-curlyTeddyNaturalBlue',
    type: 'clothColor',
    optionId: 'curlyTeddyNaturalBlue',
    name: 'Curly Teddy Natural — Blue Tint',
    price: 720,
    description: 'Curly_teddy_natural nap, blue tinted with lifted pattern contrast.'
  },
  {
    id: 'cloth-curlyTeddyCheckeredGreen',
    type: 'clothColor',
    optionId: 'curlyTeddyCheckeredGreen',
    name: 'Curly Teddy Checkered — Green Tint',
    price: 710,
    description: 'Curly_teddy_checkered cloth tinted green with visible checker depth.'
  },
  {
    id: 'cloth-curlyTeddyCheckeredBlue',
    type: 'clothColor',
    optionId: 'curlyTeddyCheckeredBlue',
    name: 'Curly Teddy Checkered — Blue Tint',
    price: 730,
    description: 'Curly_teddy_checkered cloth tinted blue with defined wool pattern.'
  },
  {
    id: 'cloth-denimFabric04Green',
    type: 'clothColor',
    optionId: 'denimFabric04Green',
    name: 'Denim Fabric 04 — Green Tint',
    price: 720,
    description: 'Denim_fabric_04 cloth tinted green and upscaled for bold weave.'
  },
  {
    id: 'cloth-denimFabric04Blue',
    type: 'clothColor',
    optionId: 'denimFabric04Blue',
    name: 'Denim Fabric 04 — Blue Tint',
    price: 740,
    description: 'Denim_fabric_04 cloth tinted blue with enlarged thread spacing.'
  },
  {
    id: 'cloth-denimFabric05Green',
    type: 'clothColor',
    optionId: 'denimFabric05Green',
    name: 'Denim Fabric 05 — Green Tint',
    price: 730,
    description: 'Denim_fabric_05 cloth tinted green with heavier texture relief.'
  },
  {
    id: 'cloth-denimFabric05Blue',
    type: 'clothColor',
    optionId: 'denimFabric05Blue',
    name: 'Denim Fabric 05 — Blue Tint',
    price: 750,
    description: 'Denim_fabric_05 cloth tinted blue with boosted fiber contrast.'
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
  {
    type: 'clothColor',
    optionId: 'denimFabric03Green',
    label: 'Denim Fabric 03 — Green Tint'
  },
  { type: 'cueStyle', optionId: 'birch-frost', label: 'Birch Frost Cue' },
  { type: 'pocketLiner', optionId: 'blackPocket', label: 'Black Pocket Jaws' }
];
