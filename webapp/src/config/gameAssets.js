const GAME_ASSET_BASE_URL =
  (import.meta.env && import.meta.env.VITE_GAME_ASSET_BASE_URL) || '/assets/game-art';

const normalizeBase = (base) => base.replace(/\/+$/, '');

const withBase = (path) => {
  if (path.startsWith('/') || path.startsWith('http')) {
    return path;
  }
  return `${normalizeBase(GAME_ASSET_BASE_URL)}/${path.replace(/^\/+/, '')}`;
};

export const gameThumbnails = {
  texasholdem: '/assets/icons/Texas%20holdem%20poker%20game%20logo.png',
  'domino-royal': '/assets/icons/Domino%20battle%20Royal%20logo.png',
  poolroyale: '/assets/icons/Pool%20Royal%20game%20logo.png',
  snookerroyale: '/assets/icons/file_00000000123071f4a91766ac58320bce.png',
  goalrush: '/assets/icons/Goal%20rush%20logo.png',
  airhockey: '/assets/icons/Air%20hockey%20game%20logo.png',
  snake: '/assets/icons/Snake%20and%20ladder%20game%20logo.png',
  murlanroyale: '/assets/icons/Murlan%20Royal%20logo.png',
  chessbattleroyal: '/assets/icons/Chess%20battle%20Royal%20logo.png',
  ludobattleroyal: '/assets/icons/Ludo%20battle%20Royal%20game%20logo.png'
};

const buildLobbyIconSet = (keys, icon) =>
  keys.reduce((acc, key) => {
    acc[key] = icon;
    return acc;
  }, {});

export const lobbyOptionIcons = {
  texasholdem: buildLobbyIconSet(
    [
      'mode-local',
      'mode-online',
      'opponents-1',
      'opponents-2',
      'opponents-3',
      'opponents-4',
      'opponents-5'
    ],
    '/assets/icons/texas-holdem.svg'
  ),
  'domino-royal': buildLobbyIconSet(
    ['players-2', 'players-3', 'players-4', 'mode-local', 'mode-online'],
    '/assets/icons/domino-royal.svg'
  ),
  poolroyale: {
    'type-regular': 'lobby/pool-royale/type-regular.webp',
    'type-tournament': 'lobby/pool-royale/type-tournament.webp',
    'mode-ai': 'lobby/pool-royale/mode-ai.webp',
    'mode-online': 'lobby/pool-royale/mode-online.webp',
    'variant-uk': '/assets/icons/8ballrack.png',
    'variant-american': '/assets/icons/American%20Billiards%20.png',
    'variant-9ball': '/assets/icons/9ballrack.png',
    'ball-uk': '/assets/icons/8ballrack.png',
    'ball-american': '/assets/icons/American%20Billiards%20.png'
  },
  snookerroyale: buildLobbyIconSet(
    [
      'type-regular',
      'type-tournament',
      'mode-ai',
      'mode-online',
      'table-championship',
      'table-club',
      'table-practice'
    ],
    '/assets/icons/snooker-royale.svg'
  ),
  goalrush: buildLobbyIconSet(
    [
      'type-regular',
      'type-training',
      'type-tournament',
      'mode-ai',
      'mode-online',
      'target-3',
      'target-5',
      'target-10'
    ],
    '/assets/icons/goal_rush_card_1200x675.webp'
  ),
  airhockey: buildLobbyIconSet(
    [
      'type-regular',
      'type-training',
      'type-tournament',
      'mode-ai',
      'mode-online',
      'target-11',
      'target-21',
      'target-31'
    ],
    '/assets/icons/air-hockey.svg'
  ),
  snake: buildLobbyIconSet(
    [
      'board-quick',
      'board-mobile',
      'board-3d',
      'table-single',
      'table-2',
      'table-3',
      'table-4',
      'ai-1',
      'ai-2',
      'ai-3'
    ],
    '/assets/icons/snake_vector_no_bg.webp'
  ),
  murlanroyale: buildLobbyIconSet(
    [
      'mode-local',
      'mode-online',
      'type-single',
      'type-points',
      'points-11',
      'points-21',
      'points-31'
    ],
    '/assets/icons/murlan-royale.svg'
  ),
  chessbattleroyal: buildLobbyIconSet(
    ['mode-ai', 'mode-online', 'queue-instant', 'queue-mobile', 'queue-hdr'],
    '/assets/icons/chess-royale.svg'
  ),
  ludobattleroyal: buildLobbyIconSet(
    [
      'queue-instant',
      'queue-touch',
      'queue-hdr',
      'table-1',
      'table-2',
      'table-4',
      'ai-1',
      'ai-2',
      'ai-3'
    ],
    '/assets/icons/ludo-royale.svg'
  )
};

export const variantThumbnails = {
  poolroyale: {
    uk: '/assets/icons/8ballrack.png',
    american: '/assets/icons/American%20Billiards%20.png',
    '9ball': '/assets/icons/9ballrack.png'
  }
};

export const getGameThumbnail = (key) =>
  (key && gameThumbnails[key] ? withBase(gameThumbnails[key]) : '');

export const getLobbyIcon = (gameKey, iconKey) =>
  (gameKey && iconKey && lobbyOptionIcons[gameKey]?.[iconKey]
    ? withBase(lobbyOptionIcons[gameKey][iconKey])
    : '');

export const getVariantThumbnail = (gameKey, variantKey) =>
  (gameKey && variantKey && variantThumbnails[gameKey]?.[variantKey]
    ? withBase(variantThumbnails[gameKey][variantKey])
    : '');

export const gameAssetBase = GAME_ASSET_BASE_URL;
