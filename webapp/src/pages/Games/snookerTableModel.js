export const TABLE_MODEL_CLASSIC = 'classic';
export const TABLE_MODEL_OPENSOURCE = 'opensource';
export const TABLE_MODEL_OPENSOURCE_GLB_URL =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/snooker_generic/snooker_generic.glb';

export const OFFICIAL_SNOOKER_SPEC = Object.freeze({
  // WPBSA full-size snooker playing area: 11 ft 8.5 in x 5 ft 10 in.
  playfieldWidthMm: 3569,
  playfieldHeightMm: 1778,
  ballDiameterMm: 52.5,
  ballDiameterToleranceMm: 0.05,
  baulkLineFromBaulkCushionMm: 737,
  dRadiusMm: 292,
  pinkSpotFromTopCushionMm: 737,
  blackSpotFromTopCushionMm: 324,
  cornerPocketMouthMm: 83,
  sidePocketMouthMm: 87
});


const MIN_GLB_FIT_SIZE = 0.0001;

function safePositiveDimension(value, fallback = MIN_GLB_FIT_SIZE) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > MIN_GLB_FIT_SIZE ? numeric : fallback;
}

export function resolveSnookerGlbFitTransform(sourceSize = {}, targetSize = {}, options = {}) {
  const sourceX = safePositiveDimension(sourceSize.x);
  const sourceY = safePositiveDimension(sourceSize.y);
  const sourceZ = safePositiveDimension(sourceSize.z);
  const targetX = safePositiveDimension(targetSize.x);
  const targetY = safePositiveDimension(targetSize.y);
  const targetZ = safePositiveDimension(targetSize.z);
  const rawScale = {
    x: targetX / sourceX,
    y: targetY / sourceY,
    z: targetZ / sourceZ
  };

  if (!options?.preserveOriginalHorizontalShape) {
    return { scale: rawScale, rawScale };
  }

  const longScale = Math.max(targetX, targetZ) / Math.max(sourceX, sourceZ);
  const shortScale = Math.min(targetX, targetZ) / Math.min(sourceX, sourceZ);
  const horizontalScale = options.fitMode === 'contain'
    ? Math.min(longScale, shortScale)
    : longScale;

  return {
    scale: {
      x: horizontalScale,
      y: options.preserveVerticalFromHorizontal === false ? rawScale.y : horizontalScale,
      z: horizontalScale
    },
    rawScale,
    horizontalScale,
    preservesOriginalHorizontalShape: true,
    fitMode: options.fitMode || 'long-edge'
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
