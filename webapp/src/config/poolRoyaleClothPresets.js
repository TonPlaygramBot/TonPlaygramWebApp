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

const CABAN_GREEN_SWATCHES = Object.freeze(['#33b46a', '#2ca85f', '#42c47a', '#4fd184', '#238f4a']);
const CABAN_OCEAN_BLUE_SWATCHES = Object.freeze([
  '#118fd6',
  '#0e83c9',
  '#1ca7f0',
  '#29b8ff',
  '#0b74b3'
]);

const GREEN_SHADE_NAMES = ['Meadow', 'Spruce', 'Grove', 'Glade', 'Summit'];
const BLUE_SHADE_NAMES = ['Harbor', 'Fjord', 'Glacier', 'Sapphire', 'Midnight'];
const NATURE_SHADE_NAMES = ['Fern', 'Grove', 'Canopy', 'Meadow', 'Wildwood'];
const OCEAN_SHADE_NAMES = ['Crest', 'Current', 'Lagoon', 'Reef', 'Abyss'];

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
    greens: CABAN_GREEN_SWATCHES,
    blues: CABAN_OCEAN_BLUE_SWATCHES
  },
  {
    prefix: 'polarFleece',
    label: 'Polar Fleece',
    sourceId: 'caban',
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
    greens: CABAN_GREEN_SWATCHES,
    blues: CABAN_OCEAN_BLUE_SWATCHES
  },
  {
    prefix: 'polarFleecePlush',
    label: 'Polar Fleece Plush',
    sourceId: 'caban',
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
    greens: CABAN_GREEN_SWATCHES,
    blues: CABAN_OCEAN_BLUE_SWATCHES
  },
  {
    prefix: 'polarFleeceNatureOcean',
    label: 'Polar Fleece Nature & Ocean',
    sourceId: 'caban',
    basePrice: 660,
    priceStep: 10,
    bluePremium: 20,
    sparkle: 1.1,
    stray: 1.08,
    detail: {
      bumpMultiplier: 1.16,
      sheen: 0.68,
      sheenRoughness: 0.5,
      emissiveIntensity: 0.34,
      envMapIntensity: 0.15
    },
    greens: CABAN_GREEN_SWATCHES,
    blues: CABAN_OCEAN_BLUE_SWATCHES,
    greenShadeNames: NATURE_SHADE_NAMES,
    blueShadeNames: OCEAN_SHADE_NAMES
  }
];

const createVariantsForMaterial = (material) => {
  const buildTone = (toneKey, palette) =>
    palette.map((hex, index) => {
      const shadeNames =
        toneKey === 'green'
          ? material.greenShadeNames || GREEN_SHADE_NAMES
          : material.blueShadeNames || BLUE_SHADE_NAMES;
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
    ...buildTone('green', material.greens),
    ...buildTone('blue', material.blues)
  ];
};

export const POOL_ROYALE_CLOTH_VARIANTS = Object.freeze(
  MATERIAL_SERIES.flatMap((material) => createVariantsForMaterial(material))
);
