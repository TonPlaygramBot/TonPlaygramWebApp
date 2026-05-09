export type HandMode = 'right' | 'both';
export type GripPreset = 'pistol' | 'rifle' | 'sniper';
export type ItemKind = 'weapon' | 'vehicle' | 'aircraft' | 'equipment';

export type DisplayEntry = {
  id: string;
  name: string;
  shortName: string;
  source: 'Quaternius' | 'Extra' | 'Vehicle' | 'Aircraft' | 'Equipment';
  kind: ItemKind;
  urls: string[];
  handMode?: HandMode;
  gripPreset?: GripPreset;
  rotateY?: number;
  rotateX?: number;
  displayLength?: number;
  floatAmp?: number;
  spinSpeed?: number;
  fallbackColor?: string;
};

export type HandTransform = {
  position: [number, number, number];
  rotation: [number, number, number];
};

export type GripProfile = {
  right: HandTransform;
  left?: HandTransform;
};

export const WEAPON_COUNT = 18;
export const VEHICLE_COUNT = 2;
export const AIRCRAFT_COUNT = 3;
export const EQUIPMENT_COUNT = 3;
export const TOTAL_ITEMS =
  WEAPON_COUNT + VEHICLE_COUNT + AIRCRAFT_COUNT + EQUIPMENT_COUNT;

export const FPS_SHOTGUN_DISPLAY_LENGTH = 1.18;
export const VEHICLE_DISPLAY_LENGTH = 1.55;
export const AIRCRAFT_DISPLAY_LENGTH = 1.7;
export const EQUIPMENT_DISPLAY_LENGTH = 1.7;

const HAND_SIZE_BY_TYPE = {
  pistolRight: 0.052,
  rifleRight: 0.058,
  rifleLeft: 0.054,
  sniperRight: 0.058,
  sniperLeft: 0.054
};

function polyGlb(uuid: string) {
  return `https://static.poly.pizza/${uuid}.glb`;
}

const SAMPLE =
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0';
const RAW_SAMPLE =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0';
const FERRARI = 'https://threejs.org/examples/models/gltf/ferrari.glb';
const BUGGY = `${SAMPLE}/Buggy/glTF-Binary/Buggy.glb`;
const BUGGY_RAW = `${RAW_SAMPLE}/Buggy/glTF-Binary/Buggy.glb`;

const MILITARY_HOSTS = [
  'https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main',
  'https://raw.githubusercontent.com/srcejon/sdrangel-3d-models/main',
  'https://cdn.statically.io/gh/srcejon/sdrangel-3d-models/main'
] as const;

function militaryUrls(filename: string) {
  return MILITARY_HOSTS.map((host) => `${host}/${filename}`);
}

export const KNOWN_WORKING_GLB = {
  awp: 'https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb',
  awpRaw:
    'https://raw.githubusercontent.com/GarbajYT/godot-sniper-rifle/master/AWP.glb',
  mrtk: 'https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  mrtkRaw:
    'https://raw.githubusercontent.com/microsoft/MixedRealityToolkit/main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  mrtkMaster:
    'https://cdn.jsdelivr.net/gh/Microsoft/MixedRealityToolkit@master/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  pistolHolster:
    'https://cdn.jsdelivr.net/gh/SAAAM-LLC/3D_model_bundle@main/SAM_ASSET-PISTOL-IN-HOLSTER.glb',
  pistolHolsterRaw:
    'https://raw.githubusercontent.com/SAAAM-LLC/3D_model_bundle/main/SAM_ASSET-PISTOL-IN-HOLSTER.glb',
  fps: 'https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf',
  fpsRaw:
    'https://raw.githubusercontent.com/lando19/Guns-for-BJS-FPS-Game/main/main/scene.gltf'
};

export const QUATERNIUS_WEAPONS: DisplayEntry[] = [
  {
    id: 'poly-shotgun-01',
    name: 'Quaternius Shotgun',
    shortName: 'Shotgun',
    source: 'Quaternius',
    kind: 'weapon',
    handMode: 'both',
    gripPreset: 'rifle',
    urls: [polyGlb('032e6589-3188-41bc-b92b-e25528344275')]
  },
  {
    id: 'poly-assault-rifle-01',
    name: 'Quaternius Assault Rifle',
    shortName: 'Assault Rifle',
    source: 'Quaternius',
    kind: 'weapon',
    handMode: 'both',
    gripPreset: 'rifle',
    urls: [polyGlb('b3e6be61-0299-4866-a227-58f5f3fe610b')]
  },
  {
    id: 'poly-pistol-01',
    name: 'Quaternius Pistol',
    shortName: 'Pistol',
    source: 'Quaternius',
    kind: 'weapon',
    handMode: 'right',
    gripPreset: 'pistol',
    urls: [polyGlb('3b53f0fe-f86e-451c-816d-6ab9bd265cdc')]
  },
  {
    id: 'poly-revolver-01',
    name: 'Quaternius Heavy Revolver',
    shortName: 'Heavy Revolver',
    source: 'Quaternius',
    kind: 'weapon',
    handMode: 'right',
    gripPreset: 'pistol',
    urls: [polyGlb('9e728565-67a3-44db-9567-982320abff09')]
  },
  {
    id: 'poly-sawed-off-01',
    name: 'Quaternius Sawed-Off Shotgun',
    shortName: 'Sawed-Off',
    source: 'Quaternius',
    kind: 'weapon',
    handMode: 'right',
    gripPreset: 'pistol',
    urls: [polyGlb('9a6ee0ee-068b-4774-8b0f-679c3cef0b6e')]
  },
  {
    id: 'poly-revolver-02',
    name: 'Quaternius Revolver Silver',
    shortName: 'Silver Revolver',
    source: 'Quaternius',
    kind: 'weapon',
    handMode: 'right',
    gripPreset: 'pistol',
    urls: [polyGlb('7951b3b9-d3a5-4ec8-81b7-11111f1c8e88')]
  },
  {
    id: 'poly-shotgun-02',
    name: 'Quaternius Long Shotgun',
    shortName: 'Long Shotgun',
    source: 'Quaternius',
    kind: 'weapon',
    handMode: 'both',
    gripPreset: 'rifle',
    urls: [polyGlb('f71d6771-f512-4374-bd23-ba00b564db68')]
  },
  {
    id: 'poly-shotgun-03',
    name: 'Quaternius Pump Shotgun',
    shortName: 'Pump Shotgun',
    source: 'Quaternius',
    kind: 'weapon',
    handMode: 'both',
    gripPreset: 'rifle',
    urls: [polyGlb('08f27141-8e64-425a-9161-1bbd6956dfca')]
  },
  {
    id: 'poly-smg-01',
    name: 'Quaternius Submachine Gun',
    shortName: 'SMG',
    source: 'Quaternius',
    kind: 'weapon',
    handMode: 'both',
    gripPreset: 'rifle',
    urls: [polyGlb('fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710')]
  }
];

export const EXTRA_WEAPONS: DisplayEntry[] = [
  {
    id: 'slot-10-ak47-gltf',
    name: 'AK47 GLTF',
    shortName: 'AK47',
    source: 'Extra',
    kind: 'weapon',
    handMode: 'both',
    gripPreset: 'rifle',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/AK47/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/AK47/scene.gltf',
      KNOWN_WORKING_GLB.awp,
      KNOWN_WORKING_GLB.awpRaw
    ]
  },
  {
    id: 'slot-11-krsv-gltf',
    name: 'KRSV GLTF',
    shortName: 'KRSV',
    source: 'Extra',
    kind: 'weapon',
    handMode: 'both',
    gripPreset: 'rifle',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/KRSV/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/KRSV/scene.gltf',
      KNOWN_WORKING_GLB.mrtk,
      KNOWN_WORKING_GLB.mrtkRaw
    ]
  },
  {
    id: 'slot-12-smith-gltf',
    name: 'Smith GLTF',
    shortName: 'Smith',
    source: 'Extra',
    kind: 'weapon',
    handMode: 'right',
    gripPreset: 'pistol',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/Smith/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models/Smith/scene.gltf',
      KNOWN_WORKING_GLB.pistolHolster,
      KNOWN_WORKING_GLB.pistolHolsterRaw
    ]
  },
  {
    id: 'slot-13-mosin-gltf',
    name: 'Mosin GLTF',
    shortName: 'Mosin',
    source: 'Extra',
    kind: 'weapon',
    handMode: 'both',
    gripPreset: 'sniper',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Mosin/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Mosin/scene.gltf',
      KNOWN_WORKING_GLB.awp,
      KNOWN_WORKING_GLB.awpRaw
    ]
  },
  {
    id: 'slot-14-uzi-gltf',
    name: 'Uzi GLTF',
    shortName: 'Uzi',
    source: 'Extra',
    kind: 'weapon',
    handMode: 'both',
    gripPreset: 'rifle',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Uzi/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models2/Uzi/scene.gltf',
      KNOWN_WORKING_GLB.mrtk,
      KNOWN_WORKING_GLB.mrtkMaster
    ]
  },
  {
    id: 'slot-15-sigsauer-gltf',
    name: 'SigSauer GLTF',
    shortName: 'SigSauer',
    source: 'Extra',
    kind: 'weapon',
    handMode: 'right',
    gripPreset: 'pistol',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models3/SigSauer/scene.gltf',
      'https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/main/models3/SigSauer/scene.gltf',
      KNOWN_WORKING_GLB.pistolHolster,
      KNOWN_WORKING_GLB.pistolHolsterRaw
    ]
  },
  {
    id: 'slot-16-awp-glb',
    name: 'AWP Sniper GLB',
    shortName: 'AWP Sniper',
    source: 'Extra',
    kind: 'weapon',
    handMode: 'both',
    gripPreset: 'sniper',
    urls: [KNOWN_WORKING_GLB.awp, KNOWN_WORKING_GLB.awpRaw]
  },
  {
    id: 'slot-17-mrtk-gun-glb',
    name: 'MRTK Gun GLB',
    shortName: 'MRTK Gun',
    source: 'Extra',
    kind: 'weapon',
    handMode: 'both',
    gripPreset: 'rifle',
    urls: [
      KNOWN_WORKING_GLB.mrtk,
      KNOWN_WORKING_GLB.mrtkRaw,
      KNOWN_WORKING_GLB.mrtkMaster
    ]
  },
  {
    id: 'slot-18-fps-gun-gltf',
    name: 'FPS Gun GLTF',
    shortName: 'FPS Shotgun',
    source: 'Extra',
    kind: 'weapon',
    handMode: 'both',
    gripPreset: 'rifle',
    urls: [
      KNOWN_WORKING_GLB.fps,
      KNOWN_WORKING_GLB.fpsRaw,
      KNOWN_WORKING_GLB.awp,
      KNOWN_WORKING_GLB.awpRaw
    ]
  }
];

export const VEHICLES: DisplayEntry[] = [
  {
    id: 'vehicle-19-ferrari-sports-car',
    name: 'Ferrari Sports Car',
    shortName: 'Ferrari',
    source: 'Vehicle',
    kind: 'vehicle',
    urls: [FERRARI],
    rotateY: Math.PI,
    displayLength: VEHICLE_DISPLAY_LENGTH
  },
  {
    id: 'vehicle-20-go-kart-buggy',
    name: 'Go-Kart Buggy',
    shortName: 'Go-Kart',
    source: 'Vehicle',
    kind: 'vehicle',
    urls: [BUGGY, BUGGY_RAW, FERRARI],
    displayLength: VEHICLE_DISPLAY_LENGTH
  }
];

export const AIRCRAFT: DisplayEntry[] = [
  {
    id: 'aircraft-21-military-drone',
    name: 'Military Drone',
    shortName: 'Drone',
    source: 'Aircraft',
    kind: 'aircraft',
    urls: militaryUrls('drone.glb'),
    rotateY: 0.45,
    displayLength: AIRCRAFT_DISPLAY_LENGTH,
    floatAmp: 0.06,
    spinSpeed: 0.0015,
    fallbackColor: '#7b8792'
  },
  {
    id: 'aircraft-22-military-helicopter',
    name: 'Military Helicopter',
    shortName: 'Helicopter',
    source: 'Aircraft',
    kind: 'aircraft',
    urls: militaryUrls('helicopter.glb'),
    rotateY: -0.55,
    displayLength: AIRCRAFT_DISPLAY_LENGTH * 1.12,
    floatAmp: 0.045,
    spinSpeed: 0.001,
    fallbackColor: '#6f7763'
  },
  {
    id: 'aircraft-23-f15-fighter-jet',
    name: 'F-15 Fighter Jet',
    shortName: 'F-15 Jet',
    source: 'Aircraft',
    kind: 'aircraft',
    urls: militaryUrls('f15.glb'),
    rotateY: -0.18,
    displayLength: AIRCRAFT_DISPLAY_LENGTH * 1.14,
    floatAmp: 0.04,
    spinSpeed: 0.0008,
    fallbackColor: '#9aa2aa'
  }
];

export const EQUIPMENT: DisplayEntry[] = [
  {
    id: 'equipment-24-atlas-v-rocket',
    name: 'Atlas V Rocket',
    shortName: 'Rocket',
    source: 'Equipment',
    kind: 'equipment',
    urls: militaryUrls('atlas_v.glb'),
    rotateY: 0.15,
    displayLength: EQUIPMENT_DISPLAY_LENGTH * 1.35,
    floatAmp: 0.018,
    spinSpeed: 0.00045,
    fallbackColor: '#d9dedf'
  },
  {
    id: 'equipment-25-antenna-tower',
    name: 'Antenna Tower',
    shortName: 'Antenna',
    source: 'Equipment',
    kind: 'equipment',
    urls: militaryUrls('antenna.glb'),
    rotateY: 0.4,
    displayLength: EQUIPMENT_DISPLAY_LENGTH * 1.3,
    floatAmp: 0.012,
    spinSpeed: 0.00035,
    fallbackColor: '#707981'
  },
  {
    id: 'equipment-26-support-truck',
    name: 'Support Truck',
    shortName: 'Support Truck',
    source: 'Equipment',
    kind: 'equipment',
    urls: militaryUrls('fire_truck.glb'),
    rotateY: 0.55,
    displayLength: EQUIPMENT_DISPLAY_LENGTH * 1.05,
    floatAmp: 0.02,
    spinSpeed: 0.0008,
    fallbackColor: '#a92a24'
  }
];

export const DISPLAY_ITEMS: DisplayEntry[] = [
  ...QUATERNIUS_WEAPONS,
  ...EXTRA_WEAPONS,
  ...VEHICLES,
  ...AIRCRAFT,
  ...EQUIPMENT
];

export const FIRST_PERSON_WEAPON =
  EXTRA_WEAPONS.find((entry) => entry.id === 'slot-10-ak47-gltf') ??
  DISPLAY_ITEMS[0];
export const FPS_HAND_DONOR =
  EXTRA_WEAPONS.find((entry) => entry.id === 'slot-18-fps-gun-gltf') ??
  DISPLAY_ITEMS[0];

export const GRIP_PROFILES: Record<GripPreset, GripProfile> = {
  pistol: {
    right: { position: [0.055, 0.068, 0.012], rotation: [0.0, -1.2, 0.03] }
  },
  rifle: {
    right: { position: [0.09, 0.078, 0.018], rotation: [0.02, -1.16, 0.04] },
    left: { position: [-0.16, 0.074, 0.032], rotation: [0.05, -1.36, 0.09] }
  },
  sniper: {
    right: { position: [0.095, 0.078, 0.018], rotation: [0.02, -1.15, 0.04] },
    left: { position: [-0.25, 0.072, 0.036], rotation: [0.06, -1.4, 0.1] }
  }
};

export const GRIP_OVERRIDES: Partial<Record<string, Partial<GripProfile>>> = {
  'poly-pistol-01': {
    right: { position: [0.05, 0.064, 0.01], rotation: [0.0, -1.22, 0.03] }
  },
  'poly-revolver-01': {
    right: { position: [0.052, 0.066, 0.01], rotation: [0.02, -1.2, 0.03] }
  },
  'poly-revolver-02': {
    right: { position: [0.052, 0.066, 0.01], rotation: [0.02, -1.2, 0.03] }
  },
  'poly-sawed-off-01': {
    right: { position: [0.058, 0.066, 0.012], rotation: [0.02, -1.18, 0.04] }
  },
  'slot-14-uzi-gltf': {
    left: { position: [-0.115, 0.072, 0.028], rotation: [0.05, -1.34, 0.08] }
  },
  'slot-16-awp-glb': {
    left: { position: [-0.28, 0.07, 0.035], rotation: [0.08, -1.42, 0.1] }
  }
};

const HAND_SIZE_OVERRIDES: Partial<
  Record<string, Partial<Record<'right' | 'left', number>>>
> = {
  'poly-pistol-01': { right: 0.047 },
  'poly-revolver-01': { right: 0.049 },
  'poly-revolver-02': { right: 0.049 },
  'poly-sawed-off-01': { right: 0.05 },
  'slot-12-smith-gltf': { right: 0.049 },
  'slot-15-sigsauer-gltf': { right: 0.049 },
  'slot-16-awp-glb': { right: 0.055, left: 0.051 }
};

export function mergedGripProfile(entry: DisplayEntry): GripProfile | null {
  if (entry.kind !== 'weapon' || !entry.gripPreset) return null;
  const base = GRIP_PROFILES[entry.gripPreset];
  const override = GRIP_OVERRIDES[entry.id] || {};
  return {
    right: override.right ?? base.right,
    left: override.left ?? base.left
  };
}

export function targetHandSize(entry: DisplayEntry, side: 'left' | 'right') {
  const fromOverride = HAND_SIZE_OVERRIDES[entry.id]?.[side];
  if (fromOverride) return fromOverride;
  if (entry.gripPreset === 'pistol') return HAND_SIZE_BY_TYPE.pistolRight;
  if (entry.gripPreset === 'sniper') {
    return side === 'right'
      ? HAND_SIZE_BY_TYPE.sniperRight
      : HAND_SIZE_BY_TYPE.sniperLeft;
  }
  return side === 'right'
    ? HAND_SIZE_BY_TYPE.rifleRight
    : HAND_SIZE_BY_TYPE.rifleLeft;
}

function isModelUrl(url: string) {
  return /\.(glb|gltf)(\?|#|$)/i.test(url);
}

export function runAssetSelfTests() {
  if (DISPLAY_ITEMS.length !== TOTAL_ITEMS)
    throw new Error('Urban FPS assets must have exactly 26 display items');
  if (
    DISPLAY_ITEMS.filter((item) => item.kind === 'weapon').length !==
    WEAPON_COUNT
  )
    throw new Error('Urban FPS assets must keep exactly 18 weapons');
  if (
    DISPLAY_ITEMS.filter((item) => item.kind === 'vehicle').length !==
    VEHICLE_COUNT
  )
    throw new Error('Urban FPS assets must keep exactly 2 vehicles');
  if (
    DISPLAY_ITEMS.filter((item) => item.kind === 'aircraft').length !==
    AIRCRAFT_COUNT
  )
    throw new Error('Urban FPS assets must keep exactly 3 aircraft');
  if (
    DISPLAY_ITEMS.filter((item) => item.kind === 'equipment').length !==
    EQUIPMENT_COUNT
  )
    throw new Error('Urban FPS assets must keep exactly 3 equipment items');
  if (new Set(DISPLAY_ITEMS.map((item) => item.id)).size !== TOTAL_ITEMS)
    throw new Error('Urban FPS asset ids must be unique');
  if (!DISPLAY_ITEMS.every((item) => item.urls.length > 0))
    throw new Error('Each Urban FPS asset needs at least one URL');
  if (!DISPLAY_ITEMS.every((item) => item.urls.every(isModelUrl)))
    throw new Error('All Urban FPS assets must be GLB/GLTF');
}

runAssetSelfTests();
