import { POOL_ROYALE_OPTION_LABELS } from './poolRoyaleInventoryConfig.js';

export const MURLAN_TABLE_FINISHES = Object.freeze([
  Object.freeze({
    id: 'peelingPaintWeathered',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.peelingPaintWeathered,
    description: 'Weathered peeling paint wood rails with a reclaimed finish.',
    price: 980,
    swatches: ['#a89f95', '#b8b3aa'],
    woodOption: Object.freeze({
      id: 'peelingPaintWeathered',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.peelingPaintWeathered,
      presetId: 'oak',
      grainId: 'wood_peeling_paint_weathered'
    })
  }),
  Object.freeze({
    id: 'oakVeneer01',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.oakVeneer01,
    description: 'Warm oak veneer rails with smooth satin polish.',
    price: 990,
    swatches: ['#b9854e', '#c89a64'],
    woodOption: Object.freeze({
      id: 'oakVeneer01',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.oakVeneer01,
      presetId: 'oak',
      grainId: 'oak_veneer_01'
    })
  }),
  Object.freeze({
    id: 'woodTable001',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.woodTable001,
    description: 'Balanced walnut-brown rails inspired by classic table slabs.',
    price: 1000,
    swatches: ['#8f6243', '#a4724f'],
    woodOption: Object.freeze({
      id: 'woodTable001',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.woodTable001,
      presetId: 'walnut',
      grainId: 'wood_table_001'
    })
  }),
  Object.freeze({
    id: 'darkWood',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.darkWood,
    description: 'Deep espresso rails with strong grain contrast.',
    price: 1010,
    swatches: ['#2f241f', '#3d2f2a'],
    woodOption: Object.freeze({
      id: 'darkWood',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.darkWood,
      presetId: 'smokedOak',
      grainId: 'dark_wood'
    })
  }),
  Object.freeze({
    id: 'rosewoodVeneer01',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.rosewoodVeneer01,
    description: 'Rosewood veneer rails with rich, reddish undertones.',
    price: 1020,
    swatches: ['#5b2f26', '#6f3a2f'],
    woodOption: Object.freeze({
      id: 'rosewoodVeneer01',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.rosewoodVeneer01,
      presetId: 'cherry',
      grainId: 'rosewood_veneer_01'
    })
  })
]);
