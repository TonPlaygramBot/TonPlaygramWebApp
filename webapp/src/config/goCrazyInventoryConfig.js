export const GO_CRAZY_DEFAULT_LOADOUT = Object.freeze([
  { type: 'weapon', optionId: 'firearm-basic' },
  { type: 'defense', optionId: 'missile-radar-mk1' }
]);

export const GO_CRAZY_DEFAULT_UNLOCKS = Object.freeze({
  weapon: ['firearm-basic'],
  defense: ['missile-radar-mk1'],
  support: []
});

export const GO_CRAZY_OPTION_LABELS = Object.freeze({
  weapon: {
    'firearm-basic': 'Basic Firearm',
    'rifle-mk2': 'Rifle MK2',
    'missile-sidewinder': 'Side Missile',
    'drone-hunter': 'Hunter Drone',
    'shotgun-quaternius': 'Quaternius Shotgun',
    'assault-rifle-quaternius': 'Quaternius Assault Rifle',
    'pistol-quaternius': 'Quaternius Pistol',
    'heavy-revolver-quaternius': 'Heavy Revolver',
    'sawed-off-quaternius': 'Sawed-Off',
    'silver-revolver-quaternius': 'Silver Revolver',
    'long-shotgun-quaternius': 'Long Shotgun',
    'pump-shotgun-quaternius': 'Pump Shotgun',
    'smg-quaternius': 'SMG',
    'ak47-gltf': 'AK47',
    'krsv-gltf': 'KRSV',
    'smith-gltf': 'Smith',
    'mosin-gltf': 'Mosin',
    'uzi-gltf': 'Uzi',
    'sigsauer-gltf': 'SigSauer',
    'awp-sniper-glb': 'AWP Sniper',
    'mrtk-gun-glb': 'MRTK Gun',
    'fps-shotgun-gltf': 'FPS Shotgun'
  },
  support: {
    'helicopter-strike': 'Helicopter Strike',
    'jet-strike': 'Jet Strike'
  },
  defense: {
    'missile-radar-mk1': 'Missile Radar',
    'drone-radar-mk1': 'Drone Radar',
    'anti-missile-battery': 'Anti Missile Battery'
  }
});

export const GO_CRAZY_STORE_ITEMS = Object.freeze([
  { id: 'gocrazy-firearm-basic', type: 'weapon', optionId: 'firearm-basic', label: 'Basic Firearm', description: 'Starter sidearm.', priceStars: 0, thumbnail: '/store-thumbs/gocrazy/firearm-basic.png' },
  { id: 'gocrazy-rifle-mk2', type: 'weapon', optionId: 'rifle-mk2', label: 'Rifle MK2', description: 'Higher precision rifle.', priceStars: 450, thumbnail: '/store-thumbs/gocrazy/rifle-mk2.png' },
  { id: 'gocrazy-missile', type: 'weapon', optionId: 'missile-sidewinder', label: 'Side Missile', description: 'Vehicle side launcher.', priceStars: 1200, thumbnail: '/store-thumbs/gocrazy/missile-sidewinder.png' },
  { id: 'gocrazy-drone', type: 'weapon', optionId: 'drone-hunter', label: 'Hunter Drone', description: 'Auto-lock drone support.', priceStars: 1600, thumbnail: '/store-thumbs/gocrazy/drone-hunter.png' },
  { id: 'gocrazy-heli', type: 'support', optionId: 'helicopter-strike', label: 'Helicopter Strike', description: 'Aerial support strike.', priceStars: 2200, thumbnail: '/store-thumbs/gocrazy/helicopter.png' },
  { id: 'gocrazy-jet', type: 'support', optionId: 'jet-strike', label: 'Jet Strike', description: 'Fast high-damage strike.', priceStars: 2800, thumbnail: '/store-thumbs/gocrazy/jet.png' },
  { id: 'gocrazy-shotgun-q', type: 'weapon', optionId: 'shotgun-quaternius', label: 'Quaternius Shotgun', description: 'Close-range burst shotgun.', priceStars: 700, thumbnail: '/store-thumbs/gocrazy/firearm-basic.png' },
  { id: 'gocrazy-assault-q', type: 'weapon', optionId: 'assault-rifle-quaternius', label: 'Quaternius Assault Rifle', description: 'Balanced automatic rifle.', priceStars: 850, thumbnail: '/store-thumbs/gocrazy/rifle-mk2.png' },
  { id: 'gocrazy-pistol-q', type: 'weapon', optionId: 'pistol-quaternius', label: 'Quaternius Pistol', description: 'Fast sidearm.', priceStars: 500, thumbnail: '/store-thumbs/gocrazy/firearm-basic.png' },
  { id: 'gocrazy-heavy-revolver-q', type: 'weapon', optionId: 'heavy-revolver-quaternius', label: 'Heavy Revolver', description: 'High impact revolver.', priceStars: 980, thumbnail: '/store-thumbs/gocrazy/firearm-basic.png' },
  { id: 'gocrazy-sawedoff-q', type: 'weapon', optionId: 'sawed-off-quaternius', label: 'Sawed-Off', description: 'Compact blast weapon.', priceStars: 1020, thumbnail: '/store-thumbs/gocrazy/firearm-basic.png' },
  { id: 'gocrazy-silver-revolver-q', type: 'weapon', optionId: 'silver-revolver-quaternius', label: 'Silver Revolver', description: 'Stylish heavy sidearm.', priceStars: 1080, thumbnail: '/store-thumbs/gocrazy/firearm-basic.png' },
  { id: 'gocrazy-long-shotgun-q', type: 'weapon', optionId: 'long-shotgun-quaternius', label: 'Long Shotgun', description: 'Long barrel spread control.', priceStars: 1180, thumbnail: '/store-thumbs/gocrazy/rifle-mk2.png' },
  { id: 'gocrazy-pump-shotgun-q', type: 'weapon', optionId: 'pump-shotgun-quaternius', label: 'Pump Shotgun', description: 'Classic pump action.', priceStars: 1250, thumbnail: '/store-thumbs/gocrazy/rifle-mk2.png' },
  { id: 'gocrazy-smg-q', type: 'weapon', optionId: 'smg-quaternius', label: 'SMG', description: 'Close-mid automatic.', priceStars: 1320, thumbnail: '/store-thumbs/gocrazy/rifle-mk2.png' },
  { id: 'gocrazy-ak47', type: 'weapon', optionId: 'ak47-gltf', label: 'AK47', description: 'Extra model AK47.', priceStars: 1450, thumbnail: '/store-thumbs/gocrazy/rifle-mk2.png' },
  { id: 'gocrazy-krsv', type: 'weapon', optionId: 'krsv-gltf', label: 'KRSV', description: 'Extra model KRSV.', priceStars: 1520, thumbnail: '/store-thumbs/gocrazy/rifle-mk2.png' },
  { id: 'gocrazy-smith', type: 'weapon', optionId: 'smith-gltf', label: 'Smith', description: 'Extra sidearm Smith.', priceStars: 1600, thumbnail: '/store-thumbs/gocrazy/firearm-basic.png' },
  { id: 'gocrazy-mosin', type: 'weapon', optionId: 'mosin-gltf', label: 'Mosin', description: 'Long range Mosin.', priceStars: 1700, thumbnail: '/store-thumbs/gocrazy/rifle-mk2.png' },
  { id: 'gocrazy-uzi', type: 'weapon', optionId: 'uzi-gltf', label: 'Uzi', description: 'Rapid SMG Uzi.', priceStars: 1760, thumbnail: '/store-thumbs/gocrazy/rifle-mk2.png' },
  { id: 'gocrazy-sigsauer', type: 'weapon', optionId: 'sigsauer-gltf', label: 'SigSauer', description: 'SigSauer sidearm.', priceStars: 1820, thumbnail: '/store-thumbs/gocrazy/firearm-basic.png' },
  { id: 'gocrazy-awp', type: 'weapon', optionId: 'awp-sniper-glb', label: 'AWP Sniper', description: 'Heavy sniper platform.', priceStars: 1980, thumbnail: '/store-thumbs/gocrazy/rifle-mk2.png' },
  { id: 'gocrazy-mrtk', type: 'weapon', optionId: 'mrtk-gun-glb', label: 'MRTK Gun', description: 'MRTK gun model.', priceStars: 2040, thumbnail: '/store-thumbs/gocrazy/rifle-mk2.png' },
  { id: 'gocrazy-fps-shotgun', type: 'weapon', optionId: 'fps-shotgun-gltf', label: 'FPS Shotgun', description: 'FPS shotgun model.', priceStars: 2100, thumbnail: '/store-thumbs/gocrazy/rifle-mk2.png' },
  { id: 'gocrazy-missile-radar', type: 'defense', optionId: 'missile-radar-mk1', label: 'Missile Radar', description: 'Warns and mitigates missiles.', priceStars: 350, thumbnail: '/store-thumbs/gocrazy/missile-radar.png' },
  { id: 'gocrazy-drone-radar', type: 'defense', optionId: 'drone-radar-mk1', label: 'Drone Radar', description: 'Counters drone lock-ons.', priceStars: 520, thumbnail: '/store-thumbs/gocrazy/drone-radar.png' },
  { id: 'gocrazy-anti-missile', type: 'defense', optionId: 'anti-missile-battery', label: 'Anti-Missile Battery', description: 'Intercepts incoming rockets.', priceStars: 980, thumbnail: '/store-thumbs/gocrazy/anti-missile.png' }
]);
