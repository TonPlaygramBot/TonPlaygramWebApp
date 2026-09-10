// Catalog and tuning copied from the supplied code; no standalone game/UI.
export const SAMPLE =
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0';
export const RAW_SAMPLE =
  'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0';
export const FERRARI = 'https://threejs.org/examples/models/gltf/ferrari.glb';
export const BUGGY = `${SAMPLE}/Buggy/glTF-Binary/Buggy.glb`;
export const BUGGY_RAW = `${RAW_SAMPLE}/Buggy/glTF-Binary/Buggy.glb`;

export const KNOWN = {
  awp: 'https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb',
  awpRaw:
    'https://raw.githubusercontent.com/GarbajYT/godot-sniper-rifle/master/AWP.glb',
  mrtk: 'https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  mrtkRaw:
    'https://raw.githubusercontent.com/microsoft/MixedRealityToolkit/main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  pistol:
    'https://cdn.jsdelivr.net/gh/SAAAM-LLC/3D_model_bundle@main/SAM_ASSET-PISTOL-IN-HOLSTER.glb',
  pistolRaw:
    'https://raw.githubusercontent.com/SAAAM-LLC/3D_model_bundle/main/SAM_ASSET-PISTOL-IN-HOLSTER.glb',
  fps: 'https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf',
  fpsRaw:
    'https://raw.githubusercontent.com/lando19/Guns-for-BJS-FPS-Game/main/main/scene.gltf'
};

export const poly = (id) => `https://static.poly.pizza/${id}.glb`;

export const WEAPONS = [
  {
    id: 'shotgun',
    name: 'Shotgun',
    icon: 'SG',
    urls: [poly('032e6589-3188-41bc-b92b-e25528344275'), KNOWN.fps, KNOWN.awp],
    ammo: 6,
    power: 2.2,
    speed: 24,
    cooldown: 0.52
  },
  {
    id: 'assault',
    name: 'Assault Rifle',
    icon: 'AR',
    urls: [poly('b3e6be61-0299-4866-a227-58f5f3fe610b'), KNOWN.mrtk, KNOWN.awp],
    ammo: 18,
    power: 1.2,
    speed: 30,
    cooldown: 0.18
  },
  {
    id: 'pistol',
    name: 'Pistol',
    icon: 'P',
    urls: [
      poly('3b53f0fe-f86e-451c-816d-6ab9bd265cdc'),
      KNOWN.pistol,
      KNOWN.mrtk
    ],
    ammo: 12,
    power: 1.0,
    speed: 28,
    cooldown: 0.28
  },
  {
    id: 'revolver',
    name: 'Heavy Revolver',
    icon: 'RV',
    urls: [
      poly('9e728565-67a3-44db-9567-982320abff09'),
      KNOWN.pistolRaw,
      KNOWN.mrtk
    ],
    ammo: 8,
    power: 1.55,
    speed: 27,
    cooldown: 0.45
  },
  {
    id: 'sawed',
    name: 'Sawed-Off',
    icon: 'SO',
    urls: [
      poly('9a6ee0ee-068b-4774-8b0f-679c3cef0b6e'),
      KNOWN.fpsRaw,
      KNOWN.awp
    ],
    ammo: 5,
    power: 2.5,
    speed: 22,
    cooldown: 0.62
  },
  {
    id: 'silver',
    name: 'Silver Revolver',
    icon: 'SR',
    urls: [
      poly('7951b3b9-d3a5-4ec8-81b7-11111f1c8e88'),
      KNOWN.pistol,
      KNOWN.mrtk
    ],
    ammo: 8,
    power: 1.6,
    speed: 27,
    cooldown: 0.42
  },
  {
    id: 'longshot',
    name: 'Long Shotgun',
    icon: 'LS',
    urls: [poly('f71d6771-f512-4374-bd23-ba00b564db68'), KNOWN.fps, KNOWN.awp],
    ammo: 6,
    power: 2.1,
    speed: 24,
    cooldown: 0.52
  },
  {
    id: 'pump',
    name: 'Pump Shotgun',
    icon: 'PS',
    urls: [
      poly('08f27141-8e64-425a-9161-1bbd6956dfca'),
      KNOWN.fpsRaw,
      KNOWN.awpRaw
    ],
    ammo: 7,
    power: 2.0,
    speed: 24,
    cooldown: 0.5
  },
  {
    id: 'smg',
    name: 'SMG',
    icon: 'SMG',
    urls: [poly('fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710'), KNOWN.mrtk, KNOWN.fps],
    ammo: 24,
    power: 0.85,
    speed: 31,
    cooldown: 0.12
  },
  {
    id: 'ak47',
    name: 'AK47',
    icon: 'AK',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/AK47/scene.gltf',
      KNOWN.awp,
      KNOWN.mrtk
    ],
    ammo: 20,
    power: 1.35,
    speed: 30,
    cooldown: 0.18
  },
  {
    id: 'krsv',
    name: 'KRSV',
    icon: 'KR',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/KRSV/scene.gltf',
      KNOWN.mrtk,
      KNOWN.awp
    ],
    ammo: 18,
    power: 1.25,
    speed: 30,
    cooldown: 0.18
  },
  {
    id: 'smith',
    name: 'Smith',
    icon: 'ST',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models/Smith/scene.gltf',
      KNOWN.pistol,
      KNOWN.mrtk
    ],
    ammo: 10,
    power: 1.15,
    speed: 27,
    cooldown: 0.3
  },
  {
    id: 'mosin',
    name: 'Mosin',
    icon: 'MS',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Mosin/scene.gltf',
      KNOWN.awp,
      KNOWN.awpRaw
    ],
    ammo: 5,
    power: 3.2,
    speed: 36,
    cooldown: 0.8
  },
  {
    id: 'uzi',
    name: 'Uzi',
    icon: 'UZ',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models2/Uzi/scene.gltf',
      KNOWN.mrtk,
      KNOWN.fps
    ],
    ammo: 26,
    power: 0.75,
    speed: 32,
    cooldown: 0.1
  },
  {
    id: 'sig',
    name: 'SigSauer',
    icon: 'SG',
    urls: [
      'https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@main/models3/SigSauer/scene.gltf',
      KNOWN.pistolRaw,
      KNOWN.mrtk
    ],
    ammo: 12,
    power: 1.1,
    speed: 28,
    cooldown: 0.28
  },
  {
    id: 'awp',
    name: 'AWP Sniper',
    icon: 'AWP',
    urls: [KNOWN.awp, KNOWN.awpRaw],
    ammo: 4,
    power: 4.0,
    speed: 40,
    cooldown: 0.95
  },
  {
    id: 'mrtk',
    name: 'MRTK Gun',
    icon: 'MG',
    urls: [KNOWN.mrtk, KNOWN.mrtkRaw],
    ammo: 12,
    power: 1.4,
    speed: 30,
    cooldown: 0.24
  },
  {
    id: 'fps',
    name: 'FPS Shotgun',
    icon: 'FS',
    urls: [KNOWN.fps, KNOWN.fpsRaw, KNOWN.awp],
    ammo: 6,
    power: 2.4,
    speed: 24,
    cooldown: 0.58
  }
];
