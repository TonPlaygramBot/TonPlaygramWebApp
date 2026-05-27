export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'royal-procedural',
    label: 'Pool Royale Procedural',
    description:
      'Classic procedural Pool Royale table with generated chrome plates and configurable table bases (same style family used in Air Hockey).',
    tableSizeId: '7ft',
    baseId: 'classicCylinders',
    icon: '🟦',
    kind: 'procedural'
  }
]);

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
    (option) => option.id === 'royal-procedural'
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
