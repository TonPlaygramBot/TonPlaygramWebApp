import { polyHavenThumb, swatchThumbnail } from './storeThumbnails.js';
import { POLY_HAVEN_CLOTHS } from '../utils/tableCustomizationOptions.js';

const normalizeHex = (value) => {
  if (typeof value === 'number') {
    return `#${value.toString(16).padStart(6, '0')}`;
  }
  return `${value || ''}`.startsWith('#') ? value : `#${value}`;
};

const clampChannel = (channel) => Math.max(0, Math.min(255, Math.round(channel)));

const tintHex = (hex, factor) => {
  const normalized = normalizeHex(hex).replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const target = factor >= 0 ? 255 : 0;
  const amount = Math.min(1, Math.abs(factor));
  const adjust = (channel) => clampChannel(channel + (target - channel) * amount);
  return `#${(adjust(r) << 16 | adjust(g) << 8 | adjust(b)).toString(16).padStart(6, '0')}`;
};

const buildSwatches = (baseHex) => [
  baseHex,
  tintHex(baseHex, 0.12),
  tintHex(baseHex, -0.12)
];

const buildClothOption = (cloth, index) => {
  const baseHex = normalizeHex(cloth.base);
  return {
    id: cloth.id,
    label: cloth.label,
    feltTop: tintHex(baseHex, 0.08),
    feltBottom: tintHex(baseHex, -0.12),
    emissive: tintHex(baseHex, -0.65),
    baseColor: baseHex,
    sourceId: cloth.id,
    swatches: buildSwatches(baseHex),
    thumbnail: polyHavenThumb(cloth.id),
    price: 640 + index * 20,
    description: `Poly Haven ${cloth.label.replace(' Cloth', '').trim()} texture with original scan pattern mapping.`
  };
};

export const MURLAN_TABLE_CLOTHS = Object.freeze(
  POLY_HAVEN_CLOTHS.map((cloth, index) => buildClothOption(cloth, index))
);

export const MURLAN_TABLE_CLOTH_THUMBNAILS = Object.freeze(
  MURLAN_TABLE_CLOTHS.reduce((acc, cloth) => {
    acc[cloth.id] = cloth.thumbnail ?? swatchThumbnail(cloth.swatches);
    return acc;
  }, {})
);
