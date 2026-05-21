export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'showood-seven-foot-procedural',
    label: 'Showood 7ft (Procedural Materials)',
    description:
      'Uses the Showood 7ft GLTF table shape and remaps Pool Royale procedural material selections onto the mapped table parts. If GLTF loading fails, fallback stays procedural.',
    tableSizeId: '7ft',
    icon: '🪵',
    kind: 'gltf',
    assetUrl:
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb',
    fallbackAssetUrl:
      'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb',
    fitStrategy: 'showoodPreview',
    fitReference: 'upperTabletop',
    fitScale: 1,
    fitFootprintScale: 1,
    fitHeightScale: 1,
    usePoolRoyaleFinish: true,
    useOriginalLayoutSurfaces: true,
    preserveOriginalSurfaceRoles: ['cloth', 'cushion', 'wood', 'trim', 'pocket'],
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'wood', 'trim', 'pocket'],
    clothRepeatScale: 1,
    playfieldVisualLift: 0,
    matchNativeUpperComponentHeight: true,
    matchNativeHeight: false,
    preserveOriginalFootprintAspect: true,
    lowerBaseHeightScale: 1,
    legLengthScale: 1,
    verticalOffset: 0
  },
  {
    id: 'showood-seven-foot-gltf',
    label: 'Showood 7ft (Original GLTF Materials)',
    description:
      'Uses the Showood 7ft GLTF table with original embedded GLTF textures/materials. If GLTF loading fails, fallback stays procedural.',
    tableSizeId: '7ft',
    icon: '🧩',
    kind: 'gltf',
    assetUrl:
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb',
    fallbackAssetUrl:
      'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb',
    fitStrategy: 'showoodPreview',
    fitReference: 'upperTabletop',
    fitScale: 1,
    fitFootprintScale: 1,
    fitHeightScale: 1,
    usePoolRoyaleFinish: false,
    useOriginalLayoutSurfaces: true,
    preserveOriginalSurfaceRoles: ['cloth', 'cushion', 'wood', 'trim', 'pocket'],
    clothRepeatScale: 1,
    playfieldVisualLift: 0,
    matchNativeUpperComponentHeight: true,
    matchNativeHeight: false,
    preserveOriginalFootprintAspect: true,
    lowerBaseHeightScale: 1,
    legLengthScale: 1,
    verticalOffset: 0
  }
]);

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
    (option) => option.id === 'showood-seven-foot-procedural'
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
