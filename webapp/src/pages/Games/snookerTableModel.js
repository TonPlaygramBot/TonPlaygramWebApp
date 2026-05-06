export const TABLE_MODEL_CLASSIC = 'classic';
export const TABLE_MODEL_OPENSOURCE = 'opensource';
export const TABLE_MODEL_OPENSOURCE_GLB_URL =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/snooker_generic/snooker_generic.glb';


const MIN_GLB_FIT_SIZE = 0.0001;

function safePositiveDimension(value, fallback = MIN_GLB_FIT_SIZE) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > MIN_GLB_FIT_SIZE ? numeric : fallback;
}

export function resolveSnookerGlbFitTransform(sourceSize = {}, targetSize = {}) {
  const sourceX = safePositiveDimension(sourceSize.x);
  const sourceY = safePositiveDimension(sourceSize.y);
  const sourceZ = safePositiveDimension(sourceSize.z);
  return {
    scale: {
      x: safePositiveDimension(targetSize.x) / sourceX,
      y: safePositiveDimension(targetSize.y) / sourceY,
      z: safePositiveDimension(targetSize.z) / sourceZ
    }
  };
}

export function resolveSnookerTableModel(value) {
  const requested = String(value || '').toLowerCase();
  return requested === TABLE_MODEL_CLASSIC ? TABLE_MODEL_CLASSIC : TABLE_MODEL_OPENSOURCE;
}

export function applySnookerTableModelParam(params, tableModel) {
  const resolved = resolveSnookerTableModel(tableModel);
  params.set('tableModel', resolved);
  return resolved;
}
