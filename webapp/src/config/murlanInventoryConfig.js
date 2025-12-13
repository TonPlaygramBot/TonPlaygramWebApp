import { TABLE_BASE_OPTIONS, TABLE_CLOTH_OPTIONS, TABLE_WOOD_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { CARD_THEMES } from '../utils/cardThemes.js';

const stoolLabels = {
  ruby: 'Ruby Stools',
  slate: 'Slate Stools',
  teal: 'Teal Stools',
  amber: 'Amber Stools',
  violet: 'Violet Stools',
  frost: 'Frost Stools'
};

const woodLabels = TABLE_WOOD_OPTIONS.reduce((acc, option) => {
  acc[option.id] = option.label;
  return acc;
}, {});

const clothLabels = TABLE_CLOTH_OPTIONS.reduce((acc, option) => {
  acc[option.id] = option.label;
  return acc;
}, {});

const baseLabels = TABLE_BASE_OPTIONS.reduce((acc, option) => {
  acc[option.id] = option.label;
  return acc;
}, {});

const cardLabels = CARD_THEMES.reduce((acc, option) => {
  acc[option.id] = option.label;
  return acc;
}, {});

export const MURLAN_OPTION_LABELS = Object.freeze({
  tableWood: Object.freeze(woodLabels),
  tableCloth: Object.freeze(clothLabels),
  tableBase: Object.freeze(baseLabels),
  cards: Object.freeze(cardLabels),
  stools: Object.freeze(stoolLabels)
});

export const MURLAN_DEFAULT_UNLOCKS = Object.freeze({
  tableWood: [TABLE_WOOD_OPTIONS[0].id],
  tableCloth: [TABLE_CLOTH_OPTIONS[0].id],
  tableBase: [TABLE_BASE_OPTIONS[0].id],
  cards: [CARD_THEMES[0].id],
  stools: ['ruby']
});

export const MURLAN_STORE_ITEMS = [
  {
    id: 'murlan-wood-warmBrown',
    type: 'tableWood',
    optionId: TABLE_WOOD_OPTIONS[1].id,
    name: 'Warm Brown Wood',
    price: 540,
    description: 'Rich walnut boards with warm grain and satin finish.'
  },
  {
    id: 'murlan-wood-cleanStrips',
    type: 'tableWood',
    optionId: TABLE_WOOD_OPTIONS[2].id,
    name: 'Clean Strips Wood',
    price: 560,
    description: 'Oak studio planks with clean striping and sheen.'
  },
  {
    id: 'murlan-wood-oldFloor',
    type: 'tableWood',
    optionId: TABLE_WOOD_OPTIONS[3].id,
    name: 'Old Wood Floor',
    price: 610,
    description: 'Smoked oak boards with vintage patina.'
  },
  {
    id: 'murlan-cloth-emerald',
    type: 'tableCloth',
    optionId: TABLE_CLOTH_OPTIONS[1].id,
    name: 'Emerald Cloth',
    price: 420,
    description: 'Deep emerald gradient felt with subtle glow.'
  },
  {
    id: 'murlan-cloth-arctic',
    type: 'tableCloth',
    optionId: TABLE_CLOTH_OPTIONS[2].id,
    name: 'Arctic Cloth',
    price: 430,
    description: 'Icy blue felt inspired by winter tournaments.'
  },
  {
    id: 'murlan-cloth-sunset',
    type: 'tableCloth',
    optionId: TABLE_CLOTH_OPTIONS[3].id,
    name: 'Sunset Cloth',
    price: 430,
    description: 'Warm orange felt with soft sunset fade.'
  },
  {
    id: 'murlan-cloth-violet',
    type: 'tableCloth',
    optionId: TABLE_CLOTH_OPTIONS[4].id,
    name: 'Violet Cloth',
    price: 440,
    description: 'Violet felt with luminous undertone.'
  },
  {
    id: 'murlan-cloth-amber',
    type: 'tableCloth',
    optionId: TABLE_CLOTH_OPTIONS[5].id,
    name: 'Amber Cloth',
    price: 440,
    description: 'Amber tournament felt with rich shadow gradient.'
  },
  {
    id: 'murlan-base-forest',
    type: 'tableBase',
    optionId: TABLE_BASE_OPTIONS[1].id,
    name: 'Forest Base',
    price: 620,
    description: 'Forest green metallic base with muted trim.'
  },
  {
    id: 'murlan-base-midnight',
    type: 'tableBase',
    optionId: TABLE_BASE_OPTIONS[2].id,
    name: 'Midnight Base',
    price: 640,
    description: 'Midnight chrome base with deep blue fascia.'
  },
  {
    id: 'murlan-base-copper',
    type: 'tableBase',
    optionId: TABLE_BASE_OPTIONS[3].id,
    name: 'Copper Base',
    price: 650,
    description: 'Copper-accented base with ember trim tones.'
  },
  {
    id: 'murlan-base-violet',
    type: 'tableBase',
    optionId: TABLE_BASE_OPTIONS[4].id,
    name: 'Violet Shadow Base',
    price: 660,
    description: 'Violet shadow pedestal with glazed edges.'
  },
  {
    id: 'murlan-base-desert',
    type: 'tableBase',
    optionId: TABLE_BASE_OPTIONS[5].id,
    name: 'Desert Base',
    price: 640,
    description: 'Brushed desert gold base with warm trims.'
  },
  {
    id: 'murlan-cards-solstice',
    type: 'cards',
    optionId: CARD_THEMES[1].id,
    name: 'Solstice Deck',
    price: 310,
    description: 'Amber-edged card backs with solstice glow.'
  },
  {
    id: 'murlan-cards-nebula',
    type: 'cards',
    optionId: CARD_THEMES[2].id,
    name: 'Nebula Deck',
    price: 320,
    description: 'Violet cosmic backs with nebula shimmer.'
  },
  {
    id: 'murlan-cards-jade',
    type: 'cards',
    optionId: CARD_THEMES[3].id,
    name: 'Jade Deck',
    price: 320,
    description: 'Emerald backed deck with jade gradients.'
  },
  {
    id: 'murlan-cards-ember',
    type: 'cards',
    optionId: CARD_THEMES[4].id,
    name: 'Ember Deck',
    price: 330,
    description: 'Fiery orange backs with ember highlights.'
  },
  {
    id: 'murlan-cards-onyx',
    type: 'cards',
    optionId: CARD_THEMES[5].id,
    name: 'Onyx Deck',
    price: 340,
    description: 'Onyx black backs with metallic sheen.'
  },
  {
    id: 'murlan-stool-slate',
    type: 'stools',
    optionId: 'slate',
    name: 'Slate Stools',
    price: 260,
    description: 'Slate upholstery with midnight legs.'
  },
  {
    id: 'murlan-stool-teal',
    type: 'stools',
    optionId: 'teal',
    name: 'Teal Stools',
    price: 270,
    description: 'Teal cushions paired with deep green legs.'
  },
  {
    id: 'murlan-stool-amber',
    type: 'stools',
    optionId: 'amber',
    name: 'Amber Stools',
    price: 270,
    description: 'Amber leather stools with dark wood supports.'
  },
  {
    id: 'murlan-stool-violet',
    type: 'stools',
    optionId: 'violet',
    name: 'Violet Stools',
    price: 280,
    description: 'Violet cushions with shadowed frames.'
  },
  {
    id: 'murlan-stool-frost',
    type: 'stools',
    optionId: 'frost',
    name: 'Frost Stools',
    price: 280,
    description: 'Frost grey seating with cool tone legs.'
  }
];

export const MURLAN_DEFAULT_LOADOUT = [
  { type: 'tableWood', optionId: TABLE_WOOD_OPTIONS[0].id, label: TABLE_WOOD_OPTIONS[0].label },
  { type: 'tableCloth', optionId: TABLE_CLOTH_OPTIONS[0].id, label: TABLE_CLOTH_OPTIONS[0].label },
  { type: 'tableBase', optionId: TABLE_BASE_OPTIONS[0].id, label: TABLE_BASE_OPTIONS[0].label },
  { type: 'cards', optionId: CARD_THEMES[0].id, label: CARD_THEMES[0].label },
  { type: 'stools', optionId: 'ruby', label: stoolLabels.ruby }
];

export const MURLAN_TYPE_LABELS = Object.freeze({
  tableWood: 'Table Wood',
  tableCloth: 'Table Cloth',
  tableBase: 'Table Base',
  cards: 'Card Decks',
  stools: 'Player Stools'
});
