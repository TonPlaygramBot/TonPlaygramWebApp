const BASE_TABLE_SCALE = 1.6;
const BASE_PLAYFIELD_WIDTH_MM = 3569; // 12 ft tournament spec width (140.5")

const TABLE_SPECS = Object.freeze({
  '10ft': {
    id: '10ft',
    label: '10 ft',
    playfield: Object.freeze({ widthMm: 3050, heightMm: 1525 }), // classic 10×5 ft
    ballDiameterMm: 52.5,
    pocketMouthMm: Object.freeze({
      corner: 86,
      side: 94
    }),
    note: 'Trimmed club cut using Pool Royale chrome + cushions'
  },
  '12ft': {
    id: '12ft',
    label: '12 ft (Pro)',
    playfield: Object.freeze({ widthMm: 3569, heightMm: 1778 }), // 12×6 ft championship
    ballDiameterMm: 52.5,
    pocketMouthMm: Object.freeze({
      corner: 86,
      side: 94
    }),
    note: 'Full-size cloth layout with official D and baulk line'
  }
});

function deriveScale(playfieldWidthMm) {
  if (!Number.isFinite(playfieldWidthMm) || playfieldWidthMm <= 0) {
    return BASE_TABLE_SCALE;
  }
  const scaled = BASE_TABLE_SCALE * (playfieldWidthMm / BASE_PLAYFIELD_WIDTH_MM);
  return Number(Math.max(1.2, scaled).toFixed(3));
}

export const TABLE_SIZE_OPTIONS = Object.freeze(
  Object.keys(TABLE_SPECS).reduce((acc, key) => {
    const spec = TABLE_SPECS[key];
    acc[key] = Object.freeze({
      ...spec,
      scale: deriveScale(spec.playfield.widthMm),
      mobileScale: deriveScale(spec.playfield.widthMm) * 1.05,
      compactScale: deriveScale(spec.playfield.widthMm) * 0.94
    });
    return acc;
  }, {})
);

export const DEFAULT_TABLE_SIZE_ID = '12ft';

export function resolveSnookerTable(sizeId) {
  const key = typeof sizeId === 'string' ? sizeId.toLowerCase() : '';
  return TABLE_SIZE_OPTIONS[key] || TABLE_SIZE_OPTIONS[DEFAULT_TABLE_SIZE_ID];
}

export const TABLE_SIZE_LIST = Object.freeze(
  Object.values(TABLE_SIZE_OPTIONS).map(({ id, label }) => ({ id, label }))
);
