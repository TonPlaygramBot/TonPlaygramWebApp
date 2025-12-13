import { useEffect, useMemo, useState } from 'react';
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
  poolRoyalAccountId
} from '../utils/poolRoyalInventory.js';
import { getAccountBalance, sendAccountTpc } from '../utils/api.js';
import { DEV_INFO } from '../utils/constants.js';

const TYPE_LABELS = {
  tableFinish: 'Table Finishes',
  chromeColor: 'Chrome Fascias',
  railMarkerColor: 'Rail Markers',
  clothColor: 'Cloth Colors',
  cueStyle: 'Cue Styles'
};

const TPC_ICON = '/assets/icons/ezgif-54c96d8a9b9236.webp';
const STORE_ACCOUNT_ID = import.meta.env.VITE_POOL_ROYALE_STORE_ACCOUNT_ID || DEV_INFO.account;
const DEVELOPER_ACCOUNT_LABEL = 'Developers Account (2% buyer + 2% seller)';

const SECONDARY_GAMES = [
  {
    id: 'snooker-club',
    name: 'Snooker Club',
    description: 'Limited cues, felt patterns, and chalk colors inspired by televised snooker.',
    tag: 'Esports skins',
    items: [
      {
        name: 'Century Green Felt',
        rarity: 'Epic',
        price: 1200,
        includes: ['Felt finish', 'Scoreboard HUD accent', 'Table lighting preset']
      },
      {
        name: '147 Cue Kit',
        rarity: 'Legendary',
        price: 2200,
        includes: ['Carbon cue', 'Golden sight lines', 'Break-off chalk dust VFX']
      },
      {
        name: 'London Venue Pack',
        rarity: 'Rare',
        price: 950,
        includes: ['Hall ambience loop', 'Venue banner wrap', 'Audience spotlight sweep']
      }
    ]
  },
  {
    id: 'billiards-classic',
    name: 'Billiards Classic',
    description: 'Casual modes with nostalgic visuals for 8-ball and 9-ball playlists.',
    tag: 'Casual',
    items: [
      {
        name: 'Neon Nights Table',
        rarity: 'Rare',
        price: 800,
        includes: ['Neon rail markers', 'Synthwave soundtrack loop', 'Animated pocket glow']
      },
      {
        name: 'Retro Arcade Bundle',
        rarity: 'Epic',
        price: 1450,
        includes: ['CRT scanline overlay', '8-bit pocket jingles', 'Arcade score banner']
      },
      {
        name: 'Minimalist Chalk Set',
        rarity: 'Uncommon',
        price: 420,
        includes: ['Muted chalk colors', 'Clean HUD icons', 'Soft impact SFX']
      }
    ]
  }
];

export default function Store() {
  useTelegramBackButton();
  const [accountId, setAccountId] = useState(() => poolRoyalAccountId());
  const [owned, setOwned] = useState(() => getPoolRoyalInventory(accountId));
  const [info, setInfo] = useState('');
  const [tpcBalance, setTpcBalance] = useState(null);
  const [processing, setProcessing] = useState('');
  const [activeGame, setActiveGame] = useState('pool-royale');
  const [marketplaceListings, setMarketplaceListings] = useState([
    {
      id: 'mk-1',
      title: 'Galaxy Felt',
      game: 'Pool Royale',
      seller: '@cue-master',
      price: 750,
      status: 'live'
    },
    {
      id: 'mk-2',
      title: 'Emerald Rail Pack',
      game: 'Snooker Club',
      seller: '@greenline',
      price: 1180,
      status: 'live'
    },
    {
      id: 'mk-3',
      title: 'Arcade Cue Wrap',
      game: 'Billiards Classic',
      seller: '@retro-king',
      price: 640,
      status: 'live'
    }
  ]);
  const [listingForm, setListingForm] = useState({
    title: '',
    game: 'Pool Royale',
    price: ''
  });
  const [marketplaceInfo, setMarketplaceInfo] = useState('');

  useEffect(() => {
    setAccountId(poolRoyalAccountId());
  }, []);

  useEffect(() => {
    setOwned(getPoolRoyalInventory(accountId));
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
        setOwned(getPoolRoyalInventory(accountId));
      }
    };
    window.addEventListener('poolRoyalInventoryUpdate', handler);
    return () => window.removeEventListener('poolRoyalInventoryUpdate', handler);
  }, [accountId]);

  const groupedItems = useMemo(() => {
    const items = POOL_ROYALE_STORE_ITEMS.map((item) => ({
      ...item,
      owned: isPoolOptionUnlocked(item.type, item.optionId, owned)
    }));
    return items.reduce((acc, item) => {
      acc[item.type] = acc[item.type] || [];
      acc[item.type].push(item);
      return acc;
    }, {});
  }, [owned]);

  const defaultLoadout = useMemo(
    () =>
      POOL_ROYALE_DEFAULT_LOADOUT.map((entry) => ({
        ...entry,
        owned: isPoolOptionUnlocked(entry.type, entry.optionId, owned)
      })),
    [owned]
  );

  const gameCards = useMemo(
    () => [
      {
        id: 'pool-royale',
        name: 'Pool Royale',
        description: 'Account-bound cosmetics, live today.',
        tag: `${Object.keys(groupedItems).length} categories`,
        highlight: true
      },
      ...SECONDARY_GAMES.map((g) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        tag: g.tag,
        highlight: false
      }))
    ],
    [groupedItems]
  );

  const handlePurchase = async (item) => {
    if (item.owned || processing === item.id) return;
    if (!accountId || accountId === 'guest') {
      setInfo('Link your TPC account in the wallet first.');
      return;
    }
    if (!STORE_ACCOUNT_ID) {
      setInfo('Store account unavailable. Please try again later.');
      return;
    }

    const labels = POOL_ROYALE_OPTION_LABELS[item.type] || {};
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
        STORE_ACCOUNT_ID,
        item.price,
        `Pool Royale: ${ownedLabel}`
      );
      if (res?.error) {
        setInfo(res.error || 'Purchase failed.');
        return;
      }

      const updatedInventory = addPoolRoyalUnlock(item.type, item.optionId, accountId);
      setOwned(updatedInventory);
      setInfo(`${ownedLabel} purchased and added to your Pool Royale account.`);

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

  const handleCreateListing = (event) => {
    event.preventDefault();
    const numericPrice = Number.parseFloat(listingForm.price);

    if (!listingForm.title.trim() || Number.isNaN(numericPrice) || numericPrice <= 0) {
      setMarketplaceInfo('Add an NFT name and a positive TPC price to publish.');
      return;
    }

    const newListing = {
      id: `mk-${Date.now()}`,
      title: listingForm.title.trim(),
      game: listingForm.game,
      seller: '@you',
      price: Number(numericPrice.toFixed(2)),
      status: 'live'
    };

    setMarketplaceListings((prev) => [newListing, ...prev]);
    setListingForm({ title: '', game: listingForm.game, price: '' });
    setMarketplaceInfo('Listing published. No listing fee—2% per side is collected after a sale.');
  };

  const handleMarketplacePurchase = (listing) => {
    if (listing.status === 'sold') return;

    const buyerFee = Number((listing.price * 0.02).toFixed(2));
    const sellerFee = Number((listing.price * 0.02).toFixed(2));
    const developerTake = Number((buyerFee + sellerFee).toFixed(2));
    const buyerTotal = Number((listing.price + buyerFee).toFixed(2));
    const sellerNet = Number((listing.price - sellerFee).toFixed(2));

    setMarketplaceListings((prev) =>
      prev.map((l) => (l.id === listing.id ? { ...l, status: 'sold' } : l))
    );

    const marketplaceSummary =
      `Simulated purchase of ${listing.title}. Buyer pays ${buyerTotal} TPC, seller receives ${sellerNet} TPC, ` +
      `developers collect ${developerTake} TPC to ${DEVELOPER_ACCOUNT_LABEL}.`;
    setMarketplaceInfo(marketplaceSummary);
  };

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center">
      <h2 className="text-xl font-bold">Store</h2>
      <p className="text-subtext text-sm text-center max-w-2xl">
        Browse every game collection, view the full item lists, and use the peer marketplace. Items
        stay organized per title so you can quickly find cosmetics and NFT unlocks.
      </p>

      <div className="store-card w-full">
        <div className="flex flex-col md:flex-row w-full gap-4 justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Multi-Game Storefront</h3>
            <p className="text-sm text-subtext">
              Pick a game to see its complete catalog. Pool Royale supports direct purchases today;
              the remaining games show every planned cosmetic so you can plan loadouts early.
            </p>
          </div>
          <div className="bg-surface border border-border rounded-lg px-3 py-2 text-xs space-y-1 w-full md:w-60">
            <div className="flex justify-between">
              <span className="text-subtext">TPC Balance</span>
              <span className="font-semibold">
                {tpcBalance === null ? '...' : tpcBalance.toLocaleString()} TPC
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-subtext">Linked Account</span>
              <span className="font-semibold truncate">{accountId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-subtext">Developer fee route</span>
              <span className="font-semibold">{DEVELOPER_ACCOUNT_LABEL}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full space-y-3">
        <h3 className="text-lg font-semibold text-center">Browse by game</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {gameCards.map((game) => (
            <button
              type="button"
              key={game.id}
              onClick={() => setActiveGame(game.id)}
              className={`store-card text-left transition ${
                activeGame === game.id ? 'ring-2 ring-primary' : 'opacity-90 hover:opacity-100'
              }`}
            >
              <div className="flex items-start justify-between w-full">
                <div>
                  <p className="text-sm uppercase text-subtext">{game.tag}</p>
                  <p className="text-lg font-semibold leading-tight">{game.name}</p>
                  <p className="text-xs text-subtext mt-1">{game.description}</p>
                </div>
                {game.highlight ? (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-primary text-black font-semibold">
                    Live
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-right text-primary font-semibold mt-2">
                View full list
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="store-card w-full space-y-4">
        <div className="flex items-center justify-between w-full">
          <div>
            <p className="text-xs text-subtext">Game catalog</p>
            <h3 className="text-lg font-semibold">
              {activeGame === 'pool-royale'
                ? 'Pool Royale Storefront'
                : SECONDARY_GAMES.find((g) => g.id === activeGame)?.name || 'Game Storefront'}
            </h3>
          </div>
          <span className="text-xs text-subtext">Tap a card above to switch games</span>
        </div>

        {activeGame === 'pool-royale' ? (
          <div className="space-y-4 w-full">
            <div className="store-info-bar">
              <span className="font-semibold">Pool Royale</span>
              <span className="text-xs text-subtext">Account: {accountId}</span>
              <span className="text-xs text-subtext">Prices shown in TPC</span>
              <span className="text-xs text-subtext">
                Balance: {tpcBalance === null ? '...' : tpcBalance.toLocaleString()} TPC
              </span>
            </div>

            <div className="store-card max-w-4xl w-full">
              <h3 className="text-lg font-semibold">Default Loadout (Free)</h3>
              <p className="text-sm text-subtext">
                These items are always available and applied when you enter Pool Royale.
              </p>
              <ul className="mt-2 space-y-1 w-full">
                {defaultLoadout.map((item) => (
                  <li
                    key={`${item.type}-${item.optionId}`}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 w-full"
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs uppercase text-subtext">
                      {TYPE_LABELS[item.type] || item.type}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="w-full space-y-3">
              <h3 className="text-lg font-semibold text-center">Pool Royale Collection</h3>
              {Object.entries(groupedItems).map(([type, items]) => (
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
                              <p className="text-xs text-subtext mt-1">
                                Applies to: {TYPE_LABELS[item.type] || item.type}
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
                              item.owned || processing === item.id
                                ? 'cursor-not-allowed opacity-60'
                                : ''
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

            {info ? (
              <div className="checkout-card text-center text-sm font-semibold">{info}</div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 w-full">
            <p className="text-sm text-subtext">
              {SECONDARY_GAMES.find((g) => g.id === activeGame)?.description ||
                'Choose a game to inspect its cosmetics.'}
            </p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {SECONDARY_GAMES.find((g) => g.id === activeGame)?.items.map((item) => (
                <div key={item.name} className="store-card">
                  <div className="flex justify-between w-full items-start">
                    <div>
                      <p className="text-sm uppercase text-subtext">{item.rarity}</p>
                      <p className="text-lg font-semibold leading-tight">{item.name}</p>
                      <ul className="text-xs text-subtext list-disc list-inside mt-1 space-y-0.5">
                        {item.includes.map((detail) => (
                          <li key={detail}>{detail}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold">
                      {item.price}
                      <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-[11px] text-subtext text-right">Full list shown</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="store-card w-full space-y-4">
        <div className="flex items-center justify-between w-full">
          <div>
            <p className="text-xs text-subtext">Peer-to-peer</p>
            <h3 className="text-lg font-semibold">Community NFT Marketplace</h3>
          </div>
          <span className="text-xs text-subtext">2% buyer + 2% seller to developers</span>
        </div>
        <p className="text-sm text-subtext">
          List NFTs for free and only pay fees when they sell. Buyers and sellers each contribute 2%
          to the developer account so the games can keep improving.
        </p>

        <form
          onSubmit={handleCreateListing}
          className="grid gap-2 md:grid-cols-[2fr_1fr_1fr_auto] items-end w-full"
        >
          <label className="text-xs text-subtext space-y-1">
            NFT name
            <input
              type="text"
              value={listingForm.title}
              onChange={(e) => setListingForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              placeholder="Cue skin, table pack, ..."
            />
          </label>
          <label className="text-xs text-subtext space-y-1">
            Game
            <select
              value={listingForm.game}
              onChange={(e) => setListingForm((prev) => ({ ...prev, game: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <option>Pool Royale</option>
              {SECONDARY_GAMES.map((g) => (
                <option key={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-subtext space-y-1">
            Price (TPC)
            <input
              type="number"
              min="1"
              step="0.01"
              value={listingForm.price}
              onChange={(e) => setListingForm((prev) => ({ ...prev, price: e.target.value }))}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              placeholder="e.g. 750"
            />
          </label>
          <button type="submit" className="buy-button md:mt-0 mt-2">Publish Listing</button>
        </form>

        <div className="grid gap-3 md:grid-cols-2 w-full">
          {marketplaceListings.map((listing) => (
            <div key={listing.id} className="store-card">
              <div className="flex w-full justify-between items-start">
                <div>
                  <p className="text-sm uppercase text-subtext">{listing.game}</p>
                  <p className="text-lg font-semibold leading-tight">{listing.title}</p>
                  <p className="text-xs text-subtext">Seller: {listing.seller}</p>
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold">
                  {listing.price}
                  <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                </div>
              </div>
              <div className="flex justify-between items-center text-[11px] text-subtext mt-2">
                <span>2% buyer fee • 2% seller fee</span>
                <span>Developer payout on purchase</span>
              </div>
              <button
                type="button"
                onClick={() => handleMarketplacePurchase(listing)}
                disabled={listing.status === 'sold'}
                className={`buy-button mt-2 ${listing.status === 'sold' ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {listing.status === 'sold' ? 'Sold' : 'Buy now (fee auto-applied)'}
              </button>
            </div>
          ))}
        </div>

        {marketplaceInfo ? (
          <div className="checkout-card text-center text-sm font-semibold">{marketplaceInfo}</div>
        ) : null}
      </div>
    </div>
  );
}
