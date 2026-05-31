const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table'

const SHOWOOD_LOCAL_ASSET_URL =
  '/models/pool-royale/showood-seven-foot/seven_foot_showood.glb'
const SHOWOOD_CDN_ASSET_URL =
  'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb'

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'showood-seven-foot',
    label: 'Showood 7 ft GLB',
    description:
      'Fixed Pooltool Showood 7 ft GLB table mapped exactly to the 78" × 39" Pool Royale playfield. Install the GLB at the local URL outside git; CDN/raw URLs remain runtime fallbacks only.',
    tableSizeId: '7ft',
    baseId: 'showoodOriginal',
    assetUrl: SHOWOOD_LOCAL_ASSET_URL,
    fallbackAssetUrls: Object.freeze([
      SHOWOOD_CDN_ASSET_URL,
      `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`
    ]),
    fallbackAssetUrl: SHOWOOD_CDN_ASSET_URL,
    icon: '🟫',
    kind: 'gltf',
    fitScale: 1,
    fitFootprintScale: 1.04,
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

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID = 'showood-seven-foot'

export function resolvePoolRoyaleTableModel (modelId) {
  const key = typeof modelId === 'string' ? modelId.trim() : ''
  return (
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find((option) => option.id === key) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS[0]
  )
}
