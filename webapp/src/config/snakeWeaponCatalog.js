import { CAPTURE_ANIMATION_OPTIONS } from './ludoBattleOptions.js'
import { swatchThumbnail, weaponSilhouetteThumbnail } from './storeThumbnails.js'

const polyGlb = (uuid) => `https://static.poly.pizza/${uuid}.glb`
const polyWebp = (uuid) => `https://static.poly.pizza/${uuid}.webp`

const polyPizzaWeapon = (id, label, uuid, colors, extra = {}) => ({
  id,
  label,
  thumbnail: extra.thumbnail || polyWebp(uuid),
  urls: [polyGlb(uuid)],
  source: extra.source || 'Poly Pizza',
  creator: extra.creator || undefined,
  license: extra.license || 'CC0 / Poly Pizza source page',
  modelScale: extra.modelScale,
  ...Object.fromEntries(Object.entries(extra).filter(([key]) => !['thumbnail', 'source', 'creator', 'license', 'modelScale'].includes(key))),
  fallbackThumbnail: weaponSilhouetteThumbnail(colors)
})

// Match Ludo Battle Royal's pinned Gunify snapshot so Snake & Ladder uses
// the same authored GLTF material/texture tree instead of whatever is on main.
export const SNAKE_GUNIFY_MAY_9_REF = '27232cf389a2be3f8f476c667cb293e978aaf5f9'
const SNAKE_GUNIFY_RAW_BASE = `https://raw.githubusercontent.com/KrishBharadwaj5678/Gunify/${SNAKE_GUNIFY_MAY_9_REF}`
const SNAKE_GUNIFY_JSDELIVR_BASE = `https://cdn.jsdelivr.net/gh/KrishBharadwaj5678/Gunify@${SNAKE_GUNIFY_MAY_9_REF}`
const SNAKE_GUNIFY_MODEL_FOLDER_BY_NAME = Object.freeze({
  Uzi: 'models2',
  Mosin: 'models2',
  SigSauer: 'models3'
})
const gunifyModelUrls = (modelName) => {
  const modelFolder = SNAKE_GUNIFY_MODEL_FOLDER_BY_NAME[modelName] || 'models'
  return [
    `${SNAKE_GUNIFY_RAW_BASE}/${modelFolder}/${modelName}/scene.gltf`,
    `${SNAKE_GUNIFY_JSDELIVR_BASE}/${modelFolder}/${modelName}/scene.gltf`
  ]
}
const gunifyWeapon = (id, label, modelName, colors, extra = {}) => ({
  id,
  label,
  thumbnail: weaponSilhouetteThumbnail(colors),
  urls: gunifyModelUrls(modelName),
  modelName,
  source: 'Gunify',
  texturePolicy: 'gunifyPbr',
  ...extra
})


const LUDO_CAPTURE_WEAPON_IDS = Object.freeze([
  'fighterJetAttack',
  'helicopterAttack',
  'droneAttack'
])
const LUDO_CAPTURE_OPTION_BY_ID = Object.freeze(
  CAPTURE_ANIMATION_OPTIONS.filter((option) => LUDO_CAPTURE_WEAPON_IDS.includes(option.id)).reduce((acc, option) => {
    acc[option.id] = option
    return acc
  }, {})
)

const ludoVehicleWeapon = (id, vehicleKind, fallbackLabel, fallbackThumbnail, extra = {}) => ({
  id,
  label: LUDO_CAPTURE_OPTION_BY_ID[id]?.label || fallbackLabel,
  description: LUDO_CAPTURE_OPTION_BY_ID[id]?.description,
  thumbnail: LUDO_CAPTURE_OPTION_BY_ID[id]?.thumbnail || fallbackThumbnail,
  source: 'Ludo Battle Royal',
  vehicleKind,
  ...extra
})

export const UKRAINIAN_DRONE_GLB_URLS = Object.freeze([
  'https://cdn.jsdelivr.net/gh/srcejon/sdrangel-3d-models@main/drone.glb',
  'https://raw.githubusercontent.com/srcejon/sdrangel-3d-models/main/drone.glb',
  'https://cdn.statically.io/gh/srcejon/sdrangel-3d-models/main/drone.glb'
])

export const SNAKE_KNOWN_WORKING_GLB = Object.freeze({
  awp: 'https://cdn.jsdelivr.net/gh/GarbajYT/godot-sniper-rifle@master/AWP.glb',
  awpRaw: 'https://raw.githubusercontent.com/GarbajYT/godot-sniper-rifle/master/AWP.glb',
  mrtk: 'https://cdn.jsdelivr.net/gh/microsoft/MixedRealityToolkit@main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  mrtkRaw: 'https://raw.githubusercontent.com/microsoft/MixedRealityToolkit/main/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  mrtkMaster: 'https://cdn.jsdelivr.net/gh/Microsoft/MixedRealityToolkit@master/SpatialInput/Samples/DemoRoom/Media/Models/Gun.glb',
  pistolHolster: 'https://cdn.jsdelivr.net/gh/SAAAM-LLC/3D_model_bundle@main/SAM_ASSET-PISTOL-IN-HOLSTER.glb',
  pistolHolsterRaw: 'https://raw.githubusercontent.com/SAAAM-LLC/3D_model_bundle/main/SAM_ASSET-PISTOL-IN-HOLSTER.glb',
  fps: 'https://cdn.jsdelivr.net/gh/lando19/Guns-for-BJS-FPS-Game@main/main/scene.gltf',
  fpsRaw: 'https://raw.githubusercontent.com/lando19/Guns-for-BJS-FPS-Game/main/main/scene.gltf'
})

export const SNAKE_CAPTURE_WEAPON_OPTIONS = Object.freeze([
  {
    id: 'ukrainianDroneAttack',
    label: 'Ukrainian Drone',
    thumbnail: swatchThumbnail(['#60a5fa', '#facc15', '#1d4ed8']),
    urls: UKRAINIAN_DRONE_GLB_URLS,
    vehicleKind: 'ukrainianDrone'
  },
  ludoVehicleWeapon(
    'fighterJetAttack',
    'fighter',
    'Fighter Jet Attack',
    swatchThumbnail(['#9ca3af', '#475569', '#cbd5e1'])
  ),
  ludoVehicleWeapon(
    'helicopterAttack',
    'helicopter',
    'Helicopter Strike',
    swatchThumbnail(['#84cc16', '#3f6212', '#bef264'])
  ),
  ludoVehicleWeapon(
    'droneAttack',
    'drone',
    'Shahad Drone',
    swatchThumbnail(['#60a5fa', '#1d4ed8', '#bfdbfe'])
  ),
  {
    id: 'supportTruckAttack',
    label: 'Support Truck',
    description: 'Ludo Battle Royal support truck parked with the same capture-vehicle inventory set.',
    thumbnail: swatchThumbnail(['#f97316', '#7c2d12', '#fdba74']),
    source: 'Ludo Battle Royal',
    vehicleKind: 'supportTruck'
  },
  polyPizzaWeapon('poly-shotgun-01', 'Quaternius Shotgun', '032e6589-3188-41bc-b92b-e25528344275', ['#64748b', '#1e293b', '#f8fafc'], { creator: 'Quaternius', modelScale: 1 }),
  polyPizzaWeapon('poly-assault-rifle-01', 'Quaternius Assault Rifle', 'b3e6be61-0299-4866-a227-58f5f3fe610b', ['#334155', '#0f172a', '#94a3b8'], { creator: 'Quaternius', modelScale: 1.02 }),
  polyPizzaWeapon('poly-pistol-01', 'Quaternius Pistol', '3b53f0fe-f86e-451c-816d-6ab9bd265cdc', ['#6b7280', '#111827', '#e5e7eb'], { creator: 'Quaternius', modelScale: 0.6 }),
  polyPizzaWeapon('poly-revolver-01', 'Quaternius Heavy Revolver', '9e728565-67a3-44db-9567-982320abff09', ['#7c2d12', '#1f2937', '#fbbf24'], { creator: 'Quaternius', modelScale: 0.64 }),
  polyPizzaWeapon('poly-sawed-off-01', 'Quaternius Sawed-Off', '9a6ee0ee-068b-4774-8b0f-679c3cef0b6e', ['#78350f', '#0f172a', '#d6d3d1'], { creator: 'Quaternius', modelScale: 0.85 }),
  polyPizzaWeapon('poly-revolver-02', 'Quaternius Revolver Silver', '7951b3b9-d3a5-4ec8-81b7-11111f1c8e88', ['#94a3b8', '#1f2937', '#f8fafc'], { creator: 'Quaternius', modelScale: 0.64 }),
  polyPizzaWeapon('poly-shotgun-02', 'Quaternius Long Shotgun', 'f71d6771-f512-4374-bd23-ba00b564db68', ['#475569', '#020617', '#cbd5e1'], { creator: 'Quaternius', modelScale: 1.05 }),
  polyPizzaWeapon('poly-shotgun-03', 'Quaternius Pump Shotgun', '08f27141-8e64-425a-9161-1bbd6956dfca', ['#52525b', '#111827', '#e2e8f0'], { creator: 'Quaternius', modelScale: 1.03 }),
  polyPizzaWeapon('poly-smg-01', 'Quaternius SMG', 'fb8ae707-d5b9-4eb8-ab8c-1c78d3c1f710', ['#374151', '#030712', '#d1d5db'], { creator: 'Quaternius', modelScale: 0.84 }),
  polyPizzaWeapon('poly-robot-large-gun-01', 'Quaternius Robot Large Gun', '78e23275-cb6a-4ba3-ae5e-48a9b4ee2e65', ['#4b5563', '#111827', '#f97316'], { creator: 'Quaternius', modelScale: 0.83 }),
  polyPizzaWeapon('poly-robot-flying-gun-01', 'Quaternius Robot Flying Gun', '6d0889f1-0c3f-4f98-b011-fbcf6c79a93b', ['#0f766e', '#0f172a', '#67e8f9'], { creator: 'Quaternius', modelScale: 0.78 }),
  polyPizzaWeapon('poly-bazooka-01', 'CreativeTrio Bazooka', '613e3b1b-d07c-496b-94a1-7c85b507bac4', ['#14532d', '#111827', '#facc15'], { creator: 'CreativeTrio', modelScale: 1.08 }),
  polyPizzaWeapon('poly-grenade-launcher-01', 'CreativeTrio Grenade Launcher', '503bb2c5-4a69-404b-9b82-13e85e8f8467', ['#365314', '#111827', '#f97316'], { creator: 'CreativeTrio', modelScale: 0.98 }),
  polyPizzaWeapon('poly-dynamite-bomb-01', 'CreativeTrio Dynamite Bomb', '38e858db-325f-4dce-9680-da62c20c5c31', ['#7f1d1d', '#111827', '#fbbf24'], { creator: 'CreativeTrio', modelScale: 0.58 }),
  polyPizzaWeapon('poly-molotov-01', 'CreativeTrio Molotov', 'd7bb0b50-09af-49f8-b1f9-dbdb0c707d40', ['#92400e', '#111827', '#fb923c'], { creator: 'CreativeTrio', modelScale: 0.46 }),
  polyPizzaWeapon('poly-gas-tank-01', 'Quaternius Gas Tank', '9c4d2ac5-114b-4da2-a26a-8049e2b1ba04', ['#b91c1c', '#111827', '#e5e7eb'], { creator: 'Quaternius', modelScale: 0.62 }),
  polyPizzaWeapon('poly-hand-grenade-01', 'CreativeTrio Hand Grenade', '03fa7f5b-4df5-45d6-86fb-87e8590f28d7', ['#3f6212', '#111827', '#a3e635'], { creator: 'CreativeTrio', modelScale: 0.36 }),
  polyPizzaWeapon('poly-tank-01', 'Quaternius Battle Tank', '58c387b2-636f-49dc-a900-13b0852717d6', ['#334155', '#111827', '#94a3b8'], { creator: 'Quaternius', modelScale: 0.7 }),
  gunifyWeapon('slot-10-ak47-gltf', 'AK47 GLTF', 'AK47', ['#7f1d1d', '#111827', '#f59e0b'], { ludoCaptureScale: 0.24 }),
  gunifyWeapon('slot-11-krsv-gltf', 'KRSV GLTF', 'KRSV', ['#1d4ed8', '#0f172a', '#bfdbfe'], { ludoCaptureScale: 0.24 }),
  gunifyWeapon('slot-12-smith-gltf', 'Smith GLTF', 'Smith', ['#6b7280', '#0f172a', '#f8fafc'], { ludoCaptureScale: 0.13 }),
  gunifyWeapon('slot-13-mosin-gltf', 'Mosin GLTF', 'Mosin', ['#92400e', '#1f2937', '#fcd34d'], { ludoCaptureScale: 0.5125 }),
  gunifyWeapon('slot-14-uzi-gltf', 'Uzi GLTF', 'Uzi', ['#0f766e', '#111827', '#99f6e4'], { ludoCaptureScale: 0.2 }),
  gunifyWeapon('slot-15-sigsauer-gltf', 'SigSauer GLTF', 'SigSauer', ['#334155', '#020617', '#f1f5f9'], { ludoCaptureScale: 0.13 }),
  { id: 'slot-16-awp-glb', label: 'AWP Sniper GLB', thumbnail: weaponSilhouetteThumbnail(['#1e293b', '#0f172a', '#f8fafc']), urls: [SNAKE_KNOWN_WORKING_GLB.awp, SNAKE_KNOWN_WORKING_GLB.awpRaw] },
  { id: 'slot-18-fps-gun-gltf', label: 'FPS Shotgun', thumbnail: weaponSilhouetteThumbnail(['#f59e0b', '#111827', '#fde68a']), urls: [SNAKE_KNOWN_WORKING_GLB.fps, SNAKE_KNOWN_WORKING_GLB.fpsRaw, SNAKE_KNOWN_WORKING_GLB.awp, SNAKE_KNOWN_WORKING_GLB.awpRaw] }
])

export const SNAKE_CAPTURE_WEAPON_ALIAS_MAP = Object.freeze({
  fighter: 'fighterJetAttack',
  fighterjet: 'fighterJetAttack',
  fighterjetattack: 'fighterJetAttack',
  jet: 'fighterJetAttack',
  helicopter: 'helicopterAttack',
  helicopterattack: 'helicopterAttack',
  shahad: 'droneAttack',
  shahaddrone: 'droneAttack',
  drone: 'droneAttack',
  droneattack: 'droneAttack',
  supporttruck: 'supportTruckAttack',
  supporttruckattack: 'supportTruckAttack',
  truck: 'supportTruckAttack',
  polyrobotlargegunattack: 'poly-robot-large-gun-01',
  polyrobotflyinggunattack: 'poly-robot-flying-gun-01',
  polybazooka01attack: 'poly-bazooka-01',
  polygrenadelauncher01attack: 'poly-grenade-launcher-01',
  polydynamitebomb01attack: 'poly-dynamite-bomb-01',
  polymolotov01attack: 'poly-molotov-01',
  polygastank01attack: 'poly-gas-tank-01',
  polyhandgrenade01attack: 'poly-hand-grenade-01',
  polytank01attack: 'poly-tank-01',
  ukrainiandrone: 'ukrainianDroneAttack',
  ukrainiandroneattack: 'ukrainianDroneAttack'
})

export const normalizeSnakeWeaponId = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : ''

export const resolveSnakeCaptureWeaponId = (weaponId) => {
  const normalized = normalizeSnakeWeaponId(weaponId)
  if (!normalized) return ''
  return SNAKE_CAPTURE_WEAPON_ALIAS_MAP[normalized] || normalized
}
