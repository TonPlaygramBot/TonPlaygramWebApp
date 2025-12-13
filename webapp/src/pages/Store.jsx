import { useMemo, useState } from 'react';
import { POOL_ROYALE_STORE_ITEMS } from '../config/poolRoyaleStoreItems.js';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  hasPoolRoyaleOwnership,
  loadPoolRoyaleOwnership,
  mergePoolRoyaleOwnership,
  persistPoolRoyaleOwnership
} from '../utils/poolRoyaleEntitlements.js';

const LABELS = {
  tableFinish: 'Table Finishes',
  chromeColor: 'Chrome Plates',
  clothColor: 'Cloth Colors',
  railMarkerColor: 'Rail Marker Colors',
  railMarkerShape: 'Rail Marker Shapes',
  cueStyle: 'Cue Styles'
};

export default function Store() {
  useTelegramBackButton();
  const [ownership, setOwnership] = useState(() => loadPoolRoyaleOwnership());

  const groupedItems = useMemo(
    () =>
      POOL_ROYALE_STORE_ITEMS.reduce((acc, item) => {
        if (!acc[item.type]) acc[item.type] = [];
        acc[item.type].push(item);
        return acc;
      }, {}),
    []
  );

  const handlePurchase = (item) => {
    const current = ownership[item.type] ?? [];
    if (current.includes(item.id)) return;
    const updated = mergePoolRoyaleOwnership({
      ...ownership,
      [item.type]: [...current, item.id]
    });
    const persisted = persistPoolRoyaleOwnership(updated);
    setOwnership(persisted);
  };

  return (
    <div className="relative p-4 space-y-6 text-text flex flex-col items-center">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">Store</h2>
        <p className="text-subtext text-sm">
          Stock up on Pool Royale cosmetics and unlock them in your table setup.
        </p>
      </div>

      <div className="w-full max-w-3xl space-y-5">
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-900/15 p-4 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-200/80">
                Pool Royale Sector
              </p>
              <h3 className="text-lg font-semibold text-white">Customization Vault</h3>
            </div>
            <span className="rounded-full border border-emerald-300/60 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
              NFTs unlock in-game
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {Object.entries(groupedItems).map(([type, items]) => (
              <div key={type} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">
                    {LABELS[type] ?? type}
                  </h4>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/70">
                    {items.length} options
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {items.map((item) => {
                    const owned = hasPoolRoyaleOwnership(item.type, item.id, ownership);
                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left shadow-inner shadow-black/30"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-white">{item.name}</p>
                            {owned ? (
                              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
                                Owned
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-white/70">{item.description}</p>
                        </div>
                        <div className="flex items-center justify-between text-sm text-emerald-100">
                          <span className="font-semibold">{item.price}</span>
                          <button
                            type="button"
                            onClick={() => handlePurchase(item)}
                            disabled={owned}
                            className={`rounded-full px-3 py-1 font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                              owned
                                ? 'cursor-not-allowed border border-white/20 bg-white/10 text-white/70'
                                : 'border border-emerald-300 bg-emerald-400/20 text-emerald-100 hover:bg-emerald-300/30'
                            }`}
                          >
                            {owned ? 'Added' : 'Purchase'}
                          </button>
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
