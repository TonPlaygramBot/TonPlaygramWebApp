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
    greens: ['#6b8c4b', '#5f7c3d', '#749a55', '#85aa61', '#56723a'],
    blues: ['#6a7592', '#7c86a2', '#59647c', '#7081a0', '#8b98b3']
  },
  {
    prefix: 'curlyTeddyNatural',
    label: 'Curly Teddy Natural',
    sourceId: 'curly_teddy_natural',
    basePrice: 700,
    priceStep: 10,
    bluePremium: 20,
    sparkle: 1.16,
    stray: 1.14,
    detail: {
      bumpMultiplier: 1.16,
      sheen: 0.72,
      sheenRoughness: 0.44,
      emissiveIntensity: 0.36,
      envMapIntensity: 0.22
    },
    greens: ['#74c18a', '#68b47e', '#7fcb99', '#8cd2a5', '#61a870'],
    blues: ['#7da6cf', '#6f98c3', '#8ab4da', '#99c0e2', '#658db2']
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
    greens: ['#7fcf95', '#72c487', '#8ed9a8', '#9ae1b3', '#68b37a'],
    blues: ['#7faadf', '#709ed5', '#8ab7e9', '#99c3f0', '#6289bd']
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
    greens: ['#6eaf73', '#63a567', '#7bb984', '#88c290', '#569658'],
    blues: ['#6f8fb4', '#6484a8', '#7b9bc0', '#89a7cc', '#557296']
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
