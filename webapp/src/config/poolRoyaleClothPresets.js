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
    greens: ['#4f7b38', '#466f30', '#5d8f45', '#6a9a4f', '#3e6531'],
    blues: ['#4f6f96', '#597aa3', '#435c82', '#5878a0', '#6b87ad']
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
    greens: ['#5da87b', '#519d70', '#6bb487', '#77bd93', '#4b8d66'],
    blues: ['#5d8fb8', '#5283ac', '#6ea0c8', '#7aaad1', '#4b739c']
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
    greens: ['#5fab7a', '#539f6d', '#6ab888', '#74c192', '#4a8a64'],
    blues: ['#5d97c6', '#528bbc', '#689ed5', '#73a8dd', '#4877a4']
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
    greens: ['#5b9c64', '#509159', '#66aa74', '#72b37f', '#45864c'],
    blues: ['#597fa6', '#4f739a', '#658ab3', '#7096bd', '#466785']
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
