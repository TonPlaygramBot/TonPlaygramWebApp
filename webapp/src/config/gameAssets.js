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
  texasholdem: 'games/texas-holdem.webp',
  'domino-royal': 'games/domino-royal.webp',
  poolroyale: '/assets/icons/Pool%20Royal%20game%20logo.png',
  snookerroyale: 'games/snooker-royale.webp',
  goalrush: 'games/goal-rush.webp',
  airhockey: 'games/air-hockey.webp',
  snake: 'games/snake-ladder.webp',
  murlanroyale: 'games/murlan-royale.webp',
  chessbattleroyal: 'games/chess-battle-royal.webp',
  ludobattleroyal: 'games/ludo-battle-royal.webp'
};

export const lobbyOptionIcons = {
  texasholdem: {
    'mode-local': 'lobby/texas-holdem/mode-local.webp',
    'mode-online': 'lobby/texas-holdem/mode-online.webp',
    'opponents-1': 'lobby/texas-holdem/opponents-1.webp',
    'opponents-2': 'lobby/texas-holdem/opponents-2.webp',
    'opponents-3': 'lobby/texas-holdem/opponents-3.webp',
    'opponents-4': 'lobby/texas-holdem/opponents-4.webp',
    'opponents-5': 'lobby/texas-holdem/opponents-5.webp'
  },
  'domino-royal': {
    'players-2': 'lobby/domino-royal/players-2.webp',
    'players-3': 'lobby/domino-royal/players-3.webp',
    'players-4': 'lobby/domino-royal/players-4.webp',
    'mode-local': 'lobby/domino-royal/mode-local.webp',
    'mode-online': 'lobby/domino-royal/mode-online.webp'
  },
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
  snookerroyale: {
    'type-regular': 'lobby/snooker-royale/type-regular.webp',
    'type-tournament': 'lobby/snooker-royale/type-tournament.webp',
    'mode-ai': 'lobby/snooker-royale/mode-ai.webp',
    'mode-online': 'lobby/snooker-royale/mode-online.webp',
    'table-championship': 'lobby/snooker-royale/table-championship.webp',
    'table-club': 'lobby/snooker-royale/table-club.webp',
    'table-practice': 'lobby/snooker-royale/table-practice.webp'
  },
  goalrush: {
    'type-regular': 'lobby/goal-rush/type-regular.webp',
    'type-training': 'lobby/goal-rush/type-training.webp',
    'type-tournament': 'lobby/goal-rush/type-tournament.webp',
    'mode-ai': 'lobby/goal-rush/mode-ai.webp',
    'mode-online': 'lobby/goal-rush/mode-online.webp',
    'target-3': 'lobby/goal-rush/target-3.webp',
    'target-5': 'lobby/goal-rush/target-5.webp',
    'target-10': 'lobby/goal-rush/target-10.webp'
  },
  airhockey: {
    'type-regular': 'lobby/air-hockey/type-regular.webp',
    'type-training': 'lobby/air-hockey/type-training.webp',
    'type-tournament': 'lobby/air-hockey/type-tournament.webp',
    'mode-ai': 'lobby/air-hockey/mode-ai.webp',
    'mode-online': 'lobby/air-hockey/mode-online.webp',
    'target-11': 'lobby/air-hockey/target-11.webp',
    'target-21': 'lobby/air-hockey/target-21.webp',
    'target-31': 'lobby/air-hockey/target-31.webp'
  },
  snake: {
    'board-quick': 'lobby/snake/board-quick.webp',
    'board-mobile': 'lobby/snake/board-mobile.webp',
    'board-3d': 'lobby/snake/board-3d.webp',
    'table-single': 'lobby/snake/table-single.webp',
    'table-2': 'lobby/snake/table-2.webp',
    'table-3': 'lobby/snake/table-3.webp',
    'table-4': 'lobby/snake/table-4.webp',
    'ai-1': 'lobby/snake/ai-1.webp',
    'ai-2': 'lobby/snake/ai-2.webp',
    'ai-3': 'lobby/snake/ai-3.webp'
  },
  murlanroyale: {
    'mode-local': 'lobby/murlan-royale/mode-local.webp',
    'mode-online': 'lobby/murlan-royale/mode-online.webp',
    'type-single': 'lobby/murlan-royale/type-single.webp',
    'type-points': 'lobby/murlan-royale/type-points.webp',
    'points-11': 'lobby/murlan-royale/points-11.webp',
    'points-21': 'lobby/murlan-royale/points-21.webp',
    'points-31': 'lobby/murlan-royale/points-31.webp'
  },
  chessbattleroyal: {
    'mode-ai': 'lobby/chess-battle-royal/mode-ai.webp',
    'mode-online': 'lobby/chess-battle-royal/mode-online.webp',
    'queue-instant': 'lobby/chess-battle-royal/queue-instant.webp',
    'queue-mobile': 'lobby/chess-battle-royal/queue-mobile.webp',
    'queue-hdr': 'lobby/chess-battle-royal/queue-hdr.webp'
  },
  ludobattleroyal: {
    'queue-instant': 'lobby/ludo-battle-royal/queue-instant.webp',
    'queue-touch': 'lobby/ludo-battle-royal/queue-touch.webp',
    'queue-hdr': 'lobby/ludo-battle-royal/queue-hdr.webp',
    'table-1': 'lobby/ludo-battle-royal/table-1.webp',
    'table-2': 'lobby/ludo-battle-royal/table-2.webp',
    'table-4': 'lobby/ludo-battle-royal/table-4.webp',
    'ai-1': 'lobby/ludo-battle-royal/ai-1.webp',
    'ai-2': 'lobby/ludo-battle-royal/ai-2.webp',
    'ai-3': 'lobby/ludo-battle-royal/ai-3.webp'
  }
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
