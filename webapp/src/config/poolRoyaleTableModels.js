export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'showood-seven-foot',
    label: 'Royal Original / Showood Surface Hybrid',
    description:
      'Pool Royale keeps the Royal Original wooden rails, base, chrome plates, and decorative shell while using the Showood GLB field, cushion, jaw, and pocket layout.',
    tableSizeId: '9ft',
    assetUrl: '/models/pool-royale/showood-seven-foot/seven_foot_showood.glb',
    fallbackAssetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`,
    fallbackAssetUrls: Object.freeze([
      `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`,
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb'
    ]),
    icon: '🎱',
    kind: 'gltf',
    fitScale: 1,
    fitFootprintScale: 1,
    preserveOriginalFootprintAspect: true,
    lowerBaseHeightScale: 1.38,
    legLengthScale: 2.05,
    clothRepeatScale: 7.5,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeHeight: true,
    matchNativeUpperComponentHeight: true,
    useOriginalLayoutSurfaces: true,
    usePoolRoyaleFinish: true,
    // Only the Showood playfield/cushion/jaw/pocket geometry is shown; the native Royal shell stays visible.
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'pocket'],
    preserveOriginalSurfaceRoles: [],
    hideSurfaceRoles: ['wood', 'trim'],
    preserveGeneratedTableShell: true,
    tintOriginalTrimGold: true,
    chromeMaterialSurfaceNames: [
      'diamonds',
      'railSight',
      'sideApron',
      'apronStrip',
      'railSightLower',
      'cornerRailSight'
    ],
    blackMaterialSurfaceNames: [],
    forceGeneratedChromePlates: false,
    fitHeightScale: 1,
    useShowoodReferenceMaterialMapping: true
  }
]);

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS[0].id;

export function resolvePoolRoyaleTableModel(modelId) {
  const key = typeof modelId === 'string' ? modelId.trim() : '';
  return (
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find((option) => option.id === key) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS[0]
  );
}
