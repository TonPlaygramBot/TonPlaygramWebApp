import { polyHavenThumb } from './storeThumbnails.js';

const reduceLabels = (items) => items.reduce((acc, option) => { acc[option.id] = option.label; return acc; }, {});

export const TENNIS_HDRI_OPTIONS = Object.freeze([
  { id:'suburbanGarden', name:'Suburban Garden', label:'Suburban Garden HDRI', assetId:'suburban_garden', price: 1900 },
  { id:'countryTrackMidday', name:'Country Track Midday', label:'Country Track Midday HDRI', assetId:'country_track_midday', price: 1920 },
  { id:'autumnPark', name:'Autumn Park', label:'Autumn Park HDRI', assetId:'autumn_park', price: 1940 },
  { id:'rooitouPark', name:'Rooitou Park', label:'Rooitou Park HDRI', assetId:'rooitou_park', price: 1980 },
  { id:'rotesRathaus', name:'Rotes Rathaus', label:'Rotes Rathaus HDRI', assetId:'rotes_rathaus', price: 2020 },
  { id:'veniceDawn2', name:'Venice Dawn 2', label:'Venice Dawn 2 HDRI', assetId:'venice_dawn_2', price: 2060 },
  { id:'piazzaSanMarco', name:'Piazza San Marco', label:'Piazza San Marco HDRI', assetId:'piazza_san_marco', price: 2120 }
].map((variant) => ({ ...variant, thumbnail: polyHavenThumb(variant.assetId), type: 'environmentHdri' })));

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
