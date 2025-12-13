import React, { useEffect, useMemo, useState } from 'react';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import {
  grantPoolRoyaleUnlock,
  hasPoolRoyaleUnlock,
  loadPoolRoyaleUnlocks,
  savePoolRoyaleUnlocks
} from '../utils/poolRoyaleUnlocks.js';

const POOL_ROYALE_SECTIONS = [
  {
    id: 'finishes',
    title: 'Table Finishes',
    blurb: 'Premium rails and frames that reshape the Pool Royale atmosphere.',
    items: [
      {
        id: 'finish-rusticSplit',
        optionId: 'rusticSplit',
        name: 'Rustic Split Oak',
        price: 4200,
        description: 'Hybrid reclaimed oak slabs with matte champagne trim.',
        category: 'finishes'
      },
      {
        id: 'finish-plankStudio',
        optionId: 'plankStudio',
        name: 'Plank Studio Maple',
        price: 3800,
        description: 'Bright maple studio boards for modern broadcasts.',
        category: 'finishes'
      },
      {
        id: 'finish-weatheredGrey',
        optionId: 'weatheredGrey',
        name: 'Weathered Grey Driftwood',
        price: 3500,
        description: 'Slate-grey wash with brushed steel undertones.',
        category: 'finishes'
      },
      {
        id: 'finish-jetBlackCarbon',
        optionId: 'jetBlackCarbon',
        name: 'Jet Black Carbon',
        price: 5200,
        description: 'Stealth carbon fascia built for esports lighting.',
        category: 'finishes'
      }
    ]
  },
  {
    id: 'chrome',
    title: 'Chrome Plates',
    blurb: 'Swap the pocket fascias for metals that match your arena.',
    items: [
      {
        id: 'chrome-standard',
        optionId: 'chrome',
        name: 'Polished Chrome',
        price: 900,
        description: 'Classic mirror finish with high-specular kick.',
        category: 'chromeColors'
      }
    ]
  },
  {
    id: 'diamonds',
    title: 'Rail Diamonds',
    blurb: 'Upgrade pocket sights with brighter metals.',
    items: [
      {
        id: 'diamonds-chrome',
        optionId: 'chrome',
        name: 'Chrome Diamonds',
        price: 600,
        description: 'Silver inlays tuned to shimmer under arena lights.',
        category: 'railMarkerColors'
      },
      {
        id: 'diamonds-pearl',
        optionId: 'pearl',
        name: 'Pearl Diamonds',
        price: 800,
        description: 'Iridescent markers for a boutique table feel.',
        category: 'railMarkerColors'
      }
    ]
  },
  {
    id: 'cloth',
    title: 'Championship Cloth',
    blurb: 'Tour-grade felts tested against Pool Royale physics.',
    items: [
      {
        id: 'cloth-graphite',
        optionId: 'graphite',
        name: 'Arcadia Graphite',
        price: 1400,
        description: 'Charcoal fast cloth for sharper ball roll.',
        category: 'clothColors'
      },
      {
        id: 'cloth-arctic',
        optionId: 'arcticBlue',
        name: 'Arctic Blue',
        price: 1300,
        description: 'Ice-blue finish with crisp highlight recovery.',
        category: 'clothColors'
      }
    ]
  },
  {
    id: 'cues',
    title: 'Cue Gallery',
    blurb: 'Collect premium butts and shafts for your Pool Royale runs.',
    items: [
      {
        id: 'cue-redwood',
        optionId: 'redwood-ember',
        name: 'Redwood Ember',
        price: 1100,
        description: 'Warm ember grain with subtle orange glow.',
        category: 'cueStyles'
      },
      {
        id: 'cue-wenge',
        optionId: 'wenge-nightfall',
        name: 'Wenge Nightfall',
        price: 1400,
        description: 'Dark wenge stripes for moody night arenas.',
        category: 'cueStyles'
      },
      {
        id: 'cue-mahogany',
        optionId: 'mahogany-heritage',
        name: 'Mahogany Heritage',
        price: 950,
        description: 'Classic deep mahogany with bright contrast rings.',
        category: 'cueStyles'
      },
      {
        id: 'cue-walnut',
        optionId: 'walnut-satin',
        name: 'Walnut Satin',
        price: 1000,
        description: 'Balanced walnut butt with satin sheen.',
        category: 'cueStyles'
      },
      {
        id: 'cue-carbon',
        optionId: 'carbon-matrix',
        name: 'Carbon Matrix',
        price: 1600,
        description: 'Carbon weave built for power breaks.',
        category: 'cueStyles'
      },
      {
        id: 'cue-maple',
        optionId: 'maple-horizon',
        name: 'Maple Horizon',
        price: 900,
        description: 'Bright maple upgrade with airy highlights.',
        category: 'cueStyles'
      },
      {
        id: 'cue-graphite',
        optionId: 'graphite-aurora',
        name: 'Graphite Aurora',
        price: 1700,
        description: 'Midnight graphite accented with aurora tones.',
        category: 'cueStyles'
      }
    ]
  }
];

function Section({ section, unlocks, onPurchase }) {
  return (
    <div className="w-full rounded-2xl border border-emerald-400/30 bg-black/70 p-4 text-white shadow-[0_16px_32px_rgba(0,0,0,0.45)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-wide">{section.title}</h3>
          <p className="text-sm text-white/70">{section.blurb}</p>
        </div>
        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
          Pool Royale
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {section.items.map((item) => {
          const owned = hasPoolRoyaleUnlock(unlocks, item.category, item.optionId);
          return (
            <div
              key={item.id}
              className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-white/70">{item.description}</p>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold tracking-wide">
                  {item.price} TON
                </span>
              </div>
              <button
                type="button"
                onClick={() => onPurchase(item)}
                disabled={owned}
                className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                  owned
                    ? 'cursor-not-allowed border border-white/20 bg-white/10 text-white/60'
                    : 'border border-emerald-300 bg-emerald-400/80 text-black hover:bg-emerald-300'
                }`}
              >
                {owned ? 'Owned (NFT)' : 'Mint & Unlock'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Store() {
  useTelegramBackButton();
  const [unlocks, setUnlocks] = useState(() => loadPoolRoyaleUnlocks());
  const [message, setMessage] = useState('');

  useEffect(() => {
    savePoolRoyaleUnlocks(unlocks);
  }, [unlocks]);

  const poolRoyaleSections = useMemo(() => POOL_ROYALE_SECTIONS, []);

  const handlePurchase = (item) => {
    setUnlocks((prev) => {
      const alreadyOwned = hasPoolRoyaleUnlock(prev, item.category, item.optionId);
      const next = grantPoolRoyaleUnlock(prev, item.category, item.optionId);
      setMessage(alreadyOwned ? `${item.name} is already in your locker.` : `${item.name} unlocked for Pool Royale.`);
      return next;
    });
  };

  return (
    <div className="relative p-4 text-text flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-4">
        <div className="rounded-2xl border border-emerald-400/40 bg-black/80 p-4 text-white shadow-[0_16px_32px_rgba(0,0,0,0.45)] backdrop-blur">
          <h2 className="text-xl font-bold">Pool Royale Custom Shop</h2>
          <p className="text-sm text-white/70">
            Default loadout ships with Charred Timber, Gold chrome & diamonds, Tour Green cloth, and the Birch Frost cue. Mint NFTs here to unlock extra looks in the in-game setup menu once they hit your account.
          </p>
          {message ? <p className="mt-2 text-sm text-emerald-200">{message}</p> : null}
        </div>

        <div className="space-y-4">
          {poolRoyaleSections.map((section) => (
            <Section key={section.id} section={section} unlocks={unlocks} onPurchase={handlePurchase} />
          ))}
        </div>
      </div>
    </div>
  );
}
