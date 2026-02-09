import { safeGetItem, safeSetItem } from './storage.js';

let gameMuted = safeGetItem('gameMuted') === 'true';
let gameVolume = parseFloat(safeGetItem('gameVolume') || '1');

export function isGameMuted() {
  return gameMuted;
}

export function getGameVolume() {
  return gameVolume;
}

export function setGameMuted(val) {
  gameMuted = val;
  safeSetItem('gameMuted', val ? 'true' : 'false');
  window.dispatchEvent(new Event('gameMuteChanged'));
}

export function setGameVolume(val) {
  gameVolume = val;
  safeSetItem('gameVolume', String(val));
  window.dispatchEvent(new Event('gameVolumeChanged'));
}

export function toggleGameMuted() {
  setGameMuted(!gameMuted);
}

export function toggleGameVolume() {
  setGameVolume(gameVolume === 0 ? 1 : 0);
}
