import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js';
import { POOL_ROYALE_DEFAULT_HDRI_ID, POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';

const FALLBACK_SEAT = '#7c3aed';
const FALLBACK_LEG = '#1f1f1f';

const withColorFallbacks = (theme) => {
  const seat = theme.seatColor || theme.primary || FALLBACK_SEAT;
  return {
    ...theme,
    primary: seat,
    accent: theme.accent || seat,
    highlight: theme.highlight || seat,
    legColor: theme.legColor || FALLBACK_LEG
  };
};

export const TEXAS_CHAIR_COLOR_OPTIONS = Object.freeze(MURLAN_STOOL_THEMES.map(withColorFallbacks));
export const TEXAS_TABLE_THEME_OPTIONS = Object.freeze(MURLAN_TABLE_THEMES);
export const TEXAS_HDRI_OPTIONS = Object.freeze(
  POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({ ...variant, label: `${variant.name} HDRI` }))
);
export const TEXAS_DEFAULT_HDRI_ID = POOL_ROYALE_DEFAULT_HDRI_ID;
