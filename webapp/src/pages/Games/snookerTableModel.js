export const TABLE_MODEL_CLASSIC = 'classic';
export const TABLE_MODEL_OPENSOURCE = 'opensource';

export function resolveSnookerTableModel(value) {
  const requested = String(value || '').toLowerCase();
  return requested === TABLE_MODEL_OPENSOURCE ? TABLE_MODEL_OPENSOURCE : TABLE_MODEL_CLASSIC;
}

export function applySnookerTableModelParam(params, tableModel) {
  const resolved = resolveSnookerTableModel(tableModel);
  params.set('tableModel', resolved);
  return resolved;
}
