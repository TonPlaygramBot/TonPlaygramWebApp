export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel'

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'classic-procedural',
    label: 'Classic Procedural 7 ft',
    description:
      'Default procedural seven-foot Pool Royale table layout for lobby and match start.',
    tableSizeId: '7ft',
    icon: '🧩',
    kind: 'procedural',
    baseId: 'openPortal'
  }
])

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
    (option) => option.id === 'classic-procedural'
  )?.id || POOL_ROYALE_TABLE_MODEL_OPTIONS[0].id

export function resolvePoolRoyaleTableModel (modelId) {
  const key = typeof modelId === 'string' ? modelId.trim() : ''
  return (
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find((option) => option.id === key) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === DEFAULT_POOL_ROYALE_TABLE_MODEL_ID
    ) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS[0]
  )
}
