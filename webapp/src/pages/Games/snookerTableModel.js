export const SNOOKER_TABLE_MODEL_CLASSIC = 'classic';
export const SNOOKER_TABLE_MODEL_OPENSOURCE = 'opensource';

export function normalizeSnookerTableModel(value) {
  const requested = String(value || '').toLowerCase();
  return requested === SNOOKER_TABLE_MODEL_OPENSOURCE
    ? SNOOKER_TABLE_MODEL_OPENSOURCE
    : SNOOKER_TABLE_MODEL_CLASSIC;
}

export function setSnookerTableModelParam(params, tableModel) {
  const normalized = normalizeSnookerTableModel(tableModel);
  params.set('tableModel', normalized);
  return normalized;
}
