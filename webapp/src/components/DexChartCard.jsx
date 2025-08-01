import React from 'react';

export default function DexChartCard() {
  return (
    <div
      id="dexscreener-embed"
      className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card"
    >
      <iframe
        src="https://dexscreener.com/ton/EQBQ51T0Oo_iKUQvs2B0-MqAxnS_UZ3DEST-zJmQC7XYw0ix?embed=1&loadChartSettings=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"
        title="DexScreener"
      />
    </div>
  );
}
