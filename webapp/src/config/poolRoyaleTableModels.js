const TABLE_MODELS = [
  {
    id: 'standard',
    label: 'Actual Table',
    description: 'Use the current Pool Royale table build.',
    baseVariantId: 'classicCylinders'
  },
  {
    id: 'blenderkit',
    label: 'BlenderKit Table',
    description: 'Pool table model sourced from BlenderKit.',
    baseVariantId: 'blenderkitPoolTable',
    assetBaseId: '30785e01-959c-47a0-8491-9471dd926581'
  }
];

export const POOL_ROYALE_TABLE_MODELS = Object.freeze(TABLE_MODELS);
export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID = 'standard';

export function resolvePoolRoyaleTableModel(modelId) {
  if (!modelId) return POOL_ROYALE_TABLE_MODELS[0];
  const match = POOL_ROYALE_TABLE_MODELS.find((model) => model.id === modelId);
  return match || POOL_ROYALE_TABLE_MODELS[0];
}
