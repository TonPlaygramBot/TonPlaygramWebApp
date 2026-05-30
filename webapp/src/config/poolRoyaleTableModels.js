export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel'

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table'

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'royal-local',
    label: 'Pool Royal local table',
    description:
      'Fast built-in Pool Royal table rendered from local Three.js geometry so matches start instantly without downloading a remote GLB.',
    tableSizeId: '7ft',
    baseId: 'showoodOriginal',
    icon: '🎱',
    kind: 'native'
  },
  {
    id: 'showood-seven-foot',
    label: 'Showood 7 ft GLB',
    description:
      'Open-source Pooltool Showood showroom table enlarged to match Pool Royale mapping. If the CDN GLB cannot load, Pool Royale retries the raw Showood GLB and keeps the Showood original base and legs.',
    tableSizeId: '7ft',
    baseId: 'showoodOriginal',
    assetUrl:
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb',
    fallbackAssetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`,
    icon: '🟫',
    kind: 'gltf',
    fitScale: 1.12,
    fitFootprintScale: 1.12,
    fitHeightScale: 1,
    lowerBaseHeightScale: 1.38,
    legLengthScale: 2.05,
    clothRepeatScale: 7.5,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeHeight: true,
    matchNativeUpperComponentHeight: true,
    preserveOriginalFootprintAspect: true,
    useOriginalLayoutSurfaces: true,
    usePoolRoyaleFinish: true,
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'wood', 'pocket', 'trim'],
    preserveOriginalSurfaceRoles: [],
    tintOriginalTrimGold: true,
    chromeMaterialSurfaceNames: ['diamonds', 'railSight', 'sideApron', 'apronStrip', 'railSightLower', 'cornerRailSight'],
    blackMaterialSurfaceNames: [],
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: []
  }
])

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
    (option) => option.id === 'royal-local'
  )?.id || POOL_ROYALE_TABLE_MODEL_OPTIONS[0].id

export function resolvePoolRoyaleTableModel (modelId) {
  const key = typeof modelId === 'string' ? modelId.trim() : ''
  return (
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find((option) => option.id === key) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === DEFAULT_POOL_ROYALE_TABLE_MODEL_ID
    ) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS[0]
  )
}
