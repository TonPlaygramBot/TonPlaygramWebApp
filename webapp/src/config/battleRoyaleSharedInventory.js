import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';
import { TABLE_CLOTH_OPTIONS } from '../utils/tableCustomizationOptions.js';
import {
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_OPTION_LABELS
} from './poolRoyaleInventoryConfig.js';

const SHARED_TABLE_FINISH_PRICE_OVERRIDES = Object.freeze({
  peelingPaintWeathered: 980,
  oakVeneer01: 990,
  woodTable001: 1000,
  darkWood: 1010,
  rosewoodVeneer01: 1020
});

const SHARED_TABLE_FINISH_DESCRIPTIONS = Object.freeze({
  peelingPaintWeathered: 'Weathered peeling paint wood rails with a reclaimed finish.',
  oakVeneer01: 'Warm oak veneer rails with smooth satin polish.',
  woodTable001: 'Balanced walnut-brown rails inspired by classic table slabs.',
  darkWood: 'Deep espresso rails with strong grain contrast.',
  rosewoodVeneer01: 'Rosewood veneer rails with rich, reddish undertones.'
});

export const BATTLE_ROYALE_SHARED_TABLE_FINISH_OPTIONS = Object.freeze(
  Object.entries(POOL_ROYALE_OPTION_LABELS.tableFinish)
    .filter(([id]) => id in SHARED_TABLE_FINISH_PRICE_OVERRIDES)
    .map(([id, label]) => ({
      id,
      label,
      price: SHARED_TABLE_FINISH_PRICE_OVERRIDES[id],
      description: SHARED_TABLE_FINISH_DESCRIPTIONS[id]
    }))
);

export const BATTLE_ROYALE_SHARED_TABLE_CLOTH_OPTIONS = Object.freeze(TABLE_CLOTH_OPTIONS);
export const BATTLE_ROYALE_SHARED_CHAIR_THEME_OPTIONS = Object.freeze(MURLAN_STOOL_THEMES);
export const BATTLE_ROYALE_SHARED_TABLE_THEME_OPTIONS = Object.freeze(MURLAN_TABLE_THEMES);
export const BATTLE_ROYALE_SHARED_HDRI_VARIANTS = Object.freeze(POOL_ROYALE_HDRI_VARIANTS);
