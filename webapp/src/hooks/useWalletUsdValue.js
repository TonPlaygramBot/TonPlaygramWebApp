import { useEffect, useState } from 'react';

export default function useWalletUsdValue(tonBalance, usdtBalance) {
  const [usdValue, setUsdValue] = useState(null);

  useEffect(() => {
    async function load() {
      if (tonBalance == null && usdtBalance == null) {
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

      const total = (tonBalance ?? 0) * tonPrice + (usdtBalance ?? 0);
      setUsdValue(total);
    }
    load();
  }, [tonBalance, usdtBalance]);

  return usdValue;
}
