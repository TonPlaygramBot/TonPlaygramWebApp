let gameMuted = localStorage.getItem('gameMuted') === 'true';

export function isGameMuted() {
  return gameMuted;
}

export function setGameMuted(val) {
  gameMuted = val;
  try {
    localStorage.setItem('gameMuted', val ? 'true' : 'false');
  } catch (err) {}
  window.dispatchEvent(new Event('gameMuteChanged'));
}

export function toggleGameMuted() {
  setGameMuted(!gameMuted);
}
