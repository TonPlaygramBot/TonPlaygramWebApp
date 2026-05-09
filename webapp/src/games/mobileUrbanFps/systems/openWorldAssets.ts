export type OpenWorldAssetKind =
  | 'building'
  | 'vehicle'
  | 'helicopter'
  | 'npc'
  | 'prop'
  | 'mall'
  | 'weapon';

export type OpenWorldAssetEntry = {
  id: string;
  kind: OpenWorldAssetKind;
  name: string;
  glb: string;
  source: string;
  license: 'CC0' | 'CC-BY' | 'Project-owned';
  mobileLod?: string;
};

export const OPEN_WORLD_ASSET_MANIFEST: OpenWorldAssetEntry[] = [
  {
    id: 'kenney-city-apartment-a',
    kind: 'building',
    name: 'Apartment building module',
    glb: '/assets/games/mobile-urban-fps/city/kenney/apartment-a.glb',
    source: 'Kenney City Kit / CC0 replacement slot',
    license: 'CC0',
    mobileLod: '/assets/games/mobile-urban-fps/city/kenney/apartment-a-lod1.glb'
  },
  {
    id: 'kenney-city-shop-row',
    kind: 'building',
    name: 'Shop row building module',
    glb: '/assets/games/mobile-urban-fps/city/kenney/shop-row.glb',
    source: 'Kenney City Kit / CC0 replacement slot',
    license: 'CC0',
    mobileLod: '/assets/games/mobile-urban-fps/city/kenney/shop-row-lod1.glb'
  },
  {
    id: 'tonplaygram-mall-shell',
    kind: 'mall',
    name: 'TonPlaygram mall shell',
    glb: '/assets/games/mobile-urban-fps/city/tonplaygram-mall.glb',
    source: 'Project-owned GLB replacement slot',
    license: 'Project-owned',
    mobileLod: '/assets/games/mobile-urban-fps/city/tonplaygram-mall-lod1.glb'
  },
  {
    id: 'quaternius-helicopter',
    kind: 'helicopter',
    name: 'Large rescue helicopter',
    glb: '/assets/games/mobile-urban-fps/vehicles/helicopter.glb',
    source: 'Quaternius / CC0 replacement slot',
    license: 'CC0',
    mobileLod: '/assets/games/mobile-urban-fps/vehicles/helicopter-lod1.glb'
  },
  {
    id: 'kenney-police-car',
    kind: 'vehicle',
    name: 'Police car',
    glb: '/assets/games/mobile-urban-fps/vehicles/police-car.glb',
    source: 'Kenney vehicle pack / CC0 replacement slot',
    license: 'CC0'
  },
  {
    id: 'kenney-ambulance',
    kind: 'vehicle',
    name: 'Ambulance',
    glb: '/assets/games/mobile-urban-fps/vehicles/ambulance.glb',
    source: 'Kenney vehicle pack / CC0 replacement slot',
    license: 'CC0'
  },
  {
    id: 'quaternius-citizen',
    kind: 'npc',
    name: 'City citizen rig',
    glb: '/assets/games/mobile-urban-fps/characters/citizen.glb',
    source: 'Quaternius character pack / CC0 replacement slot',
    license: 'CC0',
    mobileLod: '/assets/games/mobile-urban-fps/characters/citizen-lod1.glb'
  },
  {
    id: 'poly-pizza-weapon-wall',
    kind: 'weapon',
    name: 'Weapon store wall display',
    glb: '/assets/games/mobile-urban-fps/weapons/poly-pizza-wall-rack.glb',
    source: 'Poly Pizza CC/creator-approved replacement slot',
    license: 'CC-BY'
  }
];

export const OPEN_WORLD_SYSTEM_NAMES = [
  'InputSystem',
  'MobileControlsSystem',
  'PlayerController',
  'CameraController',
  'AimController',
  'WeaponSystem',
  'ShootActionSystem',
  'RecoilSystem',
  'AmmoSystem',
  'HealthSystem',
  'EnemySystem',
  'NPCSystem',
  'VehicleTrafficSystem',
  'HelicopterSystem',
  'CollisionSystem',
  'CityStreamingSystem',
  'AssetLoader',
  'MallSystem',
  'StoreSystem',
  'AudioSystem',
  'GameState',
  'HUDSystem'
] as const;
