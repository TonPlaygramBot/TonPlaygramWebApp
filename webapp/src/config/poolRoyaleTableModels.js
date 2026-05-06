export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'royal-original',
    label: 'Royal Original',
    description: 'Current TonPlaygram table with existing gameplay geometry.',
    tableSizeId: '9ft',
    finishId: 'peelingPaintWeathered',
    baseId: 'classicCylinders',
    icon: '🎱',
    kind: 'native'
  },
  {
    id: 'showood-seven-foot',
    label: 'Showood GLB',
    description: 'Open-source Showood table fitted exactly to the Royal Original 9 ft footprint and skinned with Pool Royale table finishes.',
    tableSizeId: '9ft',
    assetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood_pbr.glb`,
    fallbackAssetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`,
    icon: '🟫',
    kind: 'gltf',
    fitScale: 1,
    fitStrategy: 'exact',
    usePoolRoyaleFinishMaterials: true
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
