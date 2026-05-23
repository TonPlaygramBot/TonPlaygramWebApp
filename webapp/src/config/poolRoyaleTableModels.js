export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

const SNOOKER_GENERIC_GLB_URL =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/snooker_generic/snooker_generic.glb';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'snooker-generic',
    label: 'Snooker Generic GLB',
    description:
      'Open-source Pooltool snooker table GLB matched to the current Pool Royale footprint and table height.',
    tableSizeId: '7ft',
    baseId: 'snookerGeneric',
    assetUrl: SNOOKER_GENERIC_GLB_URL,
    fallbackAssetUrls: [
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/snooker_generic/snooker_generic.glb',
      `${POOLTOOL_RAW_BASE}/snooker_generic/snooker_generic.glb`
    ],
    icon: '🎱',
    kind: 'gltf',
    fitScale: 1,
    fitFootprintScale: 1.105,
    fitHeightScale: 1,
    lowerBaseHeightScale: 1.38,
    legLengthScale: 2.05,
    clothRepeatScale: 7.5,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeHeight: true,
    matchNativeUpperComponentHeight: true,
    preserveOriginalFootprintAspect: true,
    useOriginalLayoutSurfaces: false,
    usePoolRoyaleFinish: true,
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'pocket', 'trim', 'wood', 'topWoodRail', 'sideWoodApron', 'railSight', 'verticalCornerRim', 'baseCornerBlock', 'leg', 'baseFoot'],
    preserveOriginalSurfaceRoles: [],
    tintOriginalTrimGold: true,
    chromeMaterialSurfaceNames: ['diamonds', 'railSight', 'sideApron', 'sideWoodApron', 'apronStrip', 'railSightLower', 'cornerRailSight', 'brandingPlate', 'brandingPlates', 'namePlate', 'railApron', 'stripApron'],
    blackMaterialSurfaceNames: [],
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: [],
    useLegacyShowoodRemap: false,
    tableLogicProfile: 'snookerGenericPool8',
    cueRigProfile: 'poolRoyaleDefault'
  }
]);

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
    (option) => option.id === 'snooker-generic'
  )?.id || POOL_ROYALE_TABLE_MODEL_OPTIONS[0].id;

export function resolvePoolRoyaleTableModel(modelId) {
  const key = typeof modelId === 'string' ? modelId.trim() : '';
  return (
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find((option) => option.id === key) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
      (option) => option.id === DEFAULT_POOL_ROYALE_TABLE_MODEL_ID
    ) ||
    POOL_ROYALE_TABLE_MODEL_OPTIONS[0]
  );
}
