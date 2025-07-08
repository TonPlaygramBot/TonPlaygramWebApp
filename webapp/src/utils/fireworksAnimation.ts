export default function fireworksAnimation(duration = 5000) {
  const container = document.createElement('div');
  container.className = 'fireworks-container';
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  const createBurst = (x: number, y: number) => {
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement('div');
      particle.className = 'firework-particle';
      const angle = Math.random() * Math.PI * 2;
      const distance = 40 + Math.random() * 40;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.setProperty('--translate', `translate(${tx}px, ${ty}px)`);
      particle.style.backgroundColor = `hsl(${Math.random() * 360},100%,65%)`;
      container.appendChild(particle);
    }
  };

  for (let i = 0; i < 5; i++) {
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * window.innerHeight * 0.5 + window.innerHeight * 0.25;
    setTimeout(() => createBurst(x, y), Math.random() * (duration - 1000));
  }

  setTimeout(() => container.remove(), duration);
}
