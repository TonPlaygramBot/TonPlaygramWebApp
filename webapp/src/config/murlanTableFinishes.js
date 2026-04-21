import { POOL_ROYALE_OPTION_LABELS } from './poolRoyaleInventoryConfig.js';
import { polyHavenThumb, swatchThumbnail } from './storeThumbnails.js';

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
  Object.freeze({
    id: 'carbonFiberChalk',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalk,
    description: 'Black LT carbon-fiber weave finish with a brighter charcoal tone.',
    price: 1160,
    swatches: ['#1f242b', '#4f5a68'],
    thumbnail: swatchThumbnail(['#1f242b', '#4f5a68']),
    woodOption: Object.freeze({
      id: 'carbonFiberChalk',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalk,
      presetId: 'carbonFiberChalk',
      grainId: 'plastic_monoblock_lt_black'
    })
  }),
  Object.freeze({
    id: 'carbonFiberChalkGrey',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkGrey,
    description: 'Grey LT carbon-fiber weave finish tuned a touch brighter for clarity.',
    price: 1170,
    swatches: ['#727d8b', '#a4adbb'],
    thumbnail: swatchThumbnail(['#727d8b', '#a4adbb']),
    woodOption: Object.freeze({
      id: 'carbonFiberChalkGrey',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkGrey,
      presetId: 'carbonFiberChalkGrey',
      grainId: 'plastic_monoblock_lt_grey'
    })
  }),
  Object.freeze({
    id: 'carbonFiberChalkBeige',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkBeige,
    description: 'Dark-grey LT carbon-fiber weave finish with a slightly brighter lift.',
    price: 1180,
    swatches: ['#3f4956', '#6a7788'],
    thumbnail: swatchThumbnail(['#3f4956', '#6a7788']),
    woodOption: Object.freeze({
      id: 'carbonFiberChalkBeige',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkBeige,
      presetId: 'carbonFiberChalkBeige',
      grainId: 'plastic_monoblock_lt_dark_grey'
    })
  }),
  Object.freeze({
    id: 'carbonFiberChalkDarkBlue',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkBlue,
    description: 'Burgundy LT finish shifted to rosewood-brown warmth.',
    price: 1190,
    swatches: ['#6a3233', '#a55c5d'],
    thumbnail: swatchThumbnail(['#6a3233', '#a55c5d']),
    woodOption: Object.freeze({
      id: 'carbonFiberChalkDarkBlue',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkBlue,
      presetId: 'carbonFiberChalkDarkBlue',
      grainId: 'plastic_monoblock_lt_burgundy'
    })
  }),
  Object.freeze({
    id: 'carbonFiberChalkWhite',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkWhite,
    description: 'Milk-cream LT carbon-fiber weave finish with a deeper cream tone.',
    price: 1200,
    swatches: ['#d8ccb9', '#ece3d3'],
    thumbnail: swatchThumbnail(['#d8ccb9', '#ece3d3']),
    woodOption: Object.freeze({
      id: 'carbonFiberChalkWhite',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkWhite,
      presetId: 'carbonFiberChalkWhite',
      grainId: 'plastic_monoblock_lt_milk_cream'
    })
  }),
  Object.freeze({
    id: 'carbonFiberChalkDarkGreen',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkGreen,
    description: 'Dark-green LT carbon-fiber weave finish with rich forest depth.',
    price: 1210,
    swatches: ['#314d39', '#588365'],
    thumbnail: swatchThumbnail(['#314d39', '#588365']),
    woodOption: Object.freeze({
      id: 'carbonFiberChalkDarkGreen',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkGreen,
      presetId: 'carbonFiberChalkDarkGreen',
      grainId: 'plastic_monoblock_lt_dark_green'
    })
  }),
  Object.freeze({
    id: 'carbonFiberChalkDarkYellow',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkYellow,
    description: 'Dark-yellow LT carbon-fiber weave finish with mustard-gold warmth.',
    price: 1220,
    swatches: ['#8d6b2c', '#c79d52'],
    thumbnail: swatchThumbnail(['#8d6b2c', '#c79d52']),
    woodOption: Object.freeze({
      id: 'carbonFiberChalkDarkYellow',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkYellow,
      presetId: 'carbonFiberChalkDarkYellow',
      grainId: 'plastic_monoblock_lt_dark_yellow'
    })
  }),
  Object.freeze({
    id: 'carbonFiberChalkDarkBrown',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkBrown,
    description: 'Dark-brown LT carbon-fiber weave finish with earthy depth.',
    price: 1230,
    swatches: ['#5f3f30', '#95664f'],
    thumbnail: swatchThumbnail(['#5f3f30', '#95664f']),
    woodOption: Object.freeze({
      id: 'carbonFiberChalkDarkBrown',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkBrown,
      presetId: 'carbonFiberChalkDarkBrown',
      grainId: 'plastic_monoblock_lt_dark_brown'
    })
  }),
  Object.freeze({
    id: 'carbonFiberChalkDarkRed',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkRed,
    description: 'Dark-red LT carbon-fiber weave finish with deep crimson character.',
    price: 1240,
    swatches: ['#803a36', '#bd615e'],
    thumbnail: swatchThumbnail(['#803a36', '#bd615e']),
    woodOption: Object.freeze({
      id: 'carbonFiberChalkDarkRed',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkRed,
      presetId: 'carbonFiberChalkDarkRed',
      grainId: 'plastic_monoblock_lt_dark_red'
    })
  }),
  Object.freeze({
    id: 'carbonFiberAlligatorOlive',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorOlive,
    description: 'Olive LT alligator-scale texture with natural reptile tone transitions.',
    price: 1310,
    swatches: ['#4c5d3f', '#6d7d58'],
    thumbnail: swatchThumbnail(['#4c5d3f', '#6d7d58']),
    woodOption: Object.freeze({
      id: 'carbonFiberAlligatorOlive',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorOlive,
      presetId: 'carbonFiberAlligatorOlive',
      grainId: 'plastic_monoblock_lt_olive_alligator'
    })
  }),
  Object.freeze({
    id: 'carbonFiberAlligatorSwamp',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorSwamp,
    description: 'Swamp-green LT alligator texture tuned to deep marsh tones.',
    price: 1320,
    swatches: ['#304b36', '#48624d'],
    thumbnail: swatchThumbnail(['#304b36', '#48624d']),
    woodOption: Object.freeze({
      id: 'carbonFiberAlligatorSwamp',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorSwamp,
      presetId: 'carbonFiberAlligatorSwamp',
      grainId: 'plastic_monoblock_lt_swamp_alligator'
    })
  }),
  Object.freeze({
    id: 'carbonFiberAlligatorClay',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorClay,
    description: 'Clay-brown LT alligator pattern with warm hide-inspired contrast.',
    price: 1330,
    swatches: ['#5f4c3c', '#816a56'],
    thumbnail: swatchThumbnail(['#5f4c3c', '#816a56']),
    woodOption: Object.freeze({
      id: 'carbonFiberAlligatorClay',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorClay,
      presetId: 'carbonFiberAlligatorClay',
      grainId: 'plastic_monoblock_lt_clay_alligator'
    })
  }),
  Object.freeze({
    id: 'carbonFiberAlligatorSand',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorSand,
    description: 'Sand LT alligator scales with brighter khaki highlights.',
    price: 1340,
    swatches: ['#7e6e56', '#a49277'],
    thumbnail: swatchThumbnail(['#7e6e56', '#a49277']),
    woodOption: Object.freeze({
      id: 'carbonFiberAlligatorSand',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorSand,
      presetId: 'carbonFiberAlligatorSand',
      grainId: 'plastic_monoblock_lt_sand_alligator'
    })
  }),
  Object.freeze({
    id: 'carbonFiberAlligatorMoss',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorMoss,
    description: 'Moss LT alligator texture balancing olive and slate greens.',
    price: 1350,
    swatches: ['#435340', '#60715c'],
    thumbnail: swatchThumbnail(['#435340', '#60715c']),
    woodOption: Object.freeze({
      id: 'carbonFiberAlligatorMoss',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorMoss,
      presetId: 'carbonFiberAlligatorMoss',
      grainId: 'plastic_monoblock_lt_moss_alligator'
    })
  }),
  Object.freeze({
    id: 'carbonFiberAlligatorNight',
    label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorNight,
    description: 'Night LT alligator scales with muted charcoal-green depth.',
    price: 1360,
    swatches: ['#263129', '#3a453c'],
    thumbnail: swatchThumbnail(['#263129', '#3a453c']),
    woodOption: Object.freeze({
      id: 'carbonFiberAlligatorNight',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorNight,
      presetId: 'carbonFiberAlligatorNight',
      grainId: 'plastic_monoblock_lt_night_alligator'
    })
  })
]);
