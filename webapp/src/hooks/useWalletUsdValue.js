import { useEffect, useState } from 'react';

export default function useWalletUsdValue(tonBalance) {
  const [usdValue, setUsdValue] = useState(null);

  // TON-only estimate. The retired token has no supported TPG valuation.

  useEffect(() => {
    async function load() {
      if (tonBalance == null) {
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

      const total = tonBalance * tonPrice;
      setUsdValue(total);
    }
    load();
  }, [tonBalance]);

  return usdValue;
}
