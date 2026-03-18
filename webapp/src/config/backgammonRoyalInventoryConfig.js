import { MURLAN_TABLE_FINISHES } from './murlanTableFinishes.js'
import {
  CHESS_BATTLE_OPTION_LABELS,
  CHESS_BATTLE_OPTION_THUMBNAILS
} from './chessBattleInventoryConfig.js'
import { BADUK_RING_FINISH_OPTIONS } from './badukBattleInventoryConfig.js'

export const BACKGAMMON_BOARD_TEXTURE_OPTIONS = Object.freeze([...MURLAN_TABLE_FINISHES])

export const BACKGAMMON_FRAME_FINISH_OPTIONS = Object.freeze([...BADUK_RING_FINISH_OPTIONS])

const PIECE_STYLE_COLOR_MAP = Object.freeze({
  marble: '#e5e7eb',
  darkForest: '#14532d',
  amberGlow: '#f59e0b',
  mintVale: '#10b981',
  royalWave: '#2563eb',
  roseMist: '#f472b6',
  amethyst: '#9333ea',
  cinderBlaze: '#f97316',
  arcticDrift: '#60a5fa',
  obsidianGold: '#fbbf24',
  coralBloom: '#fb7185',
  neonPulse: '#a3e635'
})

export const BACKGAMMON_PIECE_STYLE_OPTIONS = Object.freeze(
  Object.entries(CHESS_BATTLE_OPTION_LABELS.sideColor).map(([id, label]) => ({
    id,
    label,
    color: PIECE_STYLE_COLOR_MAP[id] || '#f8fafc',
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor[id]
  }))
)

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
