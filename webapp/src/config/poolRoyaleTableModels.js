export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';


export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'procedural-showood-hybrid',
    label: 'Procedural (Showood Shape)',
    description:
      'Fast native procedural Pool Royale table with restored procedural base variants, procedural-size pocket jaws/cushions, and Showood-matched jaw/cushion/wood-rail geometry profile.',
    tableSizeId: '7ft',
    baseId: 'classicCylinders',
    icon: '🧩',
    kind: 'procedural',
    fitScale: 1,
    fitFootprintScale: 1,
    fitHeightScale: 1,
    usePoolRoyaleFinish: true
  }
]);

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
    (option) => option.id === 'procedural-showood-hybrid'
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
