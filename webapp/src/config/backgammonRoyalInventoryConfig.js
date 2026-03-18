import { MURLAN_TABLE_FINISHES } from './murlanTableFinishes.js'
import { swatchThumbnail } from './storeThumbnails.js'

export const BACKGAMMON_BOARD_TEXTURE_OPTIONS = Object.freeze([...MURLAN_TABLE_FINISHES])

export const BACKGAMMON_FRAME_FINISH_OPTIONS = Object.freeze([
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

export const BACKGAMMON_PIECE_STYLE_OPTIONS = Object.freeze([
  { id: 'marble', label: 'Marble', color: '#e5e7eb', thumbnail: swatchThumbnail(['#f8fafc', '#9ca3af']) },
  { id: 'darkForest', label: 'Dark Forest', color: '#14532d', thumbnail: swatchThumbnail(['#14532d', '#4ade80']) },
  { id: 'amberGlow', label: 'Amber Glow', color: '#f59e0b', thumbnail: swatchThumbnail(['#f59e0b', '#78350f']) },
  { id: 'mintVale', label: 'Mint Vale', color: '#10b981', thumbnail: swatchThumbnail(['#10b981', '#064e3b']) },
  { id: 'royalWave', label: 'Royal Wave', color: '#2563eb', thumbnail: swatchThumbnail(['#2563eb', '#1e3a8a']) },
  { id: 'roseMist', label: 'Rose Mist', color: '#f472b6', thumbnail: swatchThumbnail(['#f472b6', '#9d174d']) },
  { id: 'amethyst', label: 'Amethyst', color: '#9333ea', thumbnail: swatchThumbnail(['#9333ea', '#4c1d95']) },
  { id: 'cinderBlaze', label: 'Cinder Blaze', color: '#f97316', thumbnail: swatchThumbnail(['#f97316', '#7c2d12']) },
  { id: 'arcticDrift', label: 'Arctic Drift', color: '#60a5fa', thumbnail: swatchThumbnail(['#60a5fa', '#0c4a6e']) },
  { id: 'obsidianGold', label: 'Obsidian Gold', color: '#fbbf24', thumbnail: swatchThumbnail(['#111827', '#fbbf24']) },
  { id: 'coralBloom', label: 'Coral Bloom', color: '#fb7185', thumbnail: swatchThumbnail(['#fb7185', '#0ea5e9']) },
  { id: 'neonPulse', label: 'Neon Pulse', color: '#a3e635', thumbnail: swatchThumbnail(['#a3e635', '#312e81']) }
])

export const BACKGAMMON_PIECE_STYLE_MAP = Object.freeze(
  BACKGAMMON_PIECE_STYLE_OPTIONS.reduce((acc, option) => {
    acc[option.id] = option
    return acc
  }, {})
)

export const BACKGAMMON_ROYAL_OPTION_LABELS = Object.freeze({
  boardFinish: Object.freeze(
    BACKGAMMON_BOARD_TEXTURE_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label
      return acc
    }, {})
  ),
  boardFrameFinish: Object.freeze(
    BACKGAMMON_FRAME_FINISH_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label
      return acc
    }, {})
  ),
  playerOnePieceStyle: Object.freeze(
    BACKGAMMON_PIECE_STYLE_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label
      return acc
    }, {})
  ),
  playerTwoPieceStyle: Object.freeze(
    BACKGAMMON_PIECE_STYLE_OPTIONS.reduce((acc, option) => {
      acc[option.id] = option.label
      return acc
    }, {})
  )
})

export const BACKGAMMON_ROYAL_DEFAULT_UNLOCKS = Object.freeze({
  boardFinish: [BACKGAMMON_BOARD_TEXTURE_OPTIONS[0]?.id],
  boardFrameFinish: [BACKGAMMON_FRAME_FINISH_OPTIONS[0]?.id],
  playerOnePieceStyle: ['amberGlow'],
  playerTwoPieceStyle: ['mintVale']
})

export const BACKGAMMON_ROYAL_STORE_ITEMS = Object.freeze([
  ...BACKGAMMON_BOARD_TEXTURE_OPTIONS.map((option, idx) => ({
    id: `tavull-board-texture-${option.id}`,
    type: 'boardFinish',
    optionId: option.id,
    name: `${option.label} Board`,
    price: option.price ?? 980 + idx * 40,
    description: `Apply ${option.label} octagon-table texture to the backgammon board lanes and triangles.`,
    thumbnail: option.thumbnail,
    swatches: option.swatches,
    previewShape: 'board'
  })),
  ...BACKGAMMON_FRAME_FINISH_OPTIONS.map((option, idx) => ({
    id: `tavull-board-frame-${option.id}`,
    type: 'boardFrameFinish',
    optionId: option.id,
    name: `${option.label} Frame`,
    price: option.price ?? 420 + idx * 40,
    description: `Set board frame and center bar finish to ${option.label}.`,
    thumbnail: option.thumbnail,
    swatches: [option.color],
    previewShape: 'frame'
  })),
  ...BACKGAMMON_PIECE_STYLE_OPTIONS.map((option, idx) => ({
    id: `tavull-p1-piece-${option.id}`,
    type: 'playerOnePieceStyle',
    optionId: option.id,
    name: `${option.label} P1 Pieces`,
    price: 460 + idx * 10,
    description: `Use ${option.label} texture set for Player 1 checkers.`,
    thumbnail: option.thumbnail,
    previewShape: 'piece'
  })),
  ...BACKGAMMON_PIECE_STYLE_OPTIONS.map((option, idx) => ({
    id: `tavull-p2-piece-${option.id}`,
    type: 'playerTwoPieceStyle',
    optionId: option.id,
    name: `${option.label} P2 Pieces`,
    price: 460 + idx * 10,
    description: `Use ${option.label} texture set for Player 2 checkers.`,
    thumbnail: option.thumbnail,
    previewShape: 'piece'
  }))
])
