import { useEffect, useMemo, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  POOL_ROYALE_INVENTORY_EVENT,
  POOL_ROYALE_STORE_ITEMS,
  formatTPC,
  loadPoolRoyaleOwnedSet,
  purchasePoolRoyaleItem
} from '../utils/poolRoyaleStore.js';

const TPC_ICON = '/assets/icons/ezgif-54c96d8a9b9236.webp';

export default function Store() {
  useTelegramBackButton();
  const [ownedItems, setOwnedItems] = useState(() => loadPoolRoyaleOwnedSet());

  useEffect(() => {
    const handleUpdate = () => setOwnedItems(loadPoolRoyaleOwnedSet());
    window.addEventListener(POOL_ROYALE_INVENTORY_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(POOL_ROYALE_INVENTORY_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const poolRoyaleByCategory = useMemo(() => {
    const grouped = new Map();
    POOL_ROYALE_STORE_ITEMS.forEach((item) => {
      const list = grouped.get(item.category) ?? [];
      list.push({ ...item, owned: ownedItems.has(item.id) });
      grouped.set(item.category, list);
    });
    return grouped;
  }, [ownedItems]);

  const handlePurchase = (id) => {
    const updated = purchasePoolRoyaleItem(id);
    setOwnedItems(updated);
  };

  return (
    <div className="relative p-4 space-y-6 text-text flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-4">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">Store</h2>
          <p className="text-subtext text-sm">
            Pool Royale cosmetics are organized below. Defaults (Charred Timber table, gold chrome and diamonds, Tour Green
            cloth, Birch Frost cue) stay free and non-tradable.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xl font-semibold text-white">Pool Royale Collection</h3>
              <p className="text-subtext text-sm">NFT unlocks appear in your account and table setup when owned.</p>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200">
              Organized
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Array.from(poolRoyaleByCategory.entries()).map(([category, items]) => (
              <div
                key={category}
                className="rounded-xl border border-border/60 bg-black/40 p-3 space-y-2 shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-100">
                    {category}
                  </h4>
                  <span className="text-[11px] text-subtext">{items.length} options</span>
                </div>
                <div className="space-y-2">
                  {items.map((item) => {
                    const owned = item.owned;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-white">{item.name}</p>
                            <p className="text-xs text-subtext">{item.description}</p>
                          </div>
                          <div className="flex items-center gap-1 text-sm font-semibold text-amber-200">
                            {formatTPC(item.priceTPC)}
                            <img src={TPC_ICON} alt="TPC" className="h-4 w-4" />
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={owned}
                          onClick={() => handlePurchase(item.id)}
                          className={`rounded-full px-3 py-2 text-sm font-semibold uppercase tracking-[0.2em] transition-colors duration-200 ${
                            owned
                              ? 'bg-emerald-500/20 text-emerald-100 cursor-default'
                              : 'bg-emerald-500 text-black hover:bg-emerald-400'
                          }`}
                        >
                          {owned ? 'Owned' : 'Purchase NFT'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-subtext">
            More game collections will appear here later; Pool Royale items stay grouped so your lobby and table setup remain
            tidy.
          </p>
        </div>
      </div>
    </div>
  );
}
