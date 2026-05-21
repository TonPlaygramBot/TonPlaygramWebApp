export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'showood-seven-foot',
    label: 'Showood 7ft GLTF',
    description:
      'Loads the seven-foot Showood GLTF table and remaps Pool Royale cloth/wood/chrome menu finishes onto mapped parts. Falls back to the native procedural table if GLTF loading fails.',
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
    id: 'procedural-legacy',
    label: 'Pool Royale Legacy Procedural',
    description:
      'Original fully procedural Pool Royale table with native chrome plates, pocket field, cushions, branding plate, diamond markings, and procedural pocket jaws.',
    tableSizeId: '7ft',
    baseId: 'classicCylinders',
    icon: '🎱',
    kind: 'procedural',
    fitScale: 1,
    fitFootprintScale: 1,
    fitHeightScale: 1,
    usePoolRoyaleFinish: true
  }
]);

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
    (option) => option.id === 'procedural-legacy'
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
