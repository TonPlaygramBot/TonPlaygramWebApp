export const GO_CRAZY_DEFAULT_LOADOUT = Object.freeze([
  { type: 'weapon', optionId: 'firearm-basic' },
  { type: 'defense', optionId: 'missile-radar-mk1' },
  { type: 'humanCharacter', optionId: 'rpm-current' }
]);

export const GO_CRAZY_DEFAULT_UNLOCKS = Object.freeze({
  weapon: ['firearm-basic'],
  defense: ['missile-radar-mk1'],
  support: [],
  humanCharacter: ['rpm-current']
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
    'jet-strike': 'Jet Strike',
    'support-truck-strike': 'Support Truck Strike',
    'tower-sentry': 'Tower Sentry'
  },
  humanCharacter: {
    'rpm-current': 'Current Avatar',
    'rpm-67d411': 'RPM 67d411',
    'rpm-67f433': 'RPM 67f433',
    'rpm-67e1b5': 'RPM 67e1b5',
    'webgl-vietnam-human': 'Vietnam Human',
    'webgl-ai-teacher': 'AI Teacher',
    'webgl-ai-teacher-1': 'AI Teacher 1'
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
  { id: 'gocrazy-support-truck', type: 'support', optionId: 'support-truck-strike', label: 'Support Truck Strike', description: 'Ground support truck volley.', priceStars: 2100, thumbnail: '/store-thumbs/gocrazy/support-truck.png' },
  { id: 'gocrazy-tower-sentry', type: 'support', optionId: 'tower-sentry', label: 'Tower Sentry', description: 'Deployable sentry tower.', priceStars: 1800, thumbnail: '/store-thumbs/gocrazy/tower.png' },
  { id: 'gocrazy-missile-radar', type: 'defense', optionId: 'missile-radar-mk1', label: 'Missile Radar', description: 'Warns and mitigates missiles.', priceStars: 350, thumbnail: '/store-thumbs/gocrazy/missile-radar.png' },
  { id: 'gocrazy-drone-radar', type: 'defense', optionId: 'drone-radar-mk1', label: 'Drone Radar', description: 'Counters drone lock-ons.', priceStars: 520, thumbnail: '/store-thumbs/gocrazy/drone-radar.png' },
  { id: 'gocrazy-anti-missile', type: 'defense', optionId: 'anti-missile-battery', label: 'Anti-Missile Battery', description: 'Intercepts incoming rockets.', priceStars: 980, thumbnail: '/store-thumbs/gocrazy/anti-missile.png' },
  { id: 'gocrazy-human-rpm-current', type: 'humanCharacter', optionId: 'rpm-current', label: 'Current Avatar', description: 'Default seated driver avatar.', priceStars: 0, thumbnail: '/store-thumbs/chessBattle/humanCharacter/rpm-current.png' },
  { id: 'gocrazy-human-rpm-67d411', type: 'humanCharacter', optionId: 'rpm-67d411', label: 'RPM 67d411', description: 'Premium seated driver avatar.', priceStars: 390, thumbnail: '/store-thumbs/chessBattle/humanCharacter/rpm-67d411.png' },
  { id: 'gocrazy-human-rpm-67f433', type: 'humanCharacter', optionId: 'rpm-67f433', label: 'RPM 67f433', description: 'Premium seated driver avatar.', priceStars: 420, thumbnail: '/store-thumbs/chessBattle/humanCharacter/rpm-67f433.png' },
  { id: 'gocrazy-human-rpm-67e1b5', type: 'humanCharacter', optionId: 'rpm-67e1b5', label: 'RPM 67e1b5', description: 'Premium seated driver avatar.', priceStars: 450, thumbnail: '/store-thumbs/chessBattle/humanCharacter/rpm-67e1b5.png' },
  { id: 'gocrazy-human-vietnam', type: 'humanCharacter', optionId: 'webgl-vietnam-human', label: 'Vietnam Human', description: 'Open WebGL driver avatar.', priceStars: 480, thumbnail: '/store-thumbs/chessBattle/humanCharacter/webgl-vietnam-human.png' },
  { id: 'gocrazy-human-ai-teacher', type: 'humanCharacter', optionId: 'webgl-ai-teacher', label: 'AI Teacher', description: 'Open WebGL driver avatar.', priceStars: 510, thumbnail: '/store-thumbs/chessBattle/humanCharacter/webgl-ai-teacher.png' },
  { id: 'gocrazy-human-ai-teacher-1', type: 'humanCharacter', optionId: 'webgl-ai-teacher-1', label: 'AI Teacher 1', description: 'Open WebGL driver avatar.', priceStars: 540, thumbnail: '/store-thumbs/chessBattle/humanCharacter/webgl-ai-teacher-1.png' }
]);
