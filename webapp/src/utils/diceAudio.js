import { diceSound } from '../assets/soundData.js'
import { getGameVolume } from './sound.js'

const LEGACY_DICE_ROLL_SOUND = '/assets/sounds/2FilesMerged_20250717_131957.mp3'

export function createDiceRollAudio ({ muted = false } = {}) {
  const audio = new Audio(LEGACY_DICE_ROLL_SOUND)
  audio.preload = 'auto'
  audio.muted = muted
  audio.volume = getGameVolume()
  audio.addEventListener('error', () => {
    if (audio.src !== diceSound) {
      audio.src = diceSound
      audio.load()
    }
  }, { once: true })
  return audio
}
