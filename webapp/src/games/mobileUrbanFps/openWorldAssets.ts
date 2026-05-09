export type OpenWorldAssetRole =
  | 'building'
  | 'vehicle'
  | 'helicopter'
  | 'npc'
  | 'tree'
  | 'prop'
  | 'weaponStore';

export type OpenWorldAssetDefinition = {
  id: string;
  role: OpenWorldAssetRole;
  label: string;
  urls: string[];
  source: string;
  licenseNote: string;
  targetUse: string;
};

const kenney = 'https://kenney.nl/assets';

export const openWorldAssetManifest: OpenWorldAssetDefinition[] = [
  {
    id: 'quaternius-city-building-pack',
    role: 'building',
    label: 'Quaternius modular city buildings',
    urls: [
      '/assets/games/mobile-urban-fps/city/buildings/quaternius-city-kit.glb'
    ],
    source: 'Quaternius / local optimized GLB slot',
    licenseNote: 'Replace with bundled CC0/royalty-free Quaternius GLB export.',
    targetUse:
      'Primary city towers, shops, police station, hospital, fire station.'
  },
  {
    id: 'kenney-city-kit-roads-props',
    role: 'prop',
    label: 'Kenney city kit roads and props',
    urls: ['/assets/games/mobile-urban-fps/city/props/kenney-city-kit.glb'],
    source: kenney,
    licenseNote:
      'Kenney assets are generally CC0; bundle optimized GLB before production.',
    targetUse: 'Road signs, barriers, fences, benches, lamps, traffic props.'
  },
  {
    id: 'quaternius-vehicles',
    role: 'vehicle',
    label: 'Traffic vehicle set',
    urls: ['/assets/games/mobile-urban-fps/vehicles/traffic-pack.glb'],
    source: 'Quaternius / Kenney vehicle kits',
    licenseNote: 'Use locally bundled open-source GLB variants for mobile.',
    targetUse:
      'Civilian cars, police, ambulance, fire truck, buses, delivery vans.'
  },
  {
    id: 'city-helicopter-glb',
    role: 'helicopter',
    label: 'Large rooftop helicopter',
    urls: [
      'https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/helicopter.glb'
    ],
    source: 'Open-source GLB reference asset',
    licenseNote:
      'Verify upstream license before shipping; keep local optimized copy.',
    targetUse: 'Mall rooftop flyable helicopter and cockpit reference.'
  },
  {
    id: 'domino-royal-humans',
    role: 'npc',
    label: 'Domino Royal human character set',
    urls: ['/assets/games/mobile-urban-fps/characters/domino-royal-humans.glb'],
    source: 'Existing Domino Royal character pipeline',
    licenseNote: 'Bundle the existing in-game human GLBs here for shared use.',
    targetUse:
      'City pedestrians, store NPC, mall game players, playable character skins.'
  },
  {
    id: 'weapon-store-racks',
    role: 'weaponStore',
    label: 'Weapon store racks and display cases',
    urls: ['/assets/games/mobile-urban-fps/stores/weapon-shop.glb'],
    source: 'Poly Pizza / Quaternius / local optimized GLB slot',
    licenseNote:
      'Use only downloadable CC/open assets and keep attribution metadata.',
    targetUse:
      'Weapon racks, glass cases, ammo boxes, shop lights, store counter.'
  }
];

export const openWorldMaterialSources = [
  'Poly Haven PBR HDRI/materials for sky, concrete, asphalt, and metal.',
  'AmbientCG / CGBookcase / 3DTextures PBR sets for roads, wall tiles, mall floors, grass, wood, glass, and worn weapon materials.',
  'ShareTextures and OpenGameArt only where licenses allow commercial redistribution.'
];
