import { useEffect, useMemo, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  POOL_ROYALE_STORE_ITEMS,
  getOwnedPoolRoyaleItems,
  getOwnedPoolRoyaleStoreItems,
  purchasePoolRoyaleItem
} from '../utils/poolRoyaleInventory.js';

function TpcBadge() {
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 px-2 py-0.5 text-[10px] font-black text-black shadow-[0_6px_16px_rgba(250,204,21,0.45)]">
      TPC
    </span>
  );
}

function PriceTag({ amount }) {
  if (!amount) return <span className="text-emerald-300 font-semibold">Included</span>;
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-amber-200">
      <TpcBadge />
      {amount.toLocaleString()}
    </span>
  );
}

function StoreCard({ item, owned, onPurchase }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{item.name}</p>
          <p className="text-xs text-white/70">{item.description}</p>
          {item.tradable === false && (
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200/80">
              Included • Non-tradable
            </p>
          )}
        </div>
        <PriceTag amount={item.priceTpc} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.25em] text-white/70">
          {item.category}
        </span>
        <button
          type="button"
          disabled={owned}
          onClick={() => onPurchase(item.id)}
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
            owned
              ? 'cursor-not-allowed border border-emerald-400/30 bg-emerald-400/20 text-emerald-100'
              : 'border border-amber-300/60 bg-amber-300/20 text-amber-100 hover:bg-amber-300/40'
          }`}
        >
          {owned ? 'Owned' : 'Buy NFT'}
        </button>
      </div>
    </div>
  );
}

export default function Store() {
  useTelegramBackButton();
  const [ownedItems, setOwnedItems] = useState(() => new Set(getOwnedPoolRoyaleItems()));

  useEffect(() => {
    const handler = (event) => {
      const updated = event?.detail?.owned;
      if (Array.isArray(updated)) {
        setOwnedItems(new Set(updated));
      } else {
        setOwnedItems(new Set(getOwnedPoolRoyaleItems()));
      }
    };
    window.addEventListener('poolRoyaleInventoryChanged', handler);
    return () => window.removeEventListener('poolRoyaleInventoryChanged', handler);
  }, []);

  const ownedPoolItems = useMemo(
    () => new Set(getOwnedPoolRoyaleStoreItems(ownedItems)),
    [ownedItems]
  );

  const poolRoyaleIncluded = useMemo(
    () => POOL_ROYALE_STORE_ITEMS.filter((item) => item.priceTpc === 0),
    []
  );
  const poolRoyaleUpgrades = useMemo(
    () => POOL_ROYALE_STORE_ITEMS.filter((item) => item.priceTpc > 0),
    []
  );

  const handlePurchase = (itemId) => {
    const updated = purchasePoolRoyaleItem(itemId);
    setOwnedItems(new Set(updated));
  };

  return (
    <div className="relative p-4 space-y-6 text-text">
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-white">Store</h2>
        <p className="text-subtext text-sm">
          Pool Royale cosmetics now live as NFTs. Default gear stays free so you can jump in and play.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Pool Royale Starter Kit</h3>
          <span className="text-[11px] uppercase tracking-[0.25em] text-emerald-200/80">Included</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {poolRoyaleIncluded.map((item) => (
            <StoreCard
              key={item.id}
              item={item}
              owned={ownedItems.has(item.id)}
              onPurchase={handlePurchase}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Pool Royale NFT Upgrades</h3>
          <span className="text-[11px] uppercase tracking-[0.25em] text-amber-200/80">Cosmetics</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {poolRoyaleUpgrades.map((item) => (
            <StoreCard
              key={item.id}
              item={item}
              owned={ownedItems.has(item.id)}
              onPurchase={handlePurchase}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Account Inventory</h3>
          <span className="text-[11px] uppercase tracking-[0.25em] text-white/70">Pool Royale</span>
        </div>
        {ownedPoolItems.size === 0 ? (
          <p className="text-sm text-subtext">No Pool Royale items owned yet.</p>
        ) : (
          <ul className="space-y-2 text-sm text-white">
            {Array.from(ownedPoolItems).map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                <span className="font-semibold">{item.name}</span>
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/70">{item.category}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
