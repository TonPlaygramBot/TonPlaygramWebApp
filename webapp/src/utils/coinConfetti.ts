export default function coinConfetti(count: number = 50) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '60';
  container.style.overflow = 'visible';
  document.body.appendChild(container);

  for (let i = 0; i < count; i++) {
    const img = document.createElement('img');
    img.src = '/assets/icons/TPCcoin_1.webp';
    img.alt = 'TPC Coin';
    img.className = 'coin-confetti';
    const left = Math.random() * 100;
    const delay = Math.random() * 0.2;
    const duration = 2 + Math.random() * 2;
    img.style.left = left + 'vw';
    img.style.animationDelay = delay + 's';
    img.style.setProperty('--duration', duration + 's');
    container.appendChild(img);
  }

  setTimeout(() => {
    container.remove();
  }, 5000);
}

