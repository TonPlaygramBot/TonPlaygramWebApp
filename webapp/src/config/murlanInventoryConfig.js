import { TABLE_BASE_OPTIONS, TABLE_CLOTH_OPTIONS, TABLE_WOOD_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { CARD_THEMES } from '../utils/cardThemes.js';
import { MURLAN_STOOL_THEMES } from './murlanThemes.js';

const mapLabels = (options) =>
  Object.freeze(
    options.reduce((acc, option) => {
      acc[option.id] = option.label;
      return acc;
    }, {})
  );

export const MURLAN_ROYALE_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: [TABLE_WOOD_OPTIONS[0].id],
  tableCloth: [TABLE_CLOTH_OPTIONS[0].id],
  tableBase: [TABLE_BASE_OPTIONS[0].id],
  cards: [CARD_THEMES[0].id],
  stools: [MURLAN_STOOL_THEMES[0].id]
});

export const MURLAN_ROYALE_OPTION_LABELS = Object.freeze({
  tableWood: mapLabels(TABLE_WOOD_OPTIONS),
  tableCloth: mapLabels(TABLE_CLOTH_OPTIONS),
  tableBase: mapLabels(TABLE_BASE_OPTIONS),
  cards: mapLabels(CARD_THEMES),
  stools: mapLabels(MURLAN_STOOL_THEMES)
});

export const MURLAN_ROYALE_STORE_ITEMS = [
  {
    id: 'wood-warmBrown',
    type: 'tableWood',
    optionId: 'warmBrown',
    name: 'Warm Brown Table Wood',
    price: 760,
    description: 'Walnut tone rails with a gentle satin sheen.'
  },
  {
    id: 'wood-cleanStrips',
    type: 'tableWood',
    optionId: 'cleanStrips',
    name: 'Clean Strips Table Wood',
    price: 840,
    description: 'Striped oak planks with a studio polish.'
  },
  {
    id: 'wood-oldWoodFloor',
    type: 'tableWood',
    optionId: 'oldWoodFloor',
    name: 'Heritage Wood Table',
    price: 920,
    description: 'Vintage smoked boards with deep grain detail.'
  },
  {
    id: 'cloth-emerald',
    type: 'tableCloth',
    optionId: 'emerald',
    name: 'Emerald Cloth',
    price: 360,
    description: 'Tournament emerald felt with rich shadows.'
  },
  {
    id: 'cloth-arctic',
    type: 'tableCloth',
    optionId: 'arctic',
    name: 'Arctic Cloth',
    price: 380,
    description: 'Cool arctic blue felt with crisp highlights.'
  },
  {
    id: 'cloth-sunset',
    type: 'tableCloth',
    optionId: 'sunset',
    name: 'Sunset Cloth',
    price: 400,
    description: 'Amber-orange felt inspired by dusk skies.'
  },
  {
    id: 'cloth-violet',
    type: 'tableCloth',
    optionId: 'violet',
    name: 'Violet Cloth',
    price: 420,
    description: 'Deep violet felt with subtle neon sheen.'
  },
  {
    id: 'cloth-amber',
    type: 'tableCloth',
    optionId: 'amber',
    name: 'Amber Cloth',
    price: 440,
    description: 'Golden amber felt with cinematic warmth.'
  },
  {
    id: 'cloth-denimFabric03',
    type: 'tableCloth',
    optionId: 'denim_fabric_03',
    name: 'Denim Fabric 03 Cloth',
    price: 460,
    description: 'Denim-inspired felt with deep indigo threads.'
  },
  {
    id: 'cloth-hessian230',
    type: 'tableCloth',
    optionId: 'hessian_230',
    name: 'Hessian 230 Cloth',
    price: 480,
    description: 'Rustic hessian weave with warm earthy tones.'
  },
  {
    id: 'cloth-polarFleece',
    type: 'tableCloth',
    optionId: 'polar_fleece',
    name: 'Polar Fleece Cloth',
    price: 500,
    description: 'Soft polar fleece texture with airy highlights.'
  },
  {
    id: 'cloth-cottonJersey',
    type: 'tableCloth',
    optionId: 'cotton_jersey',
    name: 'Cotton Jersey Cloth',
    price: 520,
    description: 'Smooth jersey knit with balanced midtones.'
  },
  {
    id: 'cloth-leatherWeave',
    type: 'tableCloth',
    optionId: 'fabric_leather_02',
    name: 'Leather Weave Cloth',
    price: 540,
    description: 'Leather-inspired weave with luxe sheen.'
  },
  {
    id: 'cloth-fauxFurGeo',
    type: 'tableCloth',
    optionId: 'faux_fur_geometric',
    name: 'Faux Fur Geo Cloth',
    price: 560,
    description: 'Geometric faux fur nap with soft gradients.'
  },
  {
    id: 'cloth-joggingMelange',
    type: 'tableCloth',
    optionId: 'jogging_melange',
    name: 'Jogging Mélange Cloth',
    price: 580,
    description: 'Heathered mélange felt for sport styling.'
  },
  {
    id: 'cloth-knittedFleece',
    type: 'tableCloth',
    optionId: 'knitted_fleece',
    name: 'Knitted Fleece Cloth',
    price: 600,
    description: 'Knitted fleece with plush depth and warmth.'
  },
  {
    id: 'cloth-caban',
    type: 'tableCloth',
    optionId: 'caban',
    name: 'Caban Wool Cloth',
    price: 620,
    description: 'Caban wool texture with rich evergreen depth.'
  },
  {
    id: 'cloth-polarFleecePlush',
    type: 'tableCloth',
    optionId: 'polar_fleece',
    name: 'Polar Fleece Plush Cloth',
    price: 640,
    description: 'Plush polar fleece take with fuller pile and brighter fibers.'
  },
  {
    id: 'cloth-curlyTeddyCheckered',
    type: 'tableCloth',
    optionId: 'curly_teddy_checkered',
    name: 'Curly Teddy Checkered Cloth',
    price: 660,
    description: 'Checkered teddy weave with teal accents.'
  },
  {
    id: 'cloth-denimFabric04',
    type: 'tableCloth',
    optionId: 'denim_fabric_04',
    name: 'Denim Fabric 04 Cloth',
    price: 680,
    description: 'Bright indigo denim cloth with crisp texture.'
  },
  {
    id: 'cloth-denimFabric05',
    type: 'tableCloth',
    optionId: 'denim_fabric_05',
    name: 'Denim Fabric 05 Cloth',
    price: 700,
    description: 'Dark denim cloth with modern graphite threads.'
  },
  {
    id: 'cloth-scubaSuede',
    type: 'tableCloth',
    optionId: 'scuba_suede',
    name: 'Scuba Suede Cloth',
    price: 720,
    description: 'Suede-like scuba finish with deep teal tone.'
  },
  {
    id: 'base-forestBronze',
    type: 'tableBase',
    optionId: 'forestBronze',
    name: 'Forest Base',
    price: 620,
    description: 'Verdant metallic base with bronzed trim.'
  },
  {
    id: 'base-midnightChrome',
    type: 'tableBase',
    optionId: 'midnightChrome',
    name: 'Midnight Base',
    price: 690,
    description: 'Midnight blue base with chrome-inspired highlights.'
  },
  {
    id: 'base-emberCopper',
    type: 'tableBase',
    optionId: 'emberCopper',
    name: 'Copper Base',
    price: 740,
    description: 'Copper-accent base with warm metallic glints.'
  },
  {
    id: 'base-violetShadow',
    type: 'tableBase',
    optionId: 'violetShadow',
    name: 'Violet Shadow Base',
    price: 780,
    description: 'Shadowed violet base with luxe gloss trim.'
  },
  {
    id: 'base-desertGold',
    type: 'tableBase',
    optionId: 'desertGold',
    name: 'Desert Base',
    price: 820,
    description: 'Desert-inspired base with brushed gold finish.'
  },
  {
    id: 'cards-solstice',
    type: 'cards',
    optionId: 'solstice',
    name: 'Solstice Deck',
    price: 260,
    description: 'Sun-baked backs with warm metallic edgework.'
  },
  {
    id: 'cards-nebula',
    type: 'cards',
    optionId: 'nebula',
    name: 'Nebula Deck',
    price: 300,
    description: 'Cosmic purples with glowing starlit accents.'
  },
  {
    id: 'cards-jade',
    type: 'cards',
    optionId: 'jade',
    name: 'Jade Deck',
    price: 280,
    description: 'Emerald gradients with luminous jade borders.'
  },
  {
    id: 'cards-ember',
    type: 'cards',
    optionId: 'ember',
    name: 'Ember Deck',
    price: 320,
    description: 'Fiery orange backs with charcoal cores.'
  },
  {
    id: 'cards-onyx',
    type: 'cards',
    optionId: 'onyx',
    name: 'Onyx Deck',
    price: 340,
    description: 'Monochrome slate backs with steel edging.'
  },
  {
    id: 'stool-slate',
    type: 'stools',
    optionId: 'slate',
    name: 'Slate Stools',
    price: 210,
    description: 'Slate seats with midnight legs.'
  },
  {
    id: 'stool-teal',
    type: 'stools',
    optionId: 'teal',
    name: 'Teal Stools',
    price: 230,
    description: 'Teal cushions with deep green support.'
  },
  {
    id: 'stool-amber',
    type: 'stools',
    optionId: 'amber',
    name: 'Amber Stools',
    price: 250,
    description: 'Amber seats with rich brown legs.'
  },
  {
    id: 'stool-violet',
    type: 'stools',
    optionId: 'violet',
    name: 'Violet Stools',
    price: 270,
    description: 'Violet cushions with twilight framing.'
  },
  {
    id: 'stool-frost',
    type: 'stools',
    optionId: 'frost',
    name: 'Frost Stools',
    price: 290,
    description: 'Frosted charcoal seats with dark legs.'
  },
  {
    id: 'stool-leather',
    type: 'stools',
    optionId: 'leather',
    name: 'Leather Stools',
    price: 320,
    description: 'Leather-wrapped seats with dark studio legs.'
  }
];

export const MURLAN_ROYALE_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: TABLE_WOOD_OPTIONS[0].id, label: TABLE_WOOD_OPTIONS[0].label },
  { type: 'tableCloth', optionId: TABLE_CLOTH_OPTIONS[0].id, label: TABLE_CLOTH_OPTIONS[0].label },
  { type: 'tableBase', optionId: TABLE_BASE_OPTIONS[0].id, label: TABLE_BASE_OPTIONS[0].label },
  { type: 'cards', optionId: CARD_THEMES[0].id, label: CARD_THEMES[0].label },
  { type: 'stools', optionId: MURLAN_STOOL_THEMES[0].id, label: MURLAN_STOOL_THEMES[0].label }
];
