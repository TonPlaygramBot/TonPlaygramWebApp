import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js'
import { MURLAN_TABLE_FINISHES } from './murlanTableFinishes.js'
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS
} from './poolRoyaleInventoryConfig.js'

const DEFAULT_HDRI_ID = POOL_ROYALE_DEFAULT_HDRI_ID || POOL_ROYALE_HDRI_VARIANTS[0]?.id

const mapStoolThemeToChair = (theme) => ({
  ...theme,
  primary: theme.seatColor || theme.primary || '#7c3aed',
  accent: theme.accent || theme.highlight || theme.seatColor,
  legColor: theme.legColor || theme.baseColor || '#111827',
  preserveMaterials: theme.preserveMaterials ?? theme.source === 'polyhaven'
})

export const BADUK_CHAIR_OPTIONS = Object.freeze([...MURLAN_STOOL_THEMES.map(mapStoolThemeToChair)])
export const BADUK_TABLE_OPTIONS = Object.freeze([...MURLAN_TABLE_THEMES])

export const BADUK_BATTLE_DEFAULT_LOADOUT = Object.freeze({
  chairColor: [BADUK_CHAIR_OPTIONS[0]?.id],
  tables: [BADUK_TABLE_OPTIONS[0]?.id],
  tableFinish: [MURLAN_TABLE_FINISHES[0]?.id],
  environmentHdri: [DEFAULT_HDRI_ID]
})
