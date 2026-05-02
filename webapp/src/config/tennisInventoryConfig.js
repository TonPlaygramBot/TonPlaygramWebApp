import { polyHavenThumb } from './storeThumbnails.js';
import { POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';

const reduceLabels = (items) => items.reduce((acc, option) => { acc[option.id] = option.label; return acc; }, {});

export const TENNIS_HDRI_OPTIONS = Object.freeze(
  POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
    id: variant.id,
    name: variant.name,
    label: `${variant.name} HDRI`,
    assetId: variant.assetId,
    price: Number(variant.price || 0),
    thumbnail: variant.thumbnail || polyHavenThumb(variant.assetId),
    type: 'environmentHdri'
  }))
);

export const TENNIS_DEFAULT_LOADOUT = Object.freeze({ environmentHdri: [TENNIS_HDRI_OPTIONS[0].id] });

export const TENNIS_OPTION_LABELS = Object.freeze({ environmentHdri: Object.freeze(reduceLabels(TENNIS_HDRI_OPTIONS)) });

export const TENNIS_STORE_ITEMS = Object.freeze(
  TENNIS_HDRI_OPTIONS.map((option) => ({
    id: `tennis-hdri-${option.id}`,
    type: 'environmentHdri',
    optionId: option.id,
    name: option.name,
    price: option.price,
    description: `Official Poly Haven ${option.name} environment for Tennis arenas.`,
    thumbnail: option.thumbnail,
    swatches: ['#0f172a', '#38bdf8']
  }))
);
