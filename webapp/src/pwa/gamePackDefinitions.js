import gamesCatalog from '../config/gamesCatalog.js';

// One catalog drives generation, the browser fallback and every Games card.
// Downloading web media does not authorize removing it from the native shell.
export const RUNTIME_MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.mp3', '.ogg', '.wav', '.m4a', '.mp4', '.webm', '.html', '.js', '.css', '.txt', '.woff', '.woff2']);
const heavyPacks = [
  {
    id: 'shared-tirana-vehicles',
    title: 'Shared Tirana Vehicle Fleet',
    description: 'Vehicle models shared by Tirana Streets and Racing Royal.',
    hidden: true,
    cover: '/assets/kart-royale/cover.webp',
    route: null,
    gameSlugs: [],
    roots: ['assets/tirana-streets/vehicle-collection'],
    dependencies: []
  },
  {
    id: 'tirana-streets',
    title: 'Tirana Streets',
    description: 'City, landmark, street-life, vehicle and operation assets.',
    cover: '/assets/tirana-streets/map.svg',
    route: '/games/tiranastreets/lobby',
    gameSlugs: ['tiranastreets'],
    roots: ['assets/tirana-streets', 'assets/tirana-detail-kit', 'assets/tirana-landmarks', 'assets/blackwater'],
    excludeRoots: ['assets/tirana-streets/vehicle-collection'],
    excludeFiles: ['assets/tirana-streets/living/human.glb'],
    dependencies: ['shared-tirana-vehicles']
  },
  {
    id: 'racing-royal',
    title: 'Racing Royal',
    description: 'Tracks, vehicles, environments and racing presentation assets.',
    cover: '/assets/kart-royale/cover.webp',
    route: '/games/kartroyale/lobby',
    gameSlugs: ['kartroyale'],
    roots: ['assets/kart-royale'],
    dependencies: ['shared-tirana-vehicles']
  },
  {
    id: 'pool-royale',
    title: 'Pool & Snooker Royale',
    description: 'Tables, arenas, materials, cues and offline game entry assets.',
    cover: '/assets/icons/pool-royale.svg',
    route: '/games/poolroyale/lobby',
    gameSlugs: ['poolroyale', 'snookerroyale'],
    roots: ['assets/pool-royale', 'models/pool-royale'],
    files: [
      'pool-royale-bracket.html',
      'pool-royale-api.js',
      'snooker-royale-bracket.html',
      'snooker-royale-api.js',
      'lib/poolAi.js',
      'game-preloads/pool-royale-preload.txt',
      'game-preloads/snooker-royale-preload.txt',
      'power-slider.js',
      'power-slider.css'
    ],
    dependencies: []
  },
  {
    id: 'table-tennis-royal',
    title: 'Table Tennis & Tennis Royal',
    description: 'Athletes, arenas, rackets, tables and court assets.',
    cover: '/assets/icons/table-tennis-royal.svg',
    route: '/games/tabletennisroyal/lobby',
    gameSlugs: ['tabletennisroyal', 'tennisroyal'],
    roots: ['assets/table-tennis'],
    excludeFiles: [
      'assets/table-tennis/chess-human.glb',
      'assets/table-tennis/athlete-male.glb',
      'assets/table-tennis/athlete-female.glb'
    ],
    dependencies: []
  },
  {
    id: 'royal-lanes',
    title: 'Royal Lanes Bowling',
    description: 'Bowling lane, ball, pin, character and arena assets.',
    cover: '/assets/royal-lanes/mark.svg',
    route: '/games/royallanes/lobby',
    gameSlugs: ['royallanes'],
    roots: ['assets/royal-lanes'],
    files: [
      'assets/pool-royale/readyplayer.me.glb',
      'assets/table-tennis/athlete-male.glb',
      'assets/table-tennis/athlete-female.glb'
    ],
    dependencies: []
  }
];

const covered = new Set(heavyPacks.flatMap(pack => pack.gameSlugs || []));
const extraFiles = {
  texasholdem: ['texas-holdem.js'],
  'domino-royal': ['domino-royal-game.js'],
  chessbattleroyal: ['chess-royale.html']
};
export const GAME_PACK_DEFINITIONS = Object.freeze([
  ...heavyPacks.map(pack => ({ ...pack, runtimeMedia: true })),
  {
    id: 'shared-table-games', title: 'Shared game characters and materials', hidden: true,
    description: 'Shared models, textures, audio and game libraries.', gameSlugs: [],
    roots: ['models/murlan', 'models/sketchfab', 'assets/sounds', 'lib', 'vendor'],
    files: ['assets/table-tennis/chess-human.glb', 'assets/table-tennis/athlete-male.glb',
      'assets/table-tennis/athlete-female.glb', 'assets/tirana-streets/living/human.glb'],
    dependencies: [], runtimeMedia: true, keepInNative: true
  },
  ...gamesCatalog.filter(game => !covered.has(game.slug)).map(game => ({
    id: game.slug, title: game.name, description: 'Game files for faster loading on this device.',
    gameSlugs: [game.slug], route: game.route, cover: game.image,
    roots: [`assets/${game.slug}`, `models/${game.slug}`],
    files: [decodeURIComponent(game.image).replace(/^\//, ''), ...(extraFiles[game.slug] || [])],
    dependencies: ['shared-table-games'], runtimeMedia: true, keepInNative: true
  }))
]);
