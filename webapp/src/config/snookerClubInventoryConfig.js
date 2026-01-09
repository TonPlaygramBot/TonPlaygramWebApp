import { CUE_STYLE_PRESETS } from './cueStyles.js';
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_OPTION_LABELS
} from './poolRoyaleInventoryConfig.js';

export const SNOOKER_CLUB_DEFAULT_UNLOCKS = Object.freeze({
  tableFinish: ['rusticSplit'],
  chromeColor: ['chrome'],
  railMarkerColor: ['chrome'],
  clothColor: ['freshGreen'],
  cueStyle: [CUE_STYLE_PRESETS[0]?.id],
  pocketLiner: ['blackPocket'],
  environmentHdri: [POOL_ROYALE_DEFAULT_HDRI_ID]
});

export const SNOOKER_CLUB_OPTION_LABELS = Object.freeze({
  environmentHdri: Object.freeze(
    POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
      acc[variant.id] = `${variant.name} HDRI`;
      return acc;
    }, {})
  ),
  tableFinish: Object.freeze({
    rusticSplit: 'Pearl Cream',
    charredTimber: 'Charred Timber',
    plankStudio: 'Plank Studio',
    weatheredGrey: 'Weathered Grey',
    jetBlackCarbon: 'Jet Black Carbon'
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
    arcticBlue: 'Arctic Blue'
  }),
  pocketLiner: Object.freeze({
    blackPocket: 'Black Pocket Jaws',
    ...POOL_ROYALE_OPTION_LABELS.pocketLiner
  }),
  cueStyle: Object.freeze(
    CUE_STYLE_PRESETS.reduce((acc, preset) => {
      acc[preset.id] = preset.label;
      return acc;
    }, {})
  )
});

export const SNOOKER_CLUB_STORE_ITEMS = [
  {
    id: 'snooker-finish-charredTimber',
    type: 'tableFinish',
    optionId: 'charredTimber',
    name: 'Charred Timber Finish',
    price: 880,
    description: 'Dark burned timber rails with rich contrast trim.'
  },
  {
    id: 'snooker-finish-plankStudio',
    type: 'tableFinish',
    optionId: 'plankStudio',
    name: 'Plank Studio Finish',
    price: 930,
    description: 'Crisp plank-style oak studio rails with satin sheen.'
  },
  {
    id: 'snooker-finish-weatheredGrey',
    type: 'tableFinish',
    optionId: 'weatheredGrey',
    name: 'Weathered Grey Finish',
    price: 960,
    description: 'Driftwood grey rails with softened grain highlights.'
  },
  {
    id: 'snooker-finish-jetBlack',
    type: 'tableFinish',
    optionId: 'jetBlackCarbon',
    name: 'Jet Black Carbon Finish',
    price: 1040,
    description: 'Matte carbon-inspired rails with smoked metallic trim.'
  },
  {
    id: 'snooker-chrome-gold',
    type: 'chromeColor',
    optionId: 'gold',
    name: 'Gold Fascias',
    price: 420,
    description: 'Gold-plated chrome plates for the fascia set.'
  },
  {
    id: 'snooker-railMarkers-pearl',
    type: 'railMarkerColor',
    optionId: 'pearl',
    name: 'Pearl Rail Markers',
    price: 310,
    description: 'Pearlescent rail diamonds with soft sheen.'
  },
  {
    id: 'snooker-railMarkers-gold',
    type: 'railMarkerColor',
    optionId: 'gold',
    name: 'Gold Rail Markers',
    price: 340,
    description: 'Gold rail diamonds to match premium fascias.'
  },
  {
    id: 'snooker-cloth-graphite',
    type: 'clothColor',
    optionId: 'graphite',
    name: 'Arcadia Graphite Cloth',
    price: 560,
    description: 'Tournament graphite cloth for a darker arena mood.'
  },
  {
    id: 'snooker-cloth-arcticBlue',
    type: 'clothColor',
    optionId: 'arcticBlue',
    name: 'Arctic Blue Cloth',
    price: 590,
    description: 'Cool arctic blue cloth with crisp broadcast sheen.'
  },
  {
    id: 'snooker-pocket-fabric-leather-02',
    type: 'pocketLiner',
    optionId: 'fabric_leather_02',
    name: 'Fabric Leather 02 Pocket Jaws',
    price: 520,
    description: 'Warm stitched leather weave liners for the classic Pool Royale look.'
  },
  {
    id: 'snooker-pocket-fabric-leather-01',
    type: 'pocketLiner',
    optionId: 'fabric_leather_01',
    name: 'Fabric Leather 01 Pocket Jaws',
    price: 530,
    description: 'Soft-grain leather weave liners with a mellow brown finish.'
  },
  {
    id: 'snooker-pocket-brown-leather',
    type: 'pocketLiner',
    optionId: 'brown_leather',
    name: 'Brown Leather Pocket Jaws',
    price: 540,
    description: 'Deep brown leather pockets with natural creases and aged texture.'
  },
  {
    id: 'snooker-pocket-leather-red-02',
    type: 'pocketLiner',
    optionId: 'leather_red_02',
    name: 'Leather Red 02 Pocket Jaws',
    price: 560,
    description: 'Bold red leather liners with pronounced seams and worn highlights.'
  },
  {
    id: 'snooker-pocket-leather-red-03',
    type: 'pocketLiner',
    optionId: 'leather_red_03',
    name: 'Leather Red 03 Pocket Jaws',
    price: 570,
    description: 'Deep crimson leather pocket liners with subtle stitch detailing.'
  },
  {
    id: 'snooker-pocket-leather-white',
    type: 'pocketLiner',
    optionId: 'leather_white',
    name: 'Leather White Pocket Jaws',
    price: 590,
    description: 'Bright white leather pockets with crisp seam definition and clean grain.'
  },
  ...CUE_STYLE_PRESETS.slice(1).map((preset, idx) => ({
    id: `snooker-cue-${preset.id}`,
    type: 'cueStyle',
    optionId: preset.id,
    name: `${preset.label} Cue`,
    price: 320 + idx * 25,
    description: 'Unlock an alternate cue butt finish for Snooker Club.'
  })),
  ...POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
    id: `snooker-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: variant.price,
    description: variant.description
  }))
];

export const SNOOKER_CLUB_DEFAULT_LOADOUT = [
  { type: 'tableFinish', optionId: 'rusticSplit', label: 'Pearl Cream Finish' },
  { type: 'chromeColor', optionId: 'chrome', label: 'Chrome Fascias' },
  { type: 'railMarkerColor', optionId: 'chrome', label: 'Chrome Rail Markers' },
  { type: 'clothColor', optionId: 'freshGreen', label: 'Tour Green Cloth' },
  { type: 'pocketLiner', optionId: 'blackPocket', label: 'Black Pocket Jaws' },
  { type: 'cueStyle', optionId: CUE_STYLE_PRESETS[0]?.id, label: CUE_STYLE_PRESETS[0]?.label },
  {
    type: 'environmentHdri',
    optionId: POOL_ROYALE_DEFAULT_HDRI_ID,
    label:
      SNOOKER_CLUB_OPTION_LABELS.environmentHdri[POOL_ROYALE_DEFAULT_HDRI_ID] ||
      'HDR Environment'
  }
];
