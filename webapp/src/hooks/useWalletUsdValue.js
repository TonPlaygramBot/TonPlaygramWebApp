import { useEffect, useState } from 'react';

export default function useWalletUsdValue(tonBalance, tpcWalletBalance) {
  const [usdValue, setUsdValue] = useState(null);

  const TPC_ADDRESS = 'EQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X';

  useEffect(() => {
    async function load() {
      if (tonBalance == null && tpcWalletBalance == null) {
        setUsdValue(null);
        return;
      }

      let tonPrice = 0;
      try {
        const res = await fetch(
          'https://tonapi.io/v2/rates?tokens=TON&currencies=USD'
        );
        const data = await res.json();
        tonPrice = data?.rates?.TON?.prices?.USD ?? 0;
      } catch (err) {
        console.error('Failed to load TON price from tonapi:', err);
      }

      if (!tonPrice) {
        try {
          const res = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd'
          );
          const data = await res.json();
          tonPrice = data?.['the-open-network']?.usd ?? 0;
        } catch (err) {
          console.error('Failed to load TON price from coingecko:', err);
        }
      }

      let tpcPrice = 0;
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
          const rate = tpcReserve / tonReserve; // TPC per TON
          if (rate) tpcPrice = tonPrice / rate; // USD per TPC
        }
      } catch (err) {
        console.error('Failed to load TPC price from dedust:', err);
      }

      const total =
        (tonBalance ?? 0) * tonPrice + (tpcWalletBalance ?? 0) * tpcPrice;
      setUsdValue(total);
    }
    load();
  }, [tonBalance, tpcWalletBalance]);

  return usdValue;
}
