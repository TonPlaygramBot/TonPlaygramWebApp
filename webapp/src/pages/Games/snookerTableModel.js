export const TABLE_MODEL_CLASSIC = 'classic';
export const TABLE_MODEL_OPENSOURCE = 'opensource';
export const TABLE_MODEL_OPENSOURCE_GLB_URL =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/snooker_generic/snooker_generic.glb';

export const SNOOKER_GLB_PHYSICAL_TABLE_MAP = Object.freeze({
  playfieldWidthM: 1.778,
  playfieldLengthM: 3.569,
  ballDiameterM: 0.0525,
  baulkLineFromCushionM: 0.737,
  dRadiusM: 0.292,
  blackFromTopCushionM: 0.324,
  cornerPocketMouthM: 0.086,
  middlePocketMouthM: 0.095,
  // The Pooltool snooker GLBs are authored around the cushion-nose playfield.
  // Keep physics, pockets, spots, and the GLB fit on that same physical bed rather
  // than expanding the collision map to the decorative wooden cabinet.
  visualPlayfieldFitMultiplier: 1,
  cornerJawSetbackRatio: 0.72,
  middleJawSetbackRatio: 0.68,
  pocketMouthCaptureBallRatio: 0.56,
  pocketMouthRailClearanceBallRatio: 0.92,
  outerSafetyBallRatio: 0.18
});

export function resolveSnookerPhysicalTableMap(scale = 1) {
  const safeScale = safePositiveDimension(scale, 1);
  const map = SNOOKER_GLB_PHYSICAL_TABLE_MAP;
  const tableW = map.playfieldWidthM * safeScale;
  const tableL = map.playfieldLengthM * safeScale;
  const ballR = (map.ballDiameterM * safeScale) / 2;
  const cornerPocketRadius = (map.cornerPocketMouthM * safeScale) / 2;
  const middlePocketRadius = (map.middlePocketMouthM * safeScale) / 2;
  return Object.freeze({
    tableW,
    tableL,
    ballR,
    baulkLineFromCushion: map.baulkLineFromCushionM * safeScale,
    dRadius: map.dRadiusM * safeScale,
    blackFromTopCushion: map.blackFromTopCushionM * safeScale,
    cornerPocketRadius,
    middlePocketRadius,
    cornerJawSetback: cornerPocketRadius * map.cornerJawSetbackRatio,
    middleJawSetback: middlePocketRadius * map.middleJawSetbackRatio,
    visualPlayfieldFitMultiplier: map.visualPlayfieldFitMultiplier,
    pocketMouthCaptureBallRatio: map.pocketMouthCaptureBallRatio,
    pocketMouthRailClearanceBallRatio: map.pocketMouthRailClearanceBallRatio,
    outerSafetyBallRatio: map.outerSafetyBallRatio
  });
}

export function resolveSnookerPhysicalPocketMap(tableW, tableL, cornerJawSetback, middleJawSetback, cornerPocketRadius, middlePocketRadius) {
  const halfW = safePositiveDimension(tableW) / 2;
  const halfL = safePositiveDimension(tableL) / 2;
  return Object.freeze([
    Object.freeze({ x: -halfW + cornerJawSetback, z: -halfL + cornerJawSetback, radius: cornerPocketRadius, kind: 'corner' }),
    Object.freeze({ x: halfW - cornerJawSetback, z: -halfL + cornerJawSetback, radius: cornerPocketRadius, kind: 'corner' }),
    Object.freeze({ x: -halfW + cornerJawSetback, z: halfL - cornerJawSetback, radius: cornerPocketRadius, kind: 'corner' }),
    Object.freeze({ x: halfW - cornerJawSetback, z: halfL - cornerJawSetback, radius: cornerPocketRadius, kind: 'corner' }),
    Object.freeze({ x: -halfW + middleJawSetback, z: 0, radius: middlePocketRadius, kind: 'middle' }),
    Object.freeze({ x: halfW - middleJawSetback, z: 0, radius: middlePocketRadius, kind: 'middle' })
  ]);
}

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
