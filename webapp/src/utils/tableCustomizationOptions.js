import { WOOD_FINISH_PRESETS, WOOD_GRAIN_OPTIONS, WOOD_GRAIN_OPTIONS_BY_ID } from './woodMaterials.js';
import { CARD_THEMES } from './cardThemes.js';

export const WOOD_PRESETS_BY_ID = Object.freeze(
  WOOD_FINISH_PRESETS.reduce((acc, preset) => {
    acc[preset.id] = preset;
    return acc;
  }, {})
);

export const TABLE_WOOD_OPTIONS = [
  { id: 'lightNatural', label: 'Light Natural', presetId: 'birch', grainId: 'ph_wood_floor_01' },
  { id: 'warmBrown', label: 'Warm Brown', presetId: 'walnut', grainId: 'ph_wood_floor_02' },
  { id: 'cleanStrips', label: 'Clean Strips', presetId: 'oak', grainId: 'ph_wood_floor_03' },
  { id: 'oldWoodFloor', label: 'Old Wood Floor', presetId: 'smokedOak', grainId: 'ph_old_wood_floor' }
];

export const TABLE_CLOTH_OPTIONS = [
  { id: 'crimson', label: 'Crimson Cloth', feltTop: '#960019', feltBottom: '#4a0012', emissive: '#210308' },
  { id: 'emerald', label: 'Emerald Cloth', feltTop: '#0f6a2f', feltBottom: '#054d24', emissive: '#021a0b' },
  { id: 'arctic', label: 'Arctic Cloth', feltTop: '#2563eb', feltBottom: '#1d4ed8', emissive: '#071a42' },
  { id: 'sunset', label: 'Sunset Cloth', feltTop: '#ea580c', feltBottom: '#c2410c', emissive: '#320e03' },
  { id: 'violet', label: 'Violet Cloth', feltTop: '#7c3aed', feltBottom: '#5b21b6', emissive: '#1f0a47' },
  { id: 'amber', label: 'Amber Cloth', feltTop: '#b7791f', feltBottom: '#92571a', emissive: '#2b1402' }
];

export const TABLE_BASE_OPTIONS = [
  {
    id: 'obsidian',
    label: 'Obsidian Base',
    baseColor: '#141414',
    columnColor: '#0b0d10',
    trimColor: '#1f232a',
    metalness: 0.75,
    roughness: 0.35
  },
  {
    id: 'forestBronze',
    label: 'Forest Base',
    baseColor: '#101714',
    columnColor: '#0a0f0c',
    trimColor: '#1f2d24',
    metalness: 0.7,
    roughness: 0.38
  },
  {
    id: 'midnightChrome',
    label: 'Midnight Base',
    baseColor: '#0f172a',
    columnColor: '#0a1020',
    trimColor: '#1e2f4a',
    metalness: 0.78,
    roughness: 0.32
  },
  {
    id: 'emberCopper',
    label: 'Copper Base',
    baseColor: '#231312',
    columnColor: '#140707',
    trimColor: '#5c2d1b',
    metalness: 0.68,
    roughness: 0.4
  },
  {
    id: 'violetShadow',
    label: 'Violet Shadow Base',
    baseColor: '#1f1130',
    columnColor: '#130622',
    trimColor: '#3f1b5b',
    metalness: 0.74,
    roughness: 0.36
  },
  {
    id: 'desertGold',
    label: 'Desert Base',
    baseColor: '#1c1a12',
    columnColor: '#0f0d06',
    trimColor: '#5a4524',
    metalness: 0.72,
    roughness: 0.39
  }
];

export const DEFAULT_TABLE_CUSTOMIZATION = Object.freeze({
  tableWood: 0,
  tableCloth: 1,
  tableBase: 0,
  cards: 0
});

export function getWoodOptionById(id) {
  return TABLE_WOOD_OPTIONS.find((option) => option.id === id) || TABLE_WOOD_OPTIONS[0];
}

export { WOOD_GRAIN_OPTIONS, WOOD_GRAIN_OPTIONS_BY_ID, CARD_THEMES };
