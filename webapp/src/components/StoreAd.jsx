import { useEffect, useState } from 'react';
import { AiOutlineShop } from 'react-icons/ai';

const TPC_ADDRESS = 'EQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X';

export default function StoreAd() {
  const [tpcPerTon, setTpcPerTon] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('https://api.dedust.io/v2/pools-lite');
        const pools = await res.json();
        const pool = pools.find(
          (p) =>
            p.assets.includes('native') &&
            p.assets.includes(`jetton:${TPC_ADDRESS}`)
        );
        if (pool) {
          const [tonReserve, tpcReserve] = pool.reserves.map((r) => Number(r));
          const rate = tpcReserve / tonReserve;
          if (!isNaN(rate)) setTpcPerTon(rate);
        }
      } catch (err) {
        console.error('Failed to load TPC price:', err);
      }
    }
    load();
  }, []);

  const formatPrice = (v) =>
    v != null
      ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })
      : '...';

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <div className="flex items-center justify-center space-x-1">
        <AiOutlineShop className="text-accent" />
        <span className="text-lg font-bold">Buy TPC</span>
      </div>
      {tpcPerTon != null && (
        <div className="text-center text-sm flex items-center justify-center gap-1">
          <span>1</span>
          <img src="/assets/icons/TON.webp" alt="TON" className="w-4 h-4" />
          <span>= {formatPrice(tpcPerTon)}</span>
          <img
            src="/assets/icons/eab316f3-7625-42b2-9468-d421f81c4d7c.webp"
            alt="TPC"
            className="w-4 h-4"
          />
        </div>
      )}
      <div className="text-center text-sm">Buy TPC on DeDust</div>
      <a
        href="https://app.tonkeeper.com/dapp/https%3A%2F%2Fdedust.io%2Fswap%2FTON%2FEQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-auto block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
      >
        Buy TPC
      </a>
    </div>
  );
}
