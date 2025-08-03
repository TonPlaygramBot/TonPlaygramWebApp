import React from 'react';

export default function DexChartCard() {
  return (
    <div
      id="dexscreener-embed"
      className="relative bg-surface border border-border rounded-xl overflow-hidden wide-card"
    >
      <iframe
        src="https://dexscreener.com/ton/EQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X?embed=1&loadChartSettings=0&trades=0&tabs=0&info=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=1&chartType=usd&interval=15"
        title="DexScreener"
      />
    </div>
  );
}
