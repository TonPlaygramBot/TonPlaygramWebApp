const DEFAULT_GAME_VOLUME = 1

function clampVolume (value) {
  if (!Number.isFinite(value)) return DEFAULT_GAME_VOLUME
  return Math.min(1, Math.max(0, value))
}

function readStoredGameMuted () {
  try {
    return localStorage.getItem('gameMuted') === 'true'
  } catch (err) {
    return false
  }
}

function readStoredGameVolume () {
  try {
    const raw = localStorage.getItem('gameVolume')
    if (raw == null || raw === '') return DEFAULT_GAME_VOLUME
    return clampVolume(parseFloat(raw))
  } catch (err) {
    return DEFAULT_GAME_VOLUME
  }
}

let gameMuted = readStoredGameMuted()
let gameVolume = readStoredGameVolume()

export function isGameMuted () {
  return gameMuted
}

export function getGameVolume () {
  return gameVolume
}

export function setGameMuted (val) {
  gameMuted = val
  try {
    localStorage.setItem('gameMuted', val ? 'true' : 'false')
  } catch (err) {}
  window.dispatchEvent(new Event('gameMuteChanged'))
}

export function setGameVolume (val) {
  gameVolume = clampVolume(Number(val))
  try {
    localStorage.setItem('gameVolume', String(gameVolume))
  } catch (err) {}
  window.dispatchEvent(new Event('gameVolumeChanged'))
}

export function toggleGameMuted () {
  setGameMuted(!gameMuted)
}

export function toggleGameVolume () {
  setGameVolume(gameVolume === 0 ? 1 : 0)
}
