import { useCallback, useEffect, useMemo, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  POOL_ROYALE_DEFAULT_LOADOUT,
  POOL_ROYALE_OPTION_LABELS,
  POOL_ROYALE_STORE_ITEMS
} from '../config/poolRoyaleInventoryConfig.js';
import { POOL_ROYALE_CLOTH_VARIANTS } from '../config/poolRoyaleClothPresets.js';
import {
  SNOOKER_CLUB_DEFAULT_LOADOUT,
  SNOOKER_CLUB_OPTION_LABELS,
  SNOOKER_CLUB_STORE_ITEMS
} from '../config/snookerClubInventoryConfig.js';
import {
  AIR_HOCKEY_DEFAULT_LOADOUT,
  AIR_HOCKEY_OPTION_LABELS,
  AIR_HOCKEY_STORE_ITEMS
} from '../config/airHockeyInventoryConfig.js';
import {
  addPoolRoyalUnlock,
  getCachedPoolRoyalInventory,
  getPoolRoyalInventory,
  isPoolOptionUnlocked,
  listOwnedPoolRoyalOptions,
  poolRoyalAccountId
} from '../utils/poolRoyalInventory.js';
import {
  addSnookerClubUnlock,
  getSnookerClubInventory,
  isSnookerOptionUnlocked,
  listOwnedSnookerOptions,
  snookerClubAccountId
} from '../utils/snookerClubInventory.js';
import {
  addAirHockeyUnlock,
  airHockeyAccountId,
  getAirHockeyInventory,
  isAirHockeyOptionUnlocked,
  listOwnedAirHockeyOptions
} from '../utils/airHockeyInventory.js';
import {
  CHESS_BATTLE_DEFAULT_LOADOUT,
  CHESS_BATTLE_OPTION_LABELS,
  CHESS_BATTLE_STORE_ITEMS
} from '../config/chessBattleInventoryConfig.js';
import {
  addChessBattleUnlock,
  getChessBattleInventory,
  isChessOptionUnlocked,
  chessBattleAccountId,
  listOwnedChessOptions
} from '../utils/chessBattleInventory.js';
import {
  LUDO_BATTLE_DEFAULT_LOADOUT,
  LUDO_BATTLE_OPTION_LABELS,
  LUDO_BATTLE_STORE_ITEMS
} from '../config/ludoBattleInventoryConfig.js';
import {
  addLudoBattleUnlock,
  getLudoBattleInventory,
  isLudoOptionUnlocked,
  listOwnedLudoOptions,
  ludoBattleAccountId
} from '../utils/ludoBattleInventory.js';
import {
  MURLAN_ROYALE_DEFAULT_LOADOUT,
  MURLAN_ROYALE_OPTION_LABELS,
  MURLAN_ROYALE_STORE_ITEMS
} from '../config/murlanInventoryConfig.js';
import {
  addMurlanUnlock,
  getMurlanInventory,
  isMurlanOptionUnlocked,
  listOwnedMurlanOptions,
  murlanAccountId
} from '../utils/murlanInventory.js';
import {
  DOMINO_ROYAL_DEFAULT_LOADOUT,
  DOMINO_ROYAL_OPTION_LABELS,
  DOMINO_ROYAL_STORE_ITEMS
} from '../config/dominoRoyalInventoryConfig.js';
import {
  TEXAS_HOLDEM_DEFAULT_LOADOUT,
  TEXAS_HOLDEM_OPTION_LABELS,
  TEXAS_HOLDEM_STORE_ITEMS
} from '../config/texasHoldemInventoryConfig.js';
import {
  SNAKE_DEFAULT_LOADOUT,
  SNAKE_OPTION_LABELS,
  SNAKE_STORE_ITEMS
} from '../config/snakeInventoryConfig.js';
import {
  addDominoRoyalUnlock,
  dominoRoyalAccountId,
  getDominoRoyalInventory,
  isDominoOptionUnlocked,
  listOwnedDominoOptions
} from '../utils/dominoRoyalInventory.js';
import {
  addSnakeUnlock,
  getSnakeInventory,
  isSnakeOptionUnlocked,
  listOwnedSnakeOptions,
  snakeAccountId
} from '../utils/snakeInventory.js';
import {
  addTexasHoldemUnlock,
  getTexasHoldemInventory,
  isTexasOptionUnlocked,
  listOwnedTexasOptions,
  texasHoldemAccountId
} from '../utils/texasHoldemInventory.js';
import { getAccountBalance, sendAccountTpc } from '../utils/api.js';
import { DEV_INFO } from '../utils/constants.js';

const TYPE_LABELS = {
  tableFinish: 'Table Finishes',
  chromeColor: 'Chrome Fascias',
  railMarkerColor: 'Rail Markers',
  clothColor: 'Cloth Colors',
  cueStyle: 'Cue Styles',
  pocketLiner: 'Pocket Jaws'
};

const SNOOKER_TYPE_LABELS = {
  tableFinish: 'Table Finishes',
  chromeColor: 'Chrome Fascias',
  railMarkerColor: 'Rail Markers',
  clothColor: 'Cloth Colors',
  cueStyle: 'Cue Styles'
};

const AIR_HOCKEY_TYPE_LABELS = {
  field: 'Rink Surface',
  table: 'Table Frame',
  puck: 'Puck Finish',
  mallet: 'Mallets',
  rails: 'Rails',
  goals: 'Goals'
};

const CHESS_TYPE_LABELS = {
  tableWood: 'Table Wood',
  tableCloth: 'Table Cloth',
  tableBase: 'Table Base',
  chairColor: 'Chairs',
  tableShape: 'Table Shape',
  sideColor: 'Piece Colors',
  boardTheme: 'Board Themes',
  headStyle: 'Pawn Heads'
};

const BLACKJACK_TYPE_LABELS = {
  tableWood: 'Table Wood',
  tableCloth: 'Table Cloth',
  chairColor: 'Chairs',
  tableShape: 'Table Shape',
  cards: 'Cards'
};

const LUDO_TYPE_LABELS = {
  tableWood: 'Table Wood',
  tableCloth: 'Table Cloth',
  tableBase: 'Table Base',
  chairColor: 'Chairs',
  tableShape: 'Table Shape',
  tokenPalette: 'Token Palette',
  tokenStyle: 'Token Style',
  tokenPiece: 'Token Piece',
  headStyle: 'Heads'
};

const MURLAN_TYPE_LABELS = {
  tableWood: 'Table Wood',
  tableCloth: 'Table Cloth',
  tableBase: 'Table Base',
  cards: 'Card Themes',
  stools: 'Stools & Chairs',
  tables: 'Table Models'
};

const DOMINO_TYPE_LABELS = {
  tableWood: 'Table Wood',
  tableCloth: 'Table Cloth',
  tableBase: 'Table Base',
  dominoStyle: 'Domino Styles',
  highlightStyle: 'Highlights',
  chairTheme: 'Chairs'
};

const SNAKE_TYPE_LABELS = {
  arenaTheme: 'Arena Atmosphere',
  boardPalette: 'Board Palette',
  snakeSkin: 'Snake Skins',
  diceTheme: 'Dice Finish',
  railTheme: 'Rails & Nets',
  tokenFinish: 'Token Finish'
};

const TEXAS_TYPE_LABELS = {
  tableWood: 'Table Wood',
  tableCloth: 'Table Cloth',
  tableBase: 'Table Base',
  chairColor: 'Chairs',
  tableShape: 'Table Shape',
  cards: 'Cards'
};

const TPC_ICON = '/assets/icons/ezgif-54c96d8a9b9236.webp';
const POOL_STORE_ACCOUNT_ID = import.meta.env.VITE_POOL_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;
const SNOOKER_STORE_ACCOUNT_ID = import.meta.env.VITE_SNOOKER_CLUB_STORE_ACCOUNT_ID || DEV_INFO.account;
const AIR_HOCKEY_STORE_ACCOUNT_ID = import.meta.env.VITE_AIR_HOCKEY_STORE_ACCOUNT_ID || DEV_INFO.account;
const CHESS_STORE_ACCOUNT_ID = import.meta.env.VITE_CHESS_BATTLE_STORE_ACCOUNT_ID || DEV_INFO.account;
const BLACKJACK_STORE_ACCOUNT_ID = import.meta.env.VITE_BLACKJACK_STORE_ACCOUNT_ID || DEV_INFO.account;
const LUDO_STORE_ACCOUNT_ID = import.meta.env.VITE_LUDO_BATTLE_STORE_ACCOUNT_ID || DEV_INFO.account;
const MURLAN_STORE_ACCOUNT_ID = import.meta.env.VITE_MURLAN_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;
const DOMINO_STORE_ACCOUNT_ID = import.meta.env.VITE_DOMINO_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;
const SNAKE_STORE_ACCOUNT_ID = import.meta.env.VITE_SNAKE_STORE_ACCOUNT_ID || DEV_INFO.account;
const TEXAS_STORE_ACCOUNT_ID = import.meta.env.VITE_TEXAS_HOLDEM_STORE_ACCOUNT_ID || DEV_INFO.account;

const createItemKey = (type, optionId) => `${type}:${optionId}`;
const selectionKey = (item) => `${item.slug}:${item.id}`;

const resolveSwatches = (type, optionId, fallbackSwatches = []) => {
  if (OPTION_SWATCH_OVERRIDES[optionId]) return OPTION_SWATCH_OVERRIDES[optionId];
  if (TYPE_SWATCHES[type]) return TYPE_SWATCHES[type];
  if (fallbackSwatches.length) return fallbackSwatches;
  return TYPE_SWATCHES.default;
};

const resolvePreviewShape = (slug, type, preferredShape) => {
  if (preferredShape) return preferredShape;
  if (PREVIEW_BY_TYPE[type]) return PREVIEW_BY_TYPE[type];
  if (PREVIEW_BY_SLUG[slug]) return PREVIEW_BY_SLUG[slug];
  return 'default';
};

const previewLabel = (shape) => PREVIEW_LABELS[shape] || PREVIEW_LABELS.default;

const DEFAULT_LIST_FORM = {
  itemId: '',
  price: ''
};

const TYPE_SWATCHES = {
  tableFinish: ['#3b2f2f', '#8b5a2b'],
  chromeColor: ['#f5f5f5', '#d4d4d8'],
  railMarkerColor: ['#9ca3af', '#fef3c7'],
  clothColor: ['#0f766e', '#22c55e'],
  cueStyle: ['#0f172a', '#1e293b'],
  field: ['#22d3ee', '#0ea5e9'],
  table: ['#4b5563', '#94a3b8'],
  puck: ['#111827', '#4b5563'],
  mallet: ['#111827', '#f59e0b'],
  rails: ['#1e293b', '#334155'],
  goals: ['#f97316', '#fb923c'],
  tableWood: ['#4b3621', '#9a7b4f'],
  tableCloth: ['#0f172a', '#34d399'],
  tableBase: ['#0f172a', '#1f2937'],
  tables: ['#0f172a', '#94a3b8'],
  chairColor: ['#111827', '#f59e0b'],
  tableShape: ['#334155', '#64748b'],
  sideColor: ['#f8fafc', '#1f2937'],
  boardTheme: ['#f59e0b', '#14b8a6'],
  headStyle: ['#0f172a', '#facc15'],
  cards: ['#f8fafc', '#e5e7eb'],
  dominoStyle: ['#f8fafc', '#d1d5db'],
  highlightStyle: ['#22d3ee', '#818cf8'],
  chairTheme: ['#0f172a', '#eab308'],
  tokenPalette: ['#ef4444', '#22c55e', '#3b82f6'],
  tokenStyle: ['#eab308', '#6366f1'],
  tokenPiece: ['#0f172a', '#e11d48'],
  arenaTheme: ['#0ea5e9', '#a855f7'],
  boardPalette: ['#38bdf8', '#10b981'],
  snakeSkin: ['#16a34a', '#65a30d'],
  diceTheme: ['#f8fafc', '#e11d48'],
  railTheme: ['#1e293b', '#64748b'],
  tokenFinish: ['#facc15', '#fb7185'],
  default: ['#22c55e', '#0ea5e9']
};

const POOL_CLOTH_SWATCHES = POOL_ROYALE_CLOTH_VARIANTS.reduce((acc, cloth) => {
  if (cloth?.swatches?.length) {
    acc[cloth.id] = cloth.swatches;
  }
  return acc;
}, {});

const OPTION_SWATCH_OVERRIDES = {
  ...POOL_CLOTH_SWATCHES,
  charredTimber: ['#2f2217', '#6b4226'],
  rusticSplit: ['#f3e8ff', '#fef3c7'],
  plankStudio: ['#e0e7ff', '#a78bfa'],
  weatheredGrey: ['#94a3b8', '#e2e8f0'],
  jetBlackCarbon: ['#0b1220', '#111827'],
  gold: ['#f59e0b', '#fbbf24'],
  chrome: ['#e5e7eb', '#a1a1aa'],
  pearl: ['#f5f3ff', '#e2e8f0'],
  'redwood-ember': ['#7f1d1d', '#b45309'],
  'birch-frost': ['#f8fafc', '#cbd5e1'],
  'wenge-nightfall': ['#111827', '#312e81'],
  'mahogany-heritage': ['#4c1d95', '#7e22ce'],
  'walnut-satin': ['#4a3728', '#b68973'],
  'carbon-matrix': ['#0f172a', '#94a3b8'],
  'maple-horizon': ['#fef3c7', '#fbbf24'],
  'graphite-aurora': ['#111827', '#22d3ee'],
  arcticRidge: ['#bae6fd', '#38bdf8'],
  basaltStone: ['#1f2937', '#0f172a'],
  emeraldSide: ['#22c55e', '#16a34a'],
  royalIvory: ['#f8fafc', '#e2e8f0'],
  neonRush: ['#f472b6', '#22d3ee'],
  duskMallet: ['#0f172a', '#1e3a8a'],
  cinderBlaze: ['#ff6b35', '#2b1a12'],
  arcticDrift: ['#bcd7ff', '#1f2f52'],
  nebulaGlass: ['#e0f2fe', '#0b1024']
};

const PREVIEW_BY_TYPE = {
  cueStyle: 'cue',
  chairColor: 'chair',
  stools: 'chair',
  boardTheme: 'chess-royals',
  sideColor: 'chess-royals',
  headStyle: 'pawn-head',
  chromeColor: 'chrome',
  cards: 'cards',
  dominoStyle: 'domino',
  tokenPalette: 'token-stack',
  tokenStyle: 'token-stack',
  tokenPiece: 'token-stack',
  tokenFinish: 'token-stack',
  diceTheme: 'dice',
  mallet: 'puck',
  puck: 'puck',
  rails: 'table',
  table: 'table',
  tableFinish: 'table',
  tableWood: 'table',
  tableCloth: 'table',
  tableBase: 'table',
  tables: 'table'
};

const PREVIEW_BY_SLUG = {
  chessbattleroyal: 'chess-royals',
  'domino-royal': 'domino'
};

const PREVIEW_LABELS = {
  cue: 'Cue render',
  chair: 'Lounge chair',
  'chess-royals': 'King & Queen',
  'pawn-head': 'Pawn heads',
  chrome: 'Chrome fascia',
  domino: 'Domino tile',
  cards: 'Card stack',
  dice: 'Dice pair',
  table: 'Table surface',
  puck: 'Rink gear',
  'token-stack': 'Token stack',
  default: '3D sample'
};

const storeMeta = {
  poolroyale: {
    name: 'Pool Royale',
    items: POOL_ROYALE_STORE_ITEMS,
    defaults: POOL_ROYALE_DEFAULT_LOADOUT,
    labels: POOL_ROYALE_OPTION_LABELS,
    typeLabels: TYPE_LABELS,
    accountId: POOL_STORE_ACCOUNT_ID
  },
  snookerclub: {
    name: 'Snooker Club',
    items: SNOOKER_CLUB_STORE_ITEMS,
    defaults: SNOOKER_CLUB_DEFAULT_LOADOUT,
    labels: SNOOKER_CLUB_OPTION_LABELS,
    typeLabels: SNOOKER_TYPE_LABELS,
    accountId: SNOOKER_STORE_ACCOUNT_ID
  },
  airhockey: {
    name: 'Air Hockey',
    items: AIR_HOCKEY_STORE_ITEMS,
    defaults: AIR_HOCKEY_DEFAULT_LOADOUT,
    labels: AIR_HOCKEY_OPTION_LABELS,
    typeLabels: AIR_HOCKEY_TYPE_LABELS,
    accountId: AIR_HOCKEY_STORE_ACCOUNT_ID
  },
  chessbattleroyal: {
    name: 'Chess Battle Royal',
    items: CHESS_BATTLE_STORE_ITEMS,
    defaults: CHESS_BATTLE_DEFAULT_LOADOUT,
    labels: CHESS_BATTLE_OPTION_LABELS,
    typeLabels: CHESS_TYPE_LABELS,
    accountId: CHESS_STORE_ACCOUNT_ID
  },
  ludobattleroyal: {
    name: 'Ludo Battle Royal',
    items: LUDO_BATTLE_STORE_ITEMS,
    defaults: LUDO_BATTLE_DEFAULT_LOADOUT,
    labels: LUDO_BATTLE_OPTION_LABELS,
    typeLabels: LUDO_TYPE_LABELS,
    accountId: LUDO_STORE_ACCOUNT_ID
  },
  murlanroyale: {
    name: 'Murlan Royale',
    items: MURLAN_ROYALE_STORE_ITEMS,
    defaults: MURLAN_ROYALE_DEFAULT_LOADOUT,
    labels: MURLAN_ROYALE_OPTION_LABELS,
    typeLabels: MURLAN_TYPE_LABELS,
    accountId: MURLAN_STORE_ACCOUNT_ID
  },
  'domino-royal': {
    name: 'Domino Royal',
    items: DOMINO_ROYAL_STORE_ITEMS,
    defaults: DOMINO_ROYAL_DEFAULT_LOADOUT,
    labels: DOMINO_ROYAL_OPTION_LABELS,
    typeLabels: DOMINO_TYPE_LABELS,
    accountId: DOMINO_STORE_ACCOUNT_ID
  },
  snake: {
    name: 'Snake & Ladder',
    items: SNAKE_STORE_ITEMS,
    defaults: SNAKE_DEFAULT_LOADOUT,
    labels: SNAKE_OPTION_LABELS,
    typeLabels: SNAKE_TYPE_LABELS,
    accountId: SNAKE_STORE_ACCOUNT_ID
  },
  texasholdem: {
    name: "Texas Hold'em",
    items: TEXAS_HOLDEM_STORE_ITEMS,
    defaults: TEXAS_HOLDEM_DEFAULT_LOADOUT,
    labels: TEXAS_HOLDEM_OPTION_LABELS,
    typeLabels: TEXAS_TYPE_LABELS,
    accountId: TEXAS_STORE_ACCOUNT_ID
  }
};

export default function Store() {
  useTelegramBackButton();
  const [accountId, setAccountId] = useState(() => poolRoyalAccountId());
  const [poolOwned, setPoolOwned] = useState(() => getCachedPoolRoyalInventory(accountId));
  const [snookerOwned, setSnookerOwned] = useState(() => getSnookerClubInventory(snookerClubAccountId(accountId)));
  const [airOwned, setAirOwned] = useState(() => getAirHockeyInventory(airHockeyAccountId(accountId)));
  const [chessOwned, setChessOwned] = useState(() => getChessBattleInventory(chessBattleAccountId(accountId)));
  const [ludoOwned, setLudoOwned] = useState(() => getLudoBattleInventory(ludoBattleAccountId(accountId)));
  const [murlanOwned, setMurlanOwned] = useState(() => getMurlanInventory(murlanAccountId(accountId)));
  const [dominoOwned, setDominoOwned] = useState(() => getDominoRoyalInventory(dominoRoyalAccountId(accountId)));
  const [snakeOwned, setSnakeOwned] = useState(() => getSnakeInventory(snakeAccountId(accountId)));
  const [texasOwned, setTexasOwned] = useState(() => getTexasHoldemInventory(texasHoldemAccountId(accountId)));
  const [tpcBalance, setTpcBalance] = useState(null);
  const [processing, setProcessing] = useState('');
  const [info, setInfo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('featured');
  const [activeGame, setActiveGame] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [confirmItem, setConfirmItem] = useState(null);
  const [purchaseStatus, setPurchaseStatus] = useState('');
  const [userListings, setUserListings] = useState([]);
  const [showListModal, setShowListModal] = useState(false);
  const [listForm, setListForm] = useState(() => ({ ...DEFAULT_LIST_FORM }));
  const [showMyListings, setShowMyListings] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [confirmItems, setConfirmItems] = useState([]);

  useEffect(() => {
    setAccountId(poolRoyalAccountId());
  }, []);

  useEffect(() => {
    setPoolOwned(getCachedPoolRoyalInventory(accountId));
    setSnookerOwned(getSnookerClubInventory(snookerClubAccountId(accountId)));
    setAirOwned(getAirHockeyInventory(airHockeyAccountId(accountId)));
    setChessOwned(getChessBattleInventory(chessBattleAccountId(accountId)));
    setLudoOwned(getLudoBattleInventory(ludoBattleAccountId(accountId)));
    setMurlanOwned(getMurlanInventory(murlanAccountId(accountId)));
    setDominoOwned(getDominoRoyalInventory(dominoRoyalAccountId(accountId)));
    setSnakeOwned(getSnakeInventory(snakeAccountId(accountId)));
    setTexasOwned(getTexasHoldemInventory(texasHoldemAccountId(accountId)));
    let cancelled = false;
    getPoolRoyalInventory(accountId)
      .then((inventory) => {
        if (!cancelled && inventory) setPoolOwned(inventory);
      })
      .catch((err) => console.warn('Failed to sync Pool Royale inventory', err));
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  useEffect(() => {
    const handlePoolInventoryUpdate = (event) => {
      if (event?.detail?.accountId && event.detail.accountId !== accountId) return;
      if (event?.detail?.inventory) {
        setPoolOwned(event.detail.inventory);
      } else {
        setPoolOwned(getCachedPoolRoyalInventory(accountId));
        getPoolRoyalInventory(accountId)
          .then((inventory) => setPoolOwned(inventory))
          .catch((err) => console.warn('Failed to reload Pool Royale inventory', err));
      }
    };
    window.addEventListener('poolRoyalInventoryUpdate', handlePoolInventoryUpdate);
    return () => window.removeEventListener('poolRoyalInventoryUpdate', handlePoolInventoryUpdate);
  }, [accountId]);

  useEffect(() => {
    const loadBalance = async () => {
      if (!accountId || accountId === 'guest') return;
      try {
        const res = await getAccountBalance(accountId);
        if (typeof res?.balance === 'number') {
          setTpcBalance(res.balance);
        }
      } catch (err) {
        console.error('Failed to load TPC balance', err);
      }
    };
    loadBalance();
  }, [accountId]);

  const storeItemsBySlug = useMemo(
    () => ({
      poolroyale: POOL_ROYALE_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId), slug: 'poolroyale' })),
      snookerclub: SNOOKER_CLUB_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId), slug: 'snookerclub' })),
      airhockey: AIR_HOCKEY_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId), slug: 'airhockey' })),
      chessbattleroyal: CHESS_BATTLE_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId), slug: 'chessbattleroyal' })),
      ludobattleroyal: LUDO_BATTLE_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId), slug: 'ludobattleroyal' })),
      murlanroyale: MURLAN_ROYALE_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId), slug: 'murlanroyale' })),
      'domino-royal': DOMINO_ROYAL_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId), slug: 'domino-royal' })),
      snake: SNAKE_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId), slug: 'snake' })),
      texasholdem: TEXAS_HOLDEM_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId), slug: 'texasholdem' }))
    }),
    []
  );

  const ownedCheckers = useMemo(
    () => ({
      poolroyale: (type, optionId) => isPoolOptionUnlocked(type, optionId, poolOwned),
      snookerclub: (type, optionId) => isSnookerOptionUnlocked(type, optionId, snookerOwned),
      airhockey: (type, optionId) => isAirHockeyOptionUnlocked(type, optionId, airOwned),
      chessbattleroyal: (type, optionId) => isChessOptionUnlocked(type, optionId, chessOwned),
      ludobattleroyal: (type, optionId) => isLudoOptionUnlocked(type, optionId, ludoOwned),
      murlanroyale: (type, optionId) => isMurlanOptionUnlocked(type, optionId, murlanOwned),
      'domino-royal': (type, optionId) => isDominoOptionUnlocked(type, optionId, dominoOwned),
      snake: (type, optionId) => isSnakeOptionUnlocked(type, optionId, snakeOwned),
      texasholdem: (type, optionId) => isTexasOptionUnlocked(type, optionId, texasOwned)
    }),
    [airOwned, poolOwned, snookerOwned, chessOwned, ludoOwned, murlanOwned, dominoOwned, snakeOwned, texasOwned]
  );

  const labelResolvers = useMemo(
    () => ({
      poolroyale: (item) => POOL_ROYALE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      snookerclub: (item) => SNOOKER_CLUB_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      airhockey: (item) => AIR_HOCKEY_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      chessbattleroyal: (item) => CHESS_BATTLE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      ludobattleroyal: (item) => LUDO_BATTLE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      murlanroyale: (item) => MURLAN_ROYALE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      'domino-royal': (item) => DOMINO_ROYAL_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      snake: (item) => SNAKE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      texasholdem: (item) => TEXAS_HOLDEM_OPTION_LABELS[item.type]?.[item.optionId] || item.name
    }),
    []
  );

  const typeLabelResolver = useMemo(
    () => ({
      poolroyale: TYPE_LABELS,
      snookerclub: SNOOKER_TYPE_LABELS,
      airhockey: AIR_HOCKEY_TYPE_LABELS,
      chessbattleroyal: CHESS_TYPE_LABELS,
      ludobattleroyal: LUDO_TYPE_LABELS,
      murlanroyale: MURLAN_TYPE_LABELS,
      'domino-royal': DOMINO_TYPE_LABELS,
      snake: SNAKE_TYPE_LABELS,
      texasholdem: TEXAS_TYPE_LABELS
    }),
    []
  );

  const decorateMarketplaceItem = (item) => {
    const swatches = resolveSwatches(item.type, item.optionId, item.swatches);
    const previewShape = resolvePreviewShape(item.slug, item.type, item.previewShape);
    return { ...item, swatches, previewShape };
  };

  const baseMarketplaceItems = useMemo(() => {
    const entries = [];
    Object.entries(storeItemsBySlug).forEach(([slug, items]) => {
      const ownedChecker = ownedCheckers[slug];
      const labelResolver = labelResolvers[slug];
      const typeLabels = typeLabelResolver[slug] || {};
      items.forEach((item) => {
        const displayLabel = labelResolver ? labelResolver(item) : item.name;
        entries.push(
          decorateMarketplaceItem({
            ...item,
            slug,
            displayLabel,
            typeLabel: typeLabels[item.type] || item.type,
            gameName: storeMeta[slug]?.name || slug,
            owned: ownedChecker ? ownedChecker(item.type, item.optionId) : false,
            seller: 'Official store'
          })
        );
      });
    });
    return entries;
  }, [labelResolvers, ownedCheckers, storeItemsBySlug, typeLabelResolver]);

  const ownedMarketplaceItems = useMemo(
    () => baseMarketplaceItems.filter((item) => item.owned),
    [baseMarketplaceItems]
  );

  useEffect(() => {
    if (showListModal && ownedMarketplaceItems.length) {
      setListForm((prev) => {
        const validSelection = ownedMarketplaceItems.find((item) => item.id === prev.itemId);
        const nextItem = validSelection || ownedMarketplaceItems[0];
        const suggestedPrice = prev.price || (nextItem.price ? String(nextItem.price) : '');
        if (prev.itemId === nextItem.id && prev.price === suggestedPrice) return prev;
        return { ...prev, itemId: nextItem.id, price: suggestedPrice };
      });
    }

    if (!showListModal) {
      setListForm({ ...DEFAULT_LIST_FORM });
    }
  }, [ownedMarketplaceItems, showListModal]);

  const decoratedUserListings = useMemo(
    () =>
      userListings.map((listing) =>
        decorateMarketplaceItem({
          ...listing,
          slug: listing.slug || listing.game,
          gameName: storeMeta[listing.slug || listing.game]?.name || 'Player listing',
          typeLabel: listing.typeLabel || 'Player NFT',
          displayLabel: listing.displayLabel || listing.name || 'Player NFT',
          owned: true,
          seller: 'You'
        })
      ),
    [userListings]
  );

  const allMarketplaceItems = useMemo(
    () => [...baseMarketplaceItems, ...decoratedUserListings],
    [baseMarketplaceItems, decoratedUserListings]
  );

  const applyFilters = useCallback(
    (items) => {
      const term = searchTerm.trim().toLowerCase();
      return items
        .filter((item) => {
          if (activeGame !== 'all' && item.slug !== activeGame) return false;
          if (activeType !== 'all' && item.typeLabel !== activeType) return false;
          if (!term) return true;
          return (
            item.displayLabel.toLowerCase().includes(term) ||
            item.description?.toLowerCase().includes(term) ||
            item.typeLabel.toLowerCase().includes(term) ||
            item.gameName.toLowerCase().includes(term)
          );
        })
        .sort((a, b) => {
          if (sortOption === 'price-low') return a.price - b.price;
          if (sortOption === 'price-high') return b.price - a.price;
          if (sortOption === 'alpha') return a.displayLabel.localeCompare(b.displayLabel);
          return a.slug.localeCompare(b.slug);
        });
    },
    [activeGame, activeType, searchTerm, sortOption]
  );

  const filteredItems = useMemo(() => applyFilters(allMarketplaceItems), [allMarketplaceItems, applyFilters]);
  const filteredUserListings = useMemo(
    () => applyFilters(decoratedUserListings),
    [applyFilters, decoratedUserListings]
  );
  const visibleItems = showMyListings ? filteredUserListings : filteredItems;

  useEffect(() => {
    const validKeys = new Set(allMarketplaceItems.map((item) => selectionKey(item)));
    setSelectedKeys((prev) => prev.filter((key) => validKeys.has(key)));
  }, [allMarketplaceItems]);

  const selectedItems = useMemo(() => {
    const keySet = new Set(selectedKeys);
    return allMarketplaceItems.filter((item) => keySet.has(selectionKey(item)));
  }, [allMarketplaceItems, selectedKeys]);

  const selectedPurchasable = useMemo(
    () => selectedItems.filter((item) => !item.owned),
    [selectedItems]
  );
  const selectedTotalPrice = useMemo(
    () => selectedPurchasable.reduce((sum, item) => sum + item.price, 0),
    [selectedPurchasable]
  );
  const selectedOwnedCount = selectedItems.length - selectedPurchasable.length;
  const selectedGameCount = useMemo(
    () => new Set(selectedPurchasable.map((item) => item.slug)).size,
    [selectedPurchasable]
  );

  useEffect(() => {
    if (!selectedPurchasable.length) {
      setConfirmItems([]);
    }
  }, [selectedPurchasable]);

  const toggleSelection = useCallback((item) => {
    if (!item || item.owned) return;
    setSelectedKeys((prev) => {
      const key = selectionKey(item);
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return Array.from(next);
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedKeys([]), []);

  const userListingStats = useMemo(() => {
    const total = decoratedUserListings.length;
    const prices = decoratedUserListings.map((item) => Number(item.price) || 0);
    const totalValue = prices.reduce((sum, price) => sum + price, 0);
    const avgPrice = total ? Math.round((totalValue / total) * 100) / 100 : 0;
    const floorPrice = total ? Math.min(...prices) : 0;
    return { total, totalValue, avgPrice, floorPrice };
  }, [decoratedUserListings]);

  const typeFilters = useMemo(() => {
    const types = new Set();
    const scopedItems = showMyListings ? decoratedUserListings : allMarketplaceItems;
    scopedItems.forEach((item) => {
      if (item.typeLabel) {
        types.add(item.typeLabel);
      }
    });
    return ['all', ...Array.from(types)];
  }, [activeGame, allMarketplaceItems, decoratedUserListings, showMyListings]);

  useEffect(() => {
    if (!typeFilters.includes(activeType)) {
      setActiveType('all');
    }
  }, [activeType, typeFilters]);

  const resetStatus = () => {
    setPurchaseStatus('');
    setInfo('');
  };

  const handleListSubmit = (event) => {
    event?.preventDefault();
    const selectedItem = ownedMarketplaceItems.find((item) => item.id === listForm.itemId);

    if (!selectedItem) {
      setInfo('Select an owned NFT to list.');
      return;
    }

    const listingPrice = Number(listForm.price || selectedItem.price || 0);

    const newListing = decorateMarketplaceItem({
      id: `user-${Date.now()}`,
      slug: selectedItem.slug,
      type: selectedItem.type,
      optionId: selectedItem.optionId,
      name: selectedItem.name,
      displayLabel: selectedItem.displayLabel,
      description:
        selectedItem.description ||
        `${selectedItem.gameName} ${selectedItem.typeLabel} listed from your collection.`,
      price: listingPrice,
      typeLabel: selectedItem.typeLabel,
      swatches: selectedItem.swatches,
      previewShape: selectedItem.previewShape,
      owned: true,
      seller: 'You'
    });

    setUserListings((prev) => [...prev, newListing]);
    setShowListModal(false);
    setListForm({ ...DEFAULT_LIST_FORM });
    setInfo('Your NFT listing has been added to the marketplace.');
  };

  const handlePurchase = async (items) => {
    const payload = Array.isArray(items) ? items.filter(Boolean) : [items].filter(Boolean);
    if (!payload.length) return;
    const seen = new Set();
    const unique = payload.filter((item) => {
      const key = selectionKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const purchasable = unique.filter((item) => !item.owned);
    if (!purchasable.length) {
      setInfo('No new items selected for purchase.');
      return;
    }
    if (!accountId || accountId === 'guest') {
      setInfo('Link your TPC account in the wallet first.');
      return;
    }

    const storeAccounts = {
      poolroyale: POOL_STORE_ACCOUNT_ID,
      snookerclub: SNOOKER_STORE_ACCOUNT_ID,
      airhockey: AIR_HOCKEY_STORE_ACCOUNT_ID,
      chessbattleroyal: CHESS_STORE_ACCOUNT_ID,
      ludobattleroyal: LUDO_STORE_ACCOUNT_ID,
      murlanroyale: MURLAN_STORE_ACCOUNT_ID,
      'domino-royal': DOMINO_STORE_ACCOUNT_ID,
      snake: SNAKE_STORE_ACCOUNT_ID,
      texasholdem: TEXAS_STORE_ACCOUNT_ID
    };

    const totalPrice = purchasable.reduce((sum, item) => sum + item.price, 0);
    if (tpcBalance !== null && totalPrice > tpcBalance) {
      setInfo('Insufficient TPC balance for this purchase.');
      return;
    }

    const groupedBySlug = purchasable.reduce((acc, item) => {
      const storeId = storeAccounts[item.slug];
      if (!storeId) return acc;
      acc[item.slug] = acc[item.slug] || { storeId, items: [], gameName: storeMeta[item.slug]?.name || item.slug };
      acc[item.slug].items.push(item);
      return acc;
    }, {});

    const groupedEntries = Object.values(groupedBySlug);
    if (!groupedEntries.length) {
      setInfo('Selected items are unavailable for purchase.');
      return;
    }

    const labelResolver = (slug, item) =>
      labelResolvers[slug] ? labelResolvers[slug](item) : item.name || item.displayLabel;
    setProcessing(purchasable.length > 1 ? 'bulk' : purchasable[0].id);
    resetStatus();

    try {
      for (const [slug, group] of Object.entries(groupedBySlug)) {
        const total = group.items.reduce((sum, entry) => sum + entry.price, 0);
        const res = await sendAccountTpc(accountId, group.storeId, total, `${group.gameName}: ${group.items.length} cosmetics`);
        if (res?.error) {
          setInfo(res.error || 'Purchase failed.');
          return;
        }

        for (const entry of group.items) {
          if (slug === 'poolroyale') {
            const updated = await addPoolRoyalUnlock(entry.type, entry.optionId, accountId);
            setPoolOwned(updated);
          } else if (slug === 'snookerclub') {
            setSnookerOwned(addSnookerClubUnlock(entry.type, entry.optionId, accountId));
          } else if (slug === 'airhockey') {
            setAirOwned(addAirHockeyUnlock(entry.type, entry.optionId, accountId));
          } else if (slug === 'chessbattleroyal') {
            setChessOwned(addChessBattleUnlock(entry.type, entry.optionId, accountId));
          } else if (slug === 'ludobattleroyal') {
            setLudoOwned(addLudoBattleUnlock(entry.type, entry.optionId, accountId));
          } else if (slug === 'murlanroyale') {
            setMurlanOwned(addMurlanUnlock(entry.type, entry.optionId, accountId));
          } else if (slug === 'domino-royal') {
            setDominoOwned(addDominoRoyalUnlock(entry.type, entry.optionId, accountId));
          } else if (slug === 'snake') {
            setSnakeOwned(addSnakeUnlock(entry.type, entry.optionId, accountId));
          } else if (slug === 'texasholdem') {
            setTexasOwned(addTexasHoldemUnlock(entry.type, entry.optionId, accountId));
          }
        }
      }

      const bal = await getAccountBalance(accountId);
      if (typeof bal?.balance === 'number') {
        setTpcBalance(bal.balance);
      }

      const resolver = (item) => labelResolver(item.slug, item);
      const groupedCount = groupedEntries.length;
      const successLabel =
        purchasable.length === 1
          ? `${resolver(purchasable[0])} purchase completed — now owned in ${storeMeta[purchasable[0].slug]?.name || purchasable[0].slug}.`
          : `${purchasable.length} cosmetics purchased across ${groupedCount} game${groupedCount === 1 ? '' : 's'}.`;
      const purchasedKeys = new Set(purchasable.map((item) => selectionKey(item)));
      setSelectedKeys((prev) => prev.filter((key) => !purchasedKeys.has(key)));
      setPurchaseStatus(successLabel);
      setInfo('');
    } catch (err) {
      console.error('Purchase failed', err);
      setInfo('Failed to process purchase.');
    } finally {
      setProcessing('');
      setConfirmItem(null);
      setConfirmItems([]);
    }
  };

  const featuredCount = allMarketplaceItems.length;
  const ownedCount = allMarketplaceItems.filter((item) => item.owned).length;
  const walletLabel = accountId && accountId !== 'guest' ? 'Wallet connected' : 'Guest mode';

  const renderListModal = () => {
    if (!showListModal) return null;
    const selectedItem = ownedMarketplaceItems.find((item) => item.id === listForm.itemId);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <div className="flex w-full max-w-xl max-h-[90vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <p className="text-xs text-white/60">List an owned NFT</p>
              <h3 className="text-lg font-semibold text-white">Create marketplace listing</h3>
              <p className="text-sm text-white/60">Pick an unlocked cosmetic, then set the sale price. We keep the metadata locked to your NFT.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowListModal(false)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 hover:bg-white/10"
            >
              Close
            </button>
          </div>

          <form className="grid flex-1 gap-3 overflow-y-auto p-4" onSubmit={handleListSubmit}>
            <div className="grid gap-3 md:grid-cols-[7fr_5fr] md:items-start">
              <div className="grid gap-2">
                <div className="flex items-center justify-between text-sm text-white/80">
                  <span>Choose an owned NFT</span>
                  <span className="text-xs text-white/60">{ownedMarketplaceItems.length} available</span>
                </div>
                <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
                  {ownedMarketplaceItems.length ? (
                    ownedMarketplaceItems.map((item) => {
                      const active = item.id === listForm.itemId;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() =>
                            setListForm((prev) => ({
                              ...prev,
                              itemId: item.id,
                              price: prev.price || (item.price ? String(item.price) : '')
                            }))
                          }
                          className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                            active
                              ? 'border-emerald-300/60 bg-emerald-500/10 shadow-[0_10px_30px_-20px_rgba(16,185,129,0.9)]'
                              : 'border-white/10 bg-black/20 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {renderPreview3d(item, false)}
                            <div className="grid gap-0.5 text-sm text-white/80">
                              <div className="font-semibold text-white">{item.displayLabel}</div>
                              <div className="text-xs text-white/60">
                                {item.gameName} • {item.typeLabel}
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-sm text-white/80">
                            <div className="flex items-center justify-end gap-1 font-semibold">
                              <span>{item.price}</span>
                              <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                            </div>
                            <div className="text-[11px] text-white/50">Base price</div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white/70">
                      You have no cosmetics unlocked yet. Buy an item from the store before listing it.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-white/60">Selected NFT</p>
                    <h4 className="text-base font-semibold text-white">
                      {selectedItem ? selectedItem.displayLabel : 'No selection'}
                    </h4>
                    <p className="text-xs text-white/60">
                      {selectedItem
                        ? `${selectedItem.gameName} • ${selectedItem.typeLabel}`
                        : 'Pick an owned cosmetic to list it.'}
                    </p>
                  </div>
                  {selectedItem ? renderPreview3d(selectedItem, false) : null}
                </div>

                <label className="grid gap-1 text-sm text-white/80">
                  <span className="text-xs uppercase tracking-wide text-white/60">Listing price (TPC)</span>
                  <input
                    type="number"
                    min="0"
                    value={listForm.price}
                    onChange={(e) => setListForm((prev) => ({ ...prev, price: e.target.value }))}
                    placeholder={selectedItem?.price || '250'}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-white outline-none"
                    required
                  />
                  <span className="text-xs text-white/50">
                    Metadata stays tied to your NFT. Buyers will only see the price you set here.
                  </span>
                </label>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowListModal(false);
                      setListForm({ ...DEFAULT_LIST_FORM });
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white/90 sm:w-auto"
                    disabled={!selectedItem}
                  >
                    Publish listing
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderConfirmModal = () => {
    if (!confirmItem) return null;
    const gameName = storeMeta[confirmItem.slug]?.name || confirmItem.slug;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <p className="text-xs text-white/60">Confirm purchase</p>
              <h3 className="text-lg font-semibold text-white">{confirmItem.displayLabel}</h3>
              <p className="text-sm text-white/60">{gameName} • {confirmItem.typeLabel}</p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
              {confirmItem.price}
              <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-3 p-4 text-sm text-white/70">
            <p>
              This NFT cosmetic will be unlocked instantly for your account. Please confirm the payment to continue.
            </p>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              {renderStoreThumbnail(confirmItem)}
              <div className="grid gap-1 text-xs">
                <div className="text-sm font-semibold text-white">{confirmItem.displayLabel}</div>
                <div className="text-white/60">{gameName} • {confirmItem.typeLabel}</div>
              </div>
            </div>
            <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-white/80">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Game</span>
                <span className="font-semibold">{gameName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Type</span>
                <span className="font-semibold">{confirmItem.typeLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Price</span>
                <span className="flex items-center gap-1 font-semibold">
                  {confirmItem.price}
                  <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmItem(null)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handlePurchase(confirmItem)}
                className="w-full rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white/90 sm:w-auto"
                disabled={Boolean(processing)}
              >
                {processing ? 'Processing…' : 'Confirm & Buy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBulkConfirmModal = () => {
    if (!confirmItems.length) return null;
    const totalPrice = confirmItems.reduce((sum, item) => sum + item.price, 0);
    const grouped = confirmItems.reduce((acc, item) => {
      const gameName = storeMeta[item.slug]?.name || item.slug;
      acc[gameName] = (acc[gameName] || 0) + 1;
      return acc;
    }, {});
    const groupedLabels = Object.entries(grouped)
      .map(([name, count]) => `${count} in ${name}`)
      .join(' • ');

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <p className="text-xs text-white/60">Confirm bulk purchase</p>
              <h3 className="text-lg font-semibold text-white">
                {confirmItems.length} cosmetics • {groupedLabels || 'Mixed games'}
              </h3>
              <p className="text-sm text-white/60">Review your cart and pay once to unlock everything.</p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
              {totalPrice.toLocaleString()}
              <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
            </div>
          </div>

          <div className="grid gap-3 p-4 text-sm text-white/80">
            <div className="grid max-h-64 gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">
              {confirmItems.map((item) => (
                <div
                  key={`${item.slug}-${item.id}-confirm`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    {renderStoreThumbnail(item)}
                    <div className="grid gap-0.5">
                      <span className="text-white font-semibold">{item.displayLabel}</span>
                      <span className="text-xs text-white/60">{storeMeta[item.slug]?.name || item.slug} • {item.typeLabel}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    {item.price}
                    <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
              <p className="font-semibold text-white">Checkout summary</p>
              <p className="mt-1">One TPC transaction per game, applied to every unowned NFT selected.</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmItems([])}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handlePurchase(confirmItems)}
                className="w-full rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white/90 sm:w-auto"
                disabled={Boolean(processing)}
              >
                {processing ? 'Processing…' : 'Confirm & Buy All'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailModal = () => {
    if (!detailItem) return null;
    const gameName = storeMeta[detailItem.slug]?.name || detailItem.slug;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
        <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-start justify-between border-b border-white/10 p-4">
            <div>
              <p className="text-xs text-white/60">{gameName} • {detailItem.typeLabel}</p>
              <h3 className="text-lg font-semibold text-white">{detailItem.displayLabel}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/70">
                  {detailItem.slug.replace('-', ' ')}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-white/60">
                  {detailItem.typeLabel}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 font-semibold ${
                    detailItem.owned
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                      : 'border-indigo-400/30 bg-indigo-400/10 text-indigo-100'
                  }`}
                >
                  {detailItem.owned ? 'In inventory' : 'Mintable'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
                {detailItem.price}
                <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="rounded-full border border-white/10 p-2 text-white/70 hover:bg-white/10"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                <p className="font-semibold text-white">Item overview</p>
                <p className="mt-1">{detailItem.description || 'Cosmetic details will appear here.'}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Seller</span>
                  <span className="font-semibold">{detailItem.seller || 'Official store'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Status</span>
                  <span className="font-semibold text-emerald-200">{detailItem.owned ? 'Unlocked' : 'Available'}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(detailItem.swatches || []).slice(0, 6).map((color, index) => (
                    <span
                      key={`${detailItem.id}-detail-${color}-${index}`}
                      className="h-5 w-5 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  {(!detailItem.swatches || detailItem.swatches.length === 0) && (
                    <span className="text-xs text-white/60">Color samples unavailable</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 sm:w-auto"
                >
                  Close
                </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmItems([]);
                      setConfirmItem(detailItem);
                      setDetailItem(null);
                    }}
                    className="w-full rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white/90 sm:w-auto"
                  disabled={processing === detailItem.id || detailItem.owned}
                >
                  {detailItem.owned ? 'Already owned' : 'Buy now'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">{renderPreview3d(detailItem)}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                <p className="font-semibold text-white">What you get</p>
                <p className="mt-1">Unlock this cosmetic instantly for your next match with your linked TPC account.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPreview3d = (item, showCaption = true) => {
    if (!item) return null;
    const previewShape = item.previewShape || 'default';
    const primary = item.swatches?.[0] || '#0f172a';
    const secondary = item.swatches?.[1] || primary;
    const accent = item.swatches?.[2] || '#f8fafc';
    const safeId = (item.id || item.optionId || 'preview').replace(/[^a-zA-Z0-9_-]/g, '');
    const gradientId = `${safeId}-grad`;
    const shineId = `${safeId}-shine`;
    const shadowId = `${safeId}-shadow`;

    const shapeLayer = (shape) => {
      switch (shape) {
        case 'cue':
          return (
            <g filter={`url(#${shadowId})`}>
              <rect x="18" y="42" width="106" height="10" rx="5" fill={`url(#${gradientId})`} />
              <rect x="18" y="40" width="30" height="14" rx="7" fill={accent} opacity="0.25" />
              <rect x="122" y="44" width="20" height="6" rx="3" fill={accent} />
              <rect x="18" y="42" width="124" height="10" rx="5" stroke={accent} strokeWidth="1.2" fill="none" />
            </g>
          );
        case 'chess-royals':
        case 'chess':
          return (
            <g filter={`url(#${shadowId})`}>
              <path
                d="M54 24c6 4 9 9 9 16 0 5-1 9-4 12h6c3 0 5 2 4 5l-5 17H35l-5-17c-1-3 1-5 4-5h7c-2-3-4-7-4-12 0-7 3-12 9-16Z"
                fill={`url(#${gradientId})`}
                stroke={accent}
                strokeWidth="1.3"
              />
              <path
                d="M102 22h8v8h8v8h-8v6h-8v-6h-8v-8h8z"
                fill={accent}
                opacity="0.75"
                transform="translate(-6 0)"
              />
              <path
                d="M102 20c8 4 12 11 12 20 0 5-1 9-4 12h7c3 0 5 2 4 5l-4 16H82l-4-16c-1-3 1-5 4-5h7c-3-3-4-7-4-12 0-9 4-16 12-20Z"
                fill={`url(#${shineId})`}
                stroke={accent}
                strokeWidth="1.3"
                opacity="0.9"
              />
              <ellipse cx="52" cy="76" rx="20" ry="5" fill={secondary} opacity="0.5" />
              <ellipse cx="98" cy="78" rx="24" ry="6" fill={secondary} opacity="0.6" />
            </g>
          );
        case 'pawn-head':
          return (
            <g filter={`url(#${shadowId})`}>
              <ellipse cx="60" cy="36" rx="12" ry="9" fill={accent} opacity="0.85" />
              <rect x="50" y="42" width="20" height="16" rx="6" fill={`url(#${shineId})`} />
              <rect x="46" y="56" width="28" height="10" rx="4" fill={`url(#${gradientId})`} />
              <ellipse cx="104" cy="34" rx="10" ry="10" fill={accent} opacity="0.9" />
              <rect x="94" y="44" width="20" height="14" rx="5" fill={`url(#${shineId})`} />
              <rect x="90" y="56" width="28" height="10" rx="4" fill={`url(#${gradientId})`} />
            </g>
          );
        case 'chrome':
          return (
            <g filter={`url(#${shadowId})`}>
              <path
                d="M40 22h86c4 0 6 3 5 6l-10 48c-1 3-4 5-7 5H36c-4 0-6-3-5-7l9-46c1-4 4-6 7-6Z"
                fill={`url(#${gradientId})`}
              />
              <path d="M40 28h78l-8 40c-.6 3-3 5-6 5H36Z" fill={`url(#${shineId})`} opacity="0.9" />
              <circle cx="50" cy="34" r="3" fill={accent} opacity="0.7" />
              <circle cx="112" cy="34" r="3" fill={accent} opacity="0.7" />
            </g>
          );
        case 'domino':
          return (
            <g filter={`url(#${shadowId})`}>
              <rect x="26" y="18" width="108" height="64" rx="10" fill={`url(#${gradientId})`} />
              <line x1="80" y1="22" x2="80" y2="78" stroke={accent} strokeWidth="2" opacity="0.6" />
              <circle cx="60" cy="40" r="6" fill={accent} />
              <circle cx="100" cy="60" r="6" fill={accent} />
              <circle cx="100" cy="40" r="4" fill={accent} opacity="0.6" />
            </g>
          );
        case 'cards':
          return (
            <g filter={`url(#${shadowId})`}>
              <rect x="32" y="18" width="78" height="58" rx="9" fill={secondary} opacity="0.65" transform="rotate(-6 32 18)" />
              <rect x="56" y="26" width="78" height="58" rx="9" fill={`url(#${gradientId})`} transform="rotate(6 56 26)" />
              <rect
                x="52"
                y="22"
                width="78"
                height="58"
                rx="9"
                stroke={accent}
                strokeWidth="1.5"
                fill="none"
                transform="rotate(3 52 22)"
              />
              <text x="76" y="56" fill={accent} fontSize="16" fontWeight="700" opacity="0.9">A♠</text>
            </g>
          );
        case 'table':
          return (
            <g filter={`url(#${shadowId})`}>
              <rect x="22" y="26" width="116" height="48" rx="12" fill={`url(#${gradientId})`} />
              <rect x="30" y="34" width="100" height="32" rx="10" fill={`url(#${shineId})`} opacity="0.7" />
              <rect x="36" y="40" width="88" height="20" rx="8" fill={accent} opacity="0.15" />
            </g>
          );
        case 'puck':
          return (
            <g filter={`url(#${shadowId})`}>
              <circle cx="80" cy="50" r="26" fill={`url(#${gradientId})`} />
              <circle cx="80" cy="50" r="18" fill={`url(#${shineId})`} opacity="0.8" />
              <circle cx="80" cy="50" r="10" fill={accent} opacity="0.35" />
            </g>
          );
        case 'token-stack':
          return (
            <g filter={`url(#${shadowId})`}>
              <ellipse cx="64" cy="42" rx="18" ry="8" fill={`url(#${gradientId})`} />
              <rect x="46" y="42" width="36" height="12" rx="6" fill={`url(#${shineId})`} opacity="0.8" />
              <ellipse cx="96" cy="54" rx="18" ry="8" fill={`url(#${shineId})`} opacity="0.9" />
              <rect x="78" y="54" width="36" height="12" rx="6" fill={`url(#${gradientId})`} />
              <ellipse cx="78" cy="66" rx="18" ry="8" fill={accent} opacity="0.6" />
              <rect x="60" y="66" width="36" height="12" rx="6" fill={`url(#${shineId})`} opacity="0.8" />
            </g>
          );
        case 'dice':
          return (
            <g filter={`url(#${shadowId})`}>
              <rect x="42" y="24" width="44" height="44" rx="8" fill={`url(#${shineId})`} />
              <rect x="76" y="38" width="44" height="44" rx="8" fill={`url(#${gradientId})`} />
              <circle cx="54" cy="36" r="3" fill={accent} />
              <circle cx="64" cy="46" r="3" fill={accent} />
              <circle cx="54" cy="56" r="3" fill={accent} />
              <circle cx="88" cy="50" r="3" fill={accent} />
              <circle cx="110" cy="50" r="3" fill={accent} />
              <circle cx="99" cy="61" r="3" fill={accent} />
              <circle cx="88" cy="72" r="3" fill={accent} />
              <circle cx="110" cy="72" r="3" fill={accent} />
            </g>
          );
        case 'chair':
          return (
            <g filter={`url(#${shadowId})`}>
              <rect x="54" y="26" width="52" height="36" rx="10" fill={`url(#${gradientId})`} />
              <rect x="50" y="42" width="60" height="24" rx="8" fill={`url(#${shineId})`} opacity="0.85" />
              <rect x="58" y="62" width="12" height="20" rx="3" fill={accent} opacity="0.8" />
              <rect x="100" y="62" width="12" height="20" rx="3" fill={accent} opacity="0.8" />
              <rect x="70" y="64" width="28" height="8" rx="4" fill={secondary} opacity="0.7" />
            </g>
          );
        default:
          return (
            <g filter={`url(#${shadowId})`}>
              <rect x="28" y="26" width="104" height="44" rx="10" fill={`url(#${gradientId})`} />
              <rect x="38" y="34" width="84" height="28" rx="8" fill={`url(#${shineId})`} opacity="0.8" />
            </g>
          );
      }
    };

    return (
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-24 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-black/40 shadow-[0_18px_45px_-26px_rgba(0,0,0,0.9)]">
          <svg viewBox="0 0 160 100" className="h-full w-full">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={primary} />
                <stop offset="100%" stopColor={secondary} />
              </linearGradient>
              <radialGradient id={shineId} cx="50%" cy="40%" r="70%">
                <stop offset="0%" stopColor={accent} stopOpacity="0.9" />
                <stop offset="100%" stopColor={secondary} stopOpacity="0.2" />
              </radialGradient>
              <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="rgba(0,0,0,0.6)" />
              </filter>
            </defs>
            {shapeLayer(previewShape)}
            <ellipse cx="80" cy="82" rx="40" ry="8" fill="rgba(0,0,0,0.35)" />
          </svg>
        </div>
        {showCaption ? (
          <div className="grid gap-0.5 text-xs text-white/70">
            <span className="font-semibold text-white">{previewLabel(previewShape)}</span>
            <span className="text-white/60">High-fidelity 3D sample</span>
          </div>
        ) : null}
      </div>
    );
  };

  const renderStoreThumbnail = (item) => {
    if (!item) return null;
    const primary = item.swatches?.[0] || '#0f172a';
    const secondary = item.swatches?.[1] || primary;
    const accent = item.swatches?.[2] || '#f8fafc';
    const previewShape = item.previewShape || 'default';
    const label = (item.displayLabel || item.name || '').slice(0, 14);

    const base = (children) => (
      <div className="relative h-16 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-[0_16px_30px_-24px_rgba(0,0,0,0.9)]">
        <div className="absolute inset-0 opacity-80" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }} />
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/50" />
        <div className="absolute inset-[5px] rounded-xl border border-white/10 bg-black/40" />
        <div className="relative z-10 flex h-full w-full items-center justify-center">{children}</div>
      </div>
    );

    if (item.thumbnail) {
      return (
        <div className="relative h-16 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_16px_30px_-24px_rgba(0,0,0,0.9)]">
          <img src={item.thumbnail} alt={item.displayLabel || item.name} className="h-full w-full object-cover opacity-90" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/60" />
          <div className="absolute bottom-1 left-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80">
            {label}
          </div>
        </div>
      );
    }

    switch (previewShape) {
      case 'table':
        return base(
          <div className="relative h-9 w-16">
            <div className="absolute inset-x-1 top-2 h-5 rounded-xl" style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }} />
            <div className="absolute inset-x-3 top-4 h-3 rounded-lg" style={{ background: accent, opacity: 0.25 }} />
            <div className="absolute inset-x-4 bottom-2 h-2 rounded-full" style={{ background: accent, opacity: 0.3 }} />
          </div>
        );
      case 'cue':
        return base(
          <div className="relative h-2 w-16 rounded-full" style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }}>
            <div className="absolute -left-2 -top-1 h-4 w-6 rounded-full" style={{ background: accent, opacity: 0.4 }} />
            <div className="absolute right-0 top-0 h-2 w-4 rounded-full" style={{ background: accent, opacity: 0.9 }} />
          </div>
        );
      case 'cards':
        return base(
          <div className="relative h-12 w-16">
            <div className="absolute left-2 top-1 h-10 w-7 rotate-[-8deg] rounded-lg border border-white/20" style={{ background: secondary, opacity: 0.7 }} />
            <div className="absolute left-5 top-2 h-10 w-7 rotate-[6deg] rounded-lg border border-white/40" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, boxShadow: `0 0 0 2px ${accent} inset` }} />
          </div>
        );
      case 'domino':
        return base(
          <div className="relative h-12 w-16 rounded-xl border border-white/15" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
            <div className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-white/40" />
            <div className="absolute left-4 top-3 h-3 w-3 rounded-full" style={{ background: accent }} />
            <div className="absolute right-4 bottom-3 h-3 w-3 rounded-full" style={{ background: accent }} />
            <div className="absolute right-4 top-3 h-2 w-2 rounded-full" style={{ background: accent, opacity: 0.7 }} />
          </div>
        );
      case 'dice':
        return base(
          <div className="relative flex gap-1">
            <div className="relative h-9 w-9 rounded-xl border border-white/15" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
              <div className="absolute left-2 top-2 h-2 w-2 rounded-full" style={{ background: accent }} />
              <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: accent }} />
              <div className="absolute right-2 bottom-2 h-2 w-2 rounded-full" style={{ background: accent }} />
            </div>
            <div className="relative h-9 w-9 rounded-xl border border-white/15" style={{ background: `linear-gradient(135deg, ${secondary}, ${primary})` }}>
              <div className="absolute left-2 top-2 h-2 w-2 rounded-full" style={{ background: accent }} />
              <div className="absolute right-2 top-2 h-2 w-2 rounded-full" style={{ background: accent }} />
              <div className="absolute left-2 bottom-2 h-2 w-2 rounded-full" style={{ background: accent }} />
              <div className="absolute right-2 bottom-2 h-2 w-2 rounded-full" style={{ background: accent }} />
            </div>
          </div>
        );
      case 'puck':
        return base(
          <div className="relative h-10 w-10 rounded-full" style={{ background: `radial-gradient(circle at 40% 30%, ${accent}, ${secondary})` }}>
            <div className="absolute inset-2 rounded-full" style={{ background: `linear-gradient(145deg, ${primary}, ${secondary})` }} />
          </div>
        );
      case 'token-stack':
        return base(
          <div className="relative h-12 w-16">
            <div className="absolute left-1 top-2 h-3 w-12 rounded-full" style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})`, opacity: 0.85 }} />
            <div className="absolute left-3 top-5 h-3 w-12 rounded-full" style={{ background: `linear-gradient(90deg, ${secondary}, ${primary})`, opacity: 0.9 }} />
            <div className="absolute left-5 top-8 h-3 w-12 rounded-full" style={{ background: accent, opacity: 0.8 }} />
          </div>
        );
      case 'chair':
        return base(
          <div className="relative h-12 w-14">
            <div className="absolute inset-x-1 top-2 h-5 rounded-xl" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }} />
            <div className="absolute inset-x-2 top-5 h-4 rounded-lg" style={{ background: `linear-gradient(135deg, ${secondary}, ${primary})`, opacity: 0.9 }} />
            <div className="absolute left-3 bottom-2 h-3 w-3 rounded-full" style={{ background: accent, opacity: 0.75 }} />
            <div className="absolute right-3 bottom-2 h-3 w-3 rounded-full" style={{ background: accent, opacity: 0.75 }} />
          </div>
        );
      default:
        return base(
          <div className="relative h-10 w-16 rounded-xl" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
            <div className="absolute inset-2 rounded-lg" style={{ background: accent, opacity: 0.2 }} />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 shadow-sm">
              <span className="text-lg">🛍️</span>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">TonPlaygram</div>
              <div className="text-xs text-white/60">NFT Storefront</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 md:flex">
              <span className="text-white/60">TPC</span>
              <span className="flex items-center gap-1 font-semibold text-white">
                {tpcBalance === null ? '—' : tpcBalance}
                <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <div className={`h-2.5 w-2.5 rounded-full ${accountId && accountId !== 'guest' ? 'bg-emerald-400' : 'bg-white/40'}`} />
              <div className="text-xs font-semibold">{walletLabel}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-4">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/0 p-5 shadow-sm">
          <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl" />
          <div className="absolute -left-10 -bottom-10 h-44 w-44 rounded-full bg-indigo-400/10 blur-2xl" />

          <div className="relative grid gap-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Explore NFT cosmetics across every TonPlaygram game
            </div>

            <h1 className="text-balance text-xl font-semibold md:text-2xl">
              Fresh storefront — browse, filter, and grab cosmetics in seconds
            </h1>

            <p className="max-w-2xl text-sm text-white/70">
              Mobile-first design inspired by the mock above. Every card shows TPC price, accessory type, and whether you already own it.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white/90">
                Browse everything
              </button>
              <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">
                Search accessories
              </button>
            </div>
          </div>
        </section>

        <div className="mt-4 grid gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/60">Marketplace</p>
                <h2 className="text-xl font-semibold leading-tight">Accessories for every TonPlaygram game</h2>
                <p className="text-sm text-white/60">Quick filters, transparent listings, and a confirmation modal before checkout.</p>
              </div>
              <div className="grid grid-cols-3 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
                <div className="text-left">
                  <p className="text-xs text-white/60">Listings</p>
                  <p className="font-semibold text-white">{featuredCount.toLocaleString()}</p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-white/60">Owned</p>
                  <p className="font-semibold text-white">{ownedCount}</p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-white/60">TPC</p>
                  <p className="flex items-center gap-1 font-semibold text-white">
                    {tpcBalance === null ? '—' : tpcBalance}
                    <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr]">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
                <span className="text-white/60">🔎</span>
                <input
                  type="search"
                  placeholder="Search by name, game, or accessory type"
                  className="w-full bg-transparent text-sm text-white/90 outline-none placeholder:text-white/40"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none"
                value={activeGame}
                onChange={(e) => setActiveGame(e.target.value)}
              >
                <option value="all">All games</option>
                {Object.entries(storeMeta).map(([slug, meta]) => (
                  <option key={slug} value={slug}>
                    {meta.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none"
                value={activeType}
                onChange={(e) => setActiveType(e.target.value)}
              >
                {typeFilters.map((type) => (
                  <option key={type} value={type}>
                    {type === 'all' ? 'All types' : type}
                  </option>
                ))}
              </select>
              <select
                className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="featured">Trending</option>
                <option value="price-low">Price: Low</option>
                <option value="price-high">Price: High</option>
                <option value="alpha">Alphabetical</option>
              </select>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/10 px-3 py-2">
              <div className="text-xs text-white/60">
                List cosmetics you already own so other players can purchase them securely.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMyListings((prev) => !prev)}
                  className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                    showMyListings
                      ? 'border-blue-200/40 bg-blue-400/15 text-blue-50 shadow-[0_10px_30px_-20px_rgba(59,130,246,0.8)]'
                      : 'border-white/10 bg-black/30 text-white/80 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {showMyListings ? 'Show all listings' : 'View my listings'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowListModal(true)}
                  className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/20"
                >
                  List an owned NFT
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-black/15 p-3 text-sm text-white/80">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                    Multi-select checkout
                  </span>
                  <span className="font-semibold text-white">
                    {selectedPurchasable.length
                      ? `${selectedPurchasable.length} item${selectedPurchasable.length === 1 ? '' : 's'} • ${selectedGameCount || 0} game${selectedGameCount === 1 ? '' : 's'}`
                      : 'Select items to bundle a purchase'}
                  </span>
                  {selectedOwnedCount > 0 ? (
                    <span className="text-xs text-amber-200">
                      {selectedOwnedCount} owned selection{selectedOwnedCount === 1 ? ' is' : 's are'} skipped automatically.
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedKeys.length}
                  >
                    Clear selection
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmItem(null);
                      setConfirmItems(selectedPurchasable);
                    }}
                    className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!selectedPurchasable.length || Boolean(processing)}
                  >
                    Buy selected ({selectedTotalPrice.toLocaleString()} TPC)
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                  Green + Blue cloth bundles ready for Pool Royale
                </span>
                <span>Pick multiple NFTs, confirm once, and unlock them together.</span>
              </div>
            </div>

            <div className="mt-3 grid gap-3 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/80 shadow-sm sm:grid-cols-4">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Your listings</p>
                <p className="text-2xl font-semibold text-white">{userListingStats.total}</p>
                <p className="text-xs text-white/60">Listed items tied to your account</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Total value</p>
                <p className="flex items-center gap-1 text-2xl font-semibold text-white">
                  {userListingStats.totalValue.toLocaleString()}
                  <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                </p>
                <p className="text-xs text-white/60">Sum of your active listings</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Average price</p>
                <p className="flex items-center gap-1 text-2xl font-semibold text-white">
                  {userListingStats.avgPrice.toLocaleString()}
                  <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                </p>
                <p className="text-xs text-white/60">Per item across your listings</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-white/60">Floor price</p>
                <p className="flex items-center gap-1 text-2xl font-semibold text-white">
                  {userListingStats.total ? userListingStats.floorPrice.toLocaleString() : '—'}
                  {userListingStats.total ? <img src={TPC_ICON} alt="TPC" className="h-4 w-4" /> : null}
                </p>
                <p className="text-xs text-white/60">Lowest priced NFT you listed</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <div className="text-xs font-semibold text-white/70">Games</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                      activeGame === 'all'
                        ? 'border-white/20 bg-white text-zinc-950'
                        : 'border-white/10 bg-black/20 text-white/75 hover:bg-white/10 hover:text-white'
                    }`}
                    onClick={() => setActiveGame('all')}
                  >
                    All
                  </button>
                  {Object.entries(storeMeta).map(([slug, meta]) => (
                    <button
                      key={slug}
                      className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                        activeGame === slug
                          ? 'border-white/20 bg-white text-zinc-950'
                          : 'border-white/10 bg-black/20 text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                      onClick={() => setActiveGame(slug)}
                    >
                      {meta.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="text-xs font-semibold text-white/70">Accessory types</div>
                <div className="flex flex-wrap gap-2">
                  {typeFilters.map((type) => (
                    <button
                      key={type}
                      className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                        activeType === type
                          ? 'border-white/20 bg-white text-zinc-950'
                          : 'border-white/10 bg-black/20 text-white/75 hover:bg-white/10 hover:text-white'
                      }`}
                      onClick={() => setActiveType(type)}
                    >
                      {type === 'all' ? 'All' : type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <div className="text-base font-semibold">{showMyListings ? 'Your listings' : 'Marketplace'}</div>
              <div className="text-xs text-white/60">{visibleItems.length} listings | pay with TPC | accessories for every game</div>
            </div>
            <button className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 md:inline">
              View analytics
            </button>
          </div>

          <div className="space-y-2">
            {visibleItems.map((item) => {
              const checked = selectedKeys.includes(selectionKey(item));
              return (
                <div
                  key={`${item.slug}-${item.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left shadow-sm transition hover:border-white/20 hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-white/30 bg-black/40 text-emerald-400 focus:ring-emerald-300"
                        checked={checked}
                        onChange={() => toggleSelection(item)}
                        disabled={item.owned}
                      />
                    </label>
                    {renderStoreThumbnail(item)}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold">{item.displayLabel}</div>
                        {item.owned && (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                            Owned
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/60">{item.gameName} • {item.typeLabel}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <div className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
                      {item.price}
                      <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailItem(item)}
                      className="rounded-2xl border border-white/15 bg-black/30 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmItems([]);
                        setConfirmItem(item);
                      }}
                      className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-zinc-950 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={item.owned || Boolean(processing)}
                    >
                      {item.owned ? 'Owned' : 'Buy'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {visibleItems.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
              {showMyListings
                ? 'No personal listings are visible with these filters. List an owned NFT or reset the filters to see everything.'
                : 'No items match these filters. Clear the search or pick a different game.'}
            </div>
          )}

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 space-y-2">
            <p className="font-semibold text-white">Quick guidance</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Confirmation modal appears before every purchase so you always know the total.</li>
              <li>The “Owned” badge updates immediately when a purchase succeeds.</li>
              <li>Mobile-first layout keeps the cards readable on small portrait screens.</li>
            </ul>
          </div>

          {info ? <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center text-sm font-semibold text-white/80">{info}</div> : null}
          {purchaseStatus ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center text-sm font-semibold text-emerald-300">{purchaseStatus}</div>
          ) : null}
        </div>
      </main>

      {renderListModal()}
      {renderDetailModal()}
      {renderBulkConfirmModal()}
      {renderConfirmModal()}
    </div>
  );
}
