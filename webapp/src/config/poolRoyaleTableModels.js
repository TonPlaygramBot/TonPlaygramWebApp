export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
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
