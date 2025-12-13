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

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return allMarketplaceItems
      .filter((item) => {
        if (activeGame !== 'all' && item.slug !== activeGame) return false;
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
  }, [activeGame, allMarketplaceItems, searchTerm, sortOption]);

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
        <div className="w-full max-w-md rounded-2xl bg-surface border border-border p-5 shadow-xl space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase text-subtext">Confirm purchase</p>
              <h3 className="text-lg font-semibold leading-tight">{confirmItem.displayLabel}</h3>
              <p className="text-sm text-subtext">{gameName} • {confirmItem.typeLabel}</p>
            </div>
            <div className="flex items-center gap-1 font-semibold">
              {confirmItem.price}
              <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
            </div>
          </div>
          <p className="text-sm text-subtext">
            This NFT cosmetic will be unlocked instantly for your account. Please confirm the payment to continue.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setConfirmItem(null)}
              className="w-full rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handlePurchase(confirmItem)}
              className="w-full rounded-xl bg-gradient-to-r from-[#00B2FF] to-[#6D5DF6] px-4 py-2 text-sm font-semibold text-white shadow sm:w-auto"
              disabled={processing === confirmItem.id}
            >
              {processing === confirmItem.id ? 'Processing...' : 'Confirm & Buy'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-border bg-surface/80 p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-subtext">Marketplace</p>
              <h1 className="text-2xl font-bold leading-tight">All NFTs in one modern store</h1>
              <p className="text-sm text-subtext">
                Browse every cosmetic across our games, search instantly, sort by price, and confirm before buying.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
              <div className="text-left">
                <p className="text-xs text-subtext">Items</p>
                <p className="font-semibold">{featuredCount.toLocaleString()}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-left">
                <p className="text-xs text-subtext">Owned</p>
                <p className="font-semibold">{ownedCount}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-left">
                <p className="text-xs text-subtext">Balance</p>
                <p className="font-semibold flex items-center gap-1">
                  {tpcBalance === null ? '—' : tpcBalance}
                  <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
            <div className="rounded-xl border border-border bg-surface px-3 py-2 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-5 w-5 text-subtext">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 5.25 5.25a7.5 7.5 0 0 0 11.4 11.4Z" />
              </svg>
              <input
                type="search"
                placeholder="Search items, games, or styles"
                className="w-full bg-transparent text-sm focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
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
              className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
            >
              <option value="featured">Featured</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="alpha">Alphabetical</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <div key={`${item.slug}-${item.id}`} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/70 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-xs uppercase text-subtext">{item.gameName}</p>
                  <h3 className="text-lg font-semibold leading-tight">{item.displayLabel}</h3>
                  <p className="text-xs text-subtext">{item.typeLabel}</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-surface px-3 py-1 text-sm font-semibold">
                  {item.price}
                  <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                </div>
              </div>
              <p className="text-sm text-subtext line-clamp-2">{item.description}</p>
              <div className="flex items-center justify-between text-xs text-subtext">
                <span className="rounded-full bg-surface px-3 py-1 capitalize">{item.slug.replace('-', ' ')}</span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                    item.owned ? 'bg-green-400/10 text-green-400' : 'bg-[#6D5DF6]/10 text-[#6D5DF6]'
                  }`}
                >
                  {item.owned ? 'Owned' : 'Mintable'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmItem(item)}
                disabled={item.owned || processing === item.id}
                className={`buy-button text-center ${item.owned ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {item.owned ? 'Already owned' : processing === item.id ? 'Processing...' : 'Buy now'}
              </button>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface/80 p-6 text-center text-subtext">
            No items match your filters. Try clearing the search or picking a different game.
          </div>
        )}

        <div className="rounded-2xl border border-border bg-surface/80 p-4 text-sm text-subtext space-y-2">
          <p className="font-semibold text-text">Quick tips</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Every purchase opens a confirmation modal before sending TPC.</li>
            <li>Owned cosmetics show an “Owned” badge immediately after completion.</li>
            <li>Design is responsive — cards stack on mobile and expand into rows on larger screens.</li>
          </ul>
        </div>

        {info ? <div className="checkout-card text-center text-sm font-semibold">{info}</div> : null}
        {purchaseStatus ? (
          <div className="checkout-card text-center text-sm font-semibold text-green-400">{purchaseStatus}</div>
        ) : null}
      </div>
      {renderConfirmModal()}
    </div>
  );
}
