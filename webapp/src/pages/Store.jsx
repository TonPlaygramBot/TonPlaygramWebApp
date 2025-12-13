import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  POOL_ROYALE_DEFAULT_LOADOUT,
  POOL_ROYALE_OPTION_LABELS,
  POOL_ROYALE_STORE_ITEMS
} from '../config/poolRoyaleInventoryConfig.js';
import {
  addPoolRoyalUnlock,
  getPoolRoyalInventory,
  isPoolOptionUnlocked,
  listOwnedPoolRoyalOptions,
  poolRoyalAccountId
} from '../utils/poolRoyalInventory.js';
import {
  CHESS_BATTLE_DEFAULT_LOADOUT,
  CHESS_BATTLE_OPTION_LABELS,
  CHESS_BATTLE_STORE_ITEMS
} from '../config/chessBattleInventoryConfig.js';
import {
  addChessBattleUnlock,
  getChessBattleInventory,
  isChessOptionUnlocked,
  listOwnedChessOptions,
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
  listOwnedLudoOptions,
  ludoBattleAccountId
} from '../utils/ludoBattleInventory.js';
import {
  DOMINO_ROYAL_DEFAULT_LOADOUT,
  DOMINO_ROYAL_OPTION_LABELS,
  DOMINO_ROYAL_STORE_ITEMS
} from '../config/dominoRoyalInventoryConfig.js';
import {
  addDominoRoyalUnlock,
  dominoRoyalAccountId,
  getDominoRoyalInventory,
  isDominoOptionUnlocked,
  listOwnedDominoOptions
} from '../utils/dominoRoyalInventory.js';
import { getAccountBalance, sendAccountTpc } from '../utils/api.js';
import { DEV_INFO } from '../utils/constants.js';
import { catalogWithSlugs } from '../config/gamesCatalog.js';

const TYPE_LABELS = {
  tableFinish: 'Table Finishes',
  chromeColor: 'Chrome Fascias',
  railMarkerColor: 'Rail Markers',
  clothColor: 'Cloth Colors',
  cueStyle: 'Cue Styles'
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

const DOMINO_TYPE_LABELS = {
  tableWood: 'Table Wood',
  tableCloth: 'Table Cloth',
  tableBase: 'Table Base',
  dominoStyle: 'Domino Styles',
  highlightStyle: 'Highlights',
  chairTheme: 'Chairs'
};

const TPC_ICON = '/assets/icons/ezgif-54c96d8a9b9236.webp';
const POOL_STORE_ACCOUNT_ID = import.meta.env.VITE_POOL_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;
const CHESS_STORE_ACCOUNT_ID = import.meta.env.VITE_CHESS_BATTLE_STORE_ACCOUNT_ID || DEV_INFO.account;
const LUDO_STORE_ACCOUNT_ID = import.meta.env.VITE_LUDO_BATTLE_STORE_ACCOUNT_ID || DEV_INFO.account;
const DOMINO_STORE_ACCOUNT_ID = import.meta.env.VITE_DOMINO_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;
const SUPPORTED_STORE_SLUGS = ['poolroyale', 'chessbattleroyal', 'ludobattleroyal', 'domino-royal'];

const createItemKey = (type, optionId) => `${type}:${optionId}`;

export default function Store() {
  useTelegramBackButton();
  const { gameSlug } = useParams();
  const navigate = useNavigate();
  const [accountId, setAccountId] = useState(() => poolRoyalAccountId());
  const [poolOwned, setPoolOwned] = useState(() => getPoolRoyalInventory(accountId));
  const [chessOwned, setChessOwned] = useState(() => getChessBattleInventory(chessBattleAccountId(accountId)));
  const [ludoOwned, setLudoOwned] = useState(() => getLudoBattleInventory(ludoBattleAccountId(accountId)));
  const [dominoOwned, setDominoOwned] = useState(() => getDominoRoyalInventory(dominoRoyalAccountId(accountId)));
  const [info, setInfo] = useState('');
  const [marketInfo, setMarketInfo] = useState('');
  const [tpcBalance, setTpcBalance] = useState(null);
  const [processing, setProcessing] = useState('');
  const [listings, setListings] = useState([]);
  const [selectedItemKey, setSelectedItemKey] = useState('');
  const [listingPrice, setListingPrice] = useState('');

  const activeSlug = useMemo(() => {
    if (gameSlug && catalogWithSlugs.some((g) => g.slug === gameSlug)) return gameSlug;
    return 'poolroyale';
  }, [gameSlug]);

  const activeGame = useMemo(
    () => catalogWithSlugs.find((game) => game.slug === activeSlug) || catalogWithSlugs[0],
    [activeSlug]
  );

  useEffect(() => {
    if (!gameSlug || !catalogWithSlugs.some((g) => g.slug === gameSlug)) {
      navigate(`/store/${activeSlug}`, { replace: true });
    }
  }, [activeSlug, gameSlug, navigate]);

  useEffect(() => {
    setAccountId(poolRoyalAccountId());
  }, []);

  useEffect(() => {
    setPoolOwned(getPoolRoyalInventory(accountId));
    setChessOwned(getChessBattleInventory(chessBattleAccountId(accountId)));
    setLudoOwned(getLudoBattleInventory(ludoBattleAccountId(accountId)));
    setDominoOwned(getDominoRoyalInventory(dominoRoyalAccountId(accountId)));
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

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === accountId) {
        setPoolOwned(getPoolRoyalInventory(accountId));
      }
    };
    window.addEventListener('poolRoyalInventoryUpdate', handler);
    return () => window.removeEventListener('poolRoyalInventoryUpdate', handler);
  }, [accountId]);

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === accountId) {
        setChessOwned(getChessBattleInventory(chessBattleAccountId(accountId)));
      }
    };
    window.addEventListener('chessBattleInventoryUpdate', handler);
    return () => window.removeEventListener('chessBattleInventoryUpdate', handler);
  }, [accountId]);

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === accountId) {
        setLudoOwned(getLudoBattleInventory(ludoBattleAccountId(accountId)));
      }
    };
    window.addEventListener('ludoBattleInventoryUpdate', handler);
    return () => window.removeEventListener('ludoBattleInventoryUpdate', handler);
  }, [accountId]);

  useEffect(() => {
    const handler = (event) => {
      if (!event?.detail?.accountId || event.detail.accountId === accountId) {
        setDominoOwned(getDominoRoyalInventory(dominoRoyalAccountId(accountId)));
      }
    };
    window.addEventListener('dominoRoyalInventoryUpdate', handler);
    return () => window.removeEventListener('dominoRoyalInventoryUpdate', handler);
  }, [accountId]);

  useEffect(() => {
    setSelectedItemKey('');
    setListingPrice('');
    setMarketInfo('');
  }, [activeSlug]);

  const poolGroupedItems = useMemo(() => {
    const items = POOL_ROYALE_STORE_ITEMS.map((item) => ({
      ...item,
      owned: isPoolOptionUnlocked(item.type, item.optionId, poolOwned)
    }));
    return items.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    }, {});
  }, [poolOwned]);

  const poolDefaultLoadout = useMemo(
    () =>
      POOL_ROYALE_DEFAULT_LOADOUT.map((entry) => ({
        ...entry,
        owned: isPoolOptionUnlocked(entry.type, entry.optionId, poolOwned)
      })),
    [poolOwned]
  );

  const chessGroupedItems = useMemo(() => {
    const items = CHESS_BATTLE_STORE_ITEMS.map((item) => ({
      ...item,
      owned: isChessOptionUnlocked(item.type, item.optionId, chessOwned)
    }));
    return items.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    }, {});
  }, [chessOwned]);

  const chessDefaultLoadout = useMemo(
    () =>
      CHESS_BATTLE_DEFAULT_LOADOUT.map((entry) => ({
        ...entry,
        owned: isChessOptionUnlocked(entry.type, entry.optionId, chessOwned)
      })),
    [chessOwned]
  );

  const ludoGroupedItems = useMemo(() => {
    const items = LUDO_BATTLE_STORE_ITEMS.map((item) => ({
      ...item,
      owned: isLudoOptionUnlocked(item.type, item.optionId, ludoOwned)
    }));
    return items.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    }, {});
  }, [ludoOwned]);

  const ludoDefaultLoadout = useMemo(
    () =>
      LUDO_BATTLE_DEFAULT_LOADOUT.map((entry) => ({
        ...entry,
        owned: isLudoOptionUnlocked(entry.type, entry.optionId, ludoOwned)
      })),
    [ludoOwned]
  );

  const dominoGroupedItems = useMemo(() => {
    const items = DOMINO_ROYAL_STORE_ITEMS.map((item) => ({
      ...item,
      owned: isDominoOptionUnlocked(item.type, item.optionId, dominoOwned)
    }));
    return items.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    }, {});
  }, [dominoOwned]);

  const dominoDefaultLoadout = useMemo(
    () =>
      DOMINO_ROYAL_DEFAULT_LOADOUT.map((entry) => ({
        ...entry,
        owned: isDominoOptionUnlocked(entry.type, entry.optionId, dominoOwned)
      })),
    [dominoOwned]
  );

  const storeItemsBySlug = useMemo(
    () => ({
      poolroyale: POOL_ROYALE_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId) })),
      chessbattleroyal: CHESS_BATTLE_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId) })),
      ludobattleroyal: LUDO_BATTLE_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId) })),
      'domino-royal': DOMINO_ROYAL_STORE_ITEMS.map((item) => ({ ...item, key: createItemKey(item.type, item.optionId) }))
    }),
    []
  );

  const officialPriceMap = useMemo(() => {
    const prices = {};
    Object.entries(storeItemsBySlug).forEach(([slug, items]) => {
      prices[slug] = items.reduce((acc, item) => {
        acc[item.key] = item.price;
        return acc;
      }, {});
    });
    return prices;
  }, [storeItemsBySlug]);

  const ownedCheckers = useMemo(
    () => ({
      poolroyale: (type, optionId) => isPoolOptionUnlocked(type, optionId, poolOwned),
      chessbattleroyal: (type, optionId) => isChessOptionUnlocked(type, optionId, chessOwned),
      ludobattleroyal: (type, optionId) => isLudoOptionUnlocked(type, optionId, ludoOwned),
      'domino-royal': (type, optionId) => isDominoOptionUnlocked(type, optionId, dominoOwned)
    }),
    [poolOwned, chessOwned, ludoOwned, dominoOwned]
  );

  const labelResolvers = useMemo(
    () => ({
      poolroyale: (item) => POOL_ROYALE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      chessbattleroyal: (item) => CHESS_BATTLE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      ludobattleroyal: (item) => LUDO_BATTLE_OPTION_LABELS[item.type]?.[item.optionId] || item.name,
      'domino-royal': (item) => DOMINO_ROYAL_OPTION_LABELS[item.type]?.[item.optionId] || item.name
    }),
    []
  );

  const tradableOwnedItems = useMemo(() => {
    const isOwned = ownedCheckers[activeSlug];
    const labelResolver = labelResolvers[activeSlug];
    const items = storeItemsBySlug[activeSlug] || [];
    if (!isOwned || !labelResolver) return [];
    return items
      .filter((item) => isOwned(item.type, item.optionId))
      .map((item) => ({
        ...item,
        displayLabel: labelResolver(item)
      }));
  }, [activeSlug, labelResolvers, ownedCheckers, storeItemsBySlug]);

  useEffect(() => {
    if (!selectedItemKey && tradableOwnedItems.length > 0) {
      setSelectedItemKey(tradableOwnedItems[0].key);
      setListingPrice(tradableOwnedItems[0].price.toString());
    }
  }, [selectedItemKey, tradableOwnedItems]);

  const handlePurchase = async (item) => {
    if (item.owned || processing === item.id) return;
    if (!accountId || accountId === 'guest') {
      setInfo('Link your TPC account in the wallet first.');
      return;
    }
    const storeAccounts = {
      poolroyale: POOL_STORE_ACCOUNT_ID,
      chessbattleroyal: CHESS_STORE_ACCOUNT_ID,
      ludobattleroyal: LUDO_STORE_ACCOUNT_ID,
      'domino-royal': DOMINO_STORE_ACCOUNT_ID
    };
    const storeId = storeAccounts[activeSlug];
    if (!storeId) {
      setInfo('Store account unavailable. Please try again later.');
      return;
    }

    const labelMaps = {
      poolroyale: POOL_ROYALE_OPTION_LABELS,
      chessbattleroyal: CHESS_BATTLE_OPTION_LABELS,
      ludobattleroyal: LUDO_BATTLE_OPTION_LABELS,
      'domino-royal': DOMINO_ROYAL_OPTION_LABELS
    };
    const labels = labelMaps[activeSlug]?.[item.type] || {};
    const ownedLabel = labels[item.optionId] || item.name;

    if (tpcBalance !== null && item.price > tpcBalance) {
      setInfo('Insufficient TPC balance for this purchase.');
      return;
    }

    setProcessing(item.id);
    setInfo('');
    try {
      const res = await sendAccountTpc(
        accountId,
        storeId,
        item.price,
        `${activeGame?.name || 'Game'}: ${ownedLabel}`
      );
      if (res?.error) {
        setInfo(res.error || 'Purchase failed.');
        return;
      }

      if (activeSlug === 'poolroyale') {
        const updatedInventory = addPoolRoyalUnlock(item.type, item.optionId, accountId);
        setPoolOwned(updatedInventory);
        setInfo(`${ownedLabel} purchased and added to your Pool Royale account.`);
      } else if (activeSlug === 'chessbattleroyal') {
        const updatedInventory = addChessBattleUnlock(item.type, item.optionId, accountId);
        setChessOwned(updatedInventory);
        setInfo(`${ownedLabel} purchased and added to your Chess Battle Royal account.`);
      } else if (activeSlug === 'ludobattleroyal') {
        const updatedInventory = addLudoBattleUnlock(item.type, item.optionId, accountId);
        setLudoOwned(updatedInventory);
        setInfo(`${ownedLabel} purchased and added to your Ludo Battle Royal account.`);
      } else if (activeSlug === 'domino-royal') {
        const updatedInventory = addDominoRoyalUnlock(item.type, item.optionId, accountId);
        setDominoOwned(updatedInventory);
        setInfo(`${ownedLabel} purchased and added to your Domino Royal account.`);
      }

      const bal = await getAccountBalance(accountId);
      if (typeof bal?.balance === 'number') {
        setTpcBalance(bal.balance);
      }
    } catch (err) {
      console.error('Purchase failed', err);
      setInfo('Failed to process purchase.');
    } finally {
      setProcessing('');
    }
  };

  const handleCreateListing = () => {
    const item = tradableOwnedItems.find((entry) => entry.key === selectedItemKey);
    if (!item) {
      setMarketInfo('Select an item you own to list it.');
      return;
    }
    const parsedPrice = Number(listingPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setMarketInfo('Enter a valid listing price.');
      return;
    }
    const floorPrice = officialPriceMap?.[activeSlug]?.[item.key] ?? item.price;
    if (parsedPrice < floorPrice) {
      setMarketInfo(`Listing price must be at least the official store price of ${floorPrice} TPC.`);
      return;
    }

    const buyerFee = +(parsedPrice * 0.02).toFixed(2);
    const sellerFee = +(parsedPrice * 0.02).toFixed(2);
    const developerFee = +(buyerFee + sellerFee).toFixed(2);
    const sellerProceeds = +(parsedPrice - sellerFee).toFixed(2);
    const buyerTotal = +(parsedPrice + buyerFee).toFixed(2);

    setListings((prev) => [
      ...prev,
      {
        listingId: `${item.key}-${Date.now()}`,
        slug: activeSlug,
        itemKey: item.key,
        name: item.displayLabel,
        price: parsedPrice,
        officialPrice: floorPrice,
        buyerFee,
        sellerFee,
        developerFee,
        sellerProceeds,
        buyerTotal
      }
    ]);

    setMarketInfo(
      `Listing created for ${item.displayLabel}. Buyer pays ${buyerTotal} TPC (2% fee), seller receives ${sellerProceeds} TPC after a 2% fee. Developer account ${DEV_INFO.account} collects ${developerFee} TPC when sold.`
    );
  };

  const handlePurchaseListing = (listingId) => {
    const listing = listings.find((entry) => entry.listingId === listingId);
    if (!listing) return;
    setListings((prev) => prev.filter((entry) => entry.listingId !== listingId));
    setMarketInfo(
      `Sale completed for ${listing.name} at ${listing.price} TPC. Buyer paid ${listing.buyerTotal} TPC (2% marketplace fee) and seller received ${listing.sellerProceeds} TPC after their 2% fee. ${listing.developerFee} TPC was routed to developer account ${DEV_INFO.account}.`
    );
  };

  const marketplaceListings = useMemo(
    () => listings.filter((entry) => entry.slug === activeSlug),
    [listings, activeSlug]
  );

  const poolOwnedOptions = useMemo(() => listOwnedPoolRoyalOptions(accountId), [accountId]);
  const chessOwnedOptions = useMemo(() => listOwnedChessOptions(accountId), [accountId]);
  const ludoOwnedOptions = useMemo(() => listOwnedLudoOptions(accountId), [accountId]);
  const dominoOwnedOptions = useMemo(() => listOwnedDominoOptions(accountId), [accountId]);

  const ownedItemLookup = useMemo(
    () => ({
      poolroyale: poolOwnedOptions,
      chessbattleroyal: chessOwnedOptions,
      ludobattleroyal: ludoOwnedOptions,
      'domino-royal': dominoOwnedOptions
    }),
    [poolOwnedOptions, chessOwnedOptions, ludoOwnedOptions, dominoOwnedOptions]
  );

  const hasStorefront = SUPPORTED_STORE_SLUGS.includes(activeSlug);

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center">
      <h2 className="text-xl font-bold">{activeGame?.name || 'Store'}</h2>
      <p className="text-subtext text-sm text-center max-w-2xl">
        Browse official cosmetics and manage peer-to-peer trades. Each game has its own store tab; tap a game name
        above to switch pages.
      </p>

      <div className="w-full overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {catalogWithSlugs.map((game) => (
            <Link
              key={game.slug}
              to={`/store/${game.slug}`}
              className={`px-3 py-2 rounded-full border text-sm whitespace-nowrap ${
                activeSlug === game.slug
                  ? 'bg-primary text-black border-primary'
                  : 'bg-surface border-border text-subtext hover:text-text'
              }`}
            >
              {game.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="store-info-bar">
        <span className="font-semibold">{activeGame?.name || 'Storefront'}</span>
        <span className="text-xs text-subtext">Account: {accountId}</span>
        <span className="text-xs text-subtext">Prices shown in TPC</span>
        <span className="text-xs text-subtext">
          Balance: {tpcBalance === null ? '...' : tpcBalance.toLocaleString()} TPC
        </span>
      </div>

      {hasStorefront ? (
        <div className="store-card max-w-2xl">
          <h3 className="text-lg font-semibold">Marketplace policy</h3>
          <p className="text-sm text-subtext">
            Listings are limited to items you own and that are marked tradeable. Prices must match or exceed the
            official store price. A 2% fee is charged to both buyer and seller, and the combined fee is routed to the
            developer account ({DEV_INFO.account}) when the NFT transfers.
          </p>
        </div>
      ) : null}

      {activeSlug === 'poolroyale' && (
        <>
          <div className="store-card max-w-2xl">
            <h3 className="text-lg font-semibold">Default Loadout (Free)</h3>
            <p className="text-sm text-subtext">
              These items are always available and applied when you enter Pool Royale.
            </p>
            <ul className="mt-2 space-y-1 w-full">
              {poolDefaultLoadout.map((item) => (
                <li
                  key={`${item.type}-${item.optionId}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 w-full"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs uppercase text-subtext">{TYPE_LABELS[item.type] || item.type}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full space-y-3">
            <h3 className="text-lg font-semibold text-center">Pool Royale Collection</h3>
            {Object.entries(poolGroupedItems).map(([type, items]) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold">{TYPE_LABELS[type] || type}</h4>
                  <span className="text-xs text-subtext">NFT unlocks</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map((item) => {
                    const labels = POOL_ROYALE_OPTION_LABELS[item.type] || {};
                    const ownedLabel = labels[item.optionId] || item.name;
                    return (
                      <div key={item.id} className="store-card">
                        <div className="flex w-full items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-lg leading-tight">{item.name}</p>
                            <p className="text-xs text-subtext">{item.description}</p>
                            <p className="text-xs text-subtext mt-1">Applies to: {TYPE_LABELS[item.type] || item.type}</p>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-semibold">
                            {item.price}
                            <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePurchase(item)}
                          disabled={item.owned || processing === item.id}
                          className={`buy-button mt-2 text-center ${
                            item.owned || processing === item.id ? 'cursor-not-allowed opacity-60' : ''
                          }`}
                        >
                          {item.owned
                            ? `${ownedLabel} Owned`
                            : processing === item.id
                            ? 'Purchasing...'
                            : `Purchase ${ownedLabel}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeSlug === 'domino-royal' && (
        <>
          <div className="store-card max-w-2xl">
            <h3 className="text-lg font-semibold">Domino Royal Defaults (Free)</h3>
            <p className="text-sm text-subtext">
              The first option in each category stays free. Purchase the others to surface them inside the Domino Royal table
              setup menu.
            </p>
            <ul className="mt-2 space-y-1 w-full">
              {dominoDefaultLoadout.map((item) => (
                <li
                  key={`domino-${item.type}-${item.optionId}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 w-full"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs uppercase text-subtext">{DOMINO_TYPE_LABELS[item.type] || item.type}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full space-y-3">
            <h3 className="text-lg font-semibold text-center">Domino Royal Collection</h3>
            {Object.entries(dominoGroupedItems).map(([type, items]) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold">{DOMINO_TYPE_LABELS[type] || type}</h4>
                  <span className="text-xs text-subtext">NFT unlocks</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map((item) => {
                    const labels = DOMINO_ROYAL_OPTION_LABELS[item.type] || {};
                    const ownedLabel = labels[item.optionId] || item.name;
                    return (
                      <div key={item.id} className="store-card">
                        <div className="flex w-full items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-lg leading-tight">{item.name}</p>
                            <p className="text-xs text-subtext">{item.description}</p>
                            <p className="text-xs text-subtext mt-1">Applies to: {DOMINO_TYPE_LABELS[item.type] || item.type}</p>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-semibold">
                            {item.price}
                            <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePurchase(item)}
                          disabled={item.owned || processing === item.id}
                          className={`buy-button mt-2 text-center ${
                            item.owned || processing === item.id ? 'cursor-not-allowed opacity-60' : ''
                          }`}
                        >
                          {item.owned
                            ? `${ownedLabel} Owned`
                            : processing === item.id
                            ? 'Purchasing...'
                            : `Purchase ${ownedLabel}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeSlug === 'chessbattleroyal' && (
        <>
          <div className="store-card max-w-2xl">
            <h3 className="text-lg font-semibold">Chess Battle Royal Defaults (Free)</h3>
            <p className="text-sm text-subtext">
              Two base piece colors stay unlocked by default; purchase the others to surface them inside the table setup
              menu.
            </p>
            <ul className="mt-2 space-y-1 w-full">
              {chessDefaultLoadout.map((item) => (
                <li
                  key={`chess-${item.type}-${item.optionId}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 w-full"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs uppercase text-subtext">{CHESS_TYPE_LABELS[item.type] || item.type}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full space-y-3">
            <h3 className="text-lg font-semibold text-center">Chess Battle Royal Collection</h3>
            {Object.entries(chessGroupedItems).map(([type, items]) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold">{CHESS_TYPE_LABELS[type] || type}</h4>
                  <span className="text-xs text-subtext">NFT unlocks</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map((item) => {
                    const labels = CHESS_BATTLE_OPTION_LABELS[item.type] || {};
                    const ownedLabel = labels[item.optionId] || item.name;
                    return (
                      <div key={item.id} className="store-card">
                        <div className="flex w-full items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-lg leading-tight">{item.name}</p>
                            <p className="text-xs text-subtext">{item.description}</p>
                            <p className="text-xs text-subtext mt-1">
                              Applies to: {CHESS_TYPE_LABELS[item.type] || item.type}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-semibold">
                            {item.price}
                            <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePurchase(item)}
                          disabled={item.owned || processing === item.id}
                          className={`buy-button mt-2 text-center ${
                            item.owned || processing === item.id ? 'cursor-not-allowed opacity-60' : ''
                          }`}
                        >
                          {item.owned
                            ? `${ownedLabel} Owned`
                            : processing === item.id
                            ? 'Purchasing...'
                            : `Purchase ${ownedLabel}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {activeSlug === 'ludobattleroyal' && (
        <>
          <div className="store-card max-w-2xl">
            <h3 className="text-lg font-semibold">Ludo Battle Royal Defaults (Free)</h3>
            <p className="text-sm text-subtext">
              The first option in each category stays free. Purchase the others to surface them inside the Ludo table setup
              menu.
            </p>
            <ul className="mt-2 space-y-1 w-full">
              {ludoDefaultLoadout.map((item) => (
                <li
                  key={`ludo-${item.type}-${item.optionId}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 w-full"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs uppercase text-subtext">{LUDO_TYPE_LABELS[item.type] || item.type}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full space-y-3">
            <h3 className="text-lg font-semibold text-center">Ludo Battle Royal Collection</h3>
            {Object.entries(ludoGroupedItems).map(([type, items]) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold">{LUDO_TYPE_LABELS[type] || type}</h4>
                  <span className="text-xs text-subtext">NFT unlocks</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {items.map((item) => {
                    const labels = LUDO_BATTLE_OPTION_LABELS[item.type] || {};
                    const ownedLabel = labels[item.optionId] || item.name;
                    return (
                      <div key={item.id} className="store-card">
                        <div className="flex w-full items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-lg leading-tight">{item.name}</p>
                            <p className="text-xs text-subtext">{item.description}</p>
                            <p className="text-xs text-subtext mt-1">Applies to: {LUDO_TYPE_LABELS[item.type] || item.type}</p>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-semibold">
                            {item.price}
                            <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handlePurchase(item)}
                          disabled={item.owned || processing === item.id}
                          className={`buy-button mt-2 text-center ${
                            item.owned || processing === item.id ? 'cursor-not-allowed opacity-60' : ''
                          }`}
                        >
                          {item.owned
                            ? `${ownedLabel} Owned`
                            : processing === item.id
                            ? 'Purchasing...'
                            : `Purchase ${ownedLabel}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!hasStorefront && (
        <div className="store-card max-w-2xl text-center">
          <p className="text-sm text-subtext">
            The store and marketplace for {activeGame?.name || 'this game'} will open soon. Check back for cosmetic and NFT
            trading options.
          </p>
        </div>
      )}

      {hasStorefront && (
        <div className="store-card max-w-3xl w-full space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold">NFT Marketplace</h3>
              <p className="text-xs text-subtext">
                List only tradeable items you own. Prices cannot go below the official store price. A 2% fee applies to
                both buyer and seller when an order fills.
              </p>
            </div>
            <div className="text-xs text-subtext">
              Developer fee target: <span className="font-semibold text-text">{DEV_INFO.account}</span>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Select owned item</label>
              <select
                value={selectedItemKey}
                onChange={(e) => setSelectedItemKey(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                {tradableOwnedItems.length === 0 ? <option value="">No tradeable items owned</option> : null}
                {tradableOwnedItems.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.displayLabel} — Official price {item.price} TPC
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Listing price (TPC)</label>
              <input
                type="number"
                min={0}
                value={listingPrice}
                onChange={(e) => setListingPrice(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                placeholder="Enter price"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreateListing}
            className="buy-button text-center"
            disabled={!selectedItemKey || tradableOwnedItems.length === 0}
          >
            Create listing with 2% dual fee
          </button>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Active listings</h4>
              <span className="text-xs text-subtext">{marketplaceListings.length} open</span>
            </div>
            {marketplaceListings.length === 0 ? (
              <p className="text-sm text-subtext">No listings yet for this game. List something you own to get started.</p>
            ) : (
              <div className="space-y-2">
                {marketplaceListings.map((listing) => (
                  <div key={listing.listingId} className="rounded-lg border border-border p-3 bg-surface/60">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="space-y-0.5">
                        <p className="font-semibold">{listing.name}</p>
                        <p className="text-xs text-subtext">
                          Listed at {listing.price} TPC (official floor {listing.officialPrice} TPC)
                        </p>
                        <p className="text-xs text-subtext">
                          Buyer pays {listing.buyerTotal} TPC (+2%), seller receives {listing.sellerProceeds} TPC (-2%).
                          Dev receives {listing.developerFee} TPC when it sells.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePurchaseListing(listing.listingId)}
                        className="buy-button px-4 py-2 text-center"
                      >
                        Buy & settle fees
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border p-3 bg-surface/70 text-xs text-subtext">
            <p>
              You can only list items present in your owned inventory: {ownedItemLookup[activeSlug]?.length || 0} owned
              entries detected for this game. If you unlock new cosmetics, refresh or revisit this tab to enable
              listing.
            </p>
          </div>
        </div>
      )}

      {info ? <div className="checkout-card text-center text-sm font-semibold">{info}</div> : null}
      {marketInfo ? <div className="checkout-card text-center text-sm font-semibold">{marketInfo}</div> : null}
    </div>
  );
}
