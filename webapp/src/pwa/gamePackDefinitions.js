import gamesCatalog from '../config/gamesCatalog.js';
import { TURI_MODEL_URL } from '../config/playerCharacter.js';

// One catalog drives generation, the browser fallback and every Games card.
// Downloading web media does not authorize removing it from the native shell.
export const RUNTIME_MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.mp3', '.ogg', '.wav', '.m4a', '.mp4', '.webm', '.html', '.js', '.css', '.txt', '.woff', '.woff2']);
const heavyPacks = [
  {
    id: 'shared-tirana-vehicles',
    title: 'Shared Tirana Scenery and Vehicles',
    description: 'Map scenery and vehicles used in Racing Royal and Jet Ski Royal.',
    hidden: true,
    cover: '/assets/kart-royale/cover.webp',
    route: null,
    gameSlugs: [],
    roots: ['assets/tirana-streets', 'assets/tirana-detail-kit', 'assets/tirana-landmarks'],
    excludeRoots: ['assets/tirana-streets/players', 'assets/tirana-streets/weapons', 'assets/tirana-streets/weapon-thumbnails', 'assets/tirana-streets/albanian-forces'],
    dependencies: []
  },
  {
    id: 'jetski-royal',
    title: 'Jet Ski Royal',
    description: 'Watercraft, scanned coast and water materials.',
    cover: '/assets/jetski-royal/cover.webp',
    route: '/games/jetskiroyal/lobby',
    gameSlugs: ['jetskiroyal'],
    roots: ['assets/jetski-royal'],
    dependencies: ['shared-tirana-vehicles', 'shared-table-games']
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
    roots: ['assets/pool-royale', 'models/pool-royale', 'assets/snooker-royal'],
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

];

const gamesWithoutPlayerCharacters = new Set([
  'poolroyale', 'snookerroyale', 'airhockey', 'murlanroyale', 'domino-royal', 'texasholdem', 'snake'
]);

const covered = new Set(heavyPacks.flatMap(pack => pack.gameSlugs || []));
const extraFiles = {
  texasholdem: ['texas-holdem.js'],
  'domino-royal': ['domino-royal-game.js'],
  chessbattleroyal: ['chess-royale.html']
};
export const GAME_PACK_DEFINITIONS = Object.freeze([
  ...heavyPacks.map(pack => ({
    ...pack,
    dependencies: pack.gameSlugs?.some(slug => !gamesWithoutPlayerCharacters.has(slug))
      ? [...(pack.dependencies || []), 'shared-player-character']
      : pack.dependencies,
    runtimeMedia: true
  })),
  {
    id: 'shared-player-character', title: 'Turi player character', hidden: true,
    description: 'Turi’s original model and textures, shared by every game.',
    gameSlugs: [], roots: [],
    files: [TURI_MODEL_URL.slice(1), 'assets/tirana-streets/players/ATTRIBUTION.txt'],
    dependencies: [], runtimeMedia: true, keepInNative: true
  },
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
    dependencies: gamesWithoutPlayerCharacters.has(game.slug)
      ? ['shared-table-games']
      : ['shared-table-games', 'shared-player-character'],
    runtimeMedia: true, keepInNative: true
  }))
]);
