import { MURLAN_TABLE_THEMES } from './murlanThemes.js'
import { MURLAN_TABLE_FINISHES } from './murlanTableFinishes.js'
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS
} from './poolRoyaleInventoryConfig.js'
import { swatchThumbnail } from './storeThumbnails.js'
import { MURLAN_STOOL_THEMES } from './murlanThemes.js'

const DEFAULT_HDRI_ID = POOL_ROYALE_DEFAULT_HDRI_ID || POOL_ROYALE_HDRI_VARIANTS[0]?.id

const FOUR_IN_ROW_POLYHAVEN_CHAIR_OPTIONS = MURLAN_STOOL_THEMES.filter((option) => option.source === 'polyhaven')

export const FOUR_IN_ROW_CHAIR_OPTIONS = Object.freeze([...FOUR_IN_ROW_POLYHAVEN_CHAIR_OPTIONS])
export const FOUR_IN_ROW_TABLE_OPTIONS = Object.freeze([...MURLAN_TABLE_THEMES])

export const FOUR_IN_ROW_BOARD_LAYOUTS = Object.freeze([
  { id: 'classic7x6', label: 'Classic 7×6', rows: 6, cols: 7 },
  { id: 'arena8x7', label: 'Arena 8×7', rows: 7, cols: 8 }
])

export const FOUR_IN_ROW_BOARD_THEMES = Object.freeze([
  { id: 'classicArena', label: 'Classic Arena', thumbnail: '/assets/icons/four-in-row-royale.svg', tint: '#f2d3a2', grid: '#6b3e1f' },
  { id: 'midnightArena', label: 'Midnight Arena', thumbnail: '/assets/icons/four-in-row-royale.svg', tint: '#94a3b8', grid: '#0f172a' },
  { id: 'rubyArena', label: 'Ruby Arena', thumbnail: '/assets/icons/four-in-row-royale.svg', tint: '#fca5a5', grid: '#7f1d1d' },
  { id: 'auroraMint', label: 'Aurora Mint', thumbnail: swatchThumbnail(['#4ade80', '#14532d']), tint: '#4ade80', grid: '#14532d' },
  { id: 'royalSapphire', label: 'Royal Sapphire', thumbnail: swatchThumbnail(['#3b82f6', '#0f172a']), tint: '#3b82f6', grid: '#0f172a' },
  { id: 'desertCopper', label: 'Desert Copper', thumbnail: swatchThumbnail(['#f59e0b', '#78350f']), tint: '#f59e0b', grid: '#78350f' },
  { id: 'violetNebula', label: 'Violet Nebula', thumbnail: swatchThumbnail(['#a855f7', '#312e81']), tint: '#a855f7', grid: '#312e81' },
  { id: 'iceSilver', label: 'Ice Silver', thumbnail: swatchThumbnail(['#cbd5e1', '#334155']), tint: '#cbd5e1', grid: '#334155' }
])

export const FOUR_IN_ROW_BOARD_FINISH_OPTIONS = Object.freeze([...MURLAN_TABLE_FINISHES])
export const FOUR_IN_ROW_BOARD_FRAME_FINISH_OPTIONS = Object.freeze([...MURLAN_TABLE_FINISHES])

export const FOUR_IN_ROW_RING_FINISH_OPTIONS = Object.freeze([
  {
    id: 'chrome',
    label: 'Chrome',
    thumbnail: swatchThumbnail(['#dbe2ea', '#617185']),
    color: '#e2e8f0',
    metalness: 1,
    roughness: 0.16
  },
  {
    id: 'gold',
    label: 'Gold',
    thumbnail: swatchThumbnail(['#facc15', '#92400e']),
    color: '#f6c453',
    metalness: 0.98,
    roughness: 0.24
  },
  {
    id: 'aluminium',
    label: 'Aluminium',
    thumbnail: swatchThumbnail(['#cbd5e1', '#64748b']),
    color: '#c7ced9',
    metalness: 0.84,
    roughness: 0.28
  },
  {
    id: 'plasticBlack',
    label: 'Plastic Black',
    thumbnail: swatchThumbnail(['#0f172a', '#334155']),
    color: '#1f2937',
    metalness: 0.06,
    roughness: 0.52
  },
  {
    id: 'plasticWhite',
    label: 'Plastic White',
    thumbnail: swatchThumbnail(['#f8fafc', '#cbd5e1']),
    color: '#f1f5f9',
    metalness: 0.04,
    roughness: 0.46
  }
])

export const FOUR_IN_ROW_STONE_STYLES = Object.freeze([
  { id: 'rubyPearl', label: 'Ruby & Pearl', thumbnail: swatchThumbnail(['#991b1b', '#fef2f2']), black: '#991b1b', white: '#fef2f2', blackRoughness: 0.22, whiteRoughness: 0.2 },
  { id: 'tealSand', label: 'Teal & Sand', thumbnail: swatchThumbnail(['#0f766e', '#fef3c7']), black: '#0f766e', white: '#fef3c7', blackRoughness: 0.24, whiteRoughness: 0.28 },
  { id: 'plasmaSun', label: 'Plasma & Sun', thumbnail: swatchThumbnail(['#7c3aed', '#facc15']), black: '#7c3aed', white: '#facc15', blackRoughness: 0.18, whiteRoughness: 0.24 },
  { id: 'graphiteRose', label: 'Graphite & Rose', thumbnail: swatchThumbnail(['#1f2937', '#f472b6']), black: '#1f2937', white: '#f472b6', blackRoughness: 0.26, whiteRoughness: 0.26 },
  { id: 'oceanFrost', label: 'Ocean & Frost', thumbnail: swatchThumbnail(['#0c4a6e', '#dbeafe']), black: '#0c4a6e', white: '#dbeafe', blackRoughness: 0.2, whiteRoughness: 0.2 }
])

export const FOUR_IN_ROW_BATTLE_DEFAULT_UNLOCKS = Object.freeze({
  chairColor: [FOUR_IN_ROW_CHAIR_OPTIONS[0]?.id],
  tables: [FOUR_IN_ROW_TABLE_OPTIONS[0]?.id],
  tableFinish: [MURLAN_TABLE_FINISHES[0]?.id],
  boardFinish: [FOUR_IN_ROW_BOARD_FINISH_OPTIONS[0]?.id],
  boardFrameFinish: [FOUR_IN_ROW_BOARD_FRAME_FINISH_OPTIONS[0]?.id],
  ringFinish: [FOUR_IN_ROW_RING_FINISH_OPTIONS[0]?.id],
  boardTheme: [FOUR_IN_ROW_BOARD_THEMES[0]?.id],
  boardLayout: [FOUR_IN_ROW_BOARD_LAYOUTS[0]?.id],
  stoneStyle: [FOUR_IN_ROW_STONE_STYLES[0]?.id],
  environmentHdri: [DEFAULT_HDRI_ID]
})

export const FOUR_IN_ROW_BATTLE_OPTION_LABELS = Object.freeze({
  chairColor: Object.freeze(FOUR_IN_ROW_CHAIR_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  tables: Object.freeze(FOUR_IN_ROW_TABLE_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  tableFinish: Object.freeze(MURLAN_TABLE_FINISHES.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  boardFinish: Object.freeze(FOUR_IN_ROW_BOARD_FINISH_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  boardFrameFinish: Object.freeze(FOUR_IN_ROW_BOARD_FRAME_FINISH_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  ringFinish: Object.freeze(FOUR_IN_ROW_RING_FINISH_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  boardTheme: Object.freeze(FOUR_IN_ROW_BOARD_THEMES.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  boardLayout: Object.freeze(FOUR_IN_ROW_BOARD_LAYOUTS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  stoneStyle: Object.freeze(FOUR_IN_ROW_STONE_STYLES.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  environmentHdri: Object.freeze(POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => ({ ...acc, [variant.id]: `${variant.name} HDRI` }), {}))
})

export const FOUR_IN_ROW_BATTLE_DEFAULT_LOADOUT = FOUR_IN_ROW_BATTLE_DEFAULT_UNLOCKS

export const FOUR_IN_ROW_BATTLE_STORE_ITEMS = [
  ...MURLAN_TABLE_FINISHES.map((finish, idx) => ({
    id: `fourinrow-table-finish-${finish.id}`,
    type: 'tableFinish',
    optionId: finish.id,
    name: finish.label,
    price: finish.price ?? 960 + idx * 40,
    description: finish.description,
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'table'
  })),
  ...FOUR_IN_ROW_BOARD_FINISH_OPTIONS.slice(1).map((finish, idx) => ({
    id: `fourinrow-board-finish-${finish.id}`,
    type: 'boardFinish',
    optionId: finish.id,
    name: `${finish.label} Board`,
    price: finish.price ?? 540 + idx * 35,
    description: `${finish.label} octagon-table finish for the 4 in a Row board faces.`,
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'board'
  })),
  ...FOUR_IN_ROW_BOARD_FRAME_FINISH_OPTIONS.slice(1).map((finish, idx) => ({
    id: `fourinrow-board-frame-${finish.id}`,
    type: 'boardFrameFinish',
    optionId: finish.id,
    name: `${finish.label} Frame`,
    price: (finish.price ?? 980) + 120 + idx * 30,
    description: `Apply ${finish.label} octagon-table textures to the board frame and stand.`,
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'board'
  })),
  ...FOUR_IN_ROW_RING_FINISH_OPTIONS.slice(1).map((ring, idx) => ({
    id: `fourinrow-ring-${ring.id}`,
    type: 'ringFinish',
    optionId: ring.id,
    name: `${ring.label} Rings`,
    price: 420 + idx * 40,
    description: `${ring.label} ring trim around every board slot.`,
    swatches: ring.id.includes('plastic') ? [ring.color] : [ring.color, '#111827'],
    thumbnail: ring.thumbnail,
    previewShape: 'piece'
  })),
  ...FOUR_IN_ROW_TABLE_OPTIONS.slice(1).map((theme, idx) => ({
    id: `fourinrow-table-${theme.id}`,
    type: 'tables',
    optionId: theme.id,
    name: theme.label,
    price: theme.price ?? 960 + idx * 40,
    description: theme.description || `${theme.label} table with preserved Poly Haven materials.`,
    thumbnail: theme.thumbnail,
    previewShape: 'table'
  })),
  ...FOUR_IN_ROW_CHAIR_OPTIONS.slice(1).map((option, idx) => ({
    id: `fourinrow-chair-${option.id}`,
    type: 'chairColor',
    optionId: option.id,
    name: option.label,
    price: option.price ?? 320 + idx * 20,
    description: option.description || `${option.label} seating tuned for 4 in a Row.`,
    thumbnail: option.thumbnail,
    previewShape: 'chair'
  })),
  ...FOUR_IN_ROW_BOARD_LAYOUTS.slice(1).map((layout, idx) => ({
    id: `fourinrow-layout-${layout.id}`,
    type: 'boardLayout',
    optionId: layout.id,
    name: layout.label,
    price: 680 + idx * 80,
    description: 'Expanded 4 in a Row board size unlock.',
    thumbnail: swatchThumbnail(['#0ea5e9', '#1e293b']),
    previewShape: 'board'
  })),
  ...FOUR_IN_ROW_BOARD_THEMES.slice(1).map((theme, idx) => ({
    id: `fourinrow-board-${theme.id}`,
    type: 'boardTheme',
    optionId: theme.id,
    name: theme.label,
    price: 450 + idx * 30,
    description: 'Open-source 4 in Row texture variant with high-contrast line work.',
    thumbnail: theme.thumbnail,
    swatches: [theme.tint, theme.grid],
    previewShape: 'board'
  })),
  ...FOUR_IN_ROW_STONE_STYLES.slice(1).map((style, idx) => ({
    id: `fourinrow-stones-${style.id}`,
    type: 'stoneStyle',
    optionId: style.id,
    name: style.label,
    price: 420 + idx * 35,
    description: 'Stone set inspired by free/open-source 4 in Row palettes.',
    thumbnail: style.thumbnail,
    swatches: [style.black, style.white],
    previewShape: 'piece'
  })),
  ...POOL_ROYALE_HDRI_VARIANTS.slice(1).map((variant, idx) => ({
    id: `fourinrow-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: 780 + idx * 60,
    description: `Arena lighting profile based on ${variant.name}.`,
    thumbnail: variant.thumbnail || swatchThumbnail(variant.swatches || ['#1f2937', '#0f172a'])
  }))
]
