import React, { useEffect, useMemo, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  POOL_ROYALE_DEFAULT_UNLOCKS,
  POOL_ROYALE_STORE_SECTIONS,
  loadPoolRoyaleOwnership,
  persistPoolRoyaleOwnership,
  unlockPoolRoyaleItem
} from '../utils/poolRoyaleStore.js';

export default function Store() {
  useTelegramBackButton();

  const [ownedPoolRoyaleItems, setOwnedPoolRoyaleItems] = useState(() =>
    Array.from(loadPoolRoyaleOwnership())
  );

  useEffect(() => {
    persistPoolRoyaleOwnership(new Set(ownedPoolRoyaleItems));
  }, [ownedPoolRoyaleItems]);

  useEffect(() => {
    const sync = () => setOwnedPoolRoyaleItems(Array.from(loadPoolRoyaleOwnership()));
    sync();
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const ownedSet = useMemo(() => new Set(ownedPoolRoyaleItems), [ownedPoolRoyaleItems]);

  const purchaseItem = (item) => {
    const updated = unlockPoolRoyaleItem(item.key);
    setOwnedPoolRoyaleItems(Array.from(updated));
  };

  return (
    <div className="relative p-4 space-y-6 text-text flex flex-col">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">Store</h2>
        <p className="text-subtext text-sm">
          Collect cosmetics and table upgrades. Items unlock instantly once minted to your account.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Pool Royale Collection</h3>
          <p className="text-subtext text-sm">
            Defaults ship with every table. Purchase extras to reveal them inside the Pool Royale setup menu once the NFT is in your wallet.
          </p>
        </div>

        <div className="space-y-4">
          {POOL_ROYALE_STORE_SECTIONS.map((section) => (
            <div key={section.id} className="rounded-2xl border border-emerald-400/30 bg-black/70 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-200/70">{section.title}</p>
                  <p className="text-subtext text-sm">{section.blurb}</p>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                {section.items.map((item) => {
                  const owned = ownedSet.has(item.key);
                  const included = POOL_ROYALE_DEFAULT_UNLOCKS.includes(item.key);

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{item.label}</span>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                            {owned ? 'Owned' : item.price}
                          </span>
                        </div>
                        <p className="text-subtext text-xs leading-relaxed">{item.description}</p>
                      </div>
                      <div className="flex items-center gap-2 self-end md:self-auto">
                        {included ? (
                          <span className="rounded-full border border-emerald-300/60 bg-emerald-400/10 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
                            Included by default
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => purchaseItem(item)}
                            disabled={owned}
                            className={`rounded-full px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.22em] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                              owned
                                ? 'cursor-not-allowed border border-white/10 bg-white/10 text-white/60'
                                : 'border border-emerald-300 bg-emerald-400 text-black shadow-[0_0_18px_rgba(16,185,129,0.45)] hover:shadow-[0_0_22px_rgba(16,185,129,0.65)]'
                            }`}
                          >
                            {owned ? 'Minted' : 'Purchase & Mint'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
