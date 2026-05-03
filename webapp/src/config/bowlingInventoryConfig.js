import { POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';

const reduceLabels = (items) => items.reduce((acc, option) => {
  acc[option.id] = option.label;
  return acc;
}, {});

export const BOWLING_HDRI_OPTIONS = Object.freeze(
  POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
    id: variant.id,
    name: variant.name,
    label: `${variant.name} HDRI`,
    thumbnail: variant.thumbnail,
    price: Math.max(0, Number(variant.price || 0)),
    type: 'environmentHdri'
  }))
);

export const BOWLING_DEFAULT_LOADOUT = Object.freeze({
  environmentHdri: [BOWLING_HDRI_OPTIONS[0]?.id || 'colorfulStudio']
});

export const BOWLING_OPTION_LABELS = Object.freeze({
  environmentHdri: Object.freeze(reduceLabels(BOWLING_HDRI_OPTIONS))
});

export const BOWLING_STORE_ITEMS = Object.freeze(
  BOWLING_HDRI_OPTIONS.map((option) => ({
    id: `bowling-hdri-${option.id}`,
    type: 'environmentHdri',
    optionId: option.id,
    name: option.name,
    price: option.price,
    description: `Premium ${option.name} lighting environment for Bowling arenas.`,
    thumbnail: option.thumbnail,
    swatches: ['#0f172a', '#38bdf8']
  }))
);
