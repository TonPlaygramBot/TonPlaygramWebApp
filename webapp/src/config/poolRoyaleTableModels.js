export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'legacy-procedural',
    label: 'Pool Royal Legacy Procedural',
    description:
      'Original fully procedural Pool Royal table pipeline with native chrome plates, pocket field, cushions, branding plate, diamond markings, and pocket jaws.',
    tableSizeId: '7ft',
    baseId: 'classicCylinders',
    icon: '🎱',
    kind: 'procedural',
    fitScale: 1,
    fitFootprintScale: 1,
    fitHeightScale: 1,
    usePoolRoyaleFinish: true,
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'wood', 'pocket', 'trim']
  }
]);

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
    (option) => option.id === 'legacy-procedural'
  )?.id || POOL_ROYALE_TABLE_MODEL_OPTIONS[0].id;

export function resolvePoolRoyaleTableModel(modelId) {
  const key = typeof modelId === 'string' ? modelId.trim() : '';
  const normalizedKey =
    key === 'showood-seven-foot' || key === 'procedural-showood-hybrid'
      ? 'legacy-procedural'
      : key;
  return (
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find((option) => option.id === normalizedKey) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === DEFAULT_POOL_ROYALE_TABLE_MODEL_ID
    ) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS[0]
  );
}
