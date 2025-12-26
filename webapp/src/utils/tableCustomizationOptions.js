import { WOOD_FINISH_PRESETS, WOOD_GRAIN_OPTIONS, WOOD_GRAIN_OPTIONS_BY_ID } from './woodMaterials.js';
import { CARD_THEMES } from './cardThemes.js';

const numberToHex = (value) => `#${value.toString(16).padStart(6, '0')}`;
const normalizeHex = (value) => (typeof value === 'number' ? numberToHex(value) : value);

const tintHex = (hex, factor) => {
  const normalized = normalizeHex(hex).replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const clamp = (channel) => Math.max(0, Math.min(255, Math.round(channel)));
  const adjust = (channel) => {
    const delta = factor >= 0 ? (255 - channel) * factor : channel * factor;
    return clamp(channel + delta);
  };
  const next = (adjust(r) << 16) | (adjust(g) << 8) | adjust(b);
  return numberToHex(next);
};

const buildClothOption = (
  id,
  label,
  baseColor,
  { topTint = 0.08, bottomTint = -0.12, emissiveTint = -0.65, sourceId } = {}
) => {
  const baseHex = normalizeHex(baseColor);
  return {
    id,
    label,
    sourceId,
    feltTop: tintHex(baseHex, topTint),
    feltBottom: tintHex(baseHex, bottomTint),
    emissive: tintHex(baseHex, emissiveTint)
  };
};

const POLY_HAVEN_CLOTHS = [
  { id: 'denim_fabric_03', label: 'Denim Fabric 03 Cloth', base: 0x2b4a7a },
  { id: 'hessian_230', label: 'Hessian 230 Cloth', base: 0x9b7a45 },
  { id: 'polar_fleece', label: 'Polar Fleece Cloth', base: 0xd9d2c2 },
  { id: 'cotton_jersey', label: 'Cotton Jersey Cloth', base: 0xb9a27d },
  { id: 'fabric_leather_02', label: 'Leather Weave Cloth', base: 0x6a4a32 },
  { id: 'faux_fur_geometric', label: 'Faux Fur Geo Cloth', base: 0xcaa0a8 },
  { id: 'jogging_melange', label: 'Jogging Mélange Cloth', base: 0x7a7a7f },
  { id: 'knitted_fleece', label: 'Knitted Fleece Cloth', base: 0x6e5a4a },
  { id: 'caban', label: 'Caban Wool Cloth', base: 0xb56a2a },
  { id: 'curly_teddy_natural', label: 'Curly Teddy Natural Cloth', base: 0xcdbfa9 },
  { id: 'curly_teddy_checkered', label: 'Curly Teddy Checkered Cloth', base: 0x2f6a70 },
  { id: 'denim_fabric_04', label: 'Denim Fabric 04 Cloth', base: 0x4a78a8 },
  { id: 'denim_fabric_05', label: 'Denim Fabric 05 Cloth', base: 0x2c2f35 },
  { id: 'scuba_suede', label: 'Scuba Suede Cloth', base: 0x2a8c86 }
];

export const POLY_HAVEN_CLOTH_IDS = Object.freeze(new Set(POLY_HAVEN_CLOTHS.map((option) => option.id)));

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
  { id: 'amber', label: 'Amber Cloth', feltTop: '#b7791f', feltBottom: '#92571a', emissive: '#2b1402' },
  ...POLY_HAVEN_CLOTHS.map((option) => buildClothOption(option.id, option.label, option.base, { sourceId: option.id }))
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
