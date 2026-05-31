import { POOL_ROYALE_CLOTH_VARIANTS } from './poolRoyaleClothPresets.js'
import { polyHavenThumb } from './storeThumbnails.js'

export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel'

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table'

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'royal-original',
    label: 'Royal Original',
    description:
      'Current TonPlaygram rails, procedural cushions, base, chrome plates, and pocket jaws with the Showood GLB playfield overlaid.',
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
    usePoolRoyaleFinishRoles: ['cloth', 'pocket'],
    cushionUsesClothFinish: true,
    hideGeneratedCushionsAndJaws: false,
    keepGeneratedSurfaceRoles: ['cushion', 'pocketJaw', 'pocketRim'],
    preserveSourceTextureRoles: [],
    preserveOriginalSurfaceRoles: ['trim', 'wood'],
    hideSurfaceRoles: ['trim', 'wood', 'cushion'],
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
    lowerBaseHeightScale: 1.16,
    clothRepeatScale: 5.25,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeHeight: true,
    matchNativeUpperComponentHeight: true,
    useOriginalLayoutSurfaces: true,
    usePoolRoyaleFinish: true,
    useReferenceShowoodMapping: true,
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'wood', 'pocket', 'trim'],
    preserveSourceTextureRoles: ['cushion', 'topWoodRail', 'leg', 'baseCornerBlock', 'underside'],
    preserveOriginalSurfaceRoles: [],
    tintOriginalTrimGold: false,
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: []
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

export const POOL_ROYALE_SHOWOOD_MATERIAL_CONTROL_PARTS = Object.freeze([
  'cloth',
  'cushion',
  'topWoodRail',
  'legBase'
])

export const POOL_ROYALE_SHOWOOD_DEFAULT_PALETTE = Object.freeze({
  cloth: 'cabanGreenClassic',
  cushion: 'cabanGreenClassic',
  topWoodRail: 'peelingPaintWeathered',
  legBase: 'darkWood'
})

export const POOL_ROYALE_SHOWOOD_CONTROL_META = Object.freeze({
  cloth: { label: 'Field cloth', description: 'Uses every cloth-library texture on the flat playfield.' },
  cushion: {
    label: 'Cushions',
    description: 'Uses every cloth-library texture on the cushion rubber.'
  },
  topWoodRail: { label: 'Top rail frame', description: 'Uses every GLTF table-finish texture on the main top wood rail frame.' },
  legBase: { label: 'Legs + base', description: 'Uses every GLTF table-finish texture on the legs and lower base blocks only.' }
})

export const POOL_ROYALE_SHOWOOD_TABLE_FINISH_TEXTURE_OPTIONS = Object.freeze([
  { id: 'peelingPaintWeathered', label: 'Wood Peeling Paint Weathered', color: '#b8b3aa', thumbnail: polyHavenThumb('wood_peeling_paint_weathered') },
  { id: 'oakVeneer01', label: 'Oak Veneer 01', color: '#c89a64', thumbnail: polyHavenThumb('oak_veneer_01') },
  { id: 'woodTable001', label: 'Wood Table 001', color: '#a4724f', thumbnail: polyHavenThumb('wood_table_001') },
  { id: 'darkWood', label: 'Dark Wood', color: '#3d2f2a', thumbnail: polyHavenThumb('dark_wood') },
  { id: 'rosewoodVeneer01', label: 'Rosewood Veneer 01', color: '#6f3a2f', thumbnail: polyHavenThumb('rosewood_veneer_01') },
  { id: 'carbonFiberChalk', label: 'LT Black', color: '#2a313d', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberChalkGrey', label: 'LT Grey', color: '#c8d0da', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberChalkBeige', label: 'LT Dark Grey', color: '#727d8b', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberChalkDarkBlue', label: 'LT Burgundy', color: '#c17276', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberChalkWhite', label: 'LT Milk Cream', color: '#f8eedf', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberChalkDarkGreen', label: 'LT Dark Green', color: '#548460', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberChalkDarkYellow', label: 'LT Dark Yellow', color: '#d1a652', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberChalkDarkBrown', label: 'LT Dark Brown', color: '#956b4f', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberChalkDarkRed', label: 'LT Dark Red', color: '#aa5151', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberAlligatorOlive', label: 'LT Olive Fabric', color: '#556b3f', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberAlligatorSwamp', label: 'LT Swamp Fabric', color: '#3f5a3c', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberAlligatorClay', label: 'LT Clay Fabric', color: '#a06e55', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberAlligatorSand', label: 'LT Sand Fabric', color: '#c3ad83', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberAlligatorMoss', label: 'LT Moss Fabric', color: '#4d644b', thumbnail: polyHavenThumb('fabric_083') },
  { id: 'carbonFiberAlligatorNight', label: 'LT Night Fabric', color: '#1b222b', thumbnail: polyHavenThumb('fabric_083') }
])

export const POOL_ROYALE_SHOWOOD_CLOTH_TEXTURE_OPTIONS = Object.freeze(
  POOL_ROYALE_CLOTH_VARIANTS.map((variant) => ({
    id: variant.id,
    label: variant.name,
    color: variant.swatches?.[0] ?? `#${variant.baseColor.toString(16).padStart(6, '0')}`,
    thumbnail: variant.thumbnail
  }))
)

export const POOL_ROYALE_SHOWOOD_CONTROL_OPTIONS = Object.freeze({
  cloth: POOL_ROYALE_SHOWOOD_CLOTH_TEXTURE_OPTIONS,
  cushion: POOL_ROYALE_SHOWOOD_CLOTH_TEXTURE_OPTIONS,
  topWoodRail: POOL_ROYALE_SHOWOOD_TABLE_FINISH_TEXTURE_OPTIONS,
  legBase: POOL_ROYALE_SHOWOOD_TABLE_FINISH_TEXTURE_OPTIONS
})
