import { useEffect, useState } from 'react';

export default function useWalletUsdValue(tonBalance, usdtBalance) {
  const [usdValue, setUsdValue] = useState(null);

  useEffect(() => {
    async function load() {
      if (tonBalance == null && usdtBalance == null) {
        setUsdValue(null);
        return;
      }
      try {
        const res = await fetch('https://tonapi.io/v2/rates?tokens=TON&currencies=usd');
        const data = await res.json();
        const tonPrice = data?.rates?.TON?.prices?.USD ?? 0;
        const total = (tonBalance ?? 0) * tonPrice + (usdtBalance ?? 0);
        setUsdValue(total);
      } catch (err) {
        console.error('Failed to load TON price:', err);
      }
    }
    load();
  }, [tonBalance, usdtBalance]);

  return usdValue;
}
