export const POOL_ROYALE_TABLE_FINISH_VARIANTS = Object.freeze([
  Object.freeze({
    id: 'peelingPaintWeathered',
    baseId: 'peelingPaintWeathered',
    label: 'Wood Peeling Paint Weathered',
    woodTextureId: 'wood_peeling_paint_weathered',
    rail: 0xb8b3aa,
    base: 0xa89f95,
    trim: 0xd6d0c7,
    woodRepeatScale: 1,
    swatches: ['#a89f95', '#d6d0c7']
  }),
  Object.freeze({
    id: 'oakVeneer01',
    baseId: 'oakVeneer01',
    label: 'Oak Veneer 01',
    woodTextureId: 'oak_veneer_01',
    rail: 0xc89a64,
    base: 0xb9854e,
    trim: 0xe0bb7a,
    woodRepeatScale: 1,
    swatches: ['#b9854e', '#e0bb7a']
  }),
  Object.freeze({
    id: 'woodTable001',
    baseId: 'woodTable001',
    label: 'Wood Table 001',
    woodTextureId: 'wood_table_001',
    rail: 0xa4724f,
    base: 0x8f6243,
    trim: 0xc89a64,
    woodRepeatScale: 1,
    swatches: ['#8f6243', '#c89a64']
  }),
  Object.freeze({
    id: 'darkWood',
    baseId: 'darkWood',
    label: 'Dark Wood',
    woodTextureId: 'dark_wood',
    rail: 0x3d2f2a,
    base: 0x2f241f,
    trim: 0x6a5a52,
    woodRepeatScale: 1,
    swatches: ['#2f241f', '#6a5a52']
  }),
  Object.freeze({
    id: 'rosewoodVeneer01',
    baseId: 'rosewoodVeneer01',
    label: 'Rosewood Veneer 01',
    woodTextureId: 'rosewood_veneer_01',
    rail: 0x6f3a2f,
    base: 0x5b2f26,
    trim: 0x9b5a44,
    woodRepeatScale: 1,
    swatches: ['#5b2f26', '#9b5a44']
  })
]);

export const POOL_ROYALE_TABLE_FINISH_MAP = Object.freeze(
  POOL_ROYALE_TABLE_FINISH_VARIANTS.reduce((acc, finish) => {
    acc[finish.id] = finish;
    return acc;
  }, {})
);

export const DEFAULT_POOL_ROYALE_TABLE_FINISH_ID =
  POOL_ROYALE_TABLE_FINISH_VARIANTS[0]?.id;
