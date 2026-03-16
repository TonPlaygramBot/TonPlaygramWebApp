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

export const BADUK_BOARD_THEMES = Object.freeze([
  { id: 'classic', label: 'Classic Hinoki', price: 360, thumbnail: '/assets/game-art/baduk-battle-royal/boards/classic-19x19.svg' },
  { id: 'walnut', label: 'Walnut Pro Grid', price: 420, thumbnail: '/assets/game-art/baduk-battle-royal/boards/walnut-19x19.svg' },
  { id: 'slate', label: 'Slate Arena', price: 460, thumbnail: '/assets/game-art/baduk-battle-royal/boards/slate-19x19.svg' },
  { id: 'jade', label: 'Jade Masters', price: 500, thumbnail: '/assets/game-art/baduk-battle-royal/boards/jade-19x19.svg' },
  { id: 'midnight', label: 'Midnight Carbon', price: 540, thumbnail: '/assets/game-art/baduk-battle-royal/boards/midnight-19x19.svg' }
])

export const BADUK_STONE_STYLES = Object.freeze([
  {
    id: 'shellSlate',
    label: 'Shell & Slate',
    price: 380,
    blackColor: '#0b0b0d',
    whiteColor: '#f8fafc',
    blackRoughness: 0.3,
    whiteRoughness: 0.18,
    markerColor: '#34d399',
    thumbnail: '/assets/game-art/baduk-battle-royal/stones/shellSlate.svg'
  },
  {
    id: 'obsidianPearl',
    label: 'Obsidian Pearl',
    price: 430,
    blackColor: '#151515',
    whiteColor: '#fef3c7',
    blackRoughness: 0.22,
    whiteRoughness: 0.14,
    markerColor: '#f59e0b',
    thumbnail: '/assets/game-art/baduk-battle-royal/stones/obsidianPearl.svg'
  },
  {
    id: 'cobaltIvory',
    label: 'Cobalt Ivory',
    price: 470,
    blackColor: '#0f254a',
    whiteColor: '#e5e7eb',
    blackRoughness: 0.24,
    whiteRoughness: 0.2,
    markerColor: '#38bdf8',
    thumbnail: '/assets/game-art/baduk-battle-royal/stones/cobaltIvory.svg'
  },
  {
    id: 'forestBone',
    label: 'Forest Bone',
    price: 510,
    blackColor: '#1f3c2f',
    whiteColor: '#fff7ed',
    blackRoughness: 0.28,
    whiteRoughness: 0.18,
    markerColor: '#84cc16',
    thumbnail: '/assets/game-art/baduk-battle-royal/stones/forestBone.svg'
  },
  {
    id: 'neonArc',
    label: 'Neon Arc',
    price: 560,
    blackColor: '#312e81',
    whiteColor: '#f5f3ff',
    blackRoughness: 0.18,
    whiteRoughness: 0.12,
    markerColor: '#f472b6',
    thumbnail: '/assets/game-art/baduk-battle-royal/stones/neonArc.svg'
  }
])

export const BADUK_BATTLE_DEFAULT_LOADOUT = Object.freeze({
  chairColor: [BADUK_CHAIR_OPTIONS[0]?.id],
  tables: [BADUK_TABLE_OPTIONS[0]?.id],
  tableFinish: [MURLAN_TABLE_FINISHES[0]?.id],
  boardTheme: [BADUK_BOARD_THEMES[0]?.id],
  stoneStyle: [BADUK_STONE_STYLES[0]?.id],
  environmentHdri: [DEFAULT_HDRI_ID]
})

export const BADUK_BATTLE_OPTION_LABELS = Object.freeze({
  chairColor: Object.freeze(BADUK_CHAIR_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  tables: Object.freeze(BADUK_TABLE_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  tableFinish: Object.freeze(MURLAN_TABLE_FINISHES.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  boardTheme: Object.freeze(BADUK_BOARD_THEMES.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  stoneStyle: Object.freeze(BADUK_STONE_STYLES.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  environmentHdri: Object.freeze(
    POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => {
      acc[variant.id] = `${variant.name} HDRI`
      return acc
    }, {})
  )
})

export const BADUK_BATTLE_STORE_ITEMS = Object.freeze([
  ...MURLAN_TABLE_FINISHES.map((finish, idx) => ({
    id: `baduk-table-finish-${finish.id}`,
    type: 'tableFinish',
    optionId: finish.id,
    name: finish.label,
    price: finish.price ?? 980 + idx * 40,
    description: finish.description,
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'table'
  })),
  ...BADUK_TABLE_OPTIONS.slice(1).map((theme, idx) => ({
    id: `baduk-table-${theme.id}`,
    type: 'tables',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 920 + idx * 35,
    description: theme.description || `${theme.label} table tuned for Baduk Battle Royal.`,
    thumbnail: theme.thumbnail,
    previewShape: 'table'
  })),
  ...BADUK_CHAIR_OPTIONS.slice(1).map((option, idx) => ({
    id: `baduk-chair-${option.id}`,
    type: 'chairColor',
    optionId: option.id,
    name: option.label,
    price: option.price ?? 320 + idx * 20,
    description: option.description || `${option.label} seating for the Baduk arena.`,
    thumbnail: option.thumbnail,
    previewShape: 'chair'
  })),
  ...BADUK_BOARD_THEMES.slice(1).map((theme) => ({
    id: `baduk-board-${theme.id}`,
    type: 'boardTheme',
    optionId: theme.id,
    name: theme.label,
    price: theme.price,
    description: `${theme.label} board skin based on open-source goban artwork.`,
    thumbnail: theme.thumbnail,
    previewShape: 'board'
  })),
  ...BADUK_STONE_STYLES.slice(1).map((style) => ({
    id: `baduk-stone-${style.id}`,
    type: 'stoneStyle',
    optionId: style.id,
    name: style.label,
    price: style.price,
    description: `${style.label} stone material palette for matches and replays.`,
    thumbnail: style.thumbnail,
    previewShape: 'board'
  }))
])
