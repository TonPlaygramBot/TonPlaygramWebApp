import { POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';

export const BOWLING_STORE_ITEMS = Object.freeze(
  POOL_ROYALE_HDRI_VARIANTS.map((variant, index) => ({
    id: `bowling-hdri-${variant.id}`,
    type: 'environmentHdri',
    optionId: variant.id,
    name: `${variant.label} HDRI`,
    price: 2100 + index * 10,
    description: 'Shared Pool Royale HDRI available for Bowling lanes.',
    thumbnail: variant.thumbnail,
    swatches: ['#1e293b', '#38bdf8']
  }))
);
