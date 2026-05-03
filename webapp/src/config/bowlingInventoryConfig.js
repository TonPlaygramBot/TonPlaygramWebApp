import { POOL_ROYALE_HDRI_VARIANTS, POOL_ROYALE_STORE_ITEMS } from './poolRoyaleInventoryConfig.js';

const BOWLING_HDRI_NAMES = new Set(['Dancing Hall', 'Sepulchral Chapel Rotunda', 'Vestibule']);
const BOWLING_FINISH_OPTION_IDS = new Set(['rosewoodVeneer01', 'oakVeneer01', 'darkWood', 'woodTable001']);

export const BOWLING_STORE_ITEMS = Object.freeze([
  ...POOL_ROYALE_STORE_ITEMS.filter(
    (item) => item.type === 'environmentHdri' && BOWLING_HDRI_NAMES.has(item.name)
  ).map((item) => ({ ...item })),
  ...POOL_ROYALE_STORE_ITEMS.filter(
    (item) => item.type === 'tableFinish' && BOWLING_FINISH_OPTION_IDS.has(item.optionId)
  ).map((item) => ({ ...item }))
]);

export const BOWLING_HDRI_VARIANTS = Object.freeze(
  POOL_ROYALE_HDRI_VARIANTS.filter((variant) => BOWLING_HDRI_NAMES.has(variant.name))
);
