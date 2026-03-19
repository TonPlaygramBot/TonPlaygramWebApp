const DICE_ROLL_SOUND_URL = '/assets/sounds/u_qpfzpydtro-dice-142528.mp3'

export const DICE_SFX_PRESETS = Object.freeze([
  { id: 'classic-wood', label: 'Classic Wood' },
  { id: 'marble-rattle', label: 'Marble Rattle' },
  { id: 'metallic-clack', label: 'Metallic Clack' },
  { id: 'soft-felt', label: 'Soft Felt' },
  { id: 'arcade-pop', label: 'Arcade Pop' }
])

export function createDiceRollAudio ({ muted = false, presetId = 'classic-wood' } = {}) {
  void presetId
  const audio = typeof Audio !== 'undefined' ? new Audio(DICE_ROLL_SOUND_URL) : null
  if (audio) {
    audio.preload = 'auto'
    audio.volume = 1
  }
  return {
    muted,
    volume: 1,
    currentTime: 0,
    pause () {
      audio?.pause()
    },
    play () {
      if (this.muted) return Promise.resolve()
      if (!audio) return Promise.resolve()
      audio.volume = Math.max(0, Math.min(1, this.volume))
      audio.currentTime = 0
      return audio.play().catch(() => {})
    }
  }
}
