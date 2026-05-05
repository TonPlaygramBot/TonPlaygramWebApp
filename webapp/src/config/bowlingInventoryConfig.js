import { POOL_ROYALE_HDRI_VARIANTS } from './poolRoyaleInventoryConfig.js';

const POLYHAVEN_BASE = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k';
const THUMB_BASE = 'https://cdn.polyhaven.com/asset_img/thumbs';

const HDRIS = [
  ['studio_small_09','Studio Small 09'],
  ['studio_small_03','Studio Small 03'],
  ['photo_studio_01','Photo Studio 01'],
  ['brown_photostudio_02','Brown Photostudio 02'],
  ['skidpan','Skidpan'],
  ['empty_warehouse_01','Empty Warehouse 01'],
  ['industrial_workshop_foundry','Industrial Workshop Foundry'],
  ['abandoned_parking','Abandoned Parking'],
  ['lebombo','Lebombo'],
  ['aerodynamics_workshop','Aerodynamics Workshop']
];

const BASE_BOWLING_HDRI_VARIANTS = HDRIS.map(([id, label], index) => ({
  id,
  name: label,
  description: 'Poly Haven HDRI adapted for long-lane bowling lighting.',
  sourceUrl: `https://polyhaven.com/a/${id}`,
  hdriUrl: `${POLYHAVEN_BASE}/${id}_1k.hdr`,
  thumbnailUrl: `${THUMB_BASE}/${id}.png?height=240`,
  priceCoins: index === 0 ? 0 : 450,
  rarity: index === 0 ? 'common' : 'rare'
}));
const poolHdris = POOL_ROYALE_HDRI_VARIANTS.map((variant) => ({
  id: variant.id,
  name: variant.label,
  description: `Pool Royal shared HDRI: ${variant.description}`,
  sourceUrl: variant.url,
  hdriUrl: variant.url,
  thumbnailUrl: variant.thumbnail,
  priceCoins: 600,
  rarity: 'epic'
}));
export const BOWLING_HDRI_VARIANTS = Object.freeze([...BASE_BOWLING_HDRI_VARIANTS, ...poolHdris]);

export const BOWLING_OPTION_LABELS = Object.freeze({ environmentHdri: 'Bowling HDRI Environment' });

export const BOWLING_DEFAULT_LOADOUT = Object.freeze({ environmentHdri: BOWLING_HDRI_VARIANTS[0].id });

export const BOWLING_STORE_ITEMS = Object.freeze(BOWLING_HDRI_VARIANTS.map((variant) => ({
  id: `bowling-hdri-${variant.id}`,
  game: 'bowling',
  type: 'environmentHdri',
  optionId: variant.id,
  name: variant.name,
  description: variant.description,
  image: variant.thumbnailUrl,
  priceCoins: variant.priceCoins,
  featured: variant.id === BOWLING_DEFAULT_LOADOUT.environmentHdri
})));
