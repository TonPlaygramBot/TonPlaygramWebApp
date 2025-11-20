import { startTirana2040 } from './tirana-2040-main.js';

function displayBootstrapError(err) {
  console.error('Tirana 2040 failed during bootstrap import', err);
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = 'Tirana 2040 • Failed to load';
  }
}

function boot() {
  startTirana2040().catch(displayBootstrapError);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(boot));
} else {
  requestAnimationFrame(boot);
}
