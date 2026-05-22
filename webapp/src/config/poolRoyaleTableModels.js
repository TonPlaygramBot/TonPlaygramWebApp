export const POOL_ROYALE_TABLE_MODEL_STORAGE_KEY = 'poolRoyaleTableModel';

const POOLTOOL_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

const SHOWOOD_LOCAL_ASSET_PATH = '/assets/models/pool/showood-seven-foot.glb';
const SNOOKER_LOCAL_ASSET_PATH = 'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/snooker.glb';

export const POOL_ROYALE_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: 'showood-seven-foot',
    label: 'Showood 7 ft GLB',
    description:
      'Open-source Pooltool Showood showroom table matched to Pool Royale footprint. If the CDN GLB cannot load, Pool Royale retries the raw Showood GLB and keeps the Showood original base and legs.',
    tableSizeId: '7ft',
    baseId: 'showoodOriginal',
    assetUrl: SHOWOOD_LOCAL_ASSET_PATH,
    fallbackAssetUrls: [
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/seven_foot_showood/seven_foot_showood.glb',
      `${POOLTOOL_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`
    ],
    icon: '🟫',
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
    useOriginalLayoutSurfaces: true,
    usePoolRoyaleFinish: true,
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'pocket', 'trim'],
    preserveOriginalSurfaceRoles: ['wood'],
    tintOriginalTrimGold: true,
    chromeMaterialSurfaceNames: ['diamonds', 'railSight', 'sideApron', 'sideWoodApron', 'apronStrip', 'railSightLower', 'cornerRailSight'],
    blackMaterialSurfaceNames: [],
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: [],
    useLegacyShowoodRemap: false,
    tableLogicProfile: 'showood7ft',
    cueRigProfile: 'poolRoyaleDefault'
  },
  {
    id: 'chinese-8ball-snooker',
    label: 'Chinese 8-Ball (9 ft)',
    description:
      'Snooker Royal GLB 9 ft table shell adapted for Pool Royale 8-ball mapping and physics.',
    tableSizeId: '9ft',
    baseId: 'showoodOriginal',
    assetUrl: SNOOKER_LOCAL_ASSET_PATH,
    fallbackAssetUrls: [
      'https://cdn.jsdelivr.net/gh/ekiefl/pooltool@main/pooltool/models/table/snooker.glb',
      `${POOLTOOL_RAW_BASE}/snooker.glb`
    ],
    icon: '🇨🇳',
    kind: 'gltf',
    fitScale: 1,
    fitFootprintScale: 1.04,
    fitHeightScale: 1,
    clothRepeatScale: 7.2,
    fitStrategy: 'exact',
    fitReference: 'upperTabletop',
    matchNativeHeight: true,
    preserveOriginalFootprintAspect: true,
    useOriginalLayoutSurfaces: true,
    usePoolRoyaleFinish: true,
    usePoolRoyaleFinishRoles: ['cloth', 'cushion', 'pocket', 'trim'],
    preserveOriginalSurfaceRoles: ['wood'],
    tintOriginalTrimGold: true,
    chromeMaterialSurfaceNames: ['diamonds', 'railSight', 'sideApron', 'apronStrip'],
    blackMaterialSurfaceNames: [],
    forceGeneratedChromePlates: false,
    hideSurfaceRoles: [],
    tableLogicProfile: 'chinese8Ball9ft',
    cueRigProfile: 'snookerRoyalProvided'
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
