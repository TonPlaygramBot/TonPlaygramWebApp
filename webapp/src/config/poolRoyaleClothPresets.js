const normalizeHex = (value) => {
  const asString = typeof value === 'number' ? value.toString(16).padStart(6, '0') : String(value || '').replace('#', '');
  return `#${asString.slice(0, 6)}`;
};

const clampChannel = (channel) => Math.max(0, Math.min(255, Math.round(channel)));

const adjustHex = (hex, factor) => {
  const normalized = normalizeHex(hex).slice(1);
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const target = factor >= 0 ? 255 : 0;
  const amount = Math.min(1, Math.max(-1, factor));
  const delta = Math.abs(amount);
  const adjust = (channel) => clampChannel(channel + (target - channel) * delta);
  const next = (adjust(r) << 16) | (adjust(g) << 8) | adjust(b);
  return `#${next.toString(16).padStart(6, '0')}`;
};

const toNumber = (hex) => parseInt(normalizeHex(hex).slice(1), 16);

const buildPalette = (baseHex) => ({
  shadow: toNumber(adjustHex(baseHex, -0.22)),
  base: toNumber(baseHex),
  accent: toNumber(adjustHex(baseHex, 0.12)),
  highlight: toNumber(adjustHex(baseHex, 0.24))
});

const createSwatches = (baseHex) => [
  normalizeHex(baseHex),
  adjustHex(baseHex, 0.16),
  adjustHex(baseHex, 0.3)
];

const GREEN_SHADE_NAMES = ['Meadow', 'Spruce', 'Grove', 'Glade', 'Summit'];
const BLUE_SHADE_NAMES = ['Harbor', 'Fjord', 'Glacier', 'Sapphire', 'Midnight'];

const MATERIAL_SERIES = [
  {
    prefix: 'caban',
    label: 'Caban Wool',
    sourceId: 'caban',
    basePrice: 690,
    priceStep: 10,
    bluePremium: 20,
    sparkle: 1.08,
    stray: 1.06,
    detail: {
      bumpMultiplier: 1.22,
      sheen: 0.58,
      sheenRoughness: 0.46,
      emissiveIntensity: 0.24,
      envMapIntensity: 0.18
    },
    greens: ['#3f7f3a', '#357333', '#4a9446', '#58a250', '#2f6030'],
    blues: ['#566e8c', '#667e9c', '#4b5d78', '#5f7896', '#7688ad']
  },
  {
    prefix: 'polarFleece',
    label: 'Polar Fleece',
    sourceId: 'polar_fleece',
    basePrice: 640,
    priceStep: 10,
    bluePremium: 20,
    sparkle: 1.12,
    stray: 1.1,
    detail: {
      bumpMultiplier: 1.12,
      sheen: 0.7,
      sheenRoughness: 0.52,
      emissiveIntensity: 0.34,
      envMapIntensity: 0.14
    },
    greens: ['#69b980', '#5ead73', '#74c690', '#7fce99', '#4f9d62'],
    blues: ['#6d9ad0', '#608fc5', '#7aacdd', '#86b7e6', '#4e7ead']
  },
  {
    prefix: 'polarFleecePlush',
    label: 'Polar Fleece Plush',
    sourceId: 'polar_fleece',
    basePrice: 700,
    priceStep: 10,
    bluePremium: 20,
    sparkle: 1.14,
    stray: 1.12,
    detail: {
      bumpMultiplier: 1.14,
      sheen: 0.72,
      sheenRoughness: 0.5,
      emissiveIntensity: 0.36,
      envMapIntensity: 0.16
    },
    greens: ['#5fae77', '#54a36c', '#6bb885', '#78c291', '#489662'],
    blues: ['#6b99c4', '#5f8cba', '#79a6d1', '#88b4db', '#4c7ca3']
  },
  {
    prefix: 'cottonJersey',
    label: 'Cotton Jersey',
    sourceId: 'cotton_jersey',
    basePrice: 650,
    priceStep: 10,
    bluePremium: 20,
    sparkle: 1.08,
    stray: 1.06,
    detail: {
      bumpMultiplier: 1.18,
      sheen: 0.6,
      sheenRoughness: 0.48,
      emissiveIntensity: 0.28,
      envMapIntensity: 0.18
    },
    greens: ['#5a9b64', '#4f9158', '#67a971', '#73b37c', '#44804a'],
    blues: ['#6084ad', '#5579a1', '#6f92ba', '#7ca0c5', '#436a8c']
  }
];

const createVariantsForMaterial = (material) => {
  const buildTone = (toneKey, palette, shadeNames) =>
    palette.map((hex, index) => {
      const name = shadeNames[index] || `${toneKey}-${index + 1}`;
      const toneLabel = toneKey === 'green' ? 'Green' : 'Blue';
      const id = `${material.prefix}${toneLabel}${name}`;
      const price = material.basePrice + (toneKey === 'blue' ? material.bluePremium || 0 : 0) + material.priceStep * index;
      return {
        id,
        name: `${material.label} — ${toneLabel} ${name}`,
        sourceId: material.sourceId,
        tone: toneKey,
        baseColor: toNumber(hex),
        palette: buildPalette(hex),
        sparkle: material.sparkle,
        stray: material.stray,
        detail: material.detail,
        price,
        swatches: createSwatches(hex),
        description: `${material.label} cloth with a ${toneLabel.toLowerCase()} ${name.toLowerCase()} tint and detailed scan from ${material.sourceId}.`
      };
    });

  return [
    ...buildTone('green', material.greens, GREEN_SHADE_NAMES),
    ...buildTone('blue', material.blues, BLUE_SHADE_NAMES)
  ];
};

export const POOL_ROYALE_CLOTH_VARIANTS = Object.freeze(
  MATERIAL_SERIES.flatMap((material) => createVariantsForMaterial(material))
);
