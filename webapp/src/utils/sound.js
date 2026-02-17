let gameMuted = localStorage.getItem('gameMuted') === 'true';
let gameVolume = parseFloat(localStorage.getItem('gameVolume') || '1');

export function isGameMuted() {
  return gameMuted;
}

export function getGameVolume() {
  return gameVolume;
}

export function setGameMuted(val) {
  gameMuted = val;
  try {
    localStorage.setItem('gameMuted', val ? 'true' : 'false');
  } catch (err) {}
  window.dispatchEvent(new Event('gameMuteChanged'));
}

export function setGameVolume(val) {
  gameVolume = val;
  try {
    localStorage.setItem('gameVolume', String(val));
  } catch (err) {}
  window.dispatchEvent(new Event('gameVolumeChanged'));
}

export function toggleGameMuted() {
  setGameMuted(!gameMuted);
}

export function toggleGameVolume() {
  setGameVolume(gameVolume === 0 ? 1 : 0);
}
