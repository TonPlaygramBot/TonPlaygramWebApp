export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'showood-seven-foot',
    label: 'Showood 7 ft GLB',
    description:
      'Open-source Pooltool Showood showroom table matched to Pool Royale footprint. If the GLB cannot load, Pool Royale uses the same procedural cloth/fallback materials without spawning extra decorative tables.',
    tableSizeId: '7ft',
    baseId: 'showoodOriginal',
    assetUrl:
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb',
    fallbackAssetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`,
    icon: '🟫',
    kind: 'gltf',
    fitScale: 1.02,
    fitFootprintScale: 1.075,
    lowerBaseHeightScale: 0.78,
    legLengthScale: 1.18,
    clothRepeatScale: 5.25,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeHeight: true,
    matchNativeUpperComponentHeight: true,
    preserveOriginalFootprintAspect: false,
    useOriginalLayoutSurfaces: true,
    usePoolRoyaleFinish: true,
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'wood', 'pocket'],
    preserveOriginalSurfaceRoles: ['trim'],
    tintOriginalTrimGold: true,
    chromeMaterialSurfaceNames: ['diamonds', 'railSight', 'sideWoodApron', 'bevel'],
    blackMaterialSurfaceNames: [],
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: []
  }
]);

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find((option) => option.id === 'showood-seven-foot')?.id ||
  POOL_ROYALE_TABLE_MODEL_OPTIONS[0].id;

export function resolvePoolRoyaleTableModel(modelId) {
  const key = typeof modelId === 'string' ? modelId.trim() : '';
  return (
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find((option) => option.id === key) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS[0]
  );
}
