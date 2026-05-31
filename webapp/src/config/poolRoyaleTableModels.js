import { POOL_ROYALE_CLOTH_VARIANTS } from './poolRoyaleClothPresets.js';
import { WOOD_GRAIN_OPTIONS } from '../utils/woodMaterials.js';

export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'royal-original',
    label: 'Royal Original',
    description:
      'Current TonPlaygram procedural cushions, wooden rail frame, base, chrome plates, and pocket jaws with the Showood GLB playfield aligned underneath.',
    tableSizeId: '9ft',
    finishId: 'peelingPaintWeathered',
    baseId: 'classicCylinders',
    assetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`,
    fallbackAssetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood_pbr.glb`,
    icon: '🎱',
    kind: 'gltf',
    fitScale: 1.045,
    clothRepeatScale: 5.25,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeUpperComponentHeight: true,
    useOriginalLayoutSurfaces: false,
    usePoolRoyaleFinish: true,
    usePoolRoyaleFinishRoles: ['cloth'],
    cushionUsesClothFinish: false,
    hideGeneratedCushionsAndJaws: false,
    preserveSourceTextureRoles: [],
    preserveOriginalSurfaceRoles: ['trim', 'wood'],
    hideSurfaceRoles: ['trim', 'wood'],
    keepGeneratedShell: true,
    forceGeneratedChromePlates: true
  },
  {
    id: 'showood-seven-foot',
    label: 'Showood 7 ft GLB',
    description:
      'Open-source Pooltool Showood showroom table matched to Pool Royale footprint while keeping the original GLB layout for cloth, cushions, pockets, and preserved Showood chrome plates.',
    tableSizeId: '9ft',
    assetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`,
    fallbackAssetUrl: `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood_pbr.glb`,
    icon: '🟫',
    kind: 'gltf',
    fitScale: 1.055,
    lowerBaseHeightScale: 1.16,
    clothRepeatScale: 5.25,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeHeight: true,
    matchNativeUpperComponentHeight: true,
    useOriginalLayoutSurfaces: true,
    usePoolRoyaleFinish: true,
    useReferenceShowoodMapping: true,
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'wood', 'pocket', 'trim'],
    preserveSourceTextureRoles: ['cushion', 'topWoodRail', 'leg', 'baseCornerBlock', 'underside'],
    preserveOriginalSurfaceRoles: [],
    tintOriginalTrimGold: false,
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: []
  }
]);

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find((option) => option.id === 'royal-original')?.id ||
  POOL_ROYALE_TABLE_MODEL_OPTIONS[0].id;

export function resolvePoolRoyaleTableModel(modelId) {
  const key = typeof modelId === 'string' ? modelId.trim() : '';
  return (
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find((option) => option.id === key) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS[0]
  );
}

const SHOWOOD_WOOD_SWATCHES = Object.freeze({
  acg_walnut_quarter: '#6b3f24',
  wood_peeling_paint_weathered: '#b8b3aa',
  oak_veneer_01: '#c89a64',
  wood_table_001: '#a4724f',
  dark_wood: '#3d2f2a',
  rosewood_veneer_01: '#6f3a2f',
  kitchen_wood: '#a6784a',
  japanese_sycamore: '#d1b07d',
  oak_veneer_01_amber: '#c88d3f',
  oak_veneer_01_cocoa: '#72513e',
  oak_veneer_01_walnut: '#4f3224',
  oak_veneer_01_mahogany_red: '#74322d',
  oak_veneer_01_matte_black: '#11100f',
  carbon_fiber_chalk: '#2a313d'
});

const swatchFromWoodId = (id) => {
  if (SHOWOOD_WOOD_SWATCHES[id]) return SHOWOOD_WOOD_SWATCHES[id];
  if (/black|night|dark/.test(id)) return '#15181d';
  if (/grey|gray/.test(id)) return '#717b86';
  if (/burgundy|red|mahogany/.test(id)) return '#74323a';
  if (/green|olive|moss|swamp/.test(id)) return '#43573d';
  if (/cream|sand|yellow|birch/.test(id)) return '#c7ad7d';
  if (/fabric/.test(id)) return '#7f8790';
  return '#8a5a36';
};

const createShowoodWoodOptions = () =>
  Object.freeze(
    WOOD_GRAIN_OPTIONS.reduce((acc, option) => {
      acc[option.id] = Object.freeze({
        label: option.label,
        color: swatchFromWoodId(option.id),
        woodTextureId: option.id,
        metalness: /plastic|carbon/.test(option.id) ? 0.04 : 0.02,
        roughness: /matte|fabric/.test(option.id) ? 0.72 : 0.42,
        envMapIntensity: /plastic|carbon/.test(option.id) ? 1.1 : 1.35,
        clearcoat: /matte|fabric/.test(option.id) ? 0.08 : 0.36,
        clearcoatRoughness: /matte|fabric/.test(option.id) ? 0.5 : 0.2
      });
      return acc;
    }, {})
  );

const createShowoodClothOptions = () =>
  Object.freeze(
    POOL_ROYALE_CLOTH_VARIANTS.reduce((acc, variant) => {
      acc[variant.id] = Object.freeze({
        label: variant.name,
        color: `#${variant.baseColor.toString(16).padStart(6, '0')}`,
        clothTextureKey: variant.id,
        clothTextureSource: 'procedural',
        metalness: 0,
        roughness: 0.9,
        envMapIntensity: 0.18,
        sheen: 0.62,
        sheenRoughness: 0.46
      });
      return acc;
    }, {})
  );

const SHOWOOD_CLOTH_OPTIONS = createShowoodClothOptions();
const SHOWOOD_WOOD_OPTIONS = createShowoodWoodOptions();

export const POOL_ROYALE_SHOWOOD_MATERIAL_CONTROL_PARTS = Object.freeze([
  'cloth',
  'cushion',
  'topWoodRail',
  'legBase'
]);

export const POOL_ROYALE_SHOWOOD_DEFAULT_PALETTE = Object.freeze({
  cloth: POOL_ROYALE_CLOTH_VARIANTS[0]?.id || 'cabanBlueSky',
  cushion: POOL_ROYALE_CLOTH_VARIANTS[0]?.id || 'cabanBlueSky',
  topWoodRail: 'acg_walnut_quarter',
  legBase: 'dark_wood'
});

export const POOL_ROYALE_SHOWOOD_CONTROL_META = Object.freeze({
  cloth: { label: 'Field cloth', description: 'Flat playfield surface using every cloth-library texture.' },
  cushion: {
    label: 'Cushions',
    description: 'Cushion rubber uses the same full cloth-library texture list as the field.'
  },
  topWoodRail: { label: 'Top rail frame', description: 'Main top rail frame using every GLTF table-finish texture.' },
  legBase: { label: 'Legs + base', description: 'Legs and lower base blocks using every GLTF table-finish texture.' }
});

export const POOL_ROYALE_SHOWOOD_CONTROL_OPTIONS = Object.freeze({
  cloth: SHOWOOD_CLOTH_OPTIONS,
  cushion: SHOWOOD_CLOTH_OPTIONS,
  topWoodRail: SHOWOOD_WOOD_OPTIONS,
  legBase: SHOWOOD_WOOD_OPTIONS
});
