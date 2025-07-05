import React from 'react';

interface CoinBurstProps {
  token?: string;
}

export default function CoinBurst({ token = 'TPC' }: CoinBurstProps) {
  const coins = Array.from({ length: 30 }, () => ({
    dx: (Math.random() - 0.5) * 100,
    delay: Math.random() * 0.3,
    dur: 0.8 + Math.random() * 0.4,
  }));
  const src =
    token.toUpperCase() === 'TPC'
      ? '/assets/icons/TPCcoin.png'
      : `/icons/${token.toLowerCase()}.svg`;
  return (
    <div className="coin-burst">
      {coins.map((c, i) => (
        <img
          loading="lazy"
          key={i}
          src={src}
          className="coin-img"
          style={{
            '--dx': `${c.dx}px`,
            '--delay': `${c.delay}s`,
            '--dur': `${c.dur}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
