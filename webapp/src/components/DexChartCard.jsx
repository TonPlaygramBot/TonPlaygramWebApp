import React from 'react';

export default function DexChartCard() {
  return (
    <div id="dexscreener-embed" className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
      <iframe
        src="https://dexscreener.com/ton/eqbq51t0oo_ikuqvs2b0-mqaxns_uz3dest-zjmqc7xyw0ix?embed=1&loadChartSettings=0&tabs=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=light&chartStyle=0&chartType=usd&interval=15"
        title="DexScreener"
      />
    </div>
  );
}
