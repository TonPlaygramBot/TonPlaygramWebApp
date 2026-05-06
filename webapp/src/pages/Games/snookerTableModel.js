export const TABLE_MODEL_CLASSIC = 'classic';
export const TABLE_MODEL_OPENSOURCE = 'opensource';
export const TABLE_MODEL_SHOWOOD = 'showood-seven-foot';
export const TABLE_MODEL_OPENSOURCE_GLB_URL =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table/snooker_generic/snooker_generic.glb';

const POOLTOOL_TABLE_RAW_BASE =
  'https://raw.githubusercontent.com/ekiefl/pooltool/main/pooltool/models/table';

export const TABLE_MODEL_SHOWOOD_ASSET_URL =
  `${POOLTOOL_TABLE_RAW_BASE}/seven_foot_showood/seven_foot_showood_pbr.glb`;
export const TABLE_MODEL_SHOWOOD_FALLBACK_ASSET_URL =
  `${POOLTOOL_TABLE_RAW_BASE}/seven_foot_showood/seven_foot_showood.glb`;

export const SNOOKER_TABLE_MODEL_OPTIONS = Object.freeze([
  {
    id: TABLE_MODEL_CLASSIC,
    label: 'Classic Table',
    description: 'Current playable procedural Snooker Royal table.',
    kind: 'native'
  },
  {
    id: TABLE_MODEL_OPENSOURCE,
    label: 'New Snooker Table',
    description: 'Open-source Pooltool snooker_generic GLB visual fitted to the playable table.',
    kind: 'gltf',
    assetUrl: TABLE_MODEL_OPENSOURCE_GLB_URL,
    fitStrategy: 'contain',
    useSnookerRoyalFinish: false
  },
  {
    id: TABLE_MODEL_SHOWOOD,
    aliases: ['showood', 'showood7', 'showood-7ft', 'showood-seven-foot'],
    label: 'Showood 7 ft Table',
    description: 'Pooltool Showood GLB fitted exactly to the Snooker Royal table and remapped to the selected finish.',
    kind: 'gltf',
    assetUrl: TABLE_MODEL_SHOWOOD_ASSET_URL,
    fallbackAssetUrl: TABLE_MODEL_SHOWOOD_FALLBACK_ASSET_URL,
    fitStrategy: 'exact',
    fitScale: 1,
    useSnookerRoyalFinish: true
  }
]);

export function resolveSnookerTableModelOption(value) {
  const requested = String(value || '').toLowerCase();
  return (
    SNOOKER_TABLE_MODEL_OPTIONS.find(
      (option) =>
        option.id.toLowerCase() === requested ||
        option.aliases?.some((alias) => alias.toLowerCase() === requested)
    ) || SNOOKER_TABLE_MODEL_OPTIONS[0]
  );
}

export function resolveSnookerTableModel(value) {
  return resolveSnookerTableModelOption(value).id;
}

export function applySnookerTableModelParam(params, tableModel) {
  const resolved = resolveSnookerTableModel(tableModel);
  params.set('tableModel', resolved);
  return resolved;
}
