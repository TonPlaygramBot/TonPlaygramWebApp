import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';
import { TABLE_CLOTH_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { polyHavenThumb } from './storeThumbnails.js';
import {
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_OPTION_LABELS
} from './poolRoyaleInventoryConfig.js';

export const BATTLE_ROYALE_SHARED_TABLE_FINISH_OPTIONS = Object.freeze(
  [
    {
      id: 'peelingPaintWeathered',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.peelingPaintWeathered,
      description: 'Weathered peeling paint wood rails with a reclaimed finish.',
      price: 980,
      swatches: ['#a89f95', '#b8b3aa'],
      thumbnail: polyHavenThumb('wood_peeling_paint_weathered'),
      woodOption: {
        id: 'peelingPaintWeathered',
        label: POOL_ROYALE_OPTION_LABELS.tableFinish.peelingPaintWeathered,
        presetId: 'oak',
        grainId: 'wood_peeling_paint_weathered'
      }
    },
    {
      id: 'oakVeneer01',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.oakVeneer01,
      description: 'Warm oak veneer rails with smooth satin polish.',
      price: 990,
      swatches: ['#b9854e', '#c89a64'],
      thumbnail: polyHavenThumb('oak_veneer_01'),
      woodOption: {
        id: 'oakVeneer01',
        label: POOL_ROYALE_OPTION_LABELS.tableFinish.oakVeneer01,
        presetId: 'oak',
        grainId: 'oak_veneer_01'
      }
    },
    {
      id: 'woodTable001',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.woodTable001,
      description: 'Balanced walnut-brown rails inspired by classic table slabs.',
      price: 1000,
      swatches: ['#8f6243', '#a4724f'],
      thumbnail: polyHavenThumb('wood_table_001'),
      woodOption: {
        id: 'woodTable001',
        label: POOL_ROYALE_OPTION_LABELS.tableFinish.woodTable001,
        presetId: 'walnut',
        grainId: 'wood_table_001'
      }
    },
    {
      id: 'darkWood',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.darkWood,
      description: 'Deep espresso rails with strong grain contrast.',
      price: 1010,
      swatches: ['#2f241f', '#3d2f2a'],
      thumbnail: polyHavenThumb('dark_wood'),
      woodOption: {
        id: 'darkWood',
        label: POOL_ROYALE_OPTION_LABELS.tableFinish.darkWood,
        presetId: 'smokedOak',
        grainId: 'dark_wood'
      }
    },
    {
      id: 'rosewoodVeneer01',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.rosewoodVeneer01,
      description: 'Rosewood veneer rails with rich, reddish undertones.',
      price: 1020,
      swatches: ['#5b2f26', '#6f3a2f'],
      thumbnail: polyHavenThumb('rosewood_veneer_01'),
      woodOption: {
        id: 'rosewoodVeneer01',
        label: POOL_ROYALE_OPTION_LABELS.tableFinish.rosewoodVeneer01,
        presetId: 'cherry',
        grainId: 'rosewood_veneer_01'
      }
    },
    {
      id: 'carbonFiberChalk',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalk,
      description: 'Black LT carbon-fiber weave finish with a brighter charcoal tone.',
      price: 1160,
      swatches: ['#1f2937', '#374151'],
      thumbnail: polyHavenThumb('carbon_fiber'),
      woodOption: { id: 'carbonFiberChalk', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalk, presetId: 'smokedOak', grainId: 'carbonFiberChalk' }
    },
    {
      id: 'carbonFiberChalkGrey',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkGrey,
      description: 'Grey LT carbon-fiber weave finish tuned a touch brighter for clarity.',
      price: 1170,
      swatches: ['#4b5563', '#6b7280'],
      thumbnail: polyHavenThumb('carbon_fiber'),
      woodOption: { id: 'carbonFiberChalkGrey', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkGrey, presetId: 'smokedOak', grainId: 'carbonFiberChalkGrey' }
    },
    {
      id: 'carbonFiberChalkBeige',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkBeige,
      description: 'Dark-grey LT carbon-fiber weave finish with a slightly brighter lift.',
      price: 1180,
      swatches: ['#6b5f58', '#8b7a70'],
      thumbnail: polyHavenThumb('carbon_fiber'),
      woodOption: { id: 'carbonFiberChalkBeige', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkBeige, presetId: 'smokedOak', grainId: 'carbonFiberChalkBeige' }
    },
    {
      id: 'carbonFiberChalkDarkBlue',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkBlue,
      description: 'Burgundy LT finish shifted to rosewood-brown warmth.',
      price: 1190,
      swatches: ['#7f1d1d', '#991b1b'],
      thumbnail: polyHavenThumb('carbon_fiber'),
      woodOption: { id: 'carbonFiberChalkDarkBlue', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkBlue, presetId: 'smokedOak', grainId: 'carbonFiberChalkDarkBlue' }
    },
    {
      id: 'carbonFiberChalkWhite',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkWhite,
      description: 'Milk-cream LT carbon-fiber weave finish with a deeper cream tone.',
      price: 1200,
      swatches: ['#e7dcc8', '#f5ebd7'],
      thumbnail: polyHavenThumb('carbon_fiber'),
      woodOption: { id: 'carbonFiberChalkWhite', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkWhite, presetId: 'smokedOak', grainId: 'carbonFiberChalkWhite' }
    },
    {
      id: 'carbonFiberChalkDarkGreen',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkGreen,
      description: 'Dark-green LT carbon-fiber weave finish with rich forest depth.',
      price: 1210,
      swatches: ['#14532d', '#166534'],
      thumbnail: polyHavenThumb('carbon_fiber'),
      woodOption: { id: 'carbonFiberChalkDarkGreen', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkGreen, presetId: 'smokedOak', grainId: 'carbonFiberChalkDarkGreen' }
    },
    {
      id: 'carbonFiberChalkDarkYellow',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkYellow,
      description: 'Dark-yellow LT carbon-fiber weave finish with mustard-gold warmth.',
      price: 1220,
      swatches: ['#92400e', '#b45309'],
      thumbnail: polyHavenThumb('carbon_fiber'),
      woodOption: { id: 'carbonFiberChalkDarkYellow', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkYellow, presetId: 'smokedOak', grainId: 'carbonFiberChalkDarkYellow' }
    },
    {
      id: 'carbonFiberChalkDarkBrown',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkBrown,
      description: 'Dark-brown LT carbon-fiber weave finish with earthy depth.',
      price: 1230,
      swatches: ['#3f2a22', '#5b3a29'],
      thumbnail: polyHavenThumb('carbon_fiber'),
      woodOption: { id: 'carbonFiberChalkDarkBrown', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkBrown, presetId: 'smokedOak', grainId: 'carbonFiberChalkDarkBrown' }
    },
    {
      id: 'carbonFiberChalkDarkRed',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkRed,
      description: 'Dark-red LT carbon-fiber weave finish with deep crimson character.',
      price: 1240,
      swatches: ['#7f1d1d', '#991b1b'],
      thumbnail: polyHavenThumb('carbon_fiber'),
      woodOption: { id: 'carbonFiberChalkDarkRed', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberChalkDarkRed, presetId: 'smokedOak', grainId: 'carbonFiberChalkDarkRed' }
    },
    {
      id: 'carbonFiberAlligatorOlive',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorOlive,
      description: 'Olive LT alligator-scale texture with natural reptile tone transitions.',
      price: 1310,
      swatches: ['#4d5b36', '#65734d'],
      thumbnail: polyHavenThumb('alligator_skin'),
      woodOption: { id: 'carbonFiberAlligatorOlive', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorOlive, presetId: 'smokedOak', grainId: 'carbonFiberAlligatorOlive' }
    },
    {
      id: 'carbonFiberAlligatorSwamp',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorSwamp,
      description: 'Swamp-green LT alligator texture tuned to deep marsh tones.',
      price: 1320,
      swatches: ['#2f4f3f', '#3f6b56'],
      thumbnail: polyHavenThumb('alligator_skin'),
      woodOption: { id: 'carbonFiberAlligatorSwamp', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorSwamp, presetId: 'smokedOak', grainId: 'carbonFiberAlligatorSwamp' }
    },
    {
      id: 'carbonFiberAlligatorClay',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorClay,
      description: 'Clay-brown LT alligator pattern with warm hide-inspired contrast.',
      price: 1330,
      swatches: ['#6b4e3d', '#8a6650'],
      thumbnail: polyHavenThumb('alligator_skin'),
      woodOption: { id: 'carbonFiberAlligatorClay', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorClay, presetId: 'smokedOak', grainId: 'carbonFiberAlligatorClay' }
    },
    {
      id: 'carbonFiberAlligatorSand',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorSand,
      description: 'Sand LT alligator scales with brighter khaki highlights.',
      price: 1340,
      swatches: ['#b59a74', '#d0b890'],
      thumbnail: polyHavenThumb('alligator_skin'),
      woodOption: { id: 'carbonFiberAlligatorSand', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorSand, presetId: 'smokedOak', grainId: 'carbonFiberAlligatorSand' }
    },
    {
      id: 'carbonFiberAlligatorMoss',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorMoss,
      description: 'Moss LT alligator texture balancing olive and slate greens.',
      price: 1350,
      swatches: ['#4f5b43', '#637355'],
      thumbnail: polyHavenThumb('alligator_skin'),
      woodOption: { id: 'carbonFiberAlligatorMoss', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorMoss, presetId: 'smokedOak', grainId: 'carbonFiberAlligatorMoss' }
    },
    {
      id: 'carbonFiberAlligatorNight',
      label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorNight,
      description: 'Night LT alligator scales with muted charcoal-green depth.',
      price: 1360,
      swatches: ['#1f2420', '#2f3b32'],
      thumbnail: polyHavenThumb('alligator_skin'),
      woodOption: { id: 'carbonFiberAlligatorNight', label: POOL_ROYALE_OPTION_LABELS.tableFinish.carbonFiberAlligatorNight, presetId: 'smokedOak', grainId: 'carbonFiberAlligatorNight' }
    }
  ]
);

export const BATTLE_ROYALE_SHARED_TABLE_CLOTH_OPTIONS = Object.freeze(TABLE_CLOTH_OPTIONS);
export const BATTLE_ROYALE_SHARED_CHAIR_THEME_OPTIONS = Object.freeze(MURLAN_STOOL_THEMES);
export const BATTLE_ROYALE_SHARED_TABLE_THEME_OPTIONS = Object.freeze(MURLAN_TABLE_THEMES);
export const BATTLE_ROYALE_SHARED_HDRI_VARIANTS = Object.freeze(POOL_ROYALE_HDRI_VARIANTS);
