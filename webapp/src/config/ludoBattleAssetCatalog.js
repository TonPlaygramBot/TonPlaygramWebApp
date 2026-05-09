// Open-source asset manifest for Ludo Battle Royal weapon pickups/projectiles.
// Poly Pizza search pages can be Cloudflare protected in automation, so keep the
// canonical model pages and static preview ids here for manual Unity imports.
const polyModel = (id) => `https://poly.pizza/m/${id}`;
const polyBundle = (id) => `https://poly.pizza/bundle/${id}`;
const polyPreview = (uuid) => `https://static.poly.pizza/${uuid}.webp`;
const polyGlb = (uuid) => `https://static.poly.pizza/${uuid}.glb`;

export const LUDO_POLY_PIZZA_TANK_ASSETS = Object.freeze([
  {
    id: 'poly-tank-animated-01',
    attackId: 'polyTank01Attack',
    label: 'Quaternius Animated Tank Mk I',
    author: 'Quaternius',
    license: 'CC0-1.0',
    sourcePage: polyBundle('Animated-Tank-Pack-0tfvbeAJkU'),
    modelPage: polyModel('Dc4k4CooN3'),
    preview: polyPreview('52977e64-f4b3-4845-9d44-fe50ec8154e3'),
    candidateUrls: [polyGlb('52977e64-f4b3-4845-9d44-fe50ec8154e3')],
    weaponType: 'GrenadeLauncher',
    ammoVisualType: 'Rocket',
    grip: { rightHandBackFromMuzzle: 0.2, leftHandBackFromMuzzle: 0.34, leftHandSideOffset: 0.1, handLift: 0.04 },
    animationHints: ['turret recoil', 'track idle', 'barrel settle']
  },
  {
    id: 'poly-tank-animated-02',
    attackId: 'polyTank02Attack',
    label: 'Quaternius Animated Tank Mk II',
    author: 'Quaternius',
    license: 'CC0-1.0',
    sourcePage: polyBundle('Animated-Tank-Pack-0tfvbeAJkU'),
    preview: polyPreview('58c387b2-636f-49dc-a900-13b0852717d6'),
    candidateUrls: [polyGlb('58c387b2-636f-49dc-a900-13b0852717d6')],
    weaponType: 'GrenadeLauncher',
    ammoVisualType: 'Rocket',
    grip: { rightHandBackFromMuzzle: 0.22, leftHandBackFromMuzzle: 0.36, leftHandSideOffset: 0.11, handLift: 0.05 },
    animationHints: ['heavy cannon recoil', 'turret traverse']
  },
  {
    id: 'poly-tank-animated-03',
    attackId: 'polyTank03Attack',
    label: 'Quaternius Animated Tank Desert',
    author: 'Quaternius',
    license: 'CC0-1.0',
    sourcePage: polyBundle('Animated-Tank-Pack-0tfvbeAJkU'),
    preview: polyPreview('4a40c214-87f9-4cdb-bc72-003c96f49f76'),
    candidateUrls: [polyGlb('4a40c214-87f9-4cdb-bc72-003c96f49f76')],
    weaponType: 'GrenadeLauncher',
    ammoVisualType: 'Rocket',
    grip: { rightHandBackFromMuzzle: 0.2, leftHandBackFromMuzzle: 0.32, leftHandSideOffset: 0.1, handLift: 0.04 },
    animationHints: ['desert cannon recoil', 'track idle']
  },
  {
    id: 'poly-tank-animated-04',
    attackId: 'polyTank04Attack',
    label: 'Quaternius Animated Rocket Tank',
    author: 'Quaternius',
    license: 'CC0-1.0',
    sourcePage: polyBundle('Animated-Tank-Pack-0tfvbeAJkU'),
    preview: polyPreview('c0135fb4-3307-4c0f-a439-86ceafedc4c7'),
    candidateUrls: [polyGlb('c0135fb4-3307-4c0f-a439-86ceafedc4c7')],
    weaponType: 'GrenadeLauncher',
    ammoVisualType: 'Missile',
    grip: { rightHandBackFromMuzzle: 0.25, leftHandBackFromMuzzle: 0.4, leftHandSideOffset: 0.12, handLift: 0.06 },
    animationHints: ['launcher tube recoil', 'rocket exhaust']
  }
]);

export const LUDO_POLY_PIZZA_AMMO_ASSETS = Object.freeze([
  {
    id: 'ammo-9mm-pistol-creative-trio',
    label: 'Pistol Ammo',
    author: 'CreativeTrio',
    license: 'CC0-1.0',
    sourcePage: polyModel('Kh2hNjWMXA'),
    ammoVisualType: 'NineMillimeter',
    usedBy: ['Pistol', 'SMG'],
    shellEject: { mass: 0.012, speed: [1.7, 2.8], lift: [0.65, 1.1], tumble: 16 }
  },
  {
    id: 'ammo-762-j-toastie',
    label: '7.62x39mm Round',
    author: 'J-Toastie',
    license: 'CC-BY-3.0',
    sourcePage: polyModel('olPaiJI58u'),
    ammoVisualType: 'SevenSixTwoRifle',
    usedBy: ['Rifle', 'Sniper'],
    shellEject: { mass: 0.018, speed: [2.1, 3.3], lift: [0.85, 1.35], tumble: 18 }
  },
  {
    id: 'ammo-bullet-poly-google',
    label: 'Bullet Projectile',
    author: 'Poly by Google',
    license: 'CC-BY-3.0',
    sourcePage: polyModel('2_eJPKc_a_D'),
    ammoVisualType: 'FiveFiveSixRifle',
    usedBy: ['Rifle', 'SMG', 'Sniper'],
    shellEject: { mass: 0.016, speed: [2.0, 3.2], lift: [0.75, 1.25], tumble: 15 }
  },
  {
    id: 'ammo-shotgun-creative-trio',
    label: 'Shotgun Ammo',
    author: 'CreativeTrio',
    license: 'CC0-1.0',
    sourcePage: 'https://poly.pizza/search/Ammo%20Shotgun',
    ammoVisualType: 'ShotgunShell',
    usedBy: ['Shotgun'],
    pelletsPerShot: 8,
    shellEject: { mass: 0.025, speed: [1.5, 2.4], lift: [0.8, 1.4], tumble: 12 }
  },
  {
    id: 'ammo-grenade-launcher-creative-trio',
    label: 'Grenade Launcher Ammo',
    author: 'CreativeTrio',
    license: 'CC0-1.0',
    sourcePage: polyModel('BPdc4pA3tv'),
    ammoVisualType: 'GrenadeRound',
    usedBy: ['GrenadeLauncher'],
    shellEject: { mass: 0.08, speed: [0.9, 1.8], lift: [0.45, 0.9], tumble: 9 }
  },
  {
    id: 'ammo-bullets-pickup-quaternius',
    label: 'Bullets Pickup',
    author: 'Quaternius',
    license: 'CC0-1.0',
    sourcePage: polyModel('bTEYFxKHF9'),
    ammoVisualType: 'FiveFiveSixRifle',
    usedBy: ['InventoryPickup']
  }
]);

export const LUDO_WEAPON_ASSET_IMPORT_NOTES = Object.freeze({
  preferredFormat: 'GLB/GLTF',
  unityImportPath: 'Assets/Art/LudoBattleRoyal/Weapons',
  tokenFracturePath: 'Assets/Art/LudoBattleRoyal/Tokens/Fractured',
  tokenFractureRule:
    'Split the real token mesh into named child pieces and add TokenPieceHealth + Rigidbody to every piece; never use random placeholder shards.',
  gripRule:
    'For every imported weapon prefab, author muzzle, shell eject, right-hand grip, and left-hand grip sockets, then tune WeaponBallisticsProfile.gripPose.'
});
