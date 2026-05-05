import {
  POOL_ROYALE_HDRI_VARIANTS,
  POOL_ROYALE_STORE_ITEMS,
} from './poolRoyaleInventoryConfig.js';

export const BOWLING_HDRI_VARIANTS = Object.freeze(
  POOL_ROYALE_HDRI_VARIANTS.map((variant, index) => ({
    id: variant.id,
    name: variant.name,
    description: variant.description || 'Shared Pool Royale HDRI for bowling.',
    sourceUrl: variant.sourceUrl,
    hdriUrl: variant.hdriUrl,
    thumbnailUrl: variant.thumbnailUrl,
    priceCoins: index === 0 ? 0 : variant.priceCoins ?? 450,
    rarity: index === 0 ? 'common' : 'rare',
  }))
);

export const BOWLING_OPTION_LABELS = Object.freeze({
  environmentHdri: 'Bowling HDRI Environment',
  tableFinish: 'Bowling Table Finish',
  chromeColor: 'Bowling Chrome Plates',
});

export const BOWLING_DEFAULT_LOADOUT = Object.freeze({
  environmentHdri: BOWLING_HDRI_VARIANTS[0]?.id,
});

const poolVisualStoreItems = POOL_ROYALE_STORE_ITEMS.filter((item) =>
  ['environmentHdri', 'tableFinish', 'chromeColor'].includes(item.type)
);

export const BOWLING_STORE_ITEMS = Object.freeze(
  poolVisualStoreItems.map((item) => ({
    ...item,
    id: `bowling-${item.id}`,
    game: 'bowling',
    featured: item.type === 'environmentHdri' ? item.optionId === BOWLING_DEFAULT_LOADOUT.environmentHdri : !!item.featured,
  }))
);
