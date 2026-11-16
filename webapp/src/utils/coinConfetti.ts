const COIN_ICON = '/assets/icons/file_00000000362481f7978631c42572193f.png';

export default function coinConfetti(count = 32, iconSrc = COIN_ICON) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const container = document.createElement('div');
  container.className = 'coin-confetti-layer';
  container.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < count; i++) {
    const img = document.createElement('img');
    img.src = iconSrc;
    img.alt = '';
    img.className = 'coin-confetti';

    const depth = Math.random();
    const duration = 0.95 + (1 - depth) * 0.55;
    const delay = i < 6 ? 0 : Math.random() * 0.27;
    const direction = Math.random() < 0.5 ? -1 : 1;
    img.style.left = `${3 + Math.random() * 90}%`;
    img.style.setProperty('--size', `${14 + depth * 20}px`);
    img.style.setProperty('--duration', `${duration}s`);
    img.style.setProperty('--delay', `${delay}s`);
    img.style.setProperty('--drift', `${direction * (8 + Math.random() * 20)}px`);
    img.style.setProperty('--tilt', `${direction * (45 + Math.random() * 105)}deg`);
    img.style.setProperty('--tumble', `${direction * (480 + Math.random() * 620)}deg`);
    container.appendChild(img);
  }

  document.body.appendChild(container);
  const timeout = window.setTimeout(() => container.remove(), 1900);
  return () => {
    window.clearTimeout(timeout);
    container.remove();
  };
}
