export const TABLE_MODEL_CLASSIC = 'classic';
export const TABLE_MODEL_OPENSOURCE = 'opensource';
const POOLTOOL_TABLE_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

export const TABLE_MODEL_OPENSOURCE_GLB_URL =
  `${POOLTOOL_TABLE_RAW_BASE}/seven_foot_showood/seven_foot_showood_pbr.glb`;
export const TABLE_MODEL_OPENSOURCE_FALLBACK_GLB_URL =
  `${POOLTOOL_TABLE_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`;

export function resolveSnookerTableModel(value) {
  const requested = String(value || '').toLowerCase();
  return requested === TABLE_MODEL_OPENSOURCE || requested === 'showood'
    ? TABLE_MODEL_OPENSOURCE
    : TABLE_MODEL_CLASSIC;
}

export function applySnookerTableModelParam(params, tableModel) {
  const resolved = resolveSnookerTableModel(tableModel);
  params.set('tableModel', resolved);
  return resolved;
}
