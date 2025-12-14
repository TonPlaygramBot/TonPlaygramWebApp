import { useEffect, useMemo, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  POOL_ROYALE_DEFAULT_LOADOUT,
  POOL_ROYALE_OPTION_LABELS,
  POOL_ROYALE_STORE_ITEMS
} from '../config/poolRoyaleInventoryConfig.js';
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
  getPoolRoyalInventory,
  isPoolOptionUnlocked,
  poolRoyalAccountId
} from '../utils/poolRoyalInventory.js';
import {
  addSnookerClubUnlock,
  getSnookerClubInventory,
  isSnookerOptionUnlocked,
  snookerClubAccountId
} from '../utils/snookerClubInventory.js';
import {
  addAirHockeyUnlock,
  airHockeyAccountId,
  getAirHockeyInventory,
  isAirHockeyOptionUnlocked
} from '../utils/airHockeyInventory.js';
import {
  CHESS_BATTLE_DEFAULT_LOADOUT,
  CHESS_BATTLE_OPTION_LABELS,
  CHESS_BATTLE_STORE_ITEMS
} from '../config/chessBattleInventoryConfig.js';
import {
  BLACKJACK_DEFAULT_LOADOUT,
  BLACKJACK_OPTION_LABELS,
  BLACKJACK_STORE_ITEMS
} from '../config/blackjackInventoryConfig.js';
import {
  addChessBattleUnlock,
  getChessBattleInventory,
  isChessOptionUnlocked,
  chessBattleAccountId
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
  isDominoOptionUnlocked
} from '../utils/dominoRoyalInventory.js';
import {
  addSnakeUnlock,
  getSnakeInventory,
  isSnakeOptionUnlocked,
  snakeAccountId
} from '../utils/snakeInventory.js';
import {
  addBlackjackUnlock,
  getBlackjackInventory,
  isBlackjackOptionUnlocked,
  blackjackAccountId
} from '../utils/blackjackInventory.js';
import {
  addTexasHoldemUnlock,
  getTexasHoldemInventory,
  isTexasOptionUnlocked,
  texasHoldemAccountId
} from '../utils/texasHoldemInventory.js';
import { getAccountBalance, sendAccountTpc } from '../utils/api.js';
import { DEV_INFO } from '../utils/constants.js';

const TYPE_LABELS = {
  tableFinish: 'Table Finishes',
  chromeColor: 'Chrome Fascias',
  railMarkerColor: 'Rail Markers',
  clothColor: 'Cloth Colors',
  cueStyle: 'Cue Styles'
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
  stools: 'Stools'
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
  blackjack: {
    name: 'Black Jack',
    items: BLACKJACK_STORE_ITEMS,
    defaults: BLACKJACK_DEFAULT_LOADOUT,
    labels: BLACKJACK_OPTION_LABELS,
    typeLabels: BLACKJACK_TYPE_LABELS,
    accountId: BLACKJACK_STORE_ACCOUNT_ID
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
  const [poolOwned, setPoolOwned] = useState(() => getPoolRoyalInventory(accountId));
  const [snookerOwned, setSnookerOwned] = useState(() => getSnookerClubInventory(snookerClubAccountId(accountId)));
  const [airOwned, setAirOwned] = useState(() => getAirHockeyInventory(airHockeyAccountId(accountId)));
  const [chessOwned, setChessOwned] = useState(() => getChessBattleInventory(chessBattleAccountId(accountId)));
  const [blackjackOwned, setBlackjackOwned] = useState(() => getBlackjackInventory(blackjackAccountId(accountId)));
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

  useEffect(() => {
    setAccountId(poolRoyalAccountId());
  }, []);

  useEffect(() => {
    setPoolOwned(getPoolRoyalInventory(accountId));
    setSnookerOwned(getSnookerClubInventory(snookerClubAccountId(accountId)));
    setAirOwned(getAirHockeyInventory(airHockeyAccountId(accountId)));
    setChessOwned(getChessBattleInventory(chessBattleAccountId(accountId)));
    setBlackjackOwned(getBlackjackInventory(blackjackAccountId(accountId)));
    setLudoOwned(getLudoBattleInventory(ludoBattleAccountId(accountId)));
    setMurlanOwned(getMurlanInventory(murlanAccountId(accountId)));
    setDominoOwned(getDominoRoyalInventory(dominoRoyalAccountId(accountId)));
    setSnakeOwned(getSnakeInventory(snakeAccountId(accountId)));
    setTexasOwned(getTexasHoldemInventory(texasHoldemAccountId(accountId)));
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
      blackjack: BLACKJACK_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId), slug: 'blackjack' })),
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
      blackjack: (type, optionId) => isBlackjackOptionUnlocked(type, optionId, blackjackOwned),
      ludobattleroyal: (type, optionId) => isLudoOptionUnlocked(type, optionId, ludoOwned),
      murlanroyale: (type, optionId) => isMurlanOptionUnlocked(type, optionId, murlanOwned),
      'domino-royal': (type, optionId) => isDominoOptionUnlocked(type, optionId, dominoOwned),
      snake: (type, optionId) => isSnakeOptionUnlocked(type, optionId, snakeOwned),
      texasholdem: (type, optionId) => isTexasOptionUnlocked(type, optionId, texasOwned)
    }),
    [airOwned, poolOwned, snookerOwned, blackjackOwned, chessOwned, ludoOwned, murlanOwned, dominoOwned, snakeOwned, texasOwned]
  );

  const labelResolvers = useMemo(
    () => ({
      poolroyale: (item) => POOL_ROYALE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      snookerclub: (item) => SNOOKER_CLUB_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      airhockey: (item) => AIR_HOCKEY_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      chessbattleroyal: (item) => CHESS_BATTLE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      blackjack: (item) => BLACKJACK_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
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
      blackjack: BLACKJACK_TYPE_LABELS,
      ludobattleroyal: LUDO_TYPE_LABELS,
      murlanroyale: MURLAN_TYPE_LABELS,
      'domino-royal': DOMINO_TYPE_LABELS,
      snake: SNAKE_TYPE_LABELS,
      texasholdem: TEXAS_TYPE_LABELS
    }),
    []
  );

  const allMarketplaceItems = useMemo(() => {
    const entries = [];
    Object.entries(storeItemsBySlug).forEach(([slug, items]) => {
      const ownedChecker = ownedCheckers[slug];
      const labelResolver = labelResolvers[slug];
      const typeLabels = typeLabelResolver[slug] || {};
      items.forEach((item) => {
        const displayLabel = labelResolver ? labelResolver(item) : item.name;
        entries.push({
          ...item,
          slug,
          displayLabel,
          typeLabel: typeLabels[item.type] || item.type,
          gameName: storeMeta[slug]?.name || slug,
          owned: ownedChecker ? ownedChecker(item.type, item.optionId) : false
        });
      });
    });
    return entries;
  }, [labelResolvers, ownedCheckers, storeItemsBySlug, typeLabelResolver]);

  const typeFilters = useMemo(() => {
    const types = new Set();
    allMarketplaceItems.forEach((item) => {
      if (item.typeLabel) {
        types.add(item.typeLabel);
      }
    });
    return ['all', ...Array.from(types)];
  }, [allMarketplaceItems]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return allMarketplaceItems
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
  }, [activeGame, activeType, allMarketplaceItems, searchTerm, sortOption]);

  const resetStatus = () => {
    setPurchaseStatus('');
    setInfo('');
  };

  const handlePurchase = async (item) => {
    const slug = item?.slug;
    if (item.owned || processing === item.id) return;
    if (!slug) return;
    if (!accountId || accountId === 'guest') {
      setInfo('Link your TPC account in the wallet first.');
      return;
    }

    const storeAccounts = {
      poolroyale: POOL_STORE_ACCOUNT_ID,
      snookerclub: SNOOKER_STORE_ACCOUNT_ID,
      airhockey: AIR_HOCKEY_STORE_ACCOUNT_ID,
      chessbattleroyal: CHESS_STORE_ACCOUNT_ID,
      blackjack: BLACKJACK_STORE_ACCOUNT_ID,
      ludobattleroyal: LUDO_STORE_ACCOUNT_ID,
      murlanroyale: MURLAN_STORE_ACCOUNT_ID,
      'domino-royal': DOMINO_STORE_ACCOUNT_ID,
      snake: SNAKE_STORE_ACCOUNT_ID,
      texasholdem: TEXAS_STORE_ACCOUNT_ID
    };
    const storeId = storeAccounts[slug];
    const gameName = storeMeta[slug]?.name || 'Game';

    const ownedLabel = labelResolvers[slug] ? labelResolvers[slug](item) : item.name;

    if (tpcBalance !== null && item.price > tpcBalance) {
      setInfo('Insufficient TPC balance for this purchase.');
      return;
    }

    setProcessing(item.id);
    resetStatus();

    try {
      const res = await sendAccountTpc(accountId, storeId, item.price, `${gameName}: ${ownedLabel}`);
      if (res?.error) {
        setInfo(res.error || 'Purchase failed.');
        return;
      }

      if (slug === 'poolroyale') {
        setPoolOwned(addPoolRoyalUnlock(item.type, item.optionId, accountId));
      } else if (slug === 'snookerclub') {
        setSnookerOwned(addSnookerClubUnlock(item.type, item.optionId, accountId));
      } else if (slug === 'airhockey') {
        setAirOwned(addAirHockeyUnlock(item.type, item.optionId, accountId));
      } else if (slug === 'chessbattleroyal') {
        setChessOwned(addChessBattleUnlock(item.type, item.optionId, accountId));
      } else if (slug === 'blackjack') {
        setBlackjackOwned(addBlackjackUnlock(item.type, item.optionId, accountId));
      } else if (slug === 'ludobattleroyal') {
        setLudoOwned(addLudoBattleUnlock(item.type, item.optionId, accountId));
      } else if (slug === 'murlanroyale') {
        setMurlanOwned(addMurlanUnlock(item.type, item.optionId, accountId));
      } else if (slug === 'domino-royal') {
        setDominoOwned(addDominoRoyalUnlock(item.type, item.optionId, accountId));
      } else if (slug === 'snake') {
        setSnakeOwned(addSnakeUnlock(item.type, item.optionId, accountId));
      } else if (slug === 'texasholdem') {
        setTexasOwned(addTexasHoldemUnlock(item.type, item.optionId, accountId));
      }

      const bal = await getAccountBalance(accountId);
      if (typeof bal?.balance === 'number') {
        setTpcBalance(bal.balance);
      }

      setPurchaseStatus(`${ownedLabel} purchase completed — now owned in ${gameName}.`);
      setInfo('');
    } catch (err) {
      console.error('Purchase failed', err);
      setInfo('Failed to process purchase.');
    } finally {
      setProcessing('');
      setConfirmItem(null);
    }
  };

  const featuredCount = allMarketplaceItems.length;
  const ownedCount = allMarketplaceItems.filter((item) => item.owned).length;

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
                disabled={processing === confirmItem.id}
              >
                {processing === confirmItem.id ? 'Processing…' : 'Confirm & Buy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
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
              <div className="text-xs font-semibold">{accountId || 'Guest'}</div>
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
              Storefront i ri — kërko, filtro dhe bli aksesorë në pak sekonda
            </h1>

            <p className="max-w-2xl text-sm text-white/70">
              Dizajn mobil-first i frymëzuar nga mocku më sipër. Çdo kartë shfaq çmimin në TPC, tipin e aksesorit dhe nëse e keni tashmë në inventar.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white/90">
                Shfleto të gjitha
              </button>
              <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">
                Kërko aksesorë
              </button>
            </div>
          </div>
        </section>

        <div className="mt-4 grid gap-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/60">Marketplace</p>
                <h2 className="text-xl font-semibold leading-tight">Aksesorë për çdo lojë TonPlaygram</h2>
                <p className="text-sm text-white/60">Filtrime të shpejta, listim i qartë dhe modal konfirmimi para blerjes.</p>
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
                  placeholder="Kërko emër, lojë ose tip aksesor"
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
                <option value="all">Të gjitha lojërat</option>
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
                    {type === 'all' ? 'Të gjitha tipet' : type}
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

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <div className="text-xs font-semibold text-white/70">Lojërat</div>
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
                <div className="text-xs font-semibold text-white/70">Tipet e aksesorëve</div>
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
              <div className="text-base font-semibold">Marketplace</div>
              <div className="text-xs text-white/60">{filteredItems.length} listings · paguaj me TPC · aksesorë për çdo lojë</div>
            </div>
            <button className="hidden rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 md:inline">
              View analytics
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <button
                key={`${item.slug}-${item.id}`}
                onClick={() => setConfirmItem(item)}
                className="group flex flex-col gap-3 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4 text-left shadow-sm transition hover:bg-white/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-black/30 text-lg font-semibold">
                      {item.gameName[0]}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">{item.displayLabel}</div>
                        {item.owned && (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                            Owned
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/60">{item.gameName} · {item.typeLabel}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/60">Price</div>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      {item.price}
                      <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/80">
                    {item.slug.replace('-', ' ')}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-semibold text-white/60">
                    {item.typeLabel}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      item.owned ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-indigo-400/30 bg-indigo-400/10 text-indigo-100'
                    }`}
                  >
                    {item.owned ? 'Në inventar' : 'Mintable'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-white/60">
                  <div>Seller: Official store</div>
                  <div className="group-hover:text-white/80">Tap për të parë</div>
                </div>
              </button>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
              Nuk ka artikuj që përputhen me filtrat. Pastro kërkimin ose zgjidh një lojë tjetër.
            </div>
          )}

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 space-y-2">
            <p className="font-semibold text-white">Udhëzime të shpejta</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Modal konfirmimi përpara çdo blerjeje për transparencë.</li>
              <li>Badget “Owned” ndizet menjëherë pasi të përfundojë blerja.</li>
              <li>Dizajni mobile-first — kartat rreshtohen mirë edhe në ekrane të vogla.</li>
            </ul>
          </div>

          {info ? <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center text-sm font-semibold text-white/80">{info}</div> : null}
          {purchaseStatus ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center text-sm font-semibold text-emerald-300">{purchaseStatus}</div>
          ) : null}
        </div>
      </main>

      {renderConfirmModal()}
    </div>
  );
}
