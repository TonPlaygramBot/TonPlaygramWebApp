import { MURLAN_STOOL_THEMES } from './murlanThemes.js';
import { POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';

export const DOMINO_BATTLE_ROYAL_CHAIR_THEME_OPTIONS = Object.freeze(
  MURLAN_STOOL_THEMES.map((theme) => ({
    ...theme,
    description: theme.description || `${theme.label} seating set from Murlan Royale`
  }))
);

export const TEXAS_HOLDEM_SHARED_HDRI_OPTIONS = POOL_ROYALE_HDRI_VARIANTS;
export const TEXAS_HOLDEM_SHARED_DEFAULT_HDRI_ID = POOL_ROYALE_DEFAULT_HDRI_ID;
