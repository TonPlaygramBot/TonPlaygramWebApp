export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'royal-original',
    label: 'Royal Original',
    description:
      'Current TonPlaygram rails, base, and chrome with Showood GLB playfield, GLB cushions, pockets, and jaw layout overlaid.',
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
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'pocket'],
    cushionUsesClothFinish: true,
    hideGeneratedCushionsAndJaws: true,
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

export const POOL_ROYALE_SHOWOOD_MATERIAL_CONTROL_PARTS = Object.freeze([
  'cloth',
  'topWoodRail',
  'legBase'
]);

export const POOL_ROYALE_SHOWOOD_DEFAULT_PALETTE = Object.freeze({
  cloth: 'cabanGreenClassic',
  cushion: 'cabanGreenClassic',
  metalAccent: 'source',
  jaws: 'source',
  topWoodRail: 'woodTable001',
  legBase: 'darkWood'
});

export const POOL_ROYALE_SHOWOOD_CONTROL_META = Object.freeze({
  cloth: {
    label: 'Field + cushions cloth',
    description: 'Uses every cloth texture from the Pool Royale cloth library on the field and cushions.'
  },
  topWoodRail: {
    label: 'Top rail frame',
    description: 'Uses every Pool Royale table-finish texture on the main top wood rail frame.'
  },
  legBase: {
    label: 'Legs + base',
    description: 'Uses every Pool Royale table-finish texture on the legs and lower base blocks only.'
  }
});

// PoolRoyale.jsx builds these option lists from the live cloth library and table finish registry
// so the Showood GLB menu always exposes every available texture.
export const POOL_ROYALE_SHOWOOD_CONTROL_OPTIONS = Object.freeze({});
