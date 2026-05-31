import { POOL_ROYALE_CLOTH_VARIANTS } from './poolRoyaleClothPresets.js'
import { polyHavenThumb, swatchThumbnail } from './storeThumbnails.js'

export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel'

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table'

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'royal-original',
    label: 'Royal Original',
    description:
      'Current TonPlaygram procedural wooden rails, procedural cushions, base, chrome plates, pockets, and jaws with only the Showood GLB playfield cloth overlaid.',
    tableSizeId: '9ft',
    finishId: 'peelingPaintWeathered',
    baseId: 'classicCylinders',
    assetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`,
    fallbackAssetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood_pbr.glb`,
    icon: '🎱',
    kind: 'gltf',
    fitScale: 1.045,
    clothRepeatScale: 5.25,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeUpperComponentHeight: true,
    useOriginalLayoutSurfaces: false,
    usePoolRoyaleFinish: true,
    usePoolRoyaleFinishRoles: ['cloth'],
    cushionUsesClothFinish: false,
    hideGeneratedCushionsAndJaws: false,
    hideGeneratedPocketsAndJaws: false,
    keepGeneratedPocketsAndJaws: true,
    preserveSourceTextureRoles: [],
    preserveOriginalSurfaceRoles: ['trim', 'wood'],
    hideSurfaceRoles: ['trim', 'wood', 'cushion', 'pocket'],
    keepGeneratedShell: true,
    forceGeneratedChromePlates: true
  },
  {
    id: 'showood-seven-foot',
    label: 'Showood 7 ft GLB',
    description:
      'Open-source Pooltool Showood showroom table matched to Pool Royale footprint while keeping the original GLB layout for cloth, cushions, pockets, and preserved Showood chrome plates.',
    tableSizeId: '9ft',
    assetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`,
    fallbackAssetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood_pbr.glb`,
    icon: '🟫',
    kind: 'gltf',
    fitScale: 1.055,
    lowerBaseHeightScale: 1.28,
    topRailFrameHeightScale: 0.88,
    clothRepeatScale: 5.25,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeHeight: true,
    matchNativeUpperComponentHeight: true,
    useOriginalLayoutSurfaces: true,
    usePoolRoyaleFinish: true,
    useReferenceShowoodMapping: true,
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'wood'],
    preserveSourceTextureRoles: ['railSight', 'sideWoodApron', 'baseFoot', 'trim', 'pocket'],
    preserveOriginalSurfaceRoles: [],
    tintOriginalTrimGold: false,
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: [],
    hideGeneratedRailMarkers: true
  }
])

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find((option) => option.id === 'royal-original')?.id ||
  POOL_ROYALE_TABLE_MODEL_OPTIONS[0].id

export function resolvePoolRoyaleTableModel (modelId) {
  const key = typeof modelId === 'string' ? modelId.trim() : ''
  return (
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find((option) => option.id === key) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS[0]
  )
}

const SHOWOOD_TABLE_FINISH_TEXTURES = Object.freeze([
  { id: 'peelingPaintWeathered', label: 'Wood Peeling Paint Weathered', color: '#b8b3aa', textureId: 'wood_peeling_paint_weathered' },
  { id: 'oakVeneer01', label: 'Oak Veneer 01', color: '#c89a64', textureId: 'oak_veneer_01' },
  { id: 'woodTable001', label: 'Wood Table 001', color: '#a4724f', textureId: 'wood_table_001' },
  { id: 'darkWood', label: 'Dark Wood', color: '#3d2f2a', textureId: 'dark_wood' },
  { id: 'rosewoodVeneer01', label: 'Rosewood Veneer 01', color: '#6f3a2f', textureId: 'rosewood_veneer_01' },
  { id: 'carbonFiberChalk', label: 'LT Black', color: '#2a313d', textureId: 'fabric_083' },
  { id: 'carbonFiberChalkGrey', label: 'LT Grey', color: '#c8d0da', textureId: 'fabric_083' },
  { id: 'carbonFiberChalkBeige', label: 'LT Dark Grey', color: '#727d8b', textureId: 'fabric_083' },
  { id: 'carbonFiberChalkDarkBlue', label: 'LT Burgundy', color: '#c17276', textureId: 'fabric_083' },
  { id: 'carbonFiberChalkWhite', label: 'LT Milk Cream', color: '#f8eedf', textureId: 'fabric_083' },
  { id: 'carbonFiberChalkDarkGreen', label: 'LT Dark Green', color: '#548460', textureId: 'fabric_083' },
  { id: 'carbonFiberChalkDarkYellow', label: 'LT Dark Yellow', color: '#d1a652', textureId: 'fabric_083' },
  { id: 'carbonFiberChalkDarkBrown', label: 'LT Dark Brown', color: '#956b4f', textureId: 'fabric_083' },
  { id: 'carbonFiberChalkDarkRed', label: 'LT Dark Red', color: '#aa5151', textureId: 'fabric_083' },
  { id: 'carbonFiberAlligatorOlive', label: 'LT Olive Fabric', color: '#687047', textureId: 'fabric_083' },
  { id: 'carbonFiberAlligatorSwamp', label: 'LT Swamp Fabric', color: '#52623f', textureId: 'fabric_083' },
  { id: 'carbonFiberAlligatorClay', label: 'LT Clay Fabric', color: '#6f5b45', textureId: 'fabric_083' },
  { id: 'carbonFiberAlligatorSand', label: 'LT Sand Fabric', color: '#8a7b5e', textureId: 'fabric_083' },
  { id: 'carbonFiberAlligatorMoss', label: 'LT Moss Fabric', color: '#4f6048', textureId: 'fabric_083' },
  { id: 'carbonFiberAlligatorNight', label: 'LT Night Fabric', color: '#2f3c32', textureId: 'fabric_083' }
])

const buildShowoodFinishOptions = () =>
  Object.freeze(
    SHOWOOD_TABLE_FINISH_TEXTURES.reduce((acc, option) => {
      acc[option.id] = Object.freeze({
        ...option,
        finishId: option.id,
        thumbnail: option.textureId ? polyHavenThumb(option.textureId) : swatchThumbnail([option.color, '#ffffff'])
      })
      return acc
    }, {})
  )

const buildShowoodClothOptions = () =>
  Object.freeze(
    POOL_ROYALE_CLOTH_VARIANTS.reduce((acc, variant) => {
      const color = `#${variant.baseColor.toString(16).padStart(6, '0')}`
      acc[variant.id] = Object.freeze({
        label: variant.name,
        color,
        textureKey: variant.id,
        sourceId: variant.sourceId,
        thumbnail: variant.thumbnail,
        metalness: 0,
        roughness: 1,
        envMapIntensity: 0.16
      })
      return acc
    }, {})
  )

export const POOL_ROYALE_SHOWOOD_MATERIAL_CONTROL_PARTS = Object.freeze([
  'cloth',
  'cushion',
  'metalAccent',
  'pocketJaw',
  'topWoodRail',
  'legBase'
])

export const POOL_ROYALE_SHOWOOD_DEFAULT_PALETTE = Object.freeze({
  cloth: 'cabanGreenClassic',
  cushion: 'cabanGreenForest',
  metalAccent: 'gold',
  pocketJaw: 'plastic-black',
  topWoodRail: 'woodTable001',
  legBase: 'darkWood'
})

export const POOL_ROYALE_SHOWOOD_CONTROL_META = Object.freeze({
  cloth: { label: 'Field cloth', description: 'All cloth-library textures for only the flat playfield surface.' },
  cushion: {
    label: 'Cushions',
    description: 'All cloth-library textures for the cushion faces, separate from the field.'
  },
  metalAccent: {
    label: 'Rail sights + apron + feet + rims',
    description: 'Gold, chrome, or black for Showood rail sights, side apron, feet, and Rooney/corner rims.'
  },
  pocketJaw: { label: 'Pockets + jaws', description: 'Uses the same pocket-jaw texture options as the main game menu.' },
  topWoodRail: { label: 'Top rail frame', description: 'All GLTF table-finish textures for the main top wood rail frame.' },
  legBase: { label: 'Legs + base', description: 'All GLTF table-finish textures for legs and lower base blocks only.' }
})

const SHOWOOD_CLOTH_OPTIONS = buildShowoodClothOptions()
const SHOWOOD_FINISH_OPTIONS = buildShowoodFinishOptions()
const SHOWOOD_METAL_ACCENT_OPTIONS = Object.freeze({
  gold: Object.freeze({ label: 'Gold', color: '#d4af37', metalAccentId: 'gold' }),
  chrome: Object.freeze({ label: 'Chrome', color: '#d6d8dc', metalAccentId: 'chrome' }),
  black: Object.freeze({ label: 'Black', color: '#050505', metalAccentId: 'black' })
})
const SHOWOOD_POCKET_JAW_OPTIONS = Object.freeze({
  'plastic-black': Object.freeze({ label: 'Plastic Black Jaws', color: '#151515', pocketLinerId: 'plastic-black' }),
  'plastic-dark-grey': Object.freeze({ label: 'Plastic Dark Grey Jaws', color: '#2c2f33', pocketLinerId: 'plastic-dark-grey' }),
  'plastic-grey': Object.freeze({ label: 'Plastic Grey Jaws', color: '#5b5f64', pocketLinerId: 'plastic-grey' }),
  'plastic-light-grey': Object.freeze({ label: 'Plastic Light Grey Jaws', color: '#b8bcc2', pocketLinerId: 'plastic-light-grey' }),
  'plastic-magnolia': Object.freeze({ label: 'Plastic Magnolia Jaws', color: '#f4f0e6', pocketLinerId: 'plastic-magnolia' }),
  'brown-showood': Object.freeze({ label: 'Brown Showood Jaws', color: '#2a1207', pocketLinerId: 'brown-showood' })
})

export const POOL_ROYALE_SHOWOOD_CONTROL_OPTIONS = Object.freeze({
  cloth: SHOWOOD_CLOTH_OPTIONS,
  cushion: SHOWOOD_CLOTH_OPTIONS,
  metalAccent: SHOWOOD_METAL_ACCENT_OPTIONS,
  pocketJaw: SHOWOOD_POCKET_JAW_OPTIONS,
  topWoodRail: SHOWOOD_FINISH_OPTIONS,
  legBase: SHOWOOD_FINISH_OPTIONS
})
