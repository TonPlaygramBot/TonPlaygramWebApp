const clampVolume = (value) => {
  if (!Number.isFinite(value)) return 1
  return Math.max(0, Math.min(1, value))
}

const readStorage = (key) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

let gameMuted = readStorage('gameMuted') === 'true'
let gameVolume = clampVolume(parseFloat(readStorage('gameVolume') ?? '1'))

export function isGameMuted () {
  return gameMuted
}

export function getGameVolume () {
  return clampVolume(gameVolume)
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
