const normalizeHex = (value) => {
  if (typeof value === 'number') {
    return `#${value.toString(16).padStart(6, '0')}`;
  }
  const str = `${value ?? ''}`.trim();
  if (!str) return '#000000';
  return str.startsWith('#') ? str : `#${str}`;
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const hexToRgb = (hex) => {
  const normalized = normalizeHex(hex).replace('#', '');
  const int = parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255
  };
};

const rgbToHex = (r, g, b) =>
  `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

export const mixHex = (a, b, factor = 0.5) => {
  const t = clamp01(factor);
  const start = hexToRgb(a);
  const end = hexToRgb(b);
  const lerp = (from, to) => Math.round(from + (to - from) * t);
  return rgbToHex(lerp(start.r, end.r), lerp(start.g, end.g), lerp(start.b, end.b));
};

export const lightenHex = (hex, factor = 0.2) => mixHex(hex, '#ffffff', factor);

export const POOL_ROYALE_CLOTH_TINTS = Object.freeze([
  Object.freeze({ id: 'green', label: 'Green Tint', hex: '#25d366' }),
  Object.freeze({ id: 'blue', label: 'Blue Tint', hex: '#2f80ff' })
]);

export const POOL_ROYALE_BASE_CLOTHS = Object.freeze([
  Object.freeze({ id: 'denim_fabric_03', label: 'Denim Fabric 03 Cloth', fallbackColor: 0x2b4a7a }),
  Object.freeze({ id: 'hessian_230', label: 'Hessian 230 Cloth', fallbackColor: 0x9b7a45 }),
  Object.freeze({ id: 'polar_fleece', label: 'Polar Fleece Cloth', fallbackColor: 0xd9d2c2 }),
  Object.freeze({ id: 'cotton_jersey', label: 'Cotton Jersey Cloth', fallbackColor: 0xb9a27d }),
  Object.freeze({ id: 'faux_fur_geometric', label: 'Faux Fur Geo Cloth', fallbackColor: 0xcaa0a8 }),
  Object.freeze({ id: 'jogging_melange', label: 'Jogging Mélange Cloth', fallbackColor: 0x7a7a7f }),
  Object.freeze({ id: 'knitted_fleece', label: 'Knitted Fleece Cloth', fallbackColor: 0x6e5a4a }),
  Object.freeze({ id: 'caban', label: 'Caban Wool Cloth', fallbackColor: 0xb56a2a }),
  Object.freeze({ id: 'curly_teddy_natural', label: 'Curly Teddy Natural Cloth', fallbackColor: 0xcdbfa9 }),
  Object.freeze({ id: 'curly_teddy_checkered', label: 'Curly Teddy Checkered Cloth', fallbackColor: 0x2f6a70 }),
  Object.freeze({ id: 'denim_fabric_04', label: 'Denim Fabric 04 Cloth', fallbackColor: 0x4a78a8 }),
  Object.freeze({ id: 'denim_fabric_05', label: 'Denim Fabric 05 Cloth', fallbackColor: 0x2c2f35 })
]);

export const buildPoolRoyalClothVariants = () =>
  POOL_ROYALE_BASE_CLOTHS.flatMap((cloth) =>
    POOL_ROYALE_CLOTH_TINTS.map((tint) => {
      const tintedHex = mixHex(cloth.fallbackColor, tint.hex, 0.35);
      return {
        id: `${cloth.id}-${tint.id}`,
        baseId: cloth.id,
        tintId: tint.id,
        label: `${cloth.label} (${tint.label})`,
        tintLabel: tint.label,
        baseHex: normalizeHex(cloth.fallbackColor),
        tintHex: tint.hex,
        tintedHex
      };
    })
  );

export const POOL_ROYALE_CLOTH_VARIANTS = Object.freeze(
  buildPoolRoyalClothVariants().map((variant) => Object.freeze(variant))
);
export const DEFAULT_POOL_ROYALE_CLOTH_ID = POOL_ROYALE_CLOTH_VARIANTS[0]?.id ?? 'denim_fabric_03-green';

export const POOL_ROYALE_CLOTH_SWATCHES = Object.freeze(
  POOL_ROYALE_CLOTH_VARIANTS.reduce((acc, variant) => {
    acc[variant.id] = [variant.tintedHex, lightenHex(variant.tintedHex, 0.22)];
    return acc;
  }, {})
);
