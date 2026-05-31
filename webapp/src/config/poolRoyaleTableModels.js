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
    fitScale: 1.02,
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
    fitScale: 1.02,
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
  'cushion',
  'metalAccent',
  'jaws',
  'topWoodRail',
  'legBase'
]);

export const POOL_ROYALE_SHOWOOD_DEFAULT_PALETTE = Object.freeze({
  cloth: 'a',
  cushion: 'a',
  metalAccent: 'a',
  jaws: 'a',
  topWoodRail: 'a',
  legBase: 'b'
});

export const POOL_ROYALE_SHOWOOD_CONTROL_META = Object.freeze({
  cloth: { label: 'Field cloth', description: 'Only the flat playfield surface.' },
  cushion: {
    label: 'Cushions',
    description: 'Matched green or Black rubber; source cushion texture is preserved like the reference preview.'
  },
  metalAccent: {
    label: 'Rail sights + side strip + feet',
    description: 'One gold/chrome control for rail sights, side apron strip, rims, trims, plates, and feet.'
  },
  jaws: { label: 'Jaws', description: 'Pocket jaws / cups: black or brown.' },
  topWoodRail: { label: 'Top rail frame', description: 'Main top wood rail frame.' },
  legBase: { label: 'Legs + base', description: 'Legs and lower base blocks together, separate from metal accents.' }
});

export const POOL_ROYALE_SHOWOOD_CONTROL_OPTIONS = Object.freeze({
  cloth: Object.freeze({
    a: Object.freeze({ label: 'Green field', color: '#0a7b33', metalness: 0, roughness: 1, envMapIntensity: 0.16 }),
    b: Object.freeze({ label: 'Blue field', color: '#0d4fb8', metalness: 0, roughness: 1, envMapIntensity: 0.16 })
  }),
  cushion: Object.freeze({
    a: Object.freeze({ label: 'Matched green', color: '#064f22', metalness: 0, roughness: 0.88, envMapIntensity: 0.55 }),
    b: Object.freeze({ label: 'Black rubber', color: '#050505', metalness: 0, roughness: 0.86, envMapIntensity: 0.55 })
  }),
  metalAccent: Object.freeze({
    a: Object.freeze({ label: 'Gold', color: '#d8b23d', metalness: 0.98, roughness: 0.06, envMapIntensity: 6.8, clearcoat: 1, clearcoatRoughness: 0.03 }),
    b: Object.freeze({ label: 'Chrome', color: '#d7dde7', metalness: 1, roughness: 0.055, envMapIntensity: 7.2, clearcoat: 1, clearcoatRoughness: 0.025 })
  }),
  jaws: Object.freeze({
    a: Object.freeze({ label: 'Black jaws', color: '#020202', metalness: 0, roughness: 0.96, envMapIntensity: 0.14 }),
    b: Object.freeze({ label: 'Brown jaws', color: '#2a1207', metalness: 0, roughness: 0.88, envMapIntensity: 0.26 })
  }),
  topWoodRail: Object.freeze({
    a: Object.freeze({ label: 'Walnut frame', color: '#5a2608', metalness: 0.02, roughness: 0.38, envMapIntensity: 1.35, clearcoat: 0.42, clearcoatRoughness: 0.18 }),
    b: Object.freeze({ label: 'Black frame', color: '#070605', metalness: 0.04, roughness: 0.28, envMapIntensity: 1.75, clearcoat: 0.7, clearcoatRoughness: 0.1 })
  }),
  legBase: Object.freeze({
    a: Object.freeze({ label: 'Brown legs/base', color: '#3d1706', metalness: 0.02, roughness: 0.52, envMapIntensity: 1, clearcoat: 0.2, clearcoatRoughness: 0.36 }),
    b: Object.freeze({ label: 'Black legs/base', color: '#070504', metalness: 0.04, roughness: 0.4, envMapIntensity: 1.22, clearcoat: 0.32, clearcoatRoughness: 0.26 })
  })
});
