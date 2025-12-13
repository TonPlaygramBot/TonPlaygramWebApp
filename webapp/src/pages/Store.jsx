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

const FUTURE_COLLECTIONS = [
  {
    id: 'snooker-club',
    name: 'Snooker Club',
    badge: 'In design',
    description: 'Precision-grade cues, cloths, and room themes crafted for focused, tactical play.',
    items: [
      { name: 'Marble Arena Cloth', tier: 'Epic', note: 'Championship-grade baize with polished marble rails.' },
      { name: 'Shadowline Cue', tier: 'Rare', note: 'Low-deflection shaft with inlayed carbon grip.' },
      { name: 'Gallery Lounge', tier: 'Legendary', note: 'VIP room decor with animated skyline windows.' }
    ]
  },
  {
    id: 'goal-rush',
    name: 'Goal Rush',
    badge: 'Concept',
    description: 'Stadium-inspired cosmetics that turn every match into a floodlit derby.',
    items: [
      { name: 'Neon Goal Trails', tier: 'Rare', note: 'Dynamic particle boosts that respond to every shot.' },
      { name: 'Ultras Tifo Banner', tier: 'Epic', note: 'Animated crowd choreography behind your team crest.' },
      { name: 'Midnight Pitch', tier: 'Rare', note: 'Slick night-time arena with volumetric fog.' }
    ]
  },
  {
    id: 'air-hockey',
    name: 'Air Hockey',
    badge: 'Coming soon',
    description: 'Fast arcade boards, glowing pucks, and sound packs tuned for crisp rebounds.',
    items: [
      { name: 'Aurora Table Skin', tier: 'Epic', note: 'Color-shifting surface tied to your win streak.' },
      { name: 'Ion Core Puck', tier: 'Rare', note: 'Feels lighter in play with a bright impact ripple.' },
      { name: 'Arcade Legends SFX', tier: 'Rare', note: 'Retro audio kit with layered crowd calls.' }
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
  const [openSections, setOpenSections] = useState(new Set(['pool-royale']));
  const [marketplaceListings, setMarketplaceListings] = useState(() => [
    {
      id: 'mk-1',
      title: 'Iridescent Cue',
      game: 'Pool Royale',
      price: 950,
      seller: 'billiards.vault',
      status: 'Live auction'
    },
    {
      id: 'mk-2',
      title: 'Azure Rail Markers',
      game: 'Pool Royale',
      price: 420,
      seller: 'elite.club',
      status: 'Buy now'
    }
  ]);
  const [marketplaceForm, setMarketplaceForm] = useState({ title: '', game: 'Pool Royale', price: '' });

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

  const gameSections = useMemo(
    () => [
      {
        id: 'pool-royale',
        name: 'Pool Royale',
        badge: 'Live',
        description:
          'Ownable, non-tradable cosmetics minted as account-bound NFTs. Your defaults stay equipped, while purchases instantly sync to your loadout.',
        highlight: 'TPC checkout ready',
        contentType: 'pool'
      },
      ...FUTURE_COLLECTIONS
    ],
    []
  );

  const toggleSection = (id) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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

  const handleMarketplaceSubmit = (event) => {
    event.preventDefault();
    if (!marketplaceForm.title || !marketplaceForm.price) {
      setInfo('Add a title and price before listing your NFT.');
      return;
    }

    const price = Number(marketplaceForm.price);
    if (Number.isNaN(price) || price <= 0) {
      setInfo('Enter a valid sale price.');
      return;
    }

    const newListing = {
      id: `mk-${Date.now()}`,
      title: marketplaceForm.title,
      game: marketplaceForm.game,
      price,
      seller: accountId || 'you',
      status: 'Listed'
    };

    setMarketplaceListings((prev) => [newListing, ...prev]);
    setMarketplaceForm({ title: '', game: marketplaceForm.game, price: '' });
    setInfo('NFT added to the marketplace. 2% will be charged to buyer and seller on purchase.');
  };

  const handleSimulatedPurchase = (listingId) => {
    const listing = marketplaceListings.find((l) => l.id === listingId);
    if (!listing) return;

    const buyerFee = Math.ceil(listing.price * MARKETPLACE_FEE_RATE);
    const sellerFee = Math.ceil(listing.price * MARKETPLACE_FEE_RATE);
    const total = listing.price + buyerFee;

    setInfo(
      `Purchase ready: pay ${total.toLocaleString()} TPC (includes ${buyerFee.toLocaleString()} TPC buyer fee). Seller receives ${
        listing.price - sellerFee
      } TPC after developer fee.`
    );

    setMarketplaceListings((prev) =>
      prev.map((item) =>
        item.id === listingId
          ? { ...item, status: 'Reserved for checkout', buyerFee, sellerFee }
          : item
      )
    );
  };

  const renderPoolCollection = () => (
    <div className="space-y-3">
      <div className="store-info-bar">
        <span className="font-semibold">Pool Royale</span>
        <span className="text-xs text-subtext">Account: {accountId}</span>
        <span className="text-xs text-subtext">Prices shown in TPC</span>
        <span className="text-xs text-subtext">
          Balance: {tpcBalance === null ? '...' : tpcBalance.toLocaleString()} TPC
        </span>
      </div>

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
    </div>
  );

  const renderFutureCollection = (collection) => (
    <div className="grid gap-2 md:grid-cols-2">
      {collection.items.map((item) => (
        <div key={`${collection.id}-${item.name}`} className="store-card">
          <div className="flex items-start justify-between w-full">
            <div>
              <p className="font-semibold text-lg leading-tight">{item.name}</p>
              <p className="text-xs text-subtext">{item.note}</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-border text-subtext">{item.tier}</span>
          </div>
          <div className="text-xs text-subtext">Tradable cosmetics will list here once the marketplace opens.</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center">
      <h2 className="text-xl font-bold">Store</h2>
      <p className="text-subtext text-sm text-center max-w-2xl">
        Browse every game collection in one organized view. Tap a game card to see its full list of items
        and how purchases or NFT trades flow through the Store and marketplace.
      </p>

      <div className="grid w-full gap-3">
        {gameSections.map((section) => (
          <div key={section.id} className="store-card">
            <div className="flex items-start justify-between w-full gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">{section.name}</p>
                  <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-border text-subtext">
                    {section.badge}
                  </span>
                </div>
                <p className="text-xs text-subtext max-w-2xl">{section.description}</p>
                {section.highlight ? (
                  <p className="text-[11px] font-semibold text-primary">{section.highlight}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="buy-button !w-auto px-4 py-2 text-sm"
              >
                {openSections.has(section.id) ? 'Hide items' : 'View collection'}
              </button>
            </div>

            {openSections.has(section.id) && (
              <div className="pt-3 w-full">
                {section.contentType === 'pool'
                  ? renderPoolCollection()
                  : renderFutureCollection(section)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="store-card w-full max-w-3xl">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 w-full">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold">Marketplace</p>
              <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-border text-subtext">
                2% fee each side
              </span>
            </div>
            <p className="text-xs text-subtext max-w-2xl">
              List or buy player-owned NFTs. A 2% developer fee applies to buyer and seller on every
              settlement; listings remain free until a purchase clears.
            </p>
          </div>
          <div className="text-xs text-right text-subtext">
            Developer fee destination: {STORE_ACCOUNT_ID || 'Unavailable'}
          </div>
        </div>

        <form className="mt-3 grid gap-2 md:grid-cols-3" onSubmit={handleMarketplaceSubmit}>
          <input
            required
            value={marketplaceForm.title}
            onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="NFT title"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <select
            value={marketplaceForm.game}
            onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, game: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {gameSections.map((game) => (
              <option key={game.id} value={game.name}>
                {game.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              required
              value={marketplaceForm.price}
              onChange={(e) => setMarketplaceForm((prev) => ({ ...prev, price: e.target.value }))}
              placeholder="Price in TPC"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            />
            <button type="submit" className="buy-button text-sm px-4 py-2 whitespace-nowrap">
              List NFT
            </button>
          </div>
        </form>

        <div className="mt-3 space-y-2">
          {marketplaceListings.map((item) => (
            <div
              key={item.id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-lg border border-border px-3 py-2"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{item.title}</p>
                  <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-border text-subtext">
                    {item.game}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-border text-subtext">
                    {item.status}
                  </span>
                </div>
                <p className="text-[11px] text-subtext">Seller: {item.seller}</p>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold">
                <span className="flex items-center gap-1">
                  {item.price.toLocaleString()} <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                </span>
                <button
                  type="button"
                  onClick={() => handleSimulatedPurchase(item.id)}
                  className="buy-button !w-auto px-3 py-1 text-sm"
                >
                  Purchase
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {info ? (
        <div className="checkout-card text-center text-sm font-semibold">{info}</div>
      ) : null}
    </div>
  );
}
