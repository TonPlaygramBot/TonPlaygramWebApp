import { MURLAN_STOOL_THEMES, MURLAN_TABLE_THEMES } from './murlanThemes.js'
import { MURLAN_TABLE_FINISHES } from './murlanTableFinishes.js'
import {
  POOL_ROYALE_DEFAULT_HDRI_ID,
  POOL_ROYALE_HDRI_VARIANTS
} from './poolRoyaleInventoryConfig.js'
import { swatchThumbnail } from './storeThumbnails.js'

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
export const BADUK_BOARD_FINISH_OPTIONS = Object.freeze([...MURLAN_TABLE_FINISHES])
export const BADUK_FRAME_FINISH_OPTIONS = Object.freeze([...MURLAN_TABLE_FINISHES])

export const BADUK_RING_MATERIAL_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'chrome',
    label: 'Chrome Rings',
    color: '#d7dee7',
    metalness: 0.95,
    roughness: 0.14,
    description: 'Mirror-like chrome rims with bright specular response.',
    thumbnail: swatchThumbnail(['#f8fafc', '#9ca3af'])
  }),
  Object.freeze({
    id: 'gold',
    label: 'Gold Rings',
    color: '#d4a017',
    metalness: 0.9,
    roughness: 0.2,
    description: 'Polished gold rims for a premium arena look.',
    thumbnail: swatchThumbnail(['#facc15', '#a16207'])
  }),
  Object.freeze({
    id: 'aluminium',
    label: 'Aluminium Rings',
    color: '#b8c0c9',
    metalness: 0.78,
    roughness: 0.28,
    description: 'Brushed aluminium rims with a neutral industrial finish.',
    thumbnail: swatchThumbnail(['#d1d5db', '#6b7280'])
  }),
  Object.freeze({
    id: 'plasticBlack',
    label: 'Plastic Black Rings',
    color: '#111827',
    metalness: 0.08,
    roughness: 0.52,
    description: 'Matte black polymer rims for a stealth style.',
    thumbnail: swatchThumbnail(['#1f2937', '#030712'])
  }),
  Object.freeze({
    id: 'plasticWhite',
    label: 'Plastic White Rings',
    color: '#f3f4f6',
    metalness: 0.04,
    roughness: 0.46,
    description: 'Clean white polymer rims with soft reflections.',
    thumbnail: swatchThumbnail(['#ffffff', '#d1d5db'])
  })
])

export const BADUK_BOARD_LAYOUTS = Object.freeze([
  { id: 'classic7x6', label: 'Classic 7×6', rows: 6, cols: 7 },
  { id: 'arena8x7', label: 'Arena 8×7', rows: 7, cols: 8 }
])


export const BADUK_BOARD_THEMES = Object.freeze([
  { id: 'classicKaya', label: 'Classic Kaya', thumbnail: '/assets/game-art/baduk-battle-royal/store/boards/classicKaya.svg', tint: '#e2ae68', grid: '#2a1709' },
  { id: 'midnightBamboo', label: 'Midnight Bamboo', thumbnail: '/assets/game-art/baduk-battle-royal/store/boards/midnightBamboo.svg', tint: '#a4773f', grid: '#201309' },
  { id: 'stoneTemple', label: 'Stone Temple', thumbnail: '/assets/game-art/baduk-battle-royal/store/boards/stoneTemple.svg', tint: '#c6b391', grid: '#2c2c2c' },
  { id: 'sakuraDawn', label: 'Sakura Dawn', thumbnail: '/assets/game-art/baduk-battle-royal/store/boards/sakuraDawn.svg', tint: '#d2a084', grid: '#4d2f2d' },
  { id: 'volcanicAsh', label: 'Volcanic Ash', thumbnail: '/assets/game-art/baduk-battle-royal/store/boards/volcanicAsh.svg', tint: '#8e765f', grid: '#1a1715' },
  { id: 'auroraMint', label: 'Aurora Mint', thumbnail: swatchThumbnail(['#4ade80', '#14532d']), tint: '#4ade80', grid: '#14532d' },
  { id: 'royalSapphire', label: 'Royal Sapphire', thumbnail: swatchThumbnail(['#3b82f6', '#0f172a']), tint: '#3b82f6', grid: '#0f172a' },
  { id: 'desertCopper', label: 'Desert Copper', thumbnail: swatchThumbnail(['#f59e0b', '#78350f']), tint: '#f59e0b', grid: '#78350f' },
  { id: 'violetNebula', label: 'Violet Nebula', thumbnail: swatchThumbnail(['#a855f7', '#312e81']), tint: '#a855f7', grid: '#312e81' },
  { id: 'iceSilver', label: 'Ice Silver', thumbnail: swatchThumbnail(['#cbd5e1', '#334155']), tint: '#cbd5e1', grid: '#334155' }
])

export const BADUK_STONE_STYLES = Object.freeze([
  { id: 'traditional', label: 'Traditional Shell & Slate', thumbnail: '/assets/game-art/baduk-battle-royal/store/stones/traditional.svg', black: '#0a0a0d', white: '#f8fafc', blackRoughness: 0.28, whiteRoughness: 0.2 },
  { id: 'jadeIvory', label: 'Jade & Ivory', thumbnail: '/assets/game-art/baduk-battle-royal/store/stones/jadeIvory.svg', black: '#0f3b2e', white: '#f8f3d8', blackRoughness: 0.22, whiteRoughness: 0.26 },
  { id: 'obsidianGold', label: 'Obsidian & Gold', thumbnail: '/assets/game-art/baduk-battle-royal/store/stones/obsidianGold.svg', black: '#050506', white: '#f7c24b', blackRoughness: 0.16, whiteRoughness: 0.24 },
  { id: 'coralSky', label: 'Coral & Sky', thumbnail: '/assets/game-art/baduk-battle-royal/store/stones/coralSky.svg', black: '#2463ad', white: '#ff8a6b', blackRoughness: 0.2, whiteRoughness: 0.28 },
  { id: 'monoInk', label: 'Mono Ink', thumbnail: '/assets/game-art/baduk-battle-royal/store/stones/monoInk.svg', black: '#151515', white: '#dbdbdb', blackRoughness: 0.24, whiteRoughness: 0.24 },
  { id: 'rubyPearl', label: 'Ruby & Pearl', thumbnail: swatchThumbnail(['#991b1b', '#fef2f2']), black: '#991b1b', white: '#fef2f2', blackRoughness: 0.22, whiteRoughness: 0.2 },
  { id: 'tealSand', label: 'Teal & Sand', thumbnail: swatchThumbnail(['#0f766e', '#fef3c7']), black: '#0f766e', white: '#fef3c7', blackRoughness: 0.24, whiteRoughness: 0.28 },
  { id: 'plasmaSun', label: 'Plasma & Sun', thumbnail: swatchThumbnail(['#7c3aed', '#facc15']), black: '#7c3aed', white: '#facc15', blackRoughness: 0.18, whiteRoughness: 0.24 },
  { id: 'graphiteRose', label: 'Graphite & Rose', thumbnail: swatchThumbnail(['#1f2937', '#f472b6']), black: '#1f2937', white: '#f472b6', blackRoughness: 0.26, whiteRoughness: 0.26 },
  { id: 'oceanFrost', label: 'Ocean & Frost', thumbnail: swatchThumbnail(['#0c4a6e', '#dbeafe']), black: '#0c4a6e', white: '#dbeafe', blackRoughness: 0.2, whiteRoughness: 0.2 }
])

export const BADUK_BATTLE_DEFAULT_UNLOCKS = Object.freeze({
  chairColor: [BADUK_CHAIR_OPTIONS[0]?.id],
  tables: [BADUK_TABLE_OPTIONS[0]?.id],
  tableFinish: [MURLAN_TABLE_FINISHES[0]?.id],
  boardFinish: [BADUK_BOARD_FINISH_OPTIONS[0]?.id],
  frameFinish: [BADUK_FRAME_FINISH_OPTIONS[0]?.id],
  ringMaterial: [BADUK_RING_MATERIAL_OPTIONS[0]?.id],
  boardTheme: [BADUK_BOARD_THEMES[0]?.id],
  boardLayout: [BADUK_BOARD_LAYOUTS[0]?.id],
  stoneStyle: [BADUK_STONE_STYLES[0]?.id],
  environmentHdri: [DEFAULT_HDRI_ID]
})

export const BADUK_BATTLE_OPTION_LABELS = Object.freeze({
  chairColor: Object.freeze(BADUK_CHAIR_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  tables: Object.freeze(BADUK_TABLE_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  tableFinish: Object.freeze(MURLAN_TABLE_FINISHES.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  boardFinish: Object.freeze(BADUK_BOARD_FINISH_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  frameFinish: Object.freeze(BADUK_FRAME_FINISH_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  ringMaterial: Object.freeze(BADUK_RING_MATERIAL_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  boardTheme: Object.freeze(BADUK_BOARD_THEMES.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  boardLayout: Object.freeze(BADUK_BOARD_LAYOUTS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  stoneStyle: Object.freeze(BADUK_STONE_STYLES.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  environmentHdri: Object.freeze(POOL_ROYALE_HDRI_VARIANTS.reduce((acc, variant) => ({ ...acc, [variant.id]: `${variant.name} HDRI` }), {}))
})

export const BADUK_BATTLE_DEFAULT_LOADOUT = BADUK_BATTLE_DEFAULT_UNLOCKS

export const BADUK_BATTLE_STORE_ITEMS = [
  ...MURLAN_TABLE_FINISHES.map((finish, idx) => ({
    id: `baduk-table-finish-${finish.id}`,
    type: 'tableFinish',
    optionId: finish.id,
    name: finish.label,
    price: finish.price ?? 960 + idx * 40,
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
    price: theme.price ?? 960 + idx * 40,
    description: theme.description || `${theme.label} table with preserved Poly Haven materials.`,
    thumbnail: theme.thumbnail,
    previewShape: 'table'
  })),
  ...BADUK_CHAIR_OPTIONS.slice(1).map((option, idx) => ({
    id: `baduk-chair-${option.id}`,
    type: 'chairColor',
    optionId: option.id,
    name: option.label,
    price: option.price ?? 320 + idx * 20,
    description: option.description || `${option.label} seating tuned for 4 in a Row.`,
    thumbnail: option.thumbnail,
    previewShape: 'chair'
  })),
  ...BADUK_BOARD_FINISH_OPTIONS.slice(1).map((finish, idx) => ({
    id: `baduk-board-finish-${finish.id}`,
    type: 'boardFinish',
    optionId: finish.id,
    name: `${finish.label} Board`,
    price: finish.price ?? 920 + idx * 40,
    description: `Board face texture aligned with Octagon table finish ${finish.label}.`,
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'board'
  })),
  ...BADUK_FRAME_FINISH_OPTIONS.slice(1).map((finish, idx) => ({
    id: `baduk-frame-finish-${finish.id}`,
    type: 'frameFinish',
    optionId: finish.id,
    name: `${finish.label} Frame`,
    price: (finish.price ?? 920 + idx * 40) + 20,
    description: `Frame texture aligned with Octagon table finish ${finish.label}.`,
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'board'
  })),
  ...BADUK_RING_MATERIAL_OPTIONS.slice(1).map((material, idx) => ({
    id: `baduk-ring-material-${material.id}`,
    type: 'ringMaterial',
    optionId: material.id,
    name: material.label,
    price: 520 + idx * 50,
    description: material.description,
    thumbnail: material.thumbnail,
    swatches: [material.color],
    previewShape: 'board'
  })),
  ...BADUK_BOARD_LAYOUTS.slice(1).map((layout, idx) => ({
    id: `baduk-layout-${layout.id}`,
    type: 'boardLayout',
    optionId: layout.id,
    name: layout.label,
    price: 680 + idx * 80,
    description: 'Expanded 4 in a Row board size unlock.',
    thumbnail: swatchThumbnail(['#0ea5e9', '#1e293b']),
    previewShape: 'board'
  })),
  ...BADUK_BOARD_THEMES.slice(1).map((theme, idx) => ({
    id: `baduk-board-${theme.id}`,
    type: 'boardTheme',
    optionId: theme.id,
    name: theme.label,
    price: 450 + idx * 30,
    description: 'Open-source goban texture variant with high-contrast line work.',
    thumbnail: theme.thumbnail,
    swatches: [theme.tint, theme.grid],
    previewShape: 'board'
  })),
  ...BADUK_STONE_STYLES.slice(1).map((style, idx) => ({
    id: `baduk-stones-${style.id}`,
    type: 'stoneStyle',
    optionId: style.id,
    name: style.label,
    price: 420 + idx * 35,
    description: 'Stone set inspired by free/open-source goban palettes.',
    thumbnail: style.thumbnail,
    swatches: [style.black, style.white],
    previewShape: 'piece'
  })),
  ...POOL_ROYALE_HDRI_VARIANTS.slice(1).map((variant, idx) => ({
    id: `baduk-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.name} HDRI`,
    price: 780 + idx * 60,
    description: `Arena lighting profile based on ${variant.name}.`,
    thumbnail: variant.thumbnail || swatchThumbnail(variant.swatches || ['#1f2937', '#0f172a'])
  }))
]
