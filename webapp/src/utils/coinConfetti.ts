export default function coinConfetti(count: number = 50, iconSrc: string = '/assets/icons/file_000000005f0c61f48998df883554c3e8 (2).webp') {
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
    img.src = iconSrc;
    img.alt = 'confetti icon';
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

