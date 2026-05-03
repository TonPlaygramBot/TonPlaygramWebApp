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
    'drone-hunter': 'Hunter Drone'
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
  { id: 'gocrazy-missile-radar', type: 'defense', optionId: 'missile-radar-mk1', label: 'Missile Radar', description: 'Warns and mitigates missiles.', priceStars: 350, thumbnail: '/store-thumbs/gocrazy/missile-radar.png' },
  { id: 'gocrazy-drone-radar', type: 'defense', optionId: 'drone-radar-mk1', label: 'Drone Radar', description: 'Counters drone lock-ons.', priceStars: 520, thumbnail: '/store-thumbs/gocrazy/drone-radar.png' },
  { id: 'gocrazy-anti-missile', type: 'defense', optionId: 'anti-missile-battery', label: 'Anti-Missile Battery', description: 'Intercepts incoming rockets.', priceStars: 980, thumbnail: '/store-thumbs/gocrazy/anti-missile.png' }
]);
