const BASE_TABLE_SCALE = 1.44;
const BASE_TABLE_MOBILE_SCALE = 1.44;
const BASE_TABLE_COMPACT_SCALE = 1.44;
const BASE_PLAYFIELD_WIDTH_MM = 3569; // 12 ft snooker playing surface width

const TABLE_PHYSICAL_SPECS = Object.freeze({
  '8ft': {
    id: '8ft',
    label: 'Snooker Clone',
    playfield: Object.freeze({ widthMm: 3569, heightMm: 1778 }),
    ballDiameterMm: 52.5,
    pocketMouthMm: Object.freeze({
      corner: 89,
      side: 109
    }),
    cushionCutAngleDeg: 29,
    cushionPocketAnglesDeg: Object.freeze({ corner: 142, side: 104 })
  }
});

function deriveScale(playfieldWidthMm, baseScale = BASE_TABLE_SCALE) {
  if (!Number.isFinite(playfieldWidthMm) || playfieldWidthMm <= 0) {
    return baseScale;
  }
  return baseScale * (playfieldWidthMm / BASE_PLAYFIELD_WIDTH_MM);
}

function deriveMobileScale(baseScale, mobileScale = BASE_TABLE_MOBILE_SCALE) {
  const scaled = baseScale * 1.02;
  const clampTarget = Math.max(baseScale, mobileScale);
  return Math.min(clampTarget, scaled);
}

function deriveCompactScale(baseScale, compactScale = BASE_TABLE_COMPACT_SCALE) {
  const scaled = baseScale * 0.94;
  return Math.max(1.1, Math.min(compactScale, scaled));
}

export const TABLE_SIZE_OPTIONS = Object.freeze(
  Object.keys(TABLE_PHYSICAL_SPECS).reduce((acc, key) => {
    const spec = TABLE_PHYSICAL_SPECS[key];
    const overrides = spec.scaleOverrides || {};
    const baseScale =
      overrides.scale ?? deriveScale(spec.playfield.widthMm);
    const mobileScale =
      overrides.mobileScale ?? deriveMobileScale(baseScale);
    const compactScale =
      overrides.compactScale ?? deriveCompactScale(baseScale);
    acc[key] = Object.freeze({
      ...spec,
      scale: Number(baseScale.toFixed(3)),
      mobileScale: Number(mobileScale.toFixed(3)),
      compactScale: Number(compactScale.toFixed(3))
    });
    return acc;
  }, {})
);

export const DEFAULT_TABLE_SIZE_ID = '8ft';

export function resolveTableSize(sizeId) {
  const key = typeof sizeId === 'string' ? sizeId.toLowerCase() : '';
  return TABLE_SIZE_OPTIONS[key] || TABLE_SIZE_OPTIONS[DEFAULT_TABLE_SIZE_ID];
}

export const TABLE_SIZE_LIST = Object.freeze(
  Object.values(TABLE_SIZE_OPTIONS).map(({ id, label }) => ({ id, label }))
);
