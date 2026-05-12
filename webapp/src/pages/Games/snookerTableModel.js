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

export function usesProceduralSnookerTableRailDecor(tableModel) {
  return resolveSnookerTableModel(tableModel) === TABLE_MODEL_CLASSIC;
}

export function resolveSnookerCushionBoundaryPolyline(
  points = [],
  { horizontal = true, side = 1, binSize = 0.02, minPoints = 4 } = {}
) {
  const longKey = horizontal ? 'x' : 'z';
  const crossKey = horizontal ? 'z' : 'x';
  const normalizedSide = side >= 0 ? 1 : -1;
  const valid = points
    .map((point) => ({
      x: Number(point?.x),
      z: Number(point?.z)
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.z));

  if (valid.length < minPoints) return [];

  const minLong = Math.min(...valid.map((point) => point[longKey]));
  const maxLong = Math.max(...valid.map((point) => point[longKey]));
  const span = maxLong - minLong;
  if (!Number.isFinite(span) || span <= 0) return [];

  const resolvedBinSize =
    Number.isFinite(binSize) && binSize > 0
      ? Math.max(binSize, span / 240)
      : span / 160;
  const bins = new Map();

  valid.forEach((point) => {
    const bin = Math.round((point[longKey] - minLong) / resolvedBinSize);
    const current = bins.get(bin);
    const isBetter =
      !current ||
      (normalizedSide > 0
        ? point[crossKey] < current[crossKey]
        : point[crossKey] > current[crossKey]);
    if (isBetter) {
      bins.set(bin, point);
    }
  });

  const ordered = [...bins.values()].sort((a, b) => a[longKey] - b[longKey]);
  const deduped = [];
  ordered.forEach((point) => {
    const previous = deduped[deduped.length - 1];
    if (
      previous &&
      Math.hypot(previous.x - point.x, previous.z - point.z) < resolvedBinSize * 0.35
    ) {
      return;
    }
    deduped.push(point);
  });

  return deduped.length >= minPoints ? deduped : [];
}
