import { swatchThumbnail } from './storeThumbnails.js';

export const BOWLING_HDRI_OPTIONS = Object.freeze([
  { id: 'dancing-hall-hdri', label: 'Dancing Hall HDRI' },
  { id: 'sepulchral-chapel-rotunda-hdri', label: 'Sepulchral Chapel Rotunda HDRI' },
  { id: 'vestibule-hdri', label: 'Vestibule HDRI' }
]);

export const BOWLING_FLOOR_OPTIONS = Object.freeze([
  { id: 'rosewood_veneer_01', label: 'Rosewood Veneer 01' },
  { id: 'oak_veneer_01', label: 'Oak Veneer 01' },
  { id: 'dark_wood', label: 'Dark Wood' },
  { id: 'wood_table_001', label: 'Wood Table 001' }
]);

export const BOWLING_DEFAULT_UNLOCKS = Object.freeze({
  environmentHdri: ['dancing-hall-hdri'],
  floorFinish: ['oak_veneer_01']
});

const labels = (opts) => Object.freeze(opts.reduce((a, o) => ({ ...a, [o.id]: o.label }), {}));
export const BOWLING_OPTION_LABELS = Object.freeze({
  environmentHdri: labels(BOWLING_HDRI_OPTIONS),
  floorFinish: labels(BOWLING_FLOOR_OPTIONS)
});

export const BOWLING_STORE_ITEMS = Object.freeze([
  ...BOWLING_HDRI_OPTIONS.map((opt, idx) => ({ id:`bowling-hdri-${opt.id}`, type:'environmentHdri', optionId:opt.id, name:opt.label, price:1200 + idx*70, description:'Premium HDRI lighting pack for Bowling lanes.' })),
  ...BOWLING_FLOOR_OPTIONS.map((opt, idx) => ({ id:`bowling-floor-${opt.id}`, type:'floorFinish', optionId:opt.id, name:opt.label, price:680 + idx*45, description:'Premium lane floor finish for Bowling.', thumbnail: swatchThumbnail(['#8a6139', '#5b3d26']) }))
]);

export const BOWLING_DEFAULT_LOADOUT = Object.freeze([]);
