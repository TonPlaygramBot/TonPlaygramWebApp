export const POOL_ROYALE_TABLE_FINISH_VARIANTS = Object.freeze([
  Object.freeze({
    id: 'oakVeneer01-amber',
    baseId: 'oakVeneer01',
    label: 'Oak Veneer — Amber',
    woodTextureId: 'oak_veneer_01',
    rail: 0xc89a64,
    base: 0xb9854e,
    trim: 0xe0bb7a,
    woodRepeatScale: 1,
    swatches: ['#b9854e', '#e0bb7a']
  }),
  Object.freeze({
    id: 'oakVeneer01-honey',
    baseId: 'oakVeneer01',
    label: 'Oak Veneer — Honey',
    woodTextureId: 'oak_veneer_01',
    rail: 0xd7ad72,
    base: 0xc7975a,
    trim: 0xefd3a0,
    woodRepeatScale: 1,
    swatches: ['#c7975a', '#efd3a0']
  }),
  Object.freeze({
    id: 'oakVeneer01-rye',
    baseId: 'oakVeneer01',
    label: 'Oak Veneer — Rye',
    woodTextureId: 'oak_veneer_01',
    rail: 0xbb905c,
    base: 0xa97a46,
    trim: 0xd7b280,
    woodRepeatScale: 1,
    swatches: ['#a97a46', '#d7b280']
  }),
  Object.freeze({
    id: 'oakVeneer01-moss',
    baseId: 'oakVeneer01',
    label: 'Oak Veneer — Moss',
    woodTextureId: 'oak_veneer_01',
    rail: 0xa88d6a,
    base: 0x947651,
    trim: 0xc9b08a,
    woodRepeatScale: 1,
    swatches: ['#947651', '#c9b08a']
  }),
  Object.freeze({
    id: 'oakVeneer01-charcoal',
    baseId: 'oakVeneer01',
    label: 'Oak Veneer — Charcoal',
    woodTextureId: 'oak_veneer_01',
    rail: 0x8f7356,
    base: 0x7a5d42,
    trim: 0xab8a6c,
    woodRepeatScale: 1,
    swatches: ['#7a5d42', '#ab8a6c']
  }),
  Object.freeze({
    id: 'woodTable001-heritage',
    baseId: 'woodTable001',
    label: 'Wood Table — Heritage',
    woodTextureId: 'wood_table_001',
    rail: 0xa4724f,
    base: 0x8f6243,
    trim: 0xc89a64,
    woodRepeatScale: 1,
    swatches: ['#8f6243', '#c89a64']
  }),
  Object.freeze({
    id: 'woodTable001-ember',
    baseId: 'woodTable001',
    label: 'Wood Table — Ember',
    woodTextureId: 'wood_table_001',
    rail: 0xb06f50,
    base: 0x9a5b3d,
    trim: 0xd59a6d,
    woodRepeatScale: 1,
    swatches: ['#9a5b3d', '#d59a6d']
  }),
  Object.freeze({
    id: 'woodTable001-dune',
    baseId: 'woodTable001',
    label: 'Wood Table — Dune',
    woodTextureId: 'wood_table_001',
    rail: 0x967a63,
    base: 0x80644f,
    trim: 0xb89c83,
    woodRepeatScale: 1,
    swatches: ['#80644f', '#b89c83']
  }),
  Object.freeze({
    id: 'woodTable001-moss',
    baseId: 'woodTable001',
    label: 'Wood Table — Moss',
    woodTextureId: 'wood_table_001',
    rail: 0x7f6a52,
    base: 0x6a553f,
    trim: 0xa4886d,
    woodRepeatScale: 1,
    swatches: ['#6a553f', '#a4886d']
  }),
  Object.freeze({
    id: 'woodTable001-noir',
    baseId: 'woodTable001',
    label: 'Wood Table — Noir',
    woodTextureId: 'wood_table_001',
    rail: 0x5c4436,
    base: 0x4b3428,
    trim: 0x8a6b55,
    woodRepeatScale: 1,
    swatches: ['#4b3428', '#8a6b55']
  }),
  Object.freeze({
    id: 'darkWood-obsidian',
    baseId: 'darkWood',
    label: 'Dark Wood — Obsidian',
    woodTextureId: 'dark_wood',
    rail: 0x3d2f2a,
    base: 0x2f241f,
    trim: 0x6a5a52,
    woodRepeatScale: 1,
    swatches: ['#2f241f', '#6a5a52']
  }),
  Object.freeze({
    id: 'darkWood-ember',
    baseId: 'darkWood',
    label: 'Dark Wood — Ember',
    woodTextureId: 'dark_wood',
    rail: 0x4a322b,
    base: 0x3a2721,
    trim: 0x7b5c52,
    woodRepeatScale: 1,
    swatches: ['#3a2721', '#7b5c52']
  }),
  Object.freeze({
    id: 'darkWood-slate',
    baseId: 'darkWood',
    label: 'Dark Wood — Slate',
    woodTextureId: 'dark_wood',
    rail: 0x3a3c3f,
    base: 0x2d2f32,
    trim: 0x6b6e73,
    woodRepeatScale: 1,
    swatches: ['#2d2f32', '#6b6e73']
  }),
  Object.freeze({
    id: 'darkWood-cocoa',
    baseId: 'darkWood',
    label: 'Dark Wood — Cocoa',
    woodTextureId: 'dark_wood',
    rail: 0x4f3b30,
    base: 0x3f2d24,
    trim: 0x7e6151,
    woodRepeatScale: 1,
    swatches: ['#3f2d24', '#7e6151']
  }),
  Object.freeze({
    id: 'darkWood-forest',
    baseId: 'darkWood',
    label: 'Dark Wood — Forest',
    woodTextureId: 'dark_wood',
    rail: 0x3f352d,
    base: 0x312821,
    trim: 0x6b5a4f,
    woodRepeatScale: 1,
    swatches: ['#312821', '#6b5a4f']
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
