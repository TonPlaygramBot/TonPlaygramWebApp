import React, { useCallback, useMemo, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  POOL_ROYALE_BASE_UNLOCKS,
  POOL_ROYALE_STORE_CATALOG,
  grantPoolRoyaleUnlock,
  hasPoolRoyaleUnlock,
  loadPoolRoyaleInventory
} from '../utils/poolRoyaleInventory.js';

const CATEGORY_LABELS = {
  finishes: 'Table Finishes',
  chromeColors: 'Chrome Plates',
  clothColors: 'Cloth Colors',
  cueStyles: 'Cue Styles',
  railMarkerColors: 'Rail Marker Colors',
  railMarkerShapes: 'Rail Marker Shapes'
};

export default function Store() {
  useTelegramBackButton();
  const [inventory, setInventory] = useState(() => loadPoolRoyaleInventory());

  const groupedPoolRoyaleItems = useMemo(() => {
    return POOL_ROYALE_STORE_CATALOG.reduce((acc, item) => {
      const bucket = acc[item.category] ?? [];
      bucket.push(item);
      acc[item.category] = bucket;
      return acc;
    }, {});
  }, []);

  const handlePurchase = useCallback((item) => {
    const updated = grantPoolRoyaleUnlock(item.category, item.id);
    setInventory(updated);
  }, []);

  const isOwned = useCallback(
    (item) => hasPoolRoyaleUnlock(inventory, item.category, item.id),
    [inventory]
  );

  const isDefaultUnlock = useCallback(
    (item) => Array.isArray(POOL_ROYALE_BASE_UNLOCKS[item.category]) &&
      POOL_ROYALE_BASE_UNLOCKS[item.category].includes(item.id),
    []
  );

  return (
    <div className="relative p-4 space-y-6 text-text">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-bold">Store</h2>
        <p className="text-subtext text-sm">
          Upgrade your Pool Royale loadout. Items unlock inside the table setup menu once purchased.
        </p>
      </div>

      <div className="space-y-5">
        <div className="rounded-2xl border border-emerald-300/30 bg-black/60 p-4 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/80">Pool Royale</p>
              <p className="text-lg font-semibold">Cosmetics Marketplace</p>
            </div>
            <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
              NFT-gated unlocks
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {Object.entries(groupedPoolRoyaleItems).map(([category, items]) => (
              <div key={category} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.2em]">
                    {CATEGORY_LABELS[category] ?? category}
                  </p>
                  <span className="text-[11px] text-emerald-100/70">
                    Defaults stay active; new purchases add options to the table setup.
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {items.map((item) => {
                    const owned = isOwned(item);
                    const defaultOwned = isDefaultUnlock(item);
                    return (
                      <div
                        key={`${category}-${item.id}`}
                        className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-semibold">{item.label}</p>
                          <p className="text-xs text-white/70">{item.description}</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm font-semibold">
                          <span className="text-emerald-200">{item.price}</span>
                          <div className="flex items-center gap-2">
                            {defaultOwned ? (
                              <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-100">
                                Default
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handlePurchase(item)}
                              disabled={owned}
                              className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                                owned
                                  ? 'cursor-not-allowed bg-white/10 text-white/60'
                                  : 'bg-emerald-400 text-black hover:bg-emerald-300'
                              }`}
                            >
                              {owned ? 'Owned' : 'Purchase'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
