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
    }
  ]
);

export const BATTLE_ROYALE_SHARED_TABLE_CLOTH_OPTIONS = Object.freeze(TABLE_CLOTH_OPTIONS);
export const BATTLE_ROYALE_SHARED_CHAIR_THEME_OPTIONS = Object.freeze(MURLAN_STOOL_THEMES);
export const BATTLE_ROYALE_SHARED_TABLE_THEME_OPTIONS = Object.freeze(MURLAN_TABLE_THEMES);
export const BATTLE_ROYALE_SHARED_HDRI_VARIANTS = Object.freeze(POOL_ROYALE_HDRI_VARIANTS);
