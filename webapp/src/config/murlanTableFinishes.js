import { POOL_ROYALE_OPTION_LABELS } from './poolRoyaleInventoryConfig.js';
import { polyHavenThumb } from './storeThumbnails.js';

const LT_TABLE_FINISHES = Object.freeze([
  { id: 'carbonFiberChalk', description: 'Black LT carbon-fiber weave finish with a brighter charcoal tone.', price: 1160, swatches: ['#242b36', '#3b4452'] },
  { id: 'carbonFiberChalkGrey', description: 'Grey LT carbon-fiber weave finish tuned a touch brighter for clarity.', price: 1170, swatches: ['#717b88', '#99a4b2'] },
  { id: 'carbonFiberChalkBeige', description: 'Dark-grey LT carbon-fiber weave finish with a slightly brighter lift.', price: 1180, swatches: ['#45505c', '#5f6b79'] },
  { id: 'carbonFiberChalkDarkBlue', description: 'Burgundy LT finish shifted to rosewood-brown warmth.', price: 1190, swatches: ['#6a3a31', '#8d5546'] },
  { id: 'carbonFiberChalkWhite', description: 'Milk-cream LT carbon-fiber weave finish with a deeper cream tone.', price: 1200, swatches: ['#dacbb7', '#ecdecb'] },
  { id: 'carbonFiberChalkDarkGreen', description: 'Dark-green LT carbon-fiber weave finish with rich forest depth.', price: 1210, swatches: ['#36523f', '#4a6f56'] },
  { id: 'carbonFiberChalkDarkYellow', description: 'Dark-yellow LT carbon-fiber weave finish with mustard-gold warmth.', price: 1220, swatches: ['#987330', '#b38a3e'] },
  { id: 'carbonFiberChalkDarkBrown', description: 'Dark-brown LT carbon-fiber weave finish with earthy depth.', price: 1230, swatches: ['#684633', '#815843'] },
  { id: 'carbonFiberChalkDarkRed', description: 'Dark-red LT carbon-fiber weave finish with deep crimson character.', price: 1240, swatches: ['#7a2f2f', '#9b4343'] },
  { id: 'carbonFiberAlligatorOlive', description: 'Olive LT alligator-scale texture with natural reptile tone transitions.', price: 1310, swatches: ['#45573a', '#62774f'] },
  { id: 'carbonFiberAlligatorSwamp', description: 'Swamp-green LT alligator texture tuned to deep marsh tones.', price: 1320, swatches: ['#2e4733', '#3f5f46'] },
  { id: 'carbonFiberAlligatorClay', description: 'Clay-brown LT alligator pattern with warm hide-inspired contrast.', price: 1330, swatches: ['#5c4939', '#7a624d'] },
  { id: 'carbonFiberAlligatorSand', description: 'Sand LT alligator scales with brighter khaki highlights.', price: 1340, swatches: ['#786850', '#98856a'] },
  { id: 'carbonFiberAlligatorMoss', description: 'Moss LT alligator texture balancing olive and slate greens.', price: 1350, swatches: ['#3f4f3c', '#5a6b54'] },
  { id: 'carbonFiberAlligatorNight', description: 'Night LT alligator scales with muted charcoal-green depth.', price: 1360, swatches: ['#253128', '#36443a'] }
]);

export const MURLAN_TABLE_FINISHES = Object.freeze([
  Object.freeze({
    id: 'peelingPaintWeathered',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.peelingPaintWeathered,
    description: 'Weathered peeling paint wood rails with a reclaimed finish.',
    price: 980,
    swatches: ['#a89f95', '#b8b3aa'],
    thumbnail: polyHavenThumb('wood_peeling_paint_weathered'),
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
    thumbnail: polyHavenThumb('oak_veneer_01'),
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
    thumbnail: polyHavenThumb('wood_table_001'),
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
    thumbnail: polyHavenThumb('dark_wood'),
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
    thumbnail: polyHavenThumb('rosewood_veneer_01'),
    woodOption: Object.freeze({
      id: 'rosewoodVeneer01',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.rosewoodVeneer01,
      presetId: 'cherry',
      grainId: 'rosewood_veneer_01'
    })
  }),
  ...LT_TABLE_FINISHES.map((finish) =>
    Object.freeze({
      id: finish.id,
      label: POOL_ROYALE_OPTION_LABELS.tableFinish[finish.id],
      description: finish.description,
      price: finish.price,
      swatches: finish.swatches,
      thumbnail: polyHavenThumb(finish.id),
      woodOption: Object.freeze({
        id: finish.id,
        label: POOL_ROYALE_OPTION_LABELS.tableFinish[finish.id],
        presetId: 'smokedOak',
        grainId: finish.id
      })
    })
  )
]);
