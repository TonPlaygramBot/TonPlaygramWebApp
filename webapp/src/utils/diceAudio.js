import { diceSound } from '../assets/soundData.js'
import { getGameVolume } from './sound.js'

export const DICE_ROLL_FALLBACK_SRC = '/assets/sounds/2FilesMerged_20250717_131957.mp3'

export function createDiceRollAudio ({ muted = false } = {}) {
  const audio = new Audio(diceSound)
  audio.preload = 'auto'
  audio.muted = muted
  audio.volume = getGameVolume()
  audio.__fallbackSrc = DICE_ROLL_FALLBACK_SRC
  audio.__fallbackApplied = false
  return audio
}
