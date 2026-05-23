export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

const SNOOKER_GENERIC_GLB_URL =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/snooker_generic/snooker_generic.glb';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'chinese-8ball',
    label: 'Chinese 8-Ball (Snooker Table)',
    description:
      'Open-source Pooltool snooker table GLB matched to the original snooker footprint, rails, and leg geometry.',
    tableSizeId: '9ft',
    baseId: 'snookerGeneric',
    assetUrl: SNOOKER_GENERIC_GLB_URL,
    fallbackAssetUrls: [
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/snooker_generic/snooker_generic.glb',
      `${POOLTOOL_RAW_BASE}/snooker_generic/snooker_generic.glb`
    ],
    icon: '🎱',
    kind: 'gltf',
    fitScale: 1,
    fitFootprintScale: 1,
    fitHeightScale: 1,
    lowerBaseHeightScale: 1,
    legLengthScale: 1,
    clothRepeatScale: 1,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeHeight: true,
    matchNativeUpperComponentHeight: true,
    preserveOriginalFootprintAspect: true,
    useOriginalLayoutSurfaces: true,
    usePoolRoyaleFinish: true,
    usePoolRoyaleFinishRoles: ['cushion', 'pocket', 'trim', 'wood', 'topWoodRail', 'sideWoodApron', 'railSight', 'verticalCornerRim', 'baseCornerBlock'],
    preserveOriginalSurfaceRoles: ['cloth', 'leg', 'baseFoot'],
    tintOriginalTrimGold: true,
    chromeMaterialSurfaceNames: ['diamonds', 'railSight', 'sideApron', 'sideWoodApron', 'apronStrip', 'railSightLower', 'cornerRailSight', 'brandingPlate', 'brandingPlates', 'namePlate', 'railApron', 'stripApron'],
    blackMaterialSurfaceNames: [],
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: [],
    useLegacyShowoodRemap: false,
    tableLogicProfile: 'snookerGenericSnooker9ft',
    cueRigProfile: 'poolRoyaleDefault'
  },
  {
    id: 'showood-7ft',
    label: 'Showood 7 ft',
    description:
      'Precise-mapped 7 ft Showood GLB with dedicated cushion, pocket, and jaw mapping for Pool Royale gameplay.',
    tableSizeId: '7ft',
    baseId: 'showoodOriginal',
    assetUrl:
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb',
    fallbackAssetUrls: [
      `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`
    ],
    icon: '🟩',
    kind: 'gltf',
    fitScale: 1,
    fitFootprintScale: 1,
    fitHeightScale: 1,
    lowerBaseHeightScale: 1,
    legLengthScale: 1,
    clothRepeatScale: 1,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeHeight: true,
    matchNativeUpperComponentHeight: true,
    preserveOriginalFootprintAspect: true,
    useOriginalLayoutSurfaces: true,
    usePoolRoyaleFinish: true,
    usePoolRoyaleFinishRoles: ['cushion', 'pocket', 'trim', 'wood', 'topWoodRail', 'sideWoodApron', 'railSight', 'verticalCornerRim', 'baseCornerBlock'],
    preserveOriginalSurfaceRoles: ['cloth', 'leg', 'baseFoot'],
    tintOriginalTrimGold: true,
    chromeMaterialSurfaceNames: ['diamonds', 'railSight', 'sideApron', 'sideWoodApron', 'apronStrip', 'railSightLower', 'cornerRailSight', 'brandingPlate', 'brandingPlates', 'namePlate', 'railApron', 'stripApron'],
    blackMaterialSurfaceNames: [],
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: [],
    useLegacyShowoodRemap: false,
    tableLogicProfile: 'snookerGenericSnooker9ft',
    cueRigProfile: 'poolRoyaleDefault'
  }
]);

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
    (option) => option.id === 'showood-7ft'
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
