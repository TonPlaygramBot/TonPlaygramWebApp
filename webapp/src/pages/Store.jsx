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

export default function Store() {
  useTelegramBackButton();
  const [accountId, setAccountId] = useState(() => poolRoyalAccountId());
  const [owned, setOwned] = useState(() => getPoolRoyalInventory(accountId));
  const [info, setInfo] = useState('');
  const [tpcBalance, setTpcBalance] = useState(null);
  const [processing, setProcessing] = useState('');
  const [expandedGame, setExpandedGame] = useState('pool-royale');
  const [marketListings, setMarketListings] = useState(() => [
    {
      id: 'mkt-carbon',
      name: 'Carbon Matrix Cue (Minted)',
      game: 'Pool Royale',
      price: 540,
      sellerAccount: 'community-pro-1'
    },
    {
      id: 'mkt-aurora',
      name: 'Graphite Aurora Cue',
      game: 'Pool Royale',
      price: 460,
      sellerAccount: 'creator-showcase'
    },
    {
      id: 'mkt-ludo',
      name: 'Royal Dice Skin',
      game: 'Ludo Battle Royal',
      price: 220,
      sellerAccount: 'ludo-vendor'
    }
  ]);
  const [listingForm, setListingForm] = useState({
    name: '',
    game: 'Pool Royale',
    price: ''
  });

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

  const placeholderInventories = useMemo(
    () => ({
      'Snooker Club': [
        {
          id: 'snooker-heritage',
          name: 'Heritage Table Cloth',
          price: 780,
          description: 'Classic tour-grade snooker cloth with crisp roll.',
          status: 'Coming soon'
        },
        {
          id: 'snooker-precision',
          name: 'Precision Cue Pack',
          price: 520,
          description: 'Matched cues and chalk tuned for Snooker Club events.',
          status: 'Coming soon'
        }
      ],
      'Goal Rush': [
        {
          id: 'goal-rush-ball',
          name: 'Iridescent Match Ball',
          price: 310,
          description: 'Animated goal trail for every strike.',
          status: 'Coming soon'
        }
      ],
      'Domino Royal': [
        {
          id: 'domino-royal-tiles',
          name: 'Marble Crown Tiles',
          price: 260,
          description: 'Premium marble tiles with golden pips.',
          status: 'Coming soon'
        }
      ]
    }),
    []
  );

  const gameSections = useMemo(
    () => [
      {
        key: 'pool-royale',
        name: 'Pool Royale',
        route: '/games/poolroyale',
        blurb:
          'Account-bound billiards cosmetics you can unlock and equip instantly.',
        items: groupedItems,
        defaultLoadout
      },
      {
        key: 'snooker-club',
        name: 'Snooker Club',
        route: '/games/snookerclub',
        blurb: 'Competitive snooker drops styled for tournament play.',
        items: placeholderInventories['Snooker Club']
      },
      {
        key: 'goal-rush',
        name: 'Goal Rush',
        route: '/games/goalrush',
        blurb: 'Cosmetics that celebrate every strike and save.',
        items: placeholderInventories['Goal Rush']
      },
      {
        key: 'domino-royal',
        name: 'Domino Royal',
        route: '/games/domino-royal',
        blurb: 'Prestige tiles and table trims for domino showdowns.',
        items: placeholderInventories['Domino Royal']
      }
    ],
    [defaultLoadout, groupedItems, placeholderInventories]
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

  const computeMarketplaceFees = (price) => {
    const base = Number(price) || 0;
    const buyerFee = Math.max(1, Math.ceil(base * 0.02));
    const sellerFee = Math.max(1, Math.ceil(base * 0.02));
    const sellerPayout = Math.max(0, base - sellerFee);
    const devTake = buyerFee + sellerFee;
    const buyerTotal = sellerPayout + devTake;
    return { buyerFee, sellerFee, sellerPayout, devTake, buyerTotal };
  };

  const handleMarketplaceListing = () => {
    if (!accountId || accountId === 'guest') {
      setInfo('Link your TPC account in the wallet before listing NFTs.');
      return;
    }
    const parsedPrice = Math.max(0, Number(listingForm.price));
    if (!listingForm.name.trim() || !parsedPrice) {
      setInfo('Add a name and price above zero to list your NFT.');
      return;
    }

    const listing = {
      id: `mkt-${Date.now()}`,
      name: listingForm.name.trim(),
      game: listingForm.game,
      price: parsedPrice,
      sellerAccount: accountId
    };

    setMarketListings((prev) => [listing, ...prev]);
    setListingForm({ name: '', game: listingForm.game, price: '' });
    setInfo('NFT listed in the marketplace. Buyers will see the 2%/2% split at checkout.');
  };

  const handleMarketplacePurchase = async (listing) => {
    if (processing) return;
    if (!accountId || accountId === 'guest') {
      setInfo('Link your TPC account in the wallet first.');
      return;
    }

    const { buyerFee, sellerFee, sellerPayout, devTake, buyerTotal } =
      computeMarketplaceFees(listing.price);

    if (tpcBalance !== null && buyerTotal > tpcBalance) {
      setInfo('Insufficient TPC balance for this marketplace purchase.');
      return;
    }

    setProcessing(`market-${listing.id}`);
    setInfo('');
    try {
      const sellerNote = `${listing.game} NFT sale: ${listing.name}`;
      const feeNote = `${listing.game} marketplace fee (2% buyer + 2% seller)`;

      const payout = await sendAccountTpc(accountId, listing.sellerAccount, sellerPayout, sellerNote);
      if (payout?.error) {
        setInfo(payout.error || 'Purchase failed.');
        return;
      }

      const fees = await sendAccountTpc(accountId, DEV_INFO.account, devTake, feeNote);
      if (fees?.error) {
        setInfo(fees.error || 'Fee transfer failed.');
        return;
      }

      setMarketListings((prev) => prev.filter((item) => item.id !== listing.id));
      const bal = await getAccountBalance(accountId);
      if (typeof bal?.balance === 'number') {
        setTpcBalance(bal.balance);
      }

      setInfo(
        `${listing.name} purchased. Seller receives ${sellerPayout.toLocaleString()} TPC, ` +
          `developer fee ${devTake.toLocaleString()} TPC collected (2% buyer + 2% seller).`
      );
    } catch (err) {
      console.error('Marketplace purchase failed', err);
      setInfo('Failed to process marketplace purchase.');
    } finally {
      setProcessing('');
    }
  };

  const renderPoolRoyaleCollection = () => (
    <div className="space-y-3">
      <div className="store-card w-full">
        <div className="flex w-full items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold">Default Loadout (Free)</h3>
            <p className="text-sm text-subtext">
              Always applied when you enter Pool Royale. Unlocks below stack on top.
            </p>
          </div>
          <div className="text-xs text-subtext text-right">
            <p>Account: {accountId}</p>
            <p>Balance: {tpcBalance === null ? '...' : tpcBalance.toLocaleString()} TPC</p>
          </div>
        </div>

        <ul className="mt-3 space-y-1 w-full">
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
  );

  const renderPlaceholderCollection = (items = []) => (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="store-card">
          <div className="flex w-full items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-lg leading-tight">{item.name}</p>
              <p className="text-xs text-subtext">{item.description}</p>
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold">
              {item.price}
              <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
            </div>
          </div>
          <button
            type="button"
            disabled
            className="buy-button mt-2 text-center cursor-not-allowed opacity-60"
          >
            {item.status || 'Coming soon'}
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="relative p-4 space-y-5 text-text flex flex-col items-center">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">Store & Marketplace</h2>
        <p className="text-subtext text-sm max-w-2xl">
          Explore dedicated store shelves for every TonPlaygram game, then trade player-minted NFTs
          in the shared marketplace. Purchases settle in TPC with transparent fees.
        </p>
      </div>

      <div className="store-info-bar">
        <span className="font-semibold">Account: {accountId}</span>
        <span className="text-xs text-subtext">Prices shown in TPC</span>
        <span className="text-xs text-subtext">
          Balance: {tpcBalance === null ? '...' : tpcBalance.toLocaleString()} TPC
        </span>
        <span className="text-xs text-subtext">Developer fee: 2% buyer + 2% seller on marketplace</span>
      </div>

      <div className="w-full space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Game shelves</h3>
          <span className="text-xs text-subtext">Tap a shelf to view its full catalog</span>
        </div>

        {gameSections.map((game) => (
          <div key={game.key} className="store-card">
            <div className="flex w-full items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm uppercase text-subtext tracking-wide">{game.route}</p>
                <h4 className="text-lg font-semibold leading-tight">{game.name}</h4>
                <p className="text-sm text-subtext max-w-2xl">{game.blurb}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setExpandedGame((current) => (current === game.key ? '' : game.key))
                }
                className="buy-button px-4 py-2 text-center"
              >
                {expandedGame === game.key ? 'Hide catalog' : 'View full catalog'}
              </button>
            </div>

            {expandedGame === game.key ? (
              <div className="mt-3 w-full space-y-3">
                {game.key === 'pool-royale'
                  ? renderPoolRoyaleCollection()
                  : renderPlaceholderCollection(game.items)}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="w-full space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Community NFT Marketplace</h3>
          <span className="text-xs text-subtext">
            Fee split: 2% buyer surcharge + 2% seller rake to developers
          </span>
        </div>

        <div className="store-card w-full">
          <div className="flex flex-col md:flex-row w-full gap-3">
            <div className="flex-1 space-y-2">
              <h4 className="font-semibold">List an NFT</h4>
              <p className="text-xs text-subtext">
                Listing is free. Fees are only charged once a purchase is confirmed.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="NFT name"
                  value={listingForm.name}
                  onChange={(e) => setListingForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <select
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  value={listingForm.game}
                  onChange={(e) => setListingForm((prev) => ({ ...prev, game: e.target.value }))}
                >
                  {gameSections.map((game) => (
                    <option key={game.key} value={game.name}>
                      {game.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Price in TPC"
                  value={listingForm.price}
                  onChange={(e) => setListingForm((prev) => ({ ...prev, price: e.target.value }))}
                />
              </div>
              <button type="button" className="buy-button w-full md:w-auto" onClick={handleMarketplaceListing}>
                Add listing
              </button>
            </div>

            <div className="md:w-72 space-y-1 text-sm bg-background border border-border rounded-lg p-3">
              <p className="font-semibold">How fees work</p>
              <p className="text-subtext text-xs">
                Buyer pays +2% at checkout. Seller receives payout minus 2%. Both fees route to the
                developer account ({DEV_INFO.account}).
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {marketListings.map((listing) => {
            const { buyerFee, sellerFee, sellerPayout, devTake, buyerTotal } =
              computeMarketplaceFees(listing.price);
            const listingProcessing = processing === `market-${listing.id}`;
            return (
              <div key={listing.id} className="store-card">
                <div className="flex w-full items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-lg leading-tight">{listing.name}</p>
                    <p className="text-xs text-subtext">Game: {listing.game}</p>
                    <p className="text-xs text-subtext">Seller: {listing.sellerAccount}</p>
                    <p className="text-xs text-subtext mt-1">
                      Seller receives {sellerPayout.toLocaleString()} TPC | Dev fee {devTake.toLocaleString()} TPC
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold">
                    {listing.price}
                    <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-[11px] text-subtext mt-1">
                  Buyer fee {buyerFee.toLocaleString()} TPC (2%) + seller rake {sellerFee.toLocaleString()} TPC (2%).
                  Total due {buyerTotal.toLocaleString()} TPC.
                </p>
                <button
                  type="button"
                  onClick={() => handleMarketplacePurchase(listing)}
                  disabled={listingProcessing}
                  className={`buy-button mt-2 text-center ${
                    listingProcessing ? 'cursor-not-allowed opacity-60' : ''
                  }`}
                >
                  {listingProcessing ? 'Processing…' : 'Buy from marketplace'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {info ? (
        <div className="checkout-card text-center text-sm font-semibold">{info}</div>
      ) : null}
    </div>
  );
}
