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
    label: 'Showood 7 ft GLB',
    description: 'Open-source Pooltool seven-foot table with original GLB textures.',
    tableSizeId: '9ft',
    assetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood_pbr.glb`,
    fallbackAssetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`,
    icon: '🟫',
    kind: 'gltf',
    fitScale: 1.08,
    footprintScale: 1.08,
    matchNativeHeight: true
  },
  {
    id: 'pooltool-null-pbr',
    label: 'Pooltool PBR GLB',
    description: 'Pooltool PBR pool table normalized to Pool Royale proportions.',
    tableSizeId: '9ft',
    assetUrl: `${POOLTOOL_RAW_BASE}/null/null_pbr.glb`,
    fallbackAssetUrl: `${POOLTOOL_RAW_BASE}/null/null.glb`,
    icon: '🟩',
    kind: 'gltf',
    fitScale: 1.08,
    footprintScale: 1.08,
    matchNativeHeight: true
  },
  {
    id: 'snooker-generic',
    label: 'Snooker GLB',
    description: 'Open-source snooker-style table fitted to the 9 ft Pool Royale arena.',
    tableSizeId: '9ft',
    assetUrl: `${POOLTOOL_RAW_BASE}/snooker_generic/snooker_generic.glb`,
    icon: '🟦',
    kind: 'gltf',
    fitScale: 1.1,
    footprintScale: 1.1,
    matchNativeHeight: true
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
