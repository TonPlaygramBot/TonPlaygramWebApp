import { useEffect, useRef } from 'react';

export default function MiningAnimation() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const interval = setInterval(() => {
      const coin = document.createElement('div');
      coin.className = 'coin';
      coin.textContent = '🪙';
      coin.style.left = `${10 + Math.random() * 80}%`;
      container.appendChild(coin);
      coin.addEventListener('animationend', () => {
        coin.remove();
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mining-animation" ref={containerRef}>
      <div className="miner" aria-label="miner" role="img">
        🧑‍🏭
      </div>
      <div className="ground" />
    </div>
  );
}
