export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'traditional-fizyman-eight-foot',
    label: 'Traditional 8 ft glTF',
    description:
      "Traditional billiard table option inspired by fizyman's Sketchfab Pool Table Traditional model, installed from Sketchfab as a local glTF so Pool Royale loads the authentic original shape, UV mapping, and baked texture set without committing binary assets.",
    tableSizeId: '8ft',
    baseId: 'mahogany',
    assetUrl: '/models/pool-royale/pool-table-traditional-fizyman/scene.gltf',
    installScript: 'npm run fetch:pool-royale-traditional-table',
    sourceUid: 'e0b938c0c2e74eb794a49ebde2543977',
    sourceFormat: 'sketchfab-original-gltf',
    requiresInstall: true,
    installCheck: 'gltf-json',
    sourceUrl:
      'https://sketchfab.com/3d-models/pool-table-traditional-e0b938c0c2e74eb794a49ebde2543977',
    author: 'fizyman',
    license: 'CC Attribution 4.0',
    thumbnailUrl:
      'https://media.sketchfab.com/models/e0b938c0c2e74eb794a49ebde2543977/thumbnails/ca60f8c0ed984d21b89ee7a298d60650/b857e58f5e2746339b725c6b40b5b08a.jpeg',
    icon: '🎱',
    kind: 'gltf',
    assetFormat: 'glTF',
    fitScale: 1,
    fitFootprintScale: 1,
    fitHeightScale: 1,
    clothRepeatScale: 6.5,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeHeight: true,
    matchNativeUpperComponentHeight: false,
    preserveOriginalFootprintAspect: false,
    useOriginalLayoutSurfaces: true,
    usePoolRoyaleFinish: true,
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'wood', 'pocket'],
    preserveOriginalSurfaceRoles: ['railSight'],
    tintOriginalTrimGold: true,
    chromeMaterialSurfaceNames: ['brass', 'diamond', 'railSight'],
    blackMaterialSurfaceNames: ['pocket', 'net'],
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: []
  },
  {
    id: 'showood-seven-foot',
    label: 'Showood 7 ft GLB',
    description:
      'Open-source Pooltool Showood showroom table matched to Pool Royale footprint. If the CDN GLB cannot load, Pool Royale retries the raw Showood GLB and keeps the Showood original base selection.',
    tableSizeId: '7ft',
    baseId: 'showoodOriginal',
    assetUrl:
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb',
    fallbackAssetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`,
    icon: '🟫',
    kind: 'gltf',
    fitScale: 1,
    fitFootprintScale: 1.075,
    fitHeightScale: 1,
    lowerBaseHeightScale: 1.08,
    legLengthScale: 0.96,
    clothRepeatScale: 7.5,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeHeight: true,
    matchNativeUpperComponentHeight: true,
    preserveOriginalFootprintAspect: false,
    useOriginalLayoutSurfaces: true,
    usePoolRoyaleFinish: true,
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'wood', 'pocket', 'trim'],
    preserveOriginalSurfaceRoles: [],
    tintOriginalTrimGold: true,
    chromeMaterialSurfaceNames: ['diamonds', 'railSight'],
    blackMaterialSurfaceNames: [],
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: []
  }
]);

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
    (option) => option.id === 'showood-seven-foot'
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
