const BASE_TABLE_SCALE = 1.44;
const BASE_TABLE_MOBILE_SCALE = 1.44;
const BASE_TABLE_COMPACT_SCALE = 1.44;
const BASE_PLAYFIELD_WIDTH_MM = 2540; // WPA 9 ft playing surface width (100")

const TABLE_PHYSICAL_SPECS = Object.freeze({
  '9ft': {
    id: '9ft',
    label: '9 ft Pro',
    playfield: Object.freeze({ widthMm: 2540, heightMm: 1270 }), // 100" × 50"
    ballDiameterMm: 57.15,
    pocketMouthMm: Object.freeze({
      corner: 114.3,
      side: 127
    }),
    cushionCutAngleDeg: 32,
    cushionPocketAnglesDeg: Object.freeze({ corner: 142, side: 104 }),
    componentPreset: 'snooker'
  },
  '8ft': {
    id: '8ft',
    label: '8 ft',
    playfield: Object.freeze({ widthMm: 2235, heightMm: 1118 }), // 88" × 44"
    ballDiameterMm: 57.15,
    pocketMouthMm: Object.freeze({
      corner: 171.45,
      side: 152.4
    }),
    cushionCutAngleDeg: 32,
    cushionPocketAnglesDeg: Object.freeze({ corner: 142, side: 104 }),
    componentPreset: 'pool'
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

export const DEFAULT_TABLE_SIZE_ID = '9ft';

export function resolveTableSize(sizeId) {
  const key = typeof sizeId === 'string' ? sizeId.toLowerCase() : '';
  return TABLE_SIZE_OPTIONS[key] || TABLE_SIZE_OPTIONS[DEFAULT_TABLE_SIZE_ID];
}

export const TABLE_SIZE_LIST = Object.freeze(
  Object.values(TABLE_SIZE_OPTIONS).map(({ id, label }) => ({ id, label }))
);
