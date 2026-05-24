export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

const SNOOKER_GENERIC_GLB_URL =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/snooker_generic/snooker_generic.glb';


const SHOWOOD_7FT_GLB_URL =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/showood_7ft/showood_7ft.glb';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'snooker-generic',
    label: 'Snooker Generic GLB',
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
    usePoolRoyaleFinishRoles: ['cushion', 'pocket', 'trim', 'wood', 'topWoodRail', 'sideWoodApron', 'railSight', 'verticalCornerRim', 'baseCornerBlock', 'leg', 'baseFoot'],
    preserveOriginalSurfaceRoles: ['cloth'],
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
    id: 'showood-seven-foot',
    label: 'Showood 7ft GLB',
    description:
      'Open-source Pooltool showood 7ft GLB matched to the compact 7ft gameplay footprint.',
    tableSizeId: '7ft',
    baseId: 'showood7ft',
    assetUrl: SHOWOOD_7FT_GLB_URL,
    fallbackAssetUrls: [
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/showood_7ft/showood_7ft.glb',
      `${POOLTOOL_RAW_BASE}/showood_7ft/showood_7ft.glb`
    ],
    icon: '🪵',
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
    usePoolRoyaleFinish: false,
    usePoolRoyaleFinishRoles: [],
    preserveOriginalSurfaceRoles: ['cloth', 'cushion', 'pocket', 'trim', 'wood', 'topWoodRail', 'sideWoodApron', 'railSight', 'verticalCornerRim', 'baseCornerBlock', 'leg', 'baseFoot'],
    tintOriginalTrimGold: false,
    chromeMaterialSurfaceNames: ['diamonds', 'railSight', 'namePlate', 'railApron', 'stripApron'],
    blackMaterialSurfaceNames: [],
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: [],
    useLegacyShowoodRemap: false,
    tableLogicProfile: 'showood7ft',
    cueRigProfile: 'poolRoyaleDefault'
  }
]);

export const DEFAULT_POOL_ROYALE_TABLE_MODEL_ID =
  POOL_ROYALE_TABLE_MODEL_OPTIONS.find(
    (option) => option.id === 'showood-seven-foot'
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
