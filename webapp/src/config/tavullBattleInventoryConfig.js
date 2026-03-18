import { MURLAN_TABLE_FINISHES } from './murlanTableFinishes.js'
import { BADUK_RING_FINISH_OPTIONS } from './badukBattleInventoryConfig.js'
import {
  CHESS_BATTLE_OPTION_LABELS,
  CHESS_BATTLE_OPTION_THUMBNAILS
} from './chessBattleInventoryConfig.js'

export const TAVULL_BOARD_FINISH_OPTIONS = Object.freeze([...MURLAN_TABLE_FINISHES])

const RING_FRAME_OPTIONS = BADUK_RING_FINISH_OPTIONS.map((ring) => ({
  id: `ringFrame-${ring.id}`,
  label: `${ring.label} Frame`,
  thumbnail: ring.thumbnail,
  ringOption: ring,
  description: `${ring.label} metal/plastic finish for the board frame.`
}))

export const TAVULL_BOARD_FRAME_FINISH_OPTIONS = Object.freeze([
  ...MURLAN_TABLE_FINISHES,
  ...RING_FRAME_OPTIONS
])

const PIECE_IDS = [
  'marble',
  'darkForest',
  'amberGlow',
  'mintVale',
  'royalWave',
  'roseMist',
  'amethyst',
  'cinderBlaze',
  'arcticDrift',
  'obsidianGold',
  'coralBloom',
  'neonPulse'
]

export const TAVULL_PIECE_STYLE_OPTIONS = Object.freeze(
  PIECE_IDS.map((id) => ({
    id,
    label: CHESS_BATTLE_OPTION_LABELS.sideColor[id] || id,
    thumbnail: CHESS_BATTLE_OPTION_THUMBNAILS.sideColor[id]
  }))
)

export const TAVULL_BATTLE_DEFAULT_UNLOCKS = Object.freeze({
  boardFinish: [TAVULL_BOARD_FINISH_OPTIONS[0]?.id],
  boardFrameFinish: [TAVULL_BOARD_FRAME_FINISH_OPTIONS[0]?.id],
  p1PieceStyle: ['amberGlow'],
  p2PieceStyle: ['mintVale']
})

export const TAVULL_BATTLE_OPTION_LABELS = Object.freeze({
  boardFinish: Object.freeze(TAVULL_BOARD_FINISH_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  boardFrameFinish: Object.freeze(TAVULL_BOARD_FRAME_FINISH_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  p1PieceStyle: Object.freeze(TAVULL_PIECE_STYLE_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {})),
  p2PieceStyle: Object.freeze(TAVULL_PIECE_STYLE_OPTIONS.reduce((acc, option) => ({ ...acc, [option.id]: option.label }), {}))
})

export const TAVULL_TYPE_LABELS = Object.freeze({
  boardFinish: 'Board Texture',
  boardFrameFinish: 'Board Frame',
  p1PieceStyle: 'P1 Pieces',
  p2PieceStyle: 'P2 Pieces'
})

export const TAVULL_BATTLE_STORE_ITEMS = [
  ...TAVULL_BOARD_FINISH_OPTIONS.slice(1).map((finish, idx) => ({
    id: `tavull-board-finish-${finish.id}`,
    type: 'boardFinish',
    optionId: finish.id,
    name: `${finish.label} Board`,
    price: finish.price ?? 560 + idx * 35,
    description: `${finish.label} octa-table texture for the backgammon board lanes and triangles.`,
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'board'
  })),
  ...TAVULL_BOARD_FRAME_FINISH_OPTIONS.slice(1).map((finish, idx) => ({
    id: `tavull-board-frame-${finish.id}`,
    type: 'boardFrameFinish',
    optionId: finish.id,
    name: `${finish.label} Frame`,
    price: (finish.price ?? 760) + idx * 30,
    description: `Apply ${finish.label} texture/finish on the board frame separately from the board texture.`,
    swatches: finish.swatches,
    thumbnail: finish.thumbnail,
    previewShape: 'board'
  })),
  ...TAVULL_PIECE_STYLE_OPTIONS.slice(1).map((style, idx) => ({
    id: `tavull-p1-piece-${style.id}`,
    type: 'p1PieceStyle',
    optionId: style.id,
    name: `P1 ${style.label}`,
    price: 420 + idx * 25,
    description: `Player 1 checker texture set: ${style.label}.`,
    thumbnail: style.thumbnail,
    previewShape: 'piece'
  })),
  ...TAVULL_PIECE_STYLE_OPTIONS.slice(1).map((style, idx) => ({
    id: `tavull-p2-piece-${style.id}`,
    type: 'p2PieceStyle',
    optionId: style.id,
    name: `P2 ${style.label}`,
    price: 420 + idx * 25,
    description: `Player 2 checker texture set: ${style.label}.`,
    thumbnail: style.thumbnail,
    previewShape: 'piece'
  }))
]
