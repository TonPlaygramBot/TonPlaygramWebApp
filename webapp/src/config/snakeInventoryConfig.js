export const SNAKE_DEFAULT_UNLOCKS = Object.freeze({
  arenaTheme: ['nebulaAtrium'],
  boardPalette: ['desertMarble'],
  snakeSkin: ['emeraldScales'],
  diceTheme: ['imperialIvory'],
  railTheme: ['platinumOak'],
  tokenFinish: ['ceramicSheen']
});

export const SNAKE_OPTION_LABELS = Object.freeze({
  arenaTheme: Object.freeze({
    nebulaAtrium: 'Nebula Atrium',
    crystalLagoon: 'Crystal Lagoon',
    royalEmber: 'Royal Ember'
  }),
  boardPalette: Object.freeze({
    desertMarble: 'Desert Marble',
    glacierGlass: 'Glacier Glass',
    jadeSanctum: 'Jade Sanctum'
  }),
  snakeSkin: Object.freeze({
    emeraldScales: 'Emerald Scales',
    midnightCobra: 'Midnight Cobra',
    emberSerpent: 'Ember Serpent'
  }),
  diceTheme: Object.freeze({
    imperialIvory: 'Imperial Ivory',
    onyxChrome: 'Onyx Chrome',
    auroraQuartz: 'Aurora Quartz'
  }),
  railTheme: Object.freeze({
    platinumOak: 'Platinum & Oak',
    obsidianSteel: 'Obsidian Steel',
    emberBrass: 'Ember Brass'
  }),
  tokenFinish: Object.freeze({
    ceramicSheen: 'Ceramic Sheen',
    matteVelvet: 'Matte Velvet',
    holographicPulse: 'Holographic Pulse'
  })
});

export const SNAKE_DEFAULT_LOADOUT = Object.freeze([
  { type: 'arenaTheme', optionId: 'nebulaAtrium', label: 'Nebula Atrium' },
  { type: 'boardPalette', optionId: 'desertMarble', label: 'Desert Marble' },
  { type: 'snakeSkin', optionId: 'emeraldScales', label: 'Emerald Scales' },
  { type: 'diceTheme', optionId: 'imperialIvory', label: 'Imperial Ivory' },
  { type: 'railTheme', optionId: 'platinumOak', label: 'Platinum & Oak' },
  { type: 'tokenFinish', optionId: 'ceramicSheen', label: 'Ceramic Sheen' }
]);

export const SNAKE_STORE_ITEMS = [
  { id: 'snake-arena-crystal', type: 'arenaTheme', optionId: 'crystalLagoon', name: 'Crystal Lagoon Arena', price: 520, description: 'Swap in a turquoise-lit lagoon arena vibe for Snake & Ladder.' },
  { id: 'snake-arena-ember', type: 'arenaTheme', optionId: 'royalEmber', name: 'Royal Ember Arena', price: 560, description: 'Warm ember glow with royal trims for the Snake & Ladder hall.' },
  { id: 'snake-board-glacier', type: 'boardPalette', optionId: 'glacierGlass', name: 'Glacier Glass Board', price: 360, description: 'Frosted glass board palette with neon highlights.' },
  { id: 'snake-board-jade', type: 'boardPalette', optionId: 'jadeSanctum', name: 'Jade Sanctum Board', price: 390, description: 'Jade and gold board palette for your Snake & Ladder grid.' },
  { id: 'snake-skin-midnight', type: 'snakeSkin', optionId: 'midnightCobra', name: 'Midnight Cobra Skin', price: 430, description: 'Dark-scaled cobra texture for premium snake renders.' },
  { id: 'snake-skin-ember', type: 'snakeSkin', optionId: 'emberSerpent', name: 'Ember Serpent Skin', price: 450, description: 'Smoldering ember serpent skin for the animated snakes.' },
  { id: 'snake-dice-onyx', type: 'diceTheme', optionId: 'onyxChrome', name: 'Onyx Chrome Dice', price: 320, description: 'Chrome-edged onyx dice for high-stakes rolls.' },
  { id: 'snake-dice-aurora', type: 'diceTheme', optionId: 'auroraQuartz', name: 'Aurora Quartz Dice', price: 340, description: 'Iridescent quartz dice with cyan pips.' },
  { id: 'snake-rail-obsidian', type: 'railTheme', optionId: 'obsidianSteel', name: 'Obsidian Steel Rails', price: 410, description: 'Steel-and-obsidian rails with cool blue netting.' },
  { id: 'snake-rail-ember', type: 'railTheme', optionId: 'emberBrass', name: 'Ember Brass Rails', price: 430, description: 'Brass and ember rail package with rose highlights.' },
  { id: 'snake-token-matte', type: 'tokenFinish', optionId: 'matteVelvet', name: 'Matte Velvet Tokens', price: 300, description: 'Velvet-matte finish for player tokens.' },
  { id: 'snake-token-holo', type: 'tokenFinish', optionId: 'holographicPulse', name: 'Holographic Pulse Tokens', price: 360, description: 'Holographic clearcoat tokens with shimmering accents.' }
];
