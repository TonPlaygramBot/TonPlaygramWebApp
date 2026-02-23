import { diceSound } from '../assets/soundData.js'
import { getGameVolume } from './sound.js'

export function createDiceRollAudio ({ muted = false } = {}) {
  const audio = new Audio(diceSound)
  audio.preload = 'auto'
  audio.muted = muted
  audio.volume = getGameVolume()
  return audio
}
