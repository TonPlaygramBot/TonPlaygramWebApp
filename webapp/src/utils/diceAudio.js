import { diceSound } from '../assets/soundData.js'
import { getGameVolume } from './sound.js'

export function createDiceRollAudio ({ muted = false } = {}) {
  const audio = new Audio(diceSound)
  audio.preload = 'auto'
  audio.muted = muted
  audio.volume = getGameVolume()
  return audio
}

export function syncDiceRollAudioVolume (audio, { fixedVolume = null } = {}) {
  if (!audio) return
  if (typeof fixedVolume === 'number' && Number.isFinite(fixedVolume)) {
    audio.volume = Math.max(0, Math.min(1, fixedVolume))
    return
  }
  audio.volume = getGameVolume()
}
