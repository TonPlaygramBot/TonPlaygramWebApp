export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'classic',
    label: 'Classic Royal',
    description: 'Current Pool Royale table with built-in finish and base options.',
    tableSizeId: '9ft',
    isBuiltIn: true,
    accent: 'from-emerald-400/30 via-sky-500/10 to-transparent',
    fallbackIcon: '🎱'
  },
  {
    id: 'seven-foot-showood',
    label: '7 Foot ShoWood',
    description: 'Pooltool seven-foot GLB table with original mapped textures.',
    tableSizeId: '7ft',
    gltfUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`,
    accent: 'from-amber-400/30 via-orange-500/10 to-transparent',
    fallbackIcon: '🪵'
  },
  {
    id: 'seven-foot-showood-pbr',
    label: '7 Foot PBR',
    description: 'Pooltool seven-foot PBR GLB table using its original texture channels.',
    tableSizeId: '7ft',
    gltfUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood_pbr.glb`,
    accent: 'from-yellow-300/30 via-stone-500/10 to-transparent',
    fallbackIcon: '✨'
  },
  {
    id: 'snooker-generic',
    label: 'Snooker Generic',
    description: 'Pooltool snooker table GLB fitted to Pool Royale gameplay physics.',
    tableSizeId: '9ft',
    gltfUrl: `${POOLTOOL_RAW_BASE}/snooker_generic/snooker_generic.glb`,
    accent: 'from-lime-400/25 via-emerald-600/10 to-transparent',
    fallbackIcon: '🟩'
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
