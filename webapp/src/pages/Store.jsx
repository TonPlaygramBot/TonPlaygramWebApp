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
const MARKETPLACE_FEE_RATE = 0.02;

const OTHER_GAME_CATALOGS = [
  {
    id: 'snooker-club',
    name: 'Snooker Club',
    summary: 'Classic snooker cues, chalks, and prestige name plates.',
    items: [
      { name: 'Prestige Rosewood Cue', price: 450, status: 'NFT cosmetics' },
      { name: 'Tournament Green Cloth', price: 310, status: 'NFT table cloth' },
      { name: 'Signature Chalk Stack', price: 85, status: 'Consumable boosts' },
      { name: 'Gold Name Plate', price: 510, status: 'Profile cosmetic' }
    ]
  },
  {
    id: 'billiards-blitz',
    name: 'Billiards Blitz',
    summary: 'Arcade power-ups and animated table skins built for fast play.',
    items: [
      { name: 'Plasma Rail Skin', price: 260, status: 'Animated rail FX' },
      { name: 'Holo Cue Trail', price: 190, status: 'Shot FX cosmetic' },
      { name: 'Turbo Break Boost', price: 120, status: 'Match boost' },
      { name: 'Night Market Table', price: 340, status: 'Table theme' }
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
  const [marketplaceInfo, setMarketplaceInfo] = useState('');
  const [listingForm, setListingForm] = useState({
    title: '',
    collection: 'Pool Royale',
    price: ''
  });
  const [marketListings, setMarketListings] = useState([
    {
      id: 'listing-aurora',
      title: 'Graphite Aurora Cue',
      collection: 'Pool Royale',
      price: 360,
      seller: 'player-2386'
    },
    {
      id: 'listing-plasma',
      title: 'Plasma Rail Skin',
      collection: 'Billiards Blitz',
      price: 260,
      seller: 'player-9841'
    },
    {
      id: 'listing-nameplate',
      title: 'Gold Name Plate',
      collection: 'Snooker Club',
      price: 510,
      seller: 'club-210'
    }
  ]);

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
    const priceValue = Number(listingForm.price);
    if (!listingForm.title.trim() || Number.isNaN(priceValue) || priceValue <= 0) {
      setMarketplaceInfo('Add a title and a valid TPC price to create a listing.');
      return;
    }

    const newListing = {
      id: `listing-${Date.now()}`,
      title: listingForm.title.trim(),
      collection: listingForm.collection,
      price: Math.round(priceValue * 100) / 100,
      seller: accountId || 'guest-seller'
    };

    setMarketListings((prev) => [newListing, ...prev]);
    setMarketplaceInfo(
      `Listing posted. A ${MARKETPLACE_FEE_RATE * 100}% fee is collected from both buyer and seller when this NFT sells and routed to ${DEV_INFO.account}.`
    );
    setListingForm({ title: '', collection: listingForm.collection, price: '' });
  };

  const handleMarketplacePurchase = (listingId) => {
    const listing = marketListings.find((entry) => entry.id === listingId);
    if (!listing) return;

    const buyerFee = Math.round(listing.price * MARKETPLACE_FEE_RATE * 100) / 100;
    const sellerFee = buyerFee;
    const buyerTotal = Math.round((listing.price + buyerFee) * 100) / 100;
    const sellerReceives = Math.round((listing.price - sellerFee) * 100) / 100;
    const developerFeeTotal = buyerFee + sellerFee;

    setMarketListings((prev) => prev.filter((entry) => entry.id !== listingId));
    setMarketplaceInfo(
      `Purchase simulated: buyer pays ${buyerTotal} TPC (incl. ${buyerFee} TPC fee), seller receives ${sellerReceives} TPC after a ${sellerFee} TPC fee. ${developerFeeTotal} TPC is routed to ${DEV_INFO.account} for this trade.`
    );
  };

  const gameSections = useMemo(
    () => [
      {
        id: 'pool-royale',
        name: 'Pool Royale',
        description:
          'Account-bound Pool Royale cosmetics organized by category. Unlocks are minted as non-tradable NFTs bound to your account.',
        content: (
          <>
            <div className="store-card max-w-2xl">
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
                    <span className="text-xs uppercase text-subtext">{TYPE_LABELS[item.type] || item.type}</span>
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
        )
      },
      ...OTHER_GAME_CATALOGS.map((game) => ({
        id: game.id,
        name: game.name,
        description: game.summary,
        content: (
          <div className="store-card max-w-2xl">
            <div className="flex items-center justify-between w-full">
              <div>
                <p className="text-base text-subtext">Curated drops and utility items</p>
                <p className="text-sm font-semibold">Swipe through the full list below.</p>
              </div>
              <span className="text-xs rounded-full bg-primary px-3 py-1 text-black">Preview</span>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 w-full">
              {game.items.map((item) => (
                <div key={`${game.id}-${item.name}`} className="rounded-lg border border-border px-3 py-2 bg-surface/70">
                  <p className="font-semibold text-sm">{item.name}</p>
                  <p className="text-xs text-subtext">{item.status}</p>
                  <p className="text-xs font-semibold mt-1">{item.price} TPC</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-subtext mt-3 text-center">
              Tap another game above to browse its full stack of cosmetics and boosts.
            </p>
          </div>
        )
      }))
    ],
    [defaultLoadout, groupedItems, processing, owned]
  );

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center">
      <h2 className="text-xl font-bold">Store</h2>
      <p className="text-subtext text-sm text-center max-w-2xl">
        Jump between games to browse cosmetics, boosts, and table themes. Every collection is
        organized so you can see the full drop list per game before buying.
      </p>

      <div className="store-info-bar">
        <span className="font-semibold">Pool Royale</span>
        <span className="text-xs text-subtext">Account: {accountId}</span>
        <span className="text-xs text-subtext">Prices shown in TPC</span>
        <span className="text-xs text-subtext">
          Balance: {tpcBalance === null ? '...' : tpcBalance.toLocaleString()} TPC
        </span>
      </div>

      <div className="store-tabs">
        {gameSections.map((game) => (
          <button
            key={game.id}
            type="button"
            onClick={() => setActiveGame(game.id)}
            className={`store-tab ${activeGame === game.id ? 'store-tab-active' : ''}`}
          >
            <span className="text-left">
              <p className="text-sm font-semibold">{game.name}</p>
              <p className="text-xs text-subtext leading-tight">{game.description}</p>
            </span>
          </button>
        ))}
      </div>

      <div className="w-full flex flex-col items-center space-y-4">
        {gameSections
          .filter((game) => game.id === activeGame)
          .map((game) => (
            <div key={game.id} className="w-full flex flex-col items-center space-y-3">
              <h3 className="text-lg font-semibold text-center">{game.name} Storefront</h3>
              <p className="text-sm text-subtext text-center max-w-2xl">
                {game.description}
              </p>
              {game.content}
            </div>
          ))}
      </div>

      {info ? (
        <div className="checkout-card text-center text-sm font-semibold">{info}</div>
      ) : null}

      <div className="store-card max-w-3xl w-full space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 w-full">
          <div>
            <h3 className="text-lg font-semibold">Marketplace</h3>
            <p className="text-sm text-subtext">
              Users list NFTs for sale; a 2% fee is charged to both buyer and seller at purchase and
              routed to the developers.
            </p>
          </div>
          <div className="text-xs bg-primary text-black rounded-full px-3 py-1">
            Developer fee account: {DEV_INFO.account}
          </div>
        </div>

        <form className="market-form" onSubmit={handleCreateListing}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
            <label className="form-field">
              <span className="text-xs text-subtext">NFT title</span>
              <input
                type="text"
                value={listingForm.title}
                onChange={(e) => setListingForm((prev) => ({ ...prev, title: e.target.value }))}
                className="form-input"
                placeholder="e.g., Neon Rail Skin"
              />
            </label>
            <label className="form-field">
              <span className="text-xs text-subtext">Collection</span>
              <select
                value={listingForm.collection}
                onChange={(e) => setListingForm((prev) => ({ ...prev, collection: e.target.value }))}
                className="form-input"
              >
                <option value="Pool Royale">Pool Royale</option>
                <option value="Billiards Blitz">Billiards Blitz</option>
                <option value="Snooker Club">Snooker Club</option>
              </select>
            </label>
            <label className="form-field">
              <span className="text-xs text-subtext">Price (TPC)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={listingForm.price}
                onChange={(e) => setListingForm((prev) => ({ ...prev, price: e.target.value }))}
                className="form-input"
                placeholder="250"
              />
            </label>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs text-subtext">
              A {MARKETPLACE_FEE_RATE * 100}% fee applies to both buyer and seller only when the NFT
              sells. No listing fees.
            </p>
            <button type="submit" className="buy-button w-auto px-4 py-2 rounded-full">
              Post listing
            </button>
          </div>
        </form>

        <div className="market-grid">
          {marketListings.map((listing) => {
            const buyerFee = Math.round(listing.price * MARKETPLACE_FEE_RATE * 100) / 100;
            const sellerFee = buyerFee;
            return (
              <div key={listing.id} className="market-card">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <p className="font-semibold text-base">{listing.title}</p>
                    <p className="text-xs text-subtext">Collection: {listing.collection}</p>
                    <p className="text-xs text-subtext">Seller: {listing.seller}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    {listing.price}
                    <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                  </div>
                </div>
                <div className="text-xs text-subtext space-y-1">
                  <p>Buyer fee: {buyerFee} TPC • Seller fee: {sellerFee} TPC</p>
                  <p>Both fees are routed to developers after purchase.</p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="buy-button w-auto px-4 py-2 rounded-full"
                    onClick={() => handleMarketplacePurchase(listing.id)}
                  >
                    Purchase
                  </button>
                </div>
              </div>
            );
          })}
          {marketListings.length === 0 ? (
            <div className="market-empty">No active listings. Be the first to post one!</div>
          ) : null}
        </div>

        {marketplaceInfo ? (
          <div className="checkout-card text-center text-sm font-semibold w-full">{marketplaceInfo}</div>
        ) : null}
      </div>
    </div>
  );
}
