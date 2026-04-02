import { TABLE_CLOTH_OPTIONS } from '../utils/tableCustomizationOptions.js';
import { swatchThumbnail } from './storeThumbnails.js';

const toSwatches = (cloth) => {
  const palette = [cloth?.feltTop, cloth?.feltBottom, cloth?.emissive].filter(
    (value) => typeof value === 'string' && value.length
  );
  return palette.length ? palette : ['#1f7a4a', '#0f4f2d', '#062d18'];
};

export const MURLAN_TABLE_CLOTHS = Object.freeze(
  TABLE_CLOTH_OPTIONS.map((cloth, index) => {
    const swatches = toSwatches(cloth);
    return Object.freeze({
      ...cloth,
      baseColor: cloth.baseColor || swatches[0],
      sourceId: cloth.sourceId || cloth.id,
      swatches,
      price: cloth.price ?? 640 + index * 20,
      description:
        cloth.description ||
        `Shared Texas Hold'em cloth preset: ${cloth.label}.`
    });
  })
);

export const MURLAN_TABLE_CLOTH_THUMBNAILS = Object.freeze(
  MURLAN_TABLE_CLOTHS.reduce((acc, cloth) => {
    acc[cloth.id] = cloth.thumbnail ?? swatchThumbnail(cloth.swatches);
    return acc;
  }, {})
);
