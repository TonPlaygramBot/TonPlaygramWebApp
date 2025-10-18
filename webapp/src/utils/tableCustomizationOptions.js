import { WOOD_FINISH_PRESETS, WOOD_GRAIN_OPTIONS, WOOD_GRAIN_OPTIONS_BY_ID } from './woodMaterials.js';
import { CARD_THEMES } from './cardThemes.js';

export const WOOD_PRESETS_BY_ID = Object.freeze(
  WOOD_FINISH_PRESETS.reduce((acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  }, {})
);

export const TABLE_WOOD_OPTIONS = [
  { id: 'walnutHeritage', label: 'Arre Heritage', presetId: 'walnut', grainId: 'heritagePlanks' },
  { id: 'mapleChevron', label: 'Panjo Chevron', presetId: 'maple', grainId: 'atelierChevron' },
  { id: 'oakEstate', label: 'Lis Estate', presetId: 'oak', grainId: 'estateBands' },
  { id: 'teakStudio', label: 'Tik Studio', presetId: 'teak', grainId: 'studioVeins' },
  { id: 'wengeShadow', label: 'Wenge Hije', presetId: 'wenge', grainId: 'atelierChevron' },
  { id: 'ebonyClassic', label: 'Eben Klasik', presetId: 'ebony', grainId: 'heritagePlanks' }
];

export const TABLE_CLOTH_OPTIONS = [
  { id: 'crimson', label: 'Rrobë e Kuqe', feltTop: '#960019', feltBottom: '#4a0012', emissive: '#210308' },
  { id: 'emerald', label: 'Rrobë Smerald', feltTop: '#0f6a2f', feltBottom: '#054d24', emissive: '#021a0b' },
  { id: 'arctic', label: 'Rrobë Akull', feltTop: '#2563eb', feltBottom: '#1d4ed8', emissive: '#071a42' },
  { id: 'sunset', label: 'Rrobë Perëndim', feltTop: '#ea580c', feltBottom: '#c2410c', emissive: '#320e03' },
  { id: 'violet', label: 'Rrobë Vjollcë', feltTop: '#7c3aed', feltBottom: '#5b21b6', emissive: '#1f0a47' },
  { id: 'amber', label: 'Rrobë Qelibari', feltTop: '#b7791f', feltBottom: '#92571a', emissive: '#2b1402' }
];

export const TABLE_BASE_OPTIONS = [
  {
    id: 'obsidian',
    label: 'Bazë Obsidian',
    baseColor: '#141414',
    columnColor: '#0b0d10',
    trimColor: '#1f232a',
    metalness: 0.75,
    roughness: 0.35
  },
  {
    id: 'forestBronze',
    label: 'Bazë Pylli',
    baseColor: '#101714',
    columnColor: '#0a0f0c',
    trimColor: '#1f2d24',
    metalness: 0.7,
    roughness: 0.38
  },
  {
    id: 'midnightChrome',
    label: 'Bazë Mesnate',
    baseColor: '#0f172a',
    columnColor: '#0a1020',
    trimColor: '#1e2f4a',
    metalness: 0.78,
    roughness: 0.32
  },
  {
    id: 'emberCopper',
    label: 'Bazë Bakri',
    baseColor: '#231312',
    columnColor: '#140707',
    trimColor: '#5c2d1b',
    metalness: 0.68,
    roughness: 0.4
  },
  {
    id: 'violetShadow',
    label: 'Bazë Hije Vjollcë',
    baseColor: '#1f1130',
    columnColor: '#130622',
    trimColor: '#3f1b5b',
    metalness: 0.74,
    roughness: 0.36
  },
  {
    id: 'desertGold',
    label: 'Bazë Shkretëtirë',
    baseColor: '#1c1a12',
    columnColor: '#0f0d06',
    trimColor: '#5a4524',
    metalness: 0.72,
    roughness: 0.39
  }
];

export const CHAIR_COLOR_OPTIONS = [
  {
    id: 'emeraldRegal',
    label: 'Karrige Smerald',
    feltTop: '#0f5132',
    feltBottom: '#06281a'
  },
  {
    id: 'midnightCobalt',
    label: 'Karrige Kobalt',
    feltTop: '#1e3a8a',
    feltBottom: '#111c44'
  },
  {
    id: 'crimsonVelvet',
    label: 'Karrige Kadife Kuqe',
    feltTop: '#7f1d1d',
    feltBottom: '#3f0a0a'
  },
  {
    id: 'charcoalGold',
    label: 'Karrige Grafit',
    feltTop: '#3a342e',
    feltBottom: '#171311'
  },
  {
    id: 'violetLuxe',
    label: 'Karrige Vjollcë',
    feltTop: '#553c9a',
    feltBottom: '#2a1659'
  }
];

export const TABLE_SHAPE_OPTIONS = [
  {
    id: 'classicOctagon',
    label: 'Oktagon Klasik',
    type: 'polygon',
    sides: 8,
    innerScale: 0.78,
    rimInnerScale: 0.73,
    trimOuterScale: 1.04,
    trimInnerScale: 0.9,
    segments: 8,
    previewClipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)'
  },
  {
    id: 'royalCircle',
    label: 'Rreth Mbretëror',
    type: 'circle',
    innerScale: 0.7,
    rimInnerScale: 0.64,
    trimOuterScale: 1.05,
    trimInnerScale: 0.9,
    segments: 48,
    previewClipPath: 'ellipse(50% 50% at 50% 50%)'
  },
  {
    id: 'grandOval',
    label: 'Oval Grand',
    type: 'oval',
    widthScale: 1,
    heightScale: 0.68,
    innerScale: 0.68,
    rimInnerScale: 0.62,
    trimOuterScale: 1.04,
    trimInnerScale: 0.88,
    segments: 48,
    previewClipPath: 'ellipse(50% 40% at 50% 50%)'
  },
  {
    id: 'futuristHex',
    label: 'Heksagon Futurist',
    type: 'polygon',
    sides: 6,
    innerScale: 0.76,
    rimInnerScale: 0.7,
    trimOuterScale: 1.03,
    trimInnerScale: 0.88,
    segments: 6,
    previewClipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)'
  },
  {
    id: 'racetrackElite',
    label: 'Pistë Elite',
    type: 'racetrack',
    widthScale: 1,
    heightScale: 0.62,
    cornerScale: 0.32,
    innerScale: 0.7,
    rimInnerScale: 0.64,
    trimOuterScale: 1.05,
    trimInnerScale: 0.9,
    segments: 48,
    previewClipPath: 'inset(12% 8% round 40%)'
  }
];

export const DEFAULT_TABLE_CUSTOMIZATION = Object.freeze({
  tableWood: 0,
  tableCloth: 1,
  tableBase: 0,
  tableShape: 0,
  chairColor: 0,
  cards: 0
});

export function getWoodOptionById(id) {
  return TABLE_WOOD_OPTIONS.find((option) => option.id === id) || TABLE_WOOD_OPTIONS[0];
}

export { WOOD_GRAIN_OPTIONS, WOOD_GRAIN_OPTIONS_BY_ID, CARD_THEMES };
