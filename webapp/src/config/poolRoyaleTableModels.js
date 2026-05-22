export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

const SHOWOOD_LOCAL_ASSET_PATH = '/assets/models/pool/showood-seven-foot.glb';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'legacy-procedural',
    label: 'Legacy Procedural',
    description:
      'Original Pool Royale procedural table mapping with the legacy geometry/menu flow used before GLB-only mode.',
    tableSizeId: '7ft',
    baseId: 'legacyProcedural',
    icon: '🧩',
    kind: 'procedural'
  },
  {
    id: 'chinese-eightball-snooker',
    label: 'Chinese 8-Ball (9 ft Snooker)',
    description:
      'Uses the same 9 ft snooker GLB footprint but with Pool Royale 8-ball markings and gameplay mapping.',
    tableSizeId: '9ft',
    baseId: 'chineseEightBall',
    assetUrl: SHOWOOD_LOCAL_ASSET_PATH,
    fallbackAssetUrls: [
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb',
      `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`
    ],
    icon: '🐉',
    kind: 'gltf',
    fitScale: 1,
    fitFootprintScale: 1.105,
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
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'pocket', 'trim'],
    preserveOriginalSurfaceRoles: ['wood'],
    tintOriginalTrimGold: true,
    chromeMaterialSurfaceNames: ['diamonds', 'railSight', 'sideApron', 'sideWoodApron', 'apronStrip', 'railSightLower', 'cornerRailSight'],
    blackMaterialSurfaceNames: [],
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: []
  },
  {
    id: 'showood-seven-foot',
    label: 'Showood 7 ft GLB',
    description:
      'Open-source Pooltool Showood showroom table matched to Pool Royale footprint. If the CDN GLB cannot load, Pool Royale retries the raw Showood GLB and keeps the Showood original base and legs.',
    tableSizeId: '7ft',
    baseId: 'showoodOriginal',
    assetUrl: SHOWOOD_LOCAL_ASSET_PATH,
    fallbackAssetUrls: [
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb',
      `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`
    ],
    icon: '🟫',
    kind: 'gltf',
    fitScale: 1,
    fitFootprintScale: 1.105,
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
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'pocket', 'trim'],
    preserveOriginalSurfaceRoles: ['wood'],
    tintOriginalTrimGold: true,
    chromeMaterialSurfaceNames: ['diamonds', 'railSight', 'sideApron', 'sideWoodApron', 'apronStrip', 'railSightLower', 'cornerRailSight'],
    blackMaterialSurfaceNames: [],
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: []
  }
]);

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
    (option) => option.id === 'legacy-procedural'
  )?.id || POOL_ROYALE_TABLE_MODEL_OPTIONS[0].id;

export function resolvePoolRoyaleTableModel(modelId) {
  const key = typeof modelId === 'string' ? modelId.trim() : '';
  return (
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find((option) => option.id === key) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === DEFAULT_POOL_ROYALE_TABLE_MODEL_ID
    ) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS[0]
  );
}
